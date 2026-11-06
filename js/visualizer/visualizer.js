// Холст на весь экран за карточкой плеера. Читает спектр из Web Audio, сглаживает его,
// определяет бит и отдаёт рисование выбранному режиму (см. modes/).
import { BAR_COUNT } from './constants.js'
import { clamp, lerp, rgba } from './colors.js'
import { DEFAULT_PALETTE } from './palette.js'
import { modes } from './modes/index.js'

const MAX_BIN = 640 // выше ~13 кГц спектр почти пуст, не берём
const BAND_CURVE = 1.7 // >1 отдаёт больше полос басам (логарифмическая шкала)
const PALETTE_EASING = 0.05 // скорость перехода к палитре нового трека
const BEAT_COOLDOWN_MS = 180
const BEAT_MIN_LEVEL = 0.45
const BEAT_RATIO = 1.25 // бас должен быть на 25% громче своего среднего

const clonePalette = p => ({ sky: [...p.sky], ground: [...p.ground], accent: [...p.accent] })

export class Visualizer {
    /** @param {HTMLCanvasElement} canvas
     *  @param {() => {horizon: number, cx: number, cy: number, cardRadius: number, cardHalfW: number}} getLayout */
    constructor(canvas, getLayout) {
        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.getLayout = getLayout

        this.mode = 'bars'
        this.playing = false
        this.analyser = null

        this.palette = clonePalette(DEFAULT_PALETTE) // текущая, плавно догоняет targetPalette
        this.targetPalette = DEFAULT_PALETTE

        this.bars = new Float32Array(BAR_COUNT) // сглаженные уровни 0..1, от басов к верхам
        this.particles = []
        this.beat = 0 // 1 в момент бита, затухает
        this.bassAverage = 0
        this.lastBeatAt = 0

        window.addEventListener('resize', () => this.resize())
        this.resize()
        requestAnimationFrame(time => this.frame(time))
    }

    setAnalyser(analyser) {
        this.analyser = analyser
        this.spectrum = new Uint8Array(analyser.frequencyBinCount)
    }

    setPlaying(playing) { this.playing = playing }

    setMode(mode) { if (mode in modes) this.mode = mode }

    setPalette(palette) { this.targetPalette = palette ?? DEFAULT_PALETTE }

    resize() {
        // Рендерим в 1x даже на Retina: сцена из плавных градиентов и форм не теряет в чёткости,
        // зато заливка экрана в 4 раза дешевле (на 2880x1800 интерфейс заметно тормозил)
        this.width = this.canvas.width = window.innerWidth
        this.height = this.canvas.height = window.innerHeight
    }

    // Обновляет уровни полос, бас и бит
    analyse(time, layout) {
        const live = this.analyser && this.playing
        if (live) this.analyser.getByteFrequencyData(this.spectrum)

        const maxBin = Math.min(this.spectrum?.length ?? 0, MAX_BIN)
        for (let i = 0; i < BAR_COUNT; i++) {
            let target
            if (live) {
                const from = Math.floor(Math.pow(i / BAR_COUNT, BAND_CURVE) * maxBin)
                const to = Math.max(from + 1, Math.floor(Math.pow((i + 1) / BAR_COUNT, BAND_CURVE) * maxBin))
                let sum = 0
                for (let k = from; k < to; k++) sum += this.spectrum[k]
                target = Math.pow(sum / (to - from) / 255, 1.25)
                target *= 0.85 + (i / BAR_COUNT) * 0.5 // высокие частоты тише, подтягиваем
            } else {
                target = 0.035 + 0.03 * Math.sin(time / 650 + i * 0.4) // лёгкое «дыхание» в паузе
            }
            target = clamp(target, 0, 1)
            // быстро растём, медленно падаем
            this.bars[i] += (target - this.bars[i]) * (target > this.bars[i] ? 0.55 : 0.12)
        }

        // бит: резкий скачок баса относительно скользящего среднего
        let bass = 0
        if (live) {
            for (let i = 1; i < 7; i++) bass += this.spectrum[i]
            bass /= 6 * 255
        }
        this.bassAverage += (bass - this.bassAverage) * 0.04
        if (bass > this.bassAverage * BEAT_RATIO && bass > BEAT_MIN_LEVEL && time - this.lastBeatAt > BEAT_COOLDOWN_MS) {
            this.beat = 1
            this.lastBeatAt = time
            modes[this.mode].onBeat?.(this, layout, bass)
        }
        this.beat *= 0.9
    }

    easePalette() {
        for (const key of ['sky', 'ground', 'accent']) {
            this.palette[key] = this.palette[key].map((value, i) => lerp(value, this.targetPalette[key][i], PALETTE_EASING))
        }
    }

    frame(time) {
        requestAnimationFrame(t => this.frame(t))
        if (document.hidden) return

        const layout = this.getLayout()
        this.easePalette()
        this.analyse(time, layout)

        const { ctx, width, height } = this
        const { sky, ground, accent } = this.palette

        ctx.fillStyle = rgba(sky)
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = rgba(ground)
        ctx.fillRect(0, layout.horizon, width, height - layout.horizon)

        // пульсация фона на бит
        if (this.beat > 0.02) {
            const glow = ctx.createRadialGradient(width / 2, layout.horizon, 0, width / 2, layout.horizon, width * 0.6)
            glow.addColorStop(0, rgba(accent, this.beat * 0.28))
            glow.addColorStop(1, rgba(accent, 0))
            ctx.fillStyle = glow
            ctx.fillRect(0, 0, width, height)
        }

        modes[this.mode].draw(this, ctx, layout, time)
    }
}
