import { config } from '../config.js'
import { getJson } from './http.js'

const BASE = 'https://api.jamendo.com/v3.0'
const MAX_ATTEMPTS = 3

function toTrack(t) {
    return {
        id: `jamendo:${t.id}`,
        title: t.name,
        artist: t.artist_name,
        duration: t.duration,
        cover: t.image ?? null,
        src: t.audio,
        source: 'Jamendo'
    }
}

async function fetchTracks(params) {
    const query = new URLSearchParams({
        client_id: config.jamendoClientId,
        format: 'json',
        audioformat: 'mp32',
        imagesize: '500',
        ...params
    })
    // Jamendo иногда отвечает success с пустым списком, поэтому повторяем запрос
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const { headers, results } = await getJson(`${BASE}/tracks/?${query}`)
        if (headers?.status !== 'success') throw new Error(headers?.error_message)
        if (results.length) return results.filter(t => t.audio).map(toTrack)
    }
    return []
}

export const jamendo = {
    name: 'Jamendo',
    enabled: Boolean(config.jamendoClientId),
    trending: limit => fetchTracks({ limit, order: 'popularity_week' }),
    search: (query, limit) => fetchTracks({ limit, search: query })
}
