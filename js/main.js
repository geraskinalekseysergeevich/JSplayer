// Точка входа: создаёт плеер, сцену и подключает всё друг к другу.
import { dom } from './dom.js'
import { Player } from './player.js'
import { Visualizer } from './visualizer/visualizer.js'
import { paletteFromImage } from './visualizer/palette.js'
import { createLyrics } from './lyrics.js'
import { createToast } from './toast.js'
import { bindPlayerCard } from './player-ui.js'
import { bindTrackList } from './track-list.js'
import { bindModes, bindKeyboard, bindMediaSession } from './controls.js'

const toast = createToast(dom.toast)
const player = new Player(dom.audio)
const lyrics = createLyrics(dom.lyrics)

// Линия горизонта: нижний край блока с карточкой. Круг в режиме Radial центрируется на карточке.
const viz = new Visualizer(dom.scene, () => {
    const area = dom.cardArea.getBoundingClientRect()
    const card = dom.player.getBoundingClientRect()
    return {
        horizon: area.bottom,
        cx: card.left + card.width / 2,
        cy: card.top + card.height / 2,
        cardRadius: Math.max(card.width, card.height) / 2,
        cardHalfW: card.width / 2
    }
})

bindPlayerCard(player, dom)
bindTrackList(player, dom, toast)
bindKeyboard(player, dom, bindModes(viz, dom))
bindMediaSession(player)

player.addEventListener('analyser', ({ detail }) => viz.setAnalyser(detail))
player.addEventListener('playstate', ({ detail }) => viz.setPlaying(detail))
player.addEventListener('timeupdate', () => lyrics.update(player.audio.currentTime))
player.addEventListener('unavailable', ({ detail }) => toast(detail))
player.addEventListener('trackchange', async ({ detail: track }) => {
    lyrics.load(track)
    const palette = await paletteFromImage(track.cover)
    if (player.track === track) viz.setPalette(palette) // трек мог смениться, пока грузилась обложка
})
