// Единый вход к музыкальным сервисам. Каждый провайдер отдаёт треки одного формата:
// { id, title, artist, duration, cover, src, source }
import { audius } from './audius.js'
import { jamendo } from './jamendo.js'

const providers = [audius, jamendo].filter(p => p.enabled)

// Объединяем результаты, чередуя сервисы. Если один упал, остальные всё равно отдадут треки.
async function collect(request) {
    const settled = await Promise.allSettled(providers.map(request))
    const lists = settled.filter(r => r.status === 'fulfilled').map(r => r.value)
    if (!lists.length) throw new Error('Не удалось загрузить треки')

    const merged = []
    const longest = Math.max(...lists.map(list => list.length))
    for (let i = 0; i < longest; i++) {
        for (const list of lists) if (list[i]) merged.push(list[i])
    }
    return merged
}

export const trending = limit => collect(p => p.trending(limit))
export const search = (query, limit) => collect(p => p.search(query, limit))
