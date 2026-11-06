const VISIBLE_MS = 3500

export function createToast(element) {
    let timer
    return function toast(text) {
        element.textContent = text
        element.classList.add('is-visible')
        clearTimeout(timer)
        timer = setTimeout(() => element.classList.remove('is-visible'), VISIBLE_MS)
    }
}
