import { bars } from './bars.js'
import { wave } from './wave.js'
import { radial } from './radial.js'
import { sparks } from './sparks.js'

// Каждый режим: draw(viz, ctx, layout, time) и, при необходимости, onBeat(viz, layout, strength)
export const modes = { bars, wave, radial, sparks }
export const MODE_NAMES = Object.keys(modes)
