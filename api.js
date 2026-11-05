// Провайдеры музыки. Каждый возвращает треки в едином формате:
// { id, title, artist, duration, cover, src, source }
window.JSP = window.JSP || {}

;(function (JSP) {
    const cfg = window.JSPLAYER_CONFIG || {}
    const APP = cfg.appName || 'JSplayer'

    async function getJson(url) {
        const res = await fetch(url)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        return res.json()
    }

    const Audius = {
        name: 'Audius',
        enabled: true,
        base: 'https://api.audius.co/v1',
        normalize(t) {
            return {
                id: 'audius:' + t.id,
                title: t.title,
                artist: (t.user && t.user.name) || 'Unknown',
                duration: t.duration,
                cover: (t.artwork && (t.artwork['480x480'] || t.artwork['150x150'])) || null,
                src: `${this.base}/tracks/${t.id}/stream?app_name=${APP}`,
                source: 'Audius'
            }
        },
        async fetchTracks(path, params) {
            const q = new URLSearchParams({ app_name: APP, ...params })
            const { data } = await getJson(`${this.base}${path}?${q}`)
            return data
                .filter(t => t.is_streamable && !t.is_stream_gated && !t.is_delete)
                .map(t => this.normalize(t))
        },
        trending(limit) { return this.fetchTracks('/tracks/trending', { limit }) },
        search(query, limit) { return this.fetchTracks('/tracks/search', { query, limit }) }
    }

    const Jamendo = {
        name: 'Jamendo',
        enabled: !!cfg.jamendoClientId,
        base: 'https://api.jamendo.com/v3.0',
        normalize(t) {
            return {
                id: 'jamendo:' + t.id,
                title: t.name,
                artist: t.artist_name,
                duration: t.duration,
                cover: t.image || null,
                src: t.audio,
                source: 'Jamendo'
            }
        },
        async fetchTracks(params) {
            const q = new URLSearchParams({
                client_id: cfg.jamendoClientId,
                format: 'json',
                audioformat: 'mp32',
                imagesize: '500',
                ...params
            })
            // Jamendo иногда отвечает success с пустым списком, поэтому повторяем до 3 раз
            for (let attempt = 0; attempt < 3; attempt++) {
                const { headers, results } = await getJson(`${this.base}/tracks/?${q}`)
                if (headers && headers.status !== 'success') throw new Error(headers.error_message)
                if (results.length) return results.filter(t => t.audio).map(t => this.normalize(t))
            }
            return []
        },
        trending(limit) { return this.fetchTracks({ limit, order: 'popularity_week' }) },
        search(query, limit) { return this.fetchTracks({ limit, search: query }) }
    }

    const providers = [Audius, Jamendo].filter(p => p.enabled)

    // Объединяем результаты провайдеров, перемешивая их по очереди.
    // Если один провайдер упал, остальные всё равно отдадут треки.
    async function collect(method, arg, limit) {
        const settled = await Promise.allSettled(providers.map(p => p[method](...(arg === undefined ? [limit] : [arg, limit]))))
        const lists = settled.filter(r => r.status === 'fulfilled').map(r => r.value)
        if (!lists.length) throw new Error('Не удалось загрузить треки')
        const out = []
        const max = Math.max(...lists.map(l => l.length))
        for (let i = 0; i < max; i++) lists.forEach(l => l[i] && out.push(l[i]))
        return out
    }

    JSP.music = {
        providers: providers.map(p => p.name),
        trending: (limit = 20) => collect('trending', undefined, limit),
        search: (query, limit = 20) => collect('search', query, limit)
    }
})(window.JSP)
