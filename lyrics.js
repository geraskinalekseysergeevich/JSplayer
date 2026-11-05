// Синхронные тексты песен через LRCLIB (бесплатно, без ключа): https://lrclib.net
window.JSP = window.JSP || {}

;(function (JSP) {
    const root = document.getElementById('lyrics')
    const inner = document.getElementById('lyrics_inner')
    let lines = []
    let active = -1
    let token = 0

    function parse(lrc) {
        const out = []
        for (const row of lrc.split('\n')) {
            const m = row.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/)
            if (m) out.push({ t: +m[1] * 60 + +m[2], text: m[3].trim() })
        }
        return out
    }

    // Названия на Audius часто вида «Artist - Title (Remix)»: чистим для поиска
    function clean(s) {
        return s.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+/g, ' ').trim()
    }

    async function find(track) {
        const q = new URLSearchParams({ q: `${clean(track.artist)} ${clean(track.title)}` })
        const res = await fetch('https://lrclib.net/api/search?' + q)
        if (!res.ok) return null
        const list = await res.json()
        const hit = list.find(x => x.syncedLyrics && Math.abs((x.duration || 0) - track.duration) < 8)
        return hit ? parse(hit.syncedLyrics) : null
    }

    function render() {
        inner.innerHTML = ''
        lines.forEach((l, i) => {
            const p = document.createElement('p')
            p.textContent = l.text || '♪'
            p.dataset.i = i
            inner.appendChild(p)
        })
    }

    JSP.lyrics = {
        async load(track) {
            const my = ++token
            lines = []
            active = -1
            root.classList.remove('has')
            inner.innerHTML = ''
            try {
                const found = await find(track)
                if (my !== token || !found || !found.length) return
                lines = found
                render()
                root.classList.add('has')
            } catch (e) {
                /* тексты необязательны */
            }
        },
        update(time) {
            if (!lines.length) return
            let i = -1
            for (let k = 0; k < lines.length; k++) {
                if (lines[k].t <= time + 0.25) i = k
                else break
            }
            if (i === active) return
            active = i
            inner.querySelectorAll('.on').forEach(e => e.classList.remove('on'))
            const el = inner.children[i]
            if (!el) return
            el.classList.add('on')
            // прокручиваем так, чтобы активная строка была по центру панели
            inner.style.transform = `translateY(${root.clientHeight / 2 - el.offsetTop - el.offsetHeight / 2}px)`
        }
    }
})(window.JSP)
