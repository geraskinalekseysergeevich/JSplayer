// Все элементы страницы в одном месте: если разметка изменится, править нужно только здесь.
function query(selector) {
    const element = document.querySelector(selector)
    if (!element) throw new Error(`Element not found: ${selector}`)
    return element
}

const shuffleBtn = query('#shuffle-btn')
const playBtn = query('#play-btn')
const soundBtn = query('#sound-btn')

export const dom = {
    scene: query('#scene'),
    cardArea: query('.stage__card'),
    player: query('.player'),
    audio: query('#audio'),

    cover: query('.player__cover-img'),
    title: query('.player__title'),
    artist: query('.player__artist'),

    shuffleBtn,
    prevBtn: query('#prev-btn'),
    playBtn,
    playIcon: playBtn.querySelector('img'),
    nextBtn: query('#next-btn'),
    soundBtn,
    soundIcon: soundBtn.querySelector('img'),

    progress: query('.progress'),
    progressFill: query('.progress__fill'),
    timeCurrent: query('.time--current'),
    timeTotal: query('.time--total'),

    panel: query('#track-panel'),
    panelOpen: query('#panel-open'),
    panelClose: query('#panel-close'),
    searchInput: query('#search-input'),
    listTitle: query('#list-title'),
    trackList: query('#track-list'),

    lyrics: query('#lyrics'),
    modes: query('#modes'),
    toast: query('#toast')
}
