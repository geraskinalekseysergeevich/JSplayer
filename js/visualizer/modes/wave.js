// Wave: три плавные волны-ленты. Амплитуда каждой зависит от своей полосы частот (бас, середина, верх)
import { rgba } from '../colors.js'
import { BAR_COUNT } from '../constants.js'

const STEP = 6 // шаг по горизонтали, пикселей

const LAYERS = [
    { from: 0, to: 14, frequency: 0.0042, speed: 0.0011, amplitude: 1.0, alpha: 0.9 },
    { from: 14, to: 40, frequency: 0.0075, speed: -0.0016, amplitude: 0.7, alpha: 0.6 },
    { from: 40, to: BAR_COUNT, frequency: 0.0125, speed: 0.0023, amplitude: 0.45, alpha: 0.4 }
]

const average = (values, from, to) => values.slice(from, to).reduce((sum, v) => sum + v, 0) / (to - from)

function tracePath(ctx, points) {
    ctx.beginPath()
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
}

export const wave = {
    draw(viz, ctx, layout, time) {
        const { accent } = viz.palette
        const { horizon } = layout
        const maxAmplitude = horizon * 0.5

        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        for (const layer of LAYERS) {
            const energy = average(viz.bars, layer.from, layer.to)
            const amplitude = (0.04 + energy * 1.4) * maxAmplitude * layer.amplitude

            const upper = [], lower = []
            for (let x = 0; x <= viz.width + STEP; x += STEP) {
                const edgeFade = Math.pow(Math.sin(Math.min(1, x / viz.width) * Math.PI), 0.8) // затухание к краям
                const offset = Math.sin(x * layer.frequency + time * layer.speed) * amplitude * edgeFade
                upper.push([x, horizon - offset])
                lower.push([x, horizon + offset])
            }

            // лента между волной и её отражением
            tracePath(ctx, [...upper, ...[...lower].reverse()])
            ctx.closePath()
            ctx.fillStyle = rgba(accent, layer.alpha * 0.16)
            ctx.fill()

            // контуры: широкий мягкий слой и тонкий яркий
            for (const [width, alpha] of [[8, 0.12], [2, 1]]) {
                ctx.lineWidth = width
                ctx.strokeStyle = rgba(accent, layer.alpha * alpha)
                tracePath(ctx, upper)
                ctx.stroke()
                tracePath(ctx, lower)
                ctx.stroke()
            }
        }
        ctx.restore()
    }
}
