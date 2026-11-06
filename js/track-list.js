// Панель со списком треков: рендер, поиск и выезжающая панель на узких экранах.
import { COVER_PLACEHOLDER } from './player-ui.js'
import * as music from './music/index.js'

const LIST_SIZE = 25 // сколько треков запрашиваем у каждого сервиса
const SEARCH_DELAY_MS = 350 // пауза после ввода перед запросом

function createTrackItem(track, index) {
    const item = document.createElement('li')
    item.className = 'track'
    item.dataset.index = index

    const cover = document.createElement('img')
    cover.className = 'track__cover'
    cover.alt = ''
    cover.loading = 'lazy'
    cover.onerror = () => { cover.onerror = null; cover.src = COVER_PLACEHOLDER }
    cover.src = track.cover ?? COVER_PLACEHOLDER

    const title = document.createElement('div')
    title.className = 'track__title'
    title.textContent = track.title

    const artist = document.createElement('div')
    artist.className = 'track__artist'
    artist.textContent = `${track.artist} · ${track.source}`

    const meta = document.createElement('div')
    meta.className = 'track__meta'
    meta.append(title, artist)

    item.append(cover, meta)
    return item
}

export function bindTrackList(player, dom, toast) {
    function setPanelOpen(open) {
        dom.panel.classList.toggle('is-open', open)
        document.body.classList.toggle('has-open-panel', open)
    }

    function render(title) {
        dom.listTitle.textContent = title
        if (!player.queue.length) {
            const empty = document.createElement('li')
            empty.className = 'tracks__empty'
            empty.textContent = 'Ничего не найдено'
            dom.trackList.replaceChildren(empty)
            return
        }
        dom.trackList.replaceChildren(...player.queue.map(createTrackItem))
        markActive()
    }

    function markActive() {
        for (const item of dom.trackList.children) {
            item.classList.toggle('is-active', Number(item.dataset.index) === player.index)
        }
    }

    function showTracks(tracks, title) {
        player.setQueue(tracks)
        render(title)
    }

    async function showTrending() {
        try {
            showTracks(await music.trending(LIST_SIZE), 'Trending')
            // первый запуск: готовим первый трек, но не включаем (браузер всё равно заблокирует автозвук)
            if (!player.hasLoaded && player.queue.length) player.load(0)
        } catch {
            if (!player.queue.length) toast('Не удалось загрузить треки. Проверь интернет')
        }
    }

    // --- события ---
    player.addEventListener('trackchange', markActive)

    dom.trackList.addEventListener('click', event => {
        const item = event.target.closest('.track')
        if (!item) return
        player.playIndex(Number(item.dataset.index))
        setPanelOpen(false)
    })

    let searchTimer
    dom.searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer)
        const query = dom.searchInput.value.trim()
        searchTimer = setTimeout(async () => {
            if (!query) return showTrending()
            try {
                showTracks(await music.search(query, LIST_SIZE), `Results for “${query}”`)
            } catch {
                toast('Поиск не сработал, попробуй ещё раз')
            }
        }, SEARCH_DELAY_MS)
    })

    dom.panelOpen.addEventListener('click', () => setPanelOpen(true))
    dom.panelClose.addEventListener('click', () => setPanelOpen(false))

    showTrending()
}
