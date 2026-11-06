import { config } from '../config.js'
import { getJson } from './http.js'

const BASE = 'https://api.audius.co/v1'

function toTrack(t) {
    return {
        id: `audius:${t.id}`,
        title: t.title,
        artist: t.user?.name ?? 'Unknown',
        duration: t.duration,
        cover: t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? null,
        src: `${BASE}/tracks/${t.id}/stream?app_name=${config.appName}`,
        source: 'Audius'
    }
}

async function fetchTracks(path, params) {
    const query = new URLSearchParams({ app_name: config.appName, ...params })
    const { data } = await getJson(`${BASE}${path}?${query}`)
    return data.filter(t => t.is_streamable && !t.is_stream_gated && !t.is_delete).map(toTrack)
}

export const audius = {
    name: 'Audius',
    enabled: true,
    trending: limit => fetchTracks('/tracks/trending', { limit }),
    search: (query, limit) => fetchTracks('/tracks/search', { query, limit })
}
