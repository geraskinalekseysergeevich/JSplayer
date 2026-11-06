export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const lerp = (from, to, t) => from + (to - from) * t

// [r, g, b] + прозрачность -> строка для canvas
export const rgba = ([r, g, b], alpha = 1) => `rgba(${r | 0},${g | 0},${b | 0},${alpha})`

// hue 0..360, saturation и lightness 0..1 -> [r, g, b] 0..255
export function hslToRgb(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360
    const k = n => (n + h / 30) % 12
    const a = saturation * Math.min(lightness, 1 - lightness)
    const channel = n => lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
    return [channel(0) * 255, channel(8) * 255, channel(4) * 255]
}
