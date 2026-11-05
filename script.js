const player = document.querySelector('.player'),
    audio = document.querySelector('.audio'),
    song_title = document.querySelector('.song_title'),
    song_img_src = document.querySelector('.song_img_src'),
    songAutor = document.querySelector('.autor'),
    progressBar = document.querySelector('.progress_bar'),
    progress = document.querySelector('.progress'),
    prevBtn = document.querySelector('.prev'),
    nextBtn = document.querySelector('.next'),
    playBtn = document.querySelector('.play'),
    shuffleBtn = document.querySelector('.shuffle'),
    btn_img = document.querySelector('.play_btn'),
    volumeBtn = document.querySelector('.sound_btn'),
    songDuration = document.querySelector('.duration'),
    currentSongTime = document.querySelector('.current_time'),
    upper = document.querySelector('.upper'),
    searchInput = document.getElementById('search'),
    listTitle = document.getElementById('list_title'),
    trackList = document.getElementById('tracklist'),
    panel = document.getElementById('panel'),
    toastEl = document.getElementById('toast')

// Аудио с другого домена нужно для анализатора с CORS-доступом
audio.crossOrigin = 'anonymous'

const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#642020"/>' +
    '<path d="M140 270V150l130-30v120" fill="none" stroke="#D33D34" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="118" cy="272" r="24" fill="#D33D34"/><circle cx="248" cy="242" r="24" fill="#D33D34"/></svg>')

// ---------- состояние ----------
let queue = []
let song_index = -1
let shuffle = false
let history = []
let context, analyser

// ---------- визуализация ----------
const viz = new JSP.Visualizer(document.getElementById('scene'), () => {
    // линия горизонта — нижний край блока с карточкой, центр круга — центр карточки
    const u = upper.getBoundingClientRect()
    const p = player.getBoundingClientRect()
    return {
        horizon: u.bottom,
        cx: p.left + p.width / 2,
        cy: p.top + p.height / 2,
        cardRadius: Math.max(p.width, p.height) / 2,
        cardHalfW: p.width / 2
    }
})

// ---------- вспомогательное ----------
function toast(text) {
    toastEl.textContent = text
    toastEl.classList.add('show')
    clearTimeout(toast.t)
    toast.t = setTimeout(() => toastEl.classList.remove('show'), 3500)
}

// конвертация тайминга в привычный формат
function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00'
    seconds = Math.floor(seconds)
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m + ':' + (s <= 9 ? '0' + s : s)
}

// ---------- загрузка трека ----------
function loadSong(index) {
    song_index = index
    const t = queue[index]
    song_title.textContent = t.title
    songAutor.textContent = t.artist
    song_img_src.src = t.cover || PLACEHOLDER
    song_img_src.onerror = () => { song_img_src.onerror = null; song_img_src.src = PLACEHOLDER }
    audio.src = t.src
    songDuration.textContent = formatTime(t.duration)
    currentSongTime.textContent = '0:00'
    progress.style.width = '0%'
    document.title = `${t.title} · ${t.artist}`

    JSP.paletteFromImage(t.cover).then(p => {
        if (queue[song_index] === t) viz.setPalette(p)
    })
    JSP.lyrics.load(t)
    updateMediaSession(t)
    markActive()
}

// ---------- проигрывание ----------
function playSong() {
    // первый запуск: создаём граф обработки звука
    if (!context) preparation()
    if (context.state === 'suspended') context.resume()
    player.classList.add('played')
    btn_img.src = 'icons/pause.svg'
    viz.setPlaying(true)
    audio.play().catch(err => {
        if (err.name !== 'AbortError') toast('Не получилось запустить трек')
        pauseSong()
    })
}

function pauseSong() {
    player.classList.remove('played')
    audio.pause()
    btn_img.src = 'icons/play.svg'
    viz.setPlaying(false)
}

function nextSong() {
    if (!queue.length) return
    if (song_index >= 0) history.push(song_index)
    let n
    if (shuffle && queue.length > 1) {
        do { n = Math.floor(Math.random() * queue.length) } while (n === song_index)
    } else {
        n = (song_index + 1) % queue.length
    }
    loadSong(n)
    playSong()
}

function prevSong() {
    if (!queue.length) return
    // если трек играет больше 3 секунд, перематываем в начало
    if (audio.currentTime > 3) { audio.currentTime = 0; return }
    let n
    if (history.length) n = history.pop()
    else n = (song_index - 1 + queue.length) % queue.length
    loadSong(n)
    playSong()
}

function playIndex(i) {
    if (song_index >= 0) history.push(song_index)
    loadSong(i)
    playSong()
}

nextBtn.addEventListener('click', nextSong)
prevBtn.addEventListener('click', prevSong)

playBtn.addEventListener('click', () => {
    if (!queue.length) return
    player.classList.contains('played') ? pauseSong() : playSong()
})

shuffleBtn.addEventListener('click', () => {
    shuffle = !shuffle
    shuffleBtn.classList.toggle('active', shuffle)
})

// ---------- звук ----------
let lastVolume = 1
function setMuted(muted) {
    player.classList.toggle('sounded', !muted)
    audio.volume = muted ? 0 : lastVolume
    volumeBtn.src = muted ? 'icons/soundoff.svg' : 'icons/soundon.svg'
}
volumeBtn.addEventListener('click', () => setMuted(player.classList.contains('sounded')))
// громкость колесом над кнопкой звука и стрелками вверх/вниз
function changeVolume(delta) {
    lastVolume = Math.min(1, Math.max(0.05, (audio.volume || lastVolume) + delta))
    setMuted(false)
}
volumeBtn.parentElement.addEventListener('wheel', e => {
    e.preventDefault()
    changeVolume(e.deltaY < 0 ? 0.05 : -0.05)
}, { passive: false })

// ---------- подготовка анализатора (при первом запуске) ----------
function preparation() {
    context = new (window.AudioContext || window.webkitAudioContext)()
    analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.8
    const src = context.createMediaElementSource(audio)
    src.connect(analyser)
    analyser.connect(context.destination)
    viz.setAnalyser(analyser)
}

// ---------- прогресс и перемотка ----------
function updateProgress() {
    const { duration, currentTime } = audio
    if (isFinite(duration)) songDuration.textContent = formatTime(duration)
    currentSongTime.textContent = formatTime(currentTime)
    progress.style.width = (isFinite(duration) ? (currentTime / duration) * 100 : 0) + '%'
    JSP.lyrics.update(currentTime)
}
audio.addEventListener('timeupdate', updateProgress)

function seekFromPointer(e) {
    if (!isFinite(audio.duration)) return
    const r = progressBar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    audio.currentTime = ratio * audio.duration
    updateProgress()
}
// перемотка кликом и перетаскиванием
progressBar.addEventListener('pointerdown', e => {
    progressBar.setPointerCapture(e.pointerId)
    seekFromPointer(e)
    const move = ev => seekFromPointer(ev)
    const up = () => {
        progressBar.removeEventListener('pointermove', move)
        progressBar.removeEventListener('pointerup', up)
        progressBar.removeEventListener('pointercancel', up)
    }
    progressBar.addEventListener('pointermove', move)
    progressBar.addEventListener('pointerup', up)
    progressBar.addEventListener('pointercancel', up)
})

// автопроигрывание следующего
audio.addEventListener('ended', nextSong)
audio.addEventListener('error', () => {
    if (!audio.src || !queue.length) return
    toast('Трек недоступен, переключаю')
    setTimeout(() => { if (queue.length > 1) nextSong() }, 1200)
})

// ---------- список треков ----------
function renderList(tracks, title) {
    listTitle.textContent = title
    trackList.innerHTML = ''
    if (!tracks.length) {
        const li = document.createElement('li')
        li.className = 'empty'
        li.textContent = 'Ничего не найдено'
        trackList.appendChild(li)
        return
    }
    tracks.forEach((t, i) => {
        const li = document.createElement('li')
        li.dataset.i = i
        const img = document.createElement('img')
        img.alt = ''
        img.loading = 'lazy'
        img.src = t.cover || PLACEHOLDER
        img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER }
        const meta = document.createElement('div')
        meta.className = 'meta'
        const a = document.createElement('div'), b = document.createElement('div')
        a.className = 't'; a.textContent = t.title
        b.className = 'a'; b.textContent = t.artist + ' · ' + t.source
        meta.append(a, b)
        li.append(img, meta)
        trackList.appendChild(li)
    })
    markActive()
}

function markActive() {
    trackList.querySelectorAll('li').forEach(li => li.classList.toggle('on', +li.dataset.i === song_index))
}

trackList.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]')
    if (!li) return
    playIndex(+li.dataset.i)
    setPanel(false)
})

function setQueue(tracks, title, autoload) {
    queue = tracks
    history = []
    song_index = -1
    renderList(tracks, title)
    if (autoload && tracks.length) loadSong(0)
}

async function showTrending() {
    try {
        const tracks = await JSP.music.trending(25)
        setQueue(tracks, 'Trending', true)
    } catch (e) {
        renderList([], 'Trending')
        toast('Не удалось загрузить треки. Проверь интернет')
    }
}

// поиск с задержкой, чтобы не слать запрос на каждую букву
let searchTimer
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer)
    const q = searchInput.value.trim()
    searchTimer = setTimeout(async () => {
        if (!q) return showTrendingList()
        try {
            const tracks = await JSP.music.search(q, 25)
            const current = queue[song_index]
            queue = tracks
            history = []
            song_index = current ? tracks.findIndex(t => t.id === current.id) : -1
            renderList(tracks, `Results for “${q}”`)
        } catch (e) {
            toast('Поиск не сработал, попробуй ещё раз')
        }
    }, 350)
})
async function showTrendingList() {
    try {
        const tracks = await JSP.music.trending(25)
        const current = queue[song_index]
        queue = tracks
        history = []
        song_index = current ? tracks.findIndex(t => t.id === current.id) : -1
        renderList(tracks, 'Trending')
    } catch (e) { /* оставляем текущий список */ }
}

// на узких экранах список выезжает панелью; кнопка Tracks прячется, пока панель открыта
function setPanel(open) {
    panel.classList.toggle('open', open)
    document.body.classList.toggle('panel-open', open)
}
document.getElementById('panel_open').addEventListener('click', () => setPanel(true))
document.getElementById('panel_close').addEventListener('click', () => setPanel(false))

// ---------- режимы визуализации ----------
const modesEl = document.getElementById('modes')
function setMode(m) {
    viz.setMode(m)
    modesEl.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m))
    try { localStorage.setItem('jsplayer.mode', m) } catch (e) { /* без localStorage тоже работает */ }
}
modesEl.addEventListener('click', e => {
    const b = e.target.closest('[data-mode]')
    if (b) setMode(b.dataset.mode)
})
try { setMode(localStorage.getItem('jsplayer.mode') || 'bars') } catch (e) { setMode('bars') }

// ---------- клавиатура ----------
document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return
    switch (e.key) {
        case ' ': e.preventDefault(); playBtn.click(); break
        case 'ArrowRight': audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); break
        case 'ArrowLeft': audio.currentTime = Math.max(0, audio.currentTime - 5); break
        case 'ArrowUp': e.preventDefault(); changeVolume(0.1); break
        case 'ArrowDown': e.preventDefault(); changeVolume(-0.1); break
        case 'n': case 'N': nextSong(); break
        case 'p': case 'P': prevSong(); break
        case 'm': case 'M': volumeBtn.click(); break
        case 's': case 'S': shuffleBtn.click(); break
        case 'v': case 'V': {
            const i = JSP.MODES.indexOf(viz.mode)
            setMode(JSP.MODES[(i + 1) % JSP.MODES.length])
            break
        }
        case '/': e.preventDefault(); searchInput.focus(); break
    }
})

// ---------- управление из системы (медиаклавиши, экран блокировки) ----------
function updateMediaSession(t) {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        artwork: t.cover ? [{ src: t.cover, sizes: '480x480' }] : []
    })
}
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', playSong)
    navigator.mediaSession.setActionHandler('pause', pauseSong)
    navigator.mediaSession.setActionHandler('nexttrack', nextSong)
    navigator.mediaSession.setActionHandler('previoustrack', prevSong)
    navigator.mediaSession.setActionHandler('seekto', d => { audio.currentTime = d.seekTime })
}

showTrending()
