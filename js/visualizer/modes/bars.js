// Bars: цельный плавный «хребет» спектра с градиентом, контуром и отражением в земле
import { rgba } from '../colors.js'
import { BAR_COUNT } from '../constants.js'

const HEIGHT_RATIO = 0.82 // доля высоты неба, которую занимает самый высокий пик
const REFLECTION_RATIO = 0.35
const EDGE_FALLOFF = 0.45 // насколько хребет опускается к краю экрана
const OVERSHOOT = 12 // хвост за краем экрана, чтобы контур не обрывался

// Лёгкое сглаживание соседних полос, чтобы линия получилась гладкой
function smooth(bars) {
    return Float32Array.from(bars, (value, i) => {
        const prev = bars[Math.max(0, i - 1)]
        const next = bars[Math.min(bars.length - 1, i + 1)]
        return (prev + 2 * value + next) / 4
    })
}

// Плавная кривая через точки (квадратичные кривые через середины отрезков)
function traceCurve(ctx, points) {
    for (let k = 1; k < points.length - 1; k++) {
        const midX = (points[k][0] + points[k + 1][0]) / 2
        const midY = (points[k][1] + points[k + 1][1]) / 2
        ctx.quadraticCurveTo(points[k][0], points[k][1], midX, midY)
    }
    const [lastX, lastY] = points[points.length - 1]
    ctx.lineTo(lastX, lastY)
}

export const bars = {
    draw(viz, ctx, layout) {
        const { ground, accent } = viz.palette
        const { horizon, cardHalfW } = layout
        const center = viz.width / 2
        const span = center - cardHalfW // ширина зоны от края карточки до края экрана
        const maxHeight = horizon * HEIGHT_RATIO
        const values = smooth(viz.bars)

        for (const side of [-1, 1]) {
            const x = distance => center + side * (cardHalfW + distance)
            const crest = [[x(0), horizon - values[0] * maxHeight]]
            const reflection = [[x(0), horizon + values[0] * maxHeight * REFLECTION_RATIO]]
            values.forEach((value, i) => {
                const falloff = 1 - EDGE_FALLOFF * Math.pow(i / BAR_COUNT, 2.2)
                const distance = ((i + 0.5) / BAR_COUNT) * span
                crest.push([x(distance), horizon - value * maxHeight * falloff])
                reflection.push([x(distance), horizon + value * maxHeight * falloff * REFLECTION_RATIO])
            })
            crest.push([x(span + OVERSHOOT), horizon])
            reflection.push([x(span + OVERSHOOT), horizon])

            // основная масса
            ctx.beginPath()
            ctx.moveTo(center, horizon)
            ctx.lineTo(...crest[0])
            traceCurve(ctx, crest)
            ctx.lineTo(x(span + OVERSHOOT), horizon)
            ctx.closePath()
            const body = ctx.createLinearGradient(0, horizon - maxHeight, 0, horizon)
            body.addColorStop(0, rgba(accent, 0.95))
            body.addColorStop(1, rgba(ground))
            ctx.fillStyle = body
            ctx.fill()

            // отражение
            ctx.beginPath()
            ctx.moveTo(center, horizon)
            ctx.lineTo(...reflection[0])
            traceCurve(ctx, reflection)
            ctx.closePath()
            const fade = ctx.createLinearGradient(0, horizon, 0, horizon + maxHeight * REFLECTION_RATIO)
            fade.addColorStop(0, rgba(accent, 0.3))
            fade.addColorStop(1, rgba(accent, 0))
            ctx.fillStyle = fade
            ctx.fill()

            // контур: широкий мягкий слой под тонким ярким
            ctx.lineJoin = 'round'
            for (const [width, alpha] of [[7, 0.18], [2.2, 0.95]]) {
                ctx.beginPath()
                ctx.moveTo(...crest[0])
                traceCurve(ctx, crest)
                ctx.lineWidth = width
                ctx.strokeStyle = rgba(accent, alpha)
                ctx.stroke()
            }
        }
    }
}
