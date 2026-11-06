// Синхронные тексты песен через LRCLIB (бесплатно, без ключа): https://lrclib.net
const SEARCH_URL = 'https://lrclib.net/api/search'
const DURATION_TOLERANCE_S = 8 // подходящим считаем текст трека с похожей длиной
const LOOKAHEAD_S = 0.25 // подсвечиваем строку чуть раньше, чтобы глаз успевал

// «[01:23.45] строка» -> { time: 83.45, text: 'строка' }
function parseLrc(lrc) {
    return lrc.split('\n').flatMap(row => {
        const match = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/)
        return match ? [{ time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() }] : []
    })
}

// Названия на Audius часто вида «Artist - Title (Remix)»: убираем скобки для поиска
const clean = text => text.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim()

async function findLyrics(track) {
    const query = new URLSearchParams({ q: `${clean(track.artist)} ${clean(track.title)}` })
    const res = await fetch(`${SEARCH_URL}?${query}`)
    if (!res.ok) return null
    const results = await res.json()
    const hit = results.find(r => r.syncedLyrics && Math.abs((r.duration ?? 0) - track.duration) < DURATION_TOLERANCE_S)
    return hit ? parseLrc(hit.syncedLyrics) : null
}

export function createLyrics(root) {
    const inner = root.querySelector('.lyrics__inner')
    let lines = []
    let activeIndex = -1
    let requestId = 0 // чтобы ответ на устаревший трек не перебил текущий

    function render() {
        inner.replaceChildren(...lines.map(line => {
            const element = document.createElement('p')
            element.className = 'lyrics__line'
            element.textContent = line.text || '♪'
            return element
        }))
    }

    return {
        async load(track) {
            const current = ++requestId
            lines = []
            activeIndex = -1
            root.classList.remove('is-visible')
            inner.replaceChildren()
            try {
                const found = await findLyrics(track)
                if (current !== requestId || !found?.length) return
                lines = found
                render()
                root.classList.add('is-visible')
            } catch {
                // тексты необязательны: без них плеер работает как раньше
            }
        },

        update(time) {
            if (!lines.length) return
            const index = lines.findLastIndex(line => line.time <= time + LOOKAHEAD_S)
            if (index === activeIndex) return
            activeIndex = index

            inner.querySelector('.is-active')?.classList.remove('is-active')
            const element = inner.children[index]
            if (!element) return
            element.classList.add('is-active')
            // прокручиваем так, чтобы активная строка была по центру панели
            const offset = root.clientHeight / 2 - element.offsetTop - element.offsetHeight / 2
            inner.style.transform = `translateY(${offset}px)`
        }
    }
}
