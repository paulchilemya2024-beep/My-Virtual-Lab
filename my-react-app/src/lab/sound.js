// Programmatic sound engine for the virtual lab — Web Audio only, no files, no
// external libraries. Everything is synthesised from oscillators and a shared
// white-noise buffer so it works fully offline.
//
// Browsers block audio until a user gesture, so the engine starts suspended and
// `resume()` (called from the first pointer/touch interaction) wakes it up.

export default class SoundEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.noiseBuffer = null
    this.muted = false
    // Active continuous voices, so they can be stopped again.
    this.pourVoice = null
    this.bubbleTimer = null
  }

  _ensure() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(this.ctx.destination)
    // One second of white noise, reused for every noise-based effect.
    const len = this.ctx.sampleRate
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buf
  }

  async resume() {
    this._ensure()
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume()
      } catch {
        /* ignored — audio simply stays silent */
      }
    }
  }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.9
    if (m) {
      this.stopPour()
      this.stopBubbles()
    }
  }

  _noiseSource() {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    return src
  }

  // ── Pouring: soft filtered-noise water trickle, held while pouring. ──
  startPour() {
    this._ensure()
    if (!this.ctx || this.muted || this.pourVoice) return
    const now = this.ctx.currentTime
    const src = this._noiseSource()
    const band = this.ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 900
    band.Q.value = 0.8
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 400
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.15)
    // Gentle wobble so the trickle sounds liquid, not like static.
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    lfo.frequency.value = 7
    lfoGain.gain.value = 240
    lfo.connect(lfoGain)
    lfoGain.connect(band.frequency)
    src.connect(band)
    band.connect(hp)
    hp.connect(gain)
    gain.connect(this.master)
    src.start()
    lfo.start()
    this.pourVoice = { src, lfo, gain }
  }

  stopPour() {
    if (!this.pourVoice || !this.ctx) return
    const { src, lfo, gain } = this.pourVoice
    const now = this.ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    src.stop(now + 0.2)
    lfo.stop(now + 0.2)
    this.pourVoice = null
  }

  // ── Effervescence: looping bubbles for gas-producing reactions. ──
  startBubbles() {
    this._ensure()
    if (!this.ctx || this.muted || this.bubbleTimer) return
    const blip = () => {
      if (!this.ctx) return
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      const f0 = 180 + Math.random() * 320
      osc.frequency.setValueAtTime(f0, now)
      osc.frequency.exponentialRampToValueAtTime(f0 * 2.2, now + 0.08)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.06 + Math.random() * 0.04, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(now)
      osc.stop(now + 0.14)
    }
    this.bubbleTimer = setInterval(() => {
      blip()
      if (Math.random() > 0.6) blip()
    }, 110)
  }

  stopBubbles() {
    if (this.bubbleTimer) {
      clearInterval(this.bubbleTimer)
      this.bubbleTimer = null
    }
  }

  // ── Short hiss for exothermic reactions / acid-on-metal. ──
  hiss() {
    this._ensure()
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    const src = this._noiseSource()
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2200
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
    src.connect(hp)
    hp.connect(gain)
    gain.connect(this.master)
    src.start(now)
    src.stop(now + 0.75)
  }

  // ── Subtle glass clink when picking up a flask/dropper. ──
  clink() {
    this._ensure()
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    ;[2400, 3600].forEach((freq, i) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const t = now + i * 0.012
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t)
      osc.stop(t + 0.2)
    })
  }

  // ── Soft success chime at the correct endpoint. ──
  chime() {
    this._ensure()
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    const notes = [659.25, 783.99, 987.77] // E5, G5, B5
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.13
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t)
      osc.stop(t + 0.65)
    })
  }

  // ── Safe "pop" for a dangerous / failed reaction. ──
  pop() {
    this._ensure()
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    // Low thump.
    const osc = this.ctx.createOscillator()
    const og = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25)
    og.gain.setValueAtTime(0.0001, now)
    og.gain.exponentialRampToValueAtTime(0.4, now + 0.01)
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    osc.connect(og)
    og.connect(this.master)
    osc.start(now)
    osc.stop(now + 0.4)
    // Noise burst on top.
    const src = this._noiseSource()
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    const ng = this.ctx.createGain()
    ng.gain.setValueAtTime(0.0001, now)
    ng.gain.exponentialRampToValueAtTime(0.3, now + 0.01)
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
    src.connect(lp)
    lp.connect(ng)
    ng.connect(this.master)
    src.start(now)
    src.stop(now + 0.32)
  }

  // Route an engine event to the matching sound.
  play(event) {
    switch (event) {
      case 'fizz':
        this.startBubbles()
        break
      case 'hiss':
        this.hiss()
        break
      case 'precipitate':
        this.clink()
        break
      case 'endpoint':
        this.chime()
        break
      case 'danger':
        this.pop()
        break
      default:
        break
    }
  }

  dispose() {
    this.stopPour()
    this.stopBubbles()
    if (this.ctx) {
      try {
        this.ctx.close()
      } catch {
        /* already closed */
      }
      this.ctx = null
    }
  }
}
