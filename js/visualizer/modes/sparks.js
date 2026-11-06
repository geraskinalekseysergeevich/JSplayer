// Sparks: фонтан светящихся искр. Высота и частота вылета зависят от силы каждой частоты
import { clamp, rgba } from '../colors.js'
import { BAR_COUNT } from '../constants.js'

const MAX_PARTICLES = 150
const GRAVITY = 0.12 // искры летят дугой и падают

// Мягкое свечение рисуется готовой картинкой: shadowBlur на сотне частиц в разы дороже
let sprite = null
let spriteKey = ''
function glowSprite(color) {
    const key = color.map(v => v >> 4).join()
    if (key === spriteKey) return sprite

    const size = 32
    sprite = document.createElement('canvas')
    sprite.width = sprite.height = size
    const ctx = sprite.getContext('2d')
    const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    glow.addColorStop(0, rgba([255, 255, 255]))
    glow.addColorStop(0.18, rgba(color, 0.9))
    glow.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, size, size)
    spriteKey = key
    return sprite
}

function spawnFromBars(viz, layout) {
    const center = viz.width / 2
    const barWidth = (center - layout.cardHalfW) / BAR_COUNT
    viz.bars.forEach((level, i) => {
        if (level < 0.2 || Math.random() > level * level * 0.2) return
        const side = Math.random() < 0.5 ? -1 : 1
        viz.particles.push({
            x: center + side * (layout.cardHalfW + (i + Math.random()) * barWidth),
            y: layout.horizon,
            vx: (Math.random() - 0.5) * 5,
            vy: -(3 + level * 12 * (0.6 + Math.random() * 0.6)),
            life: 1,
            decay: 0.009 + Math.random() * 0.012,
            size: 3 + level * 5
        })
    })
}

export const sparks = {
    // всплеск искр на бит
    onBeat(viz, layout, strength) {
        const count = 10 + Math.round(strength * 14)
        for (let i = 0; i < count && viz.particles.length < MAX_PARTICLES; i++) {
            viz.particles.push({
                x: Math.random() * viz.width,
                y: layout.horizon,
                vx: (Math.random() - 0.5) * 2.4,
                vy: -(4 + Math.random() * 8),
                life: 1,
                decay: 0.008 + Math.random() * 0.01,
                size: 2 + Math.random() * 4
            })
        }
    },

    draw(viz, ctx, layout) {
        const { accent } = viz.palette

        // мягкое свечение горизонта
        const haze = ctx.createLinearGradient(0, layout.horizon - 60, 0, layout.horizon + 30)
        haze.addColorStop(0, rgba(accent, 0))
        haze.addColorStop(0.7, rgba(accent, 0.25 + viz.beat * 0.3))
        haze.addColorStop(1, rgba(accent, 0))
        ctx.fillStyle = haze
        ctx.fillRect(0, layout.horizon - 60, viz.width, 90)

        if (viz.playing && viz.particles.length < MAX_PARTICLES) spawnFromBars(viz, layout)

        const glow = glowSprite(accent)
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        viz.particles = viz.particles.filter(p => p.life > 0 && p.y < viz.height + 40)
        for (const p of viz.particles) {
            p.x += p.vx
            p.y += p.vy
            p.vy += GRAVITY
            p.life -= p.decay
            const alpha = clamp(p.life, 0, 1)
            const radius = p.size * (0.3 + alpha * 0.7) * 2.6
            ctx.globalAlpha = alpha
            ctx.drawImage(glow, p.x - radius, p.y - radius, radius * 2, radius * 2)
        }
        ctx.restore()
    }
}
