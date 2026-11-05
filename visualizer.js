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
            this.useCover = true
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
        setUseCover(v) { this.useCover = v }

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

        emit(n) {
            if (this.mode !== 'sparks') return
            const { horizon } = this.getLayout()
            for (let i = 0; i < n && this.particles.length < 400; i++) {
                this.particles.push({
                    x: Math.random() * this.w,
                    y: horizon,
                    vx: (Math.random() - 0.5) * 1.2,
                    vy: -(1.2 + Math.random() * 3.6),
                    life: 1,
                    decay: 0.006 + Math.random() * 0.014,
                    size: 1.5 + Math.random() * 3.5
                })
            }
        }

        frame(ts) {
            requestAnimationFrame(this.frame)
            if (document.hidden) return
            // плавный переход к палитре трека
            const target = this.useCover ? this.target : DEFAULT_PALETTE
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

            if (this.mode === 'wave') this.drawWave(c, L)
            else if (this.mode === 'radial') this.drawRadial(c, L, ts)
            else this.drawBars(c, L, ts)
            if (this.mode === 'sparks') this.drawParticles(c)
        }

        drawBars(c, L, ts) {
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

        drawWave(c, L) {
            const { w } = this
            const { ground, accent } = this.pal
            const n = this.wave ? this.wave.length : 0
            const baseY = L.horizon - L.horizon * 0.28
            const amp = L.horizon * 0.34
            const step = Math.max(2, Math.floor(w / 220))
            const draw = (scale, alpha, width, blur) => {
                c.beginPath()
                for (let x = 0; x <= w; x += step) {
                    const idx = n ? Math.floor((x / w) * (n - 1)) : 0
                    const v = n && this.playing ? (this.wave[idx] - 128) / 128 : Math.sin(x / 90 + performance.now() / 700) * 0.04
                    const edge = Math.sin((x / w) * Math.PI) // затухание к краям экрана
                    const y = baseY + v * amp * scale * (0.35 + edge)
                    x === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
                }
                c.lineWidth = width
                c.lineJoin = 'round'
                c.strokeStyle = rgb(accent, alpha)
                c.shadowColor = rgb(accent, 0.9)
                c.shadowBlur = blur
                c.stroke()
                c.shadowBlur = 0
            }
            // заливка под линией: плавный переход в «землю»
            const g = c.createLinearGradient(0, baseY - amp, 0, L.horizon)
            g.addColorStop(0, rgb(ground, 0))
            g.addColorStop(1, rgb(ground, 0.65))
            c.fillStyle = g
            c.fillRect(0, baseY - amp, w, L.horizon - baseY + amp)
            draw(1.5, 0.25, 6, 24)
            draw(1, 0.95, 2.5, 16)
        }

        drawRadial(c, L, ts) {
            const { accent, ground } = this.pal
            const R = L.cardRadius + 28
            const count = BARS * 2
            this.rot += 0.0004
            c.save()
            c.translate(L.cx, L.cy)
            // кольцо, пульсирующее на бит
            c.beginPath()
            c.arc(0, 0, R - 10 + this.beat * 14, 0, Math.PI * 2)
            c.strokeStyle = rgb(accent, 0.25 + this.beat * 0.4)
            c.lineWidth = 2
            c.stroke()
            c.rotate(this.rot)
            c.lineCap = 'round'
            c.lineWidth = Math.max(3, (Math.PI * 2 * R) / count - 3)
            for (let i = 0; i < count; i++) {
                const k = i < BARS ? i : count - 1 - i // зеркально
                const len = 6 + this.bars[k] * Math.min(220, this.h * 0.3)
                const a = (i / count) * Math.PI * 2
                const ca = Math.cos(a), sa = Math.sin(a)
                c.strokeStyle = i % 2 ? rgb(accent, 0.95) : rgb(ground, 1)
                c.beginPath()
                c.moveTo(ca * R, sa * R)
                c.lineTo(ca * (R + len), sa * (R + len))
                c.stroke()
            }
            c.restore()
        }

        drawParticles(c) {
            const { accent } = this.pal
            c.save()
            c.globalCompositeOperation = 'lighter'
            // постоянные искры от высоких столбиков
            if (this.playing) {
                const { horizon } = this.getLayout()
                const i = Math.floor(Math.random() * BARS)
                if (this.bars[i] > 0.5 && this.particles.length < 400) {
                    const { cardHalfW } = this.getLayout()
                    const half = this.w / 2, bw = (half - cardHalfW) / BARS
                    this.particles.push({
                        x: half + (Math.random() < 0.5 ? 1 : -1) * (cardHalfW + (i + 0.5) * bw),
                        y: horizon - this.bars[i] * horizon * 0.82,
                        vx: (Math.random() - 0.5) * 0.8, vy: -(0.6 + Math.random() * 1.6),
                        life: 1, decay: 0.012 + Math.random() * 0.02, size: 1.2 + Math.random() * 2.4
                    })
                }
            }
            this.particles = this.particles.filter(p => p.life > 0)
            for (const p of this.particles) {
                p.x += p.vx
                p.y += p.vy
                p.vy *= 0.995
                p.life -= p.decay
                c.fillStyle = rgb(accent, clamp(p.life, 0, 1))
                c.beginPath()
                c.arc(p.x, p.y, p.size * p.life + 0.4, 0, Math.PI * 2)
                c.fill()
            }
            c.restore()
        }
    }

    JSP.Visualizer = Visualizer
    JSP.MODES = MODES
})(window.JSP)
