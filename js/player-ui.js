// Связывает движок плеера с карточкой: кнопки, название, обложка, прогресс.
const ICONS = {
    play: 'assets/icons/play.svg',
    pause: 'assets/icons/pause.svg',
    soundOn: 'assets/icons/soundon.svg',
    soundOff: 'assets/icons/soundoff.svg'
}
const WHEEL_VOLUME_STEP = 0.05

// Заглушка, если у трека нет обложки или она не загрузилась
export const COVER_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#642020"/>' +
    '<path d="M140 270V150l130-30v120" fill="none" stroke="#D33D34" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="118" cy="272" r="24" fill="#D33D34"/><circle cx="248" cy="242" r="24" fill="#D33D34"/></svg>')

// 125 -> «2:05»
export function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00'
    const total = Math.floor(seconds)
    const secs = total % 60
    return `${Math.floor(total / 60)}:${secs < 10 ? '0' : ''}${secs}`
}

export function bindPlayerCard(player, dom) {
    const { audio } = player

    // --- кнопки ---
    dom.playBtn.addEventListener('click', () => player.toggle())
    dom.nextBtn.addEventListener('click', () => player.next())
    dom.prevBtn.addEventListener('click', () => player.prev())
    dom.shuffleBtn.addEventListener('click', () => player.toggleShuffle())
    dom.soundBtn.addEventListener('click', () => player.toggleMute())
    // громкость колесом над кнопкой звука
    dom.soundBtn.addEventListener('wheel', event => {
        event.preventDefault()
        player.changeVolume(event.deltaY < 0 ? WHEEL_VOLUME_STEP : -WHEEL_VOLUME_STEP)
    }, { passive: false })

    // --- состояние плеера -> карточка ---
    player.addEventListener('playstate', ({ detail: playing }) => {
        dom.playIcon.src = playing ? ICONS.pause : ICONS.play
    })
    player.addEventListener('shufflechange', ({ detail: on }) => {
        dom.shuffleBtn.classList.toggle('is-active', on)
        dom.shuffleBtn.setAttribute('aria-pressed', String(on))
    })
    player.addEventListener('volumechange', ({ detail: { muted } }) => {
        dom.soundIcon.src = muted ? ICONS.soundOff : ICONS.soundOn
    })

    player.addEventListener('trackchange', ({ detail: track }) => {
        dom.title.textContent = dom.title.title = track.title
        dom.artist.textContent = dom.artist.title = track.artist

        // обложка плавно появляется, когда догрузится; до этого виден фон нужного размера
        dom.cover.classList.remove('is-loaded')
        dom.cover.onload = () => dom.cover.classList.add('is-loaded')
        dom.cover.onerror = () => { dom.cover.onerror = null; dom.cover.src = COVER_PLACEHOLDER }
        dom.cover.src = track.cover ?? COVER_PLACEHOLDER

        dom.timeTotal.textContent = formatTime(track.duration)
        dom.timeCurrent.textContent = '0:00'
        dom.progressFill.style.width = '0%'
        document.title = `${track.title} · ${track.artist}`
    })

    player.addEventListener('timeupdate', () => {
        const { duration, currentTime } = audio
        const known = Number.isFinite(duration)
        if (known) dom.timeTotal.textContent = formatTime(duration)
        dom.timeCurrent.textContent = formatTime(currentTime)
        dom.progressFill.style.width = `${known ? (currentTime / duration) * 100 : 0}%`
    })

    // --- перемотка кликом и перетаскиванием ---
    const seekToPointer = event => {
        const rect = dom.progress.getBoundingClientRect()
        player.seek((event.clientX - rect.left) / rect.width)
    }
    dom.progress.addEventListener('pointerdown', event => {
        dom.progress.setPointerCapture(event.pointerId)
        seekToPointer(event)
        const stop = () => {
            dom.progress.removeEventListener('pointermove', seekToPointer)
            dom.progress.removeEventListener('pointerup', stop)
            dom.progress.removeEventListener('pointercancel', stop)
        }
        dom.progress.addEventListener('pointermove', seekToPointer)
        dom.progress.addEventListener('pointerup', stop)
        dom.progress.addEventListener('pointercancel', stop)
    })
}
