// Voice-over for the animated explainers.
//
// Uses the Web Speech API, which costs zero bytes, works offline once the page
// is cached, and is available in most languages the students might want. That
// matters more here than studio polish: a downloaded audio track for every
// scene of every lab would dwarf the entire application.
//
// The narrator is deliberately pluggable. `speak()` resolves through an
// onEnd callback rather than a fixed duration, so the animation can wait for
// the voice however long it actually takes — and if speech is unavailable,
// muted, or silently fails, the caller falls back to a reading-speed estimate
// and the lesson still runs.

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

// Roughly how long a caption needs to be readable, at about 150 words/minute
// with a floor so very short lines do not flash past.
export function estimateReadMs(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(2600, Math.round((words / 2.5) * 1000))
}

export class Narrator {
  constructor() {
    this.muted = false
    this.utterance = null
    this.voice = null
    this.onVoices = null
    if (speechSupported()) {
      this.pickVoice()
      // Voices load asynchronously in Chrome — the first getVoices() is often
      // an empty array, so re-pick once they arrive.
      this.onVoices = () => this.pickVoice()
      window.speechSynthesis.addEventListener?.('voiceschanged', this.onVoices)
    }
  }

  pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices() || []
      if (!voices.length) return
      this.voice =
        voices.find((v) => /female|samantha|google uk english female/i.test(v.name)) ||
        voices.find((v) => v.lang?.startsWith('en')) ||
        voices[0]
    } catch {
      this.voice = null
    }
  }

  // Speaks `text`. Returns true if speech actually started, false if the caller
  // should fall back to a timed caption. `onEnd` fires exactly once either way.
  speak(text, onEnd) {
    this.cancel()
    if (this.muted || !speechSupported() || !text) return false

    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      onEnd?.()
    }

    try {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.92
      u.pitch = 1.0
      if (this.voice) u.voice = this.voice
      u.onend = done
      u.onerror = done
      this.utterance = u
      window.speechSynthesis.speak(u)
      return true
    } catch {
      return false
    }
  }

  cancel() {
    this.utterance = null
    if (!speechSupported()) return
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* nothing to cancel */
    }
  }

  setMuted(muted) {
    this.muted = muted
    if (muted) this.cancel()
  }

  dispose() {
    this.cancel()
    if (this.onVoices && speechSupported()) {
      window.speechSynthesis.removeEventListener?.('voiceschanged', this.onVoices)
    }
    this.onVoices = null
  }
}
