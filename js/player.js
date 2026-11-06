// Движок плеера: очередь, переключение, звук и анализатор. Про DOM ничего не знает,
// интерфейс подписывается на события (trackchange, playstate, timeupdate, volumechange, unavailable).
import { clamp } from './visualizer/colors.js'

const RESTART_THRESHOLD_S = 3 // «назад» после 3 секунд перематывает в начало, а не на прошлый трек
const MIN_VOLUME = 0.05
const SKIP_UNAVAILABLE_DELAY_MS = 1200

export class Player extends EventTarget {
    constructor(audio) {
        super()
        this.audio = audio
        // Анализатор звука работает только с аудио, отданным с CORS-заголовками
        audio.crossOrigin = 'anonymous'

        this.queue = []
        this.index = -1 // позиция играющего трека в queue
        this.history = [] // индексы сыгранных треков для кнопки «назад»
        this.shuffle = false
        this.volume = 1
        this.muted = false
        this.hasLoaded = false

        this.context = null
        this.analyser = null

        audio.addEventListener('timeupdate', () => this.emit('timeupdate'))
        audio.addEventListener('ended', () => this.next())
        audio.addEventListener('error', () => this.handleError())
    }

    emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }))
    }

    get track() { return this.queue[this.index] }
    get playing() { return !this.audio.paused }

    // Подменяет очередь, сохраняя позицию играющего трека, если он есть в новом списке
    setQueue(tracks) {
        const current = this.track
        this.queue = tracks
        this.history = []
        this.index = current ? tracks.findIndex(t => t.id === current.id) : -1
    }

    load(index) {
        this.index = index
        this.hasLoaded = true
        this.audio.src = this.track.src
        this.emit('trackchange', this.track)
    }

    // Создаём граф обработки звука при первом запуске (браузер требует действия пользователя)
    prepareAudioGraph() {
        if (this.context) return
        this.context = new (window.AudioContext || window.webkitAudioContext)()
        this.analyser = this.context.createAnalyser()
        this.analyser.fftSize = 2048
        this.analyser.smoothingTimeConstant = 0.8
        this.context.createMediaElementSource(this.audio).connect(this.analyser)
        this.analyser.connect(this.context.destination)
        this.emit('analyser', this.analyser)
    }

    play() {
        if (!this.track) return
        this.prepareAudioGraph()
        if (this.context.state === 'suspended') this.context.resume()
        this.emit('playstate', true)
        this.audio.play().catch(error => {
            if (error.name !== 'AbortError') this.emit('unavailable', 'Не получилось запустить трек')
            this.pause()
        })
    }

    pause() {
        this.audio.pause()
        this.emit('playstate', false)
    }

    toggle() {
        this.playing ? this.pause() : this.play()
    }

    playIndex(index) {
        if (this.index >= 0) this.history.push(this.index)
        this.load(index)
        this.play()
    }

    next() {
        if (!this.queue.length) return
        let index = (this.index + 1) % this.queue.length
        if (this.shuffle && this.queue.length > 1) {
            do { index = Math.floor(Math.random() * this.queue.length) } while (index === this.index)
        }
        this.playIndex(index)
    }

    prev() {
        if (!this.queue.length) return
        if (this.audio.currentTime > RESTART_THRESHOLD_S) {
            this.audio.currentTime = 0
            return
        }
        // возвращаемся по истории, без неё идём на предыдущий по списку
        const index = this.history.pop() ?? (this.index - 1 + this.queue.length) % this.queue.length
        this.load(index)
        this.play()
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle
        this.emit('shufflechange', this.shuffle)
    }

    setMuted(muted) {
        this.muted = muted
        this.audio.volume = muted ? 0 : this.volume
        this.emit('volumechange', { muted })
    }

    toggleMute() { this.setMuted(!this.muted) }

    changeVolume(delta) {
        this.volume = clamp(this.volume + delta, MIN_VOLUME, 1)
        this.setMuted(false)
    }

    // ratio: 0..1 от длительности трека
    seek(ratio) {
        if (!Number.isFinite(this.audio.duration)) return
        this.audio.currentTime = clamp(ratio, 0, 1) * this.audio.duration
        this.emit('timeupdate')
    }

    seekBy(seconds) {
        this.audio.currentTime = clamp(this.audio.currentTime + seconds, 0, this.audio.duration || 0)
    }

    handleError() {
        if (!this.hasLoaded) return
        this.emit('unavailable', 'Трек недоступен, переключаю')
        setTimeout(() => { if (this.queue.length > 1) this.next() }, SKIP_UNAVAILABLE_DELAY_MS)
    }
}
