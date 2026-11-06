// Radial: симметричное кольцо вокруг карточки. Басы внизу, высокие частоты вверху
import { rgba } from '../colors.js'
import { BAR_COUNT } from '../constants.js'

const MARGIN = 24 // зазор между карточкой и кольцом
const MAX_RAY = 190
const MIN_RAY = 5

export const radial = {
    draw(viz, ctx, layout) {
        const { accent } = viz.palette
        const radius = layout.cardRadius + MARGIN
        const rays = BAR_COUNT * 2
        const maxRay = Math.min(MAX_RAY, Math.max(60, Math.min(viz.height, viz.width) / 2 - radius + 90))

        ctx.save()
        ctx.translate(layout.cx, layout.cy)

        // тонкое кольцо, пульсирует на бит
        ctx.beginPath()
        ctx.arc(0, 0, radius - 8 + viz.beat * 12, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(accent, 0.3 + viz.beat * 0.5)
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.lineCap = 'round'
        ctx.lineWidth = Math.max(3, (Math.PI * 2 * radius) / rays - 4)
        for (let i = 0; i < rays; i++) {
            // левая и правая половины зеркальны, бас в нижней точке кольца
            const mirrored = i < BAR_COUNT ? i : rays - 1 - i
            const level = viz.bars[BAR_COUNT - 1 - mirrored]
            const length = MIN_RAY + level * maxRay
            const angle = Math.PI / 2 + ((i + 0.5) / rays) * Math.PI * 2
            const cos = Math.cos(angle), sin = Math.sin(angle)

            ctx.strokeStyle = rgba(accent, 0.55 + level * 0.45)
            ctx.beginPath()
            ctx.moveTo(cos * radius, sin * radius)
            ctx.lineTo(cos * (radius + length), sin * (radius + length))
            ctx.stroke()
        }
        ctx.restore()
    }
}
