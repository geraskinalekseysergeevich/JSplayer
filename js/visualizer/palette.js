// Палитра сцены: небо, земля и акцент. Строится из доминирующего цвета обложки.
import { clamp, hslToRgb } from './colors.js'

// Исходный красный цвет плеера. Используется, пока нет обложки или её нельзя прочитать.
export const DEFAULT_PALETTE = {
    sky: [100, 32, 32],
    ground: [211, 61, 52],
    accent: [255, 138, 120]
}

const SAMPLE_SIZE = 32 // обложка сжимается до 32x32 для быстрого анализа
const HUE_BUCKET_DEG = 15
const MIN_BRIGHTNESS = 0.15 // слишком тёмные пиксели не учитываем
const MIN_SATURATION = 0.2 // серые тоже
const MIN_BUCKET_PIXELS = 6

function paletteFromHue(hue, saturation) {
    return {
        sky: hslToRgb(hue, saturation * 0.85, 0.25),
        ground: hslToRgb(hue, saturation, 0.52),
        accent: hslToRgb(hue, clamp(saturation + 0.1, 0, 1), 0.72)
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous' // без этого canvas не даст прочитать пиксели
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
    })
}

function readPixels(img) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SAMPLE_SIZE
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
    return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
}

// Группируем цветные пиксели по оттенку, побеждает группа с наибольшим весом (насыщенность * яркость)
function derivePalette(pixels) {
    const buckets = Array.from({ length: 360 / HUE_BUCKET_DEG }, () => ({ weight: 0, saturation: 0, hue: 0, count: 0 }))
    let grayPixels = 0

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255
        const max = Math.max(r, g, b)
        const delta = max - Math.min(r, g, b)
        if (max < MIN_BRIGHTNESS) continue

        const saturation = delta / max
        if (saturation < MIN_SATURATION) { grayPixels++; continue }

        let hue
        if (max === r) hue = ((g - b) / delta) % 6
        else if (max === g) hue = (b - r) / delta + 2
        else hue = (r - g) / delta + 4
        hue = (hue * 60 + 360) % 360

        const bucket = buckets[Math.floor(hue / HUE_BUCKET_DEG)]
        bucket.weight += saturation * max
        bucket.saturation += saturation
        bucket.hue += hue
        bucket.count++
    }

    const best = buckets.reduce((a, b) => (b.weight > a.weight ? b : a))
    if (best.count < MIN_BUCKET_PIXELS) {
        // почти нет цвета: холодный серо-синий для ч/б обложек, мягкий синий для остальных
        return paletteFromHue(220, grayPixels > 100 ? 0.06 : 0.3)
    }
    return paletteFromHue(best.hue / best.count, clamp(best.saturation / best.count, 0.4, 0.78))
}

// null, если картинку не удалось загрузить или прочитать (например, нет CORS)
export async function paletteFromImage(url) {
    if (!url) return null
    try {
        return derivePalette(readPixels(await loadImage(url)))
    } catch {
        return null
    }
}
