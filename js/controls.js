// Переключатель режимов визуализации, клавиатура и управление из системы (медиаклавиши).
import { MODE_NAMES } from './visualizer/modes/index.js'

const STORAGE_KEY = 'jsplayer.mode'
const SEEK_STEP_S = 5
const KEY_VOLUME_STEP = 0.1

export function bindModes(viz, dom) {
    function setMode(mode) {
        viz.setMode(mode)
        for (const button of dom.modes.querySelectorAll('[data-mode]')) {
            button.classList.toggle('is-active', button.dataset.mode === mode)
        }
        try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* без localStorage тоже работает */ }
    }

    dom.modes.addEventListener('click', event => {
        const button = event.target.closest('[data-mode]')
        if (button) setMode(button.dataset.mode)
    })

    let saved = null
    try { saved = localStorage.getItem(STORAGE_KEY) } catch { /* приватный режим */ }
    setMode(MODE_NAMES.includes(saved) ? saved : MODE_NAMES[0])

    return {
        cycle() { setMode(MODE_NAMES[(MODE_NAMES.indexOf(viz.mode) + 1) % MODE_NAMES.length]) }
    }
}

export function bindKeyboard(player, dom, modeSwitcher) {
    const actions = {
        ' ': () => player.toggle(),
        ArrowRight: () => player.seekBy(SEEK_STEP_S),
        ArrowLeft: () => player.seekBy(-SEEK_STEP_S),
        ArrowUp: () => player.changeVolume(KEY_VOLUME_STEP),
        ArrowDown: () => player.changeVolume(-KEY_VOLUME_STEP),
        n: () => player.next(),
        p: () => player.prev(),
        m: () => player.toggleMute(),
        s: () => player.toggleShuffle(),
        v: () => modeSwitcher.cycle(),
        '/': () => dom.searchInput.focus()
    }

    document.addEventListener('keydown', event => {
        if (event.target.matches?.('input, textarea') || event.metaKey || event.ctrlKey || event.altKey) return
        const action = actions[event.key.length === 1 ? event.key.toLowerCase() : event.key]
        if (!action) return
        event.preventDefault() // иначе пробел и стрелки прокручивают страницу
        action()
    })
}

export function bindMediaSession(player) {
    if (!('mediaSession' in navigator)) return

    player.addEventListener('trackchange', ({ detail: track }) => {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            artwork: track.cover ? [{ src: track.cover, sizes: '480x480' }] : []
        })
    })

    const handlers = {
        play: () => player.play(),
        pause: () => player.pause(),
        nexttrack: () => player.next(),
        previoustrack: () => player.prev(),
        seekto: ({ seekTime }) => { player.audio.currentTime = seekTime }
    }
    for (const [action, handler] of Object.entries(handlers)) navigator.mediaSession.setActionHandler(action, handler)
}
