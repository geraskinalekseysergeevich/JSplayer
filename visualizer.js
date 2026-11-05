// Визуализация: canvas на весь экран за карточкой плеера.
// Режимы: bars, wave, radial, sparks. Цвета берутся из обложки трека.
window.JSP = window.JSP || {}

;(function (JSP) {
    const DEFAULT_PALETTE = { sky: [100, 32, 32], ground: [211, 61, 52], accent: [255, 138, 120] }
    const MODES = ['bars', 'wave', 'radial', 'sparks']
    const BARS = 72

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
    const lerp = (a, b, t) => a + (b - a) * t
    const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360
        const k = n => (n + h / 30) % 12
        const a = s * Math.min(l, 1 - l)
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
        return [f(0) * 255, f(8) * 255, f(4) * 255]
    }

    function paletteFromHue(h, s) {
        return {
            sky: hslToRgb(h, s * 0.85, 0.25),
            ground: hslToRgb(h, s, 0.52),
            accent: hslToRgb(h, clamp(s + 0.1, 0, 1), 0.72)
        }
    }

    // Доминирующий оттенок обложки (взвешено по насыщенности и яркости).
    // null, если картинку не удалось прочитать (например, нет CORS).
    JSP.paletteFromImage = function (url) {
        return new Promise(resolve => {
            if (!url) return resolve(null)
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                try {
                    const c = document.createElement('canvas')
                    c.width = c.height = 32
                    const x = c.getContext('2d')
                    x.drawImage(img, 0, 0, 32, 32)
                    const px = x.getImageData(0, 0, 32, 32).data
                    const buckets = Array.from({ length: 24 }, () => ({ w: 0, sat: 0, n: 0 }))
                    let gray = 0
                    for (let i = 0; i < px.length; i += 4) {
                        const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255
                        const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
                        if (max < 0.15) continue
                        const sat = max === 0 ? 0 : d / max
                        if (sat < 0.2) { gray++; continue }
                        let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
                        h = ((h * 60) + 360) % 360
                        const bk = buckets[Math.floor(h / 15)]
                        bk.w += sat * max
                        bk.sat += sat
                        bk.n++
                        bk.h = (bk.h || 0) + h
                    }
                    const best = buckets.reduce((a, b) => (b.w > a.w ? b : a))
                    if (best.n < 6) return resolve(paletteFromHue(220, gray > 100 ? 0.06 : 0.3))
                    resolve(paletteFromHue(best.h / best.n, clamp(best.sat / best.n, 0.4, 0.78)))
                } catch (e) {
                    resolve(null)
                }
            }
            img.onerror = () => resolve(null)
            img.src = url
        })
    }

    class Visualizer {
        constructor(canvas, getLayout) {
            this.canvas = canvas
            this.ctx = canvas.getContext('2d')
            this.getLayout = getLayout // () => { horizon, cx, cy, cardRadius, cardHalfW }
            this.mode = 'bars'
            this.analyser = null
            this.playing = false
                        this.target = DEFAULT_PALETTE
            this.pal = { sky: [...DEFAULT_PALETTE.sky], ground: [...DEFAULT_PALETTE.ground], accent: [...DEFAULT_PALETTE.accent] }
            this.bars = new Float32Array(BARS)
            this.peaks = new Float32Array(BARS)
            this.particles = []
            this.beat = 0
            this.bassAvg = 0
            this.lastBeat = 0
            this.rot = 0
            this.resize = this.resize.bind(this)
            this.frame = this.frame.bind(this)
            window.addEventListener('resize', this.resize)
            this.resize()
            requestAnimationFrame(this.frame)
        }

        setAnalyser(a) {
            this.analyser = a
            this.freq = new Uint8Array(a.frequencyBinCount)
            this.wave = new Uint8Array(a.fftSize)
        }
        setPlaying(v) { this.playing = v }
        setMode(m) { if (MODES.includes(m)) this.mode = m }
        setPalette(p) { this.target = p || DEFAULT_PALETTE }

        resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            this.w = window.innerWidth
            this.h = window.innerHeight
            this.canvas.width = this.w * dpr
            this.canvas.height = this.h * dpr
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        // Обновляем данные: сглаженные столбики, пики, бас и бит
        analyse(ts) {
            const live = this.analyser && this.playing
            if (live) {
                this.analyser.getByteFrequencyData(this.freq)
                this.analyser.getByteTimeDomainData(this.wave)
            }
            const maxBin = Math.min(this.freq ? this.freq.length : 0, 640)
            for (let i = 0; i < BARS; i++) {
                let t = 0
                if (live) {
                    // логарифмическая раскладка: больше столбиков на басах
                    const a = Math.floor(Math.pow(i / BARS, 1.7) * maxBin)
                    const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / BARS, 1.7) * maxBin))
                    let s = 0
                    for (let k = a; k < b; k++) s += this.freq[k]
                    t = Math.pow(s / (b - a) / 255, 1.25)
                    t *= 0.85 + (i / BARS) * 0.5 // высокие частоты тише, подтягиваем
                } else {
                    t = 0.035 + 0.03 * Math.sin(ts / 650 + i * 0.4)
                }
                t = clamp(t, 0, 1)
                this.bars[i] += (t - this.bars[i]) * (t > this.bars[i] ? 0.55 : 0.12)
                this.peaks[i] = Math.max(this.bars[i], this.peaks[i] - 0.006)
            }
            // бит: резкий скачок баса относительно скользящего среднего
            let bass = 0
            if (live) {
                for (let i = 1; i < 7; i++) bass += this.freq[i]
                bass /= 6 * 255
            }
            this.bassAvg += (bass - this.bassAvg) * 0.04
            if (bass > this.bassAvg * 1.25 && bass > 0.45 && ts - this.lastBeat > 180) {
                this.beat = 1
                this.lastBeat = ts
                this.emit(10 + Math.round(bass * 14))
            }
            this.beat *= 0.9
            this.bass = bass
        }

        // всплеск частиц на бит (режим sparks)
        emit(n) {
            if (this.mode !== 'sparks') return
            const { horizon } = this.getLayout()
            for (let i = 0; i < n && this.particles.length < 700; i++) {
                this.particles.push({
                    x: Math.random() * this.w,
                    y: horizon,
                    vx: (Math.random() - 0.5) * 2.4,
                    vy: -(4 + Math.random() * 8),
                    life: 1,
                    decay: 0.008 + Math.random() * 0.01,
                    size: 2 + Math.random() * 4
                })
            }
        }

        frame(ts) {
            requestAnimationFrame(this.frame)
            if (document.hidden) return
            // плавный переход к палитре трека
            const target = this.target
            for (const k of ['sky', 'ground', 'accent']) {
                for (let i = 0; i < 3; i++) this.pal[k][i] = lerp(this.pal[k][i], target[k][i], 0.05)
            }
            this.analyse(ts)
            const L = this.getLayout()
            const c = this.ctx
            const { w, h } = this
            const { sky, ground, accent } = this.pal

            c.clearRect(0, 0, w, h)
            c.fillStyle = rgb(sky)
            c.fillRect(0, 0, w, h)
            c.fillStyle = rgb(ground)
            c.fillRect(0, L.horizon, w, h - L.horizon)

            // пульсация фона на бит
            if (this.beat > 0.02) {
                const g = c.createRadialGradient(w / 2, L.horizon, 0, w / 2, L.horizon, w * 0.6)
                g.addColorStop(0, rgb(accent, this.beat * 0.28))
                g.addColorStop(1, rgb(accent, 0))
                c.fillStyle = g
                c.fillRect(0, 0, w, h)
            }

            if (this.mode === 'wave') this.drawWave(c, L, ts)
            else if (this.mode === 'radial') this.drawRadial(c, L)
            else if (this.mode === 'sparks') this.drawSparks(c, L)
            else this.drawBars(c, L)
        }

        drawBars(c, L) {
            const { w } = this
            const { ground, accent } = this.pal
            // столбики начинаются у края карточки, чтобы басы не прятались под ней
            const half = w / 2
            const inner = L.cardHalfW
            const bw = (half - inner) / BARS
            const maxH = L.horizon * 0.82
            for (let i = 0; i < BARS; i++) {
                const bh = this.bars[i] * maxH
                const ph = this.peaks[i] * maxH
                const gap = Math.min(2, bw * 0.2)
                for (const side of [-1, 1]) {
                    const x = side === 1 ? half + inner + i * bw : half - inner - (i + 1) * bw
                    // столбик растёт вверх от линии горизонта
                    c.fillStyle = rgb(ground)
                    c.fillRect(x, L.horizon - bh, bw - gap, bh)
                    // отражение в «земле»
                    const rg = c.createLinearGradient(0, L.horizon, 0, L.horizon + bh * 0.45)
                    rg.addColorStop(0, rgb(accent, 0.22))
                    rg.addColorStop(1, rgb(accent, 0))
                    c.fillStyle = rg
                    c.fillRect(x, L.horizon, bw - gap, bh * 0.45)
                    // «падающая» вершина
                    c.fillStyle = rgb(accent, 0.9)
                    c.fillRect(x, L.horizon - ph - 3, bw - gap, 2.5)
                }
            }
        }

        // Wave: три плавные волны, амплитуда каждой зависит от своей полосы частот (бас, середина, верх)
        drawWave(c, L, ts) {
            const { w } = this
            const { accent, ground } = this.pal
            const avg = (a, b) => {
                let s = 0
                for (let i = a; i < b; i++) s += this.bars[i]
                return s / (b - a)
            }
            const bands = [avg(0, 14), avg(14, 40), avg(40, BARS)]
            const layers = [
                { band: bands[0], freq: 0.0042, speed: 0.0011, amp: 1.0, alpha: 0.9 },
                { band: bands[1], freq: 0.0075, speed: -0.0016, amp: 0.7, alpha: 0.6 },
                { band: bands[2], freq: 0.0125, speed: 0.0023, amp: 0.45, alpha: 0.4 }
            ]
            const maxAmp = L.horizon * 0.5
            const step = 6
            c.save()
            c.globalCompositeOperation = 'lighter'
            for (const l of layers) {
                const A = (0.04 + l.band * 1.4) * maxAmp * l.amp
                const top = [], bot = []
                for (let x = 0; x <= w + step; x += step) {
                    const env = Math.pow(Math.sin(Math.min(1, x / w) * Math.PI), 0.8) // затухание к краям
                    const y = Math.sin(x * l.freq + ts * l.speed) * A * env
                    top.push([x, L.horizon - y])
                    bot.push([x, L.horizon + y])
                }
                // лента между волной и её отражением
                c.beginPath()
                top.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)))
                for (let k = bot.length - 1; k >= 0; k--) c.lineTo(bot[k][0], bot[k][1])
                c.closePath()
                c.fillStyle = rgb(accent, l.alpha * 0.16)
                c.fill()
                // контур с свечением
                c.shadowColor = rgb(accent, 0.8)
                c.shadowBlur = 14
                c.lineWidth = 2
                c.strokeStyle = rgb(accent, l.alpha)
                c.beginPath()
                top.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)))
                c.stroke()
                c.beginPath()
                bot.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)))
                c.stroke()
                c.shadowBlur = 0
            }
            c.restore()
        }

        // Radial: симметричное кольцо вокруг карточки, растёт от центра-низа к верху
        drawRadial(c, L) {
            const { accent } = this.pal
            const R = L.cardRadius + 24
            const count = BARS * 2
            c.save()
            c.translate(L.cx, L.cy)
            // тонкое кольцо, пульсирует на бит
            c.beginPath()
            c.arc(0, 0, R - 8 + this.beat * 12, 0, Math.PI * 2)
            c.strokeStyle = rgb(accent, 0.3 + this.beat * 0.5)
            c.lineWidth = 2
            c.stroke()
            c.lineCap = 'round'
            c.lineWidth = Math.max(3, (Math.PI * 2 * R) / count - 4)
            const maxLen = Math.min(190, Math.max(60, (Math.min(this.h, this.w) / 2 - R) + 90))
            for (let i = 0; i < count; i++) {
                // басы внизу, высокие вверху; левая и правая половины зеркальны
                const half = i < BARS ? i : count - 1 - i
                const k = BARS - 1 - half
                const len = 5 + this.bars[k] * maxLen
                const a = Math.PI / 2 + ((i + 0.5) / count) * Math.PI * 2 // старт снизу
                const ca = Math.cos(a), sa = Math.sin(a)
                c.strokeStyle = rgb(accent, 0.55 + this.bars[k] * 0.45)
                c.beginPath()
                c.moveTo(ca * R, sa * R)
                c.lineTo(ca * (R + len), sa * (R + len))
                c.stroke()
            }
            c.restore()
        }

        // Sparks: без столбиков, фонтан искр; высота и частота зависят от силы каждой частоты
        drawSparks(c, L) {
            const { accent, ground } = this.pal
            const half = this.w / 2
            const inner = L.cardHalfW
            const bw = (half - inner) / BARS
            // мягкое свечение горизонта
            const g = c.createLinearGradient(0, L.horizon - 60, 0, L.horizon + 30)
            g.addColorStop(0, rgb(accent, 0))
            g.addColorStop(0.7, rgb(accent, 0.25 + this.beat * 0.3))
            g.addColorStop(1, rgb(accent, 0))
            c.fillStyle = g
            c.fillRect(0, L.horizon - 60, this.w, 90)

            if (this.playing && this.particles.length < 700) {
                for (let i = 0; i < BARS; i++) {
                    const v = this.bars[i]
                    if (v < 0.2 || Math.random() > v * v * 0.2) continue
                    const side = Math.random() < 0.5 ? -1 : 1
                    this.particles.push({
                        x: half + side * (inner + (i + Math.random()) * bw),
                        y: L.horizon,
                        vx: (Math.random() - 0.5) * 5,
                        vy: -(3 + v * 12 * (0.6 + Math.random() * 0.6)),
                        life: 1,
                        decay: 0.006 + Math.random() * 0.01,
                        size: 3 + v * 5
                    })
                }
            }
            c.save()
            c.globalCompositeOperation = 'lighter'
            this.particles = this.particles.filter(p => p.life > 0 && p.y < this.h + 40)
            for (const p of this.particles) {
                p.x += p.vx
                p.y += p.vy
                p.vy += 0.12 // гравитация: искры летят дугой и падают
                p.life -= p.decay
                const a = clamp(p.life, 0, 1)
                // светящаяся точка с коротким хвостом
                c.fillStyle = rgb(accent, a)
                c.shadowColor = rgb(accent, 0.9)
                c.shadowBlur = 10
                c.beginPath()
                c.arc(p.x, p.y, p.size * (0.3 + a * 0.7), 0, Math.PI * 2)
                c.fill()
            }
            c.shadowBlur = 0
            c.restore()
        }
    }

    JSP.Visualizer = Visualizer
    JSP.MODES = MODES
})(window.JSP)
