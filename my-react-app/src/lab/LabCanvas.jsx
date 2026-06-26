import { useEffect, useRef } from 'react'

// Cinematic canvas renderer for the beaker scene. A single requestAnimationFrame
// loop reads everything it needs from refs, so React re-renders never restart the
// animation. Displayed state (level, colour, particles, foam, glow) eases smoothly
// toward the targets supplied by `getTarget()`.
//
// Rendering is layered back-to-front: bench + contact shadow, heat shimmer, danger
// halo, gas plume, source bottle, pour stream + droplets, then the glass-clipped
// liquid (depth gradient, curved animated meniscus, caustics), sediment, precipitate,
// bubbles, foam, ripples and colour blooms, finishing with the front glass, rim
// highlight, graduations and a moving specular streak.
//
// Interaction: press-and-hold (mouse or touch) pours the selected reagent. The
// longer you hold, the more is added. The source bottle tilts and a stream falls in.

const MAX_VOLUME = 30 // mL — full beaker

function easeFactor(dt, tau) {
  return 1 - Math.exp(-dt / tau)
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

export default function LabCanvas({
  getTarget,
  streamColor,
  canPour,
  onPourStart,
  onPourTick,
  onPourEnd,
  soundRef,
}) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  // Live prop mirrors so the rAF loop always sees the latest values.
  const getTargetRef = useRef(getTarget)
  const streamColorRef = useRef(streamColor)
  const canPourRef = useRef(canPour)
  const cbRef = useRef({ onPourStart, onPourTick, onPourEnd })

  useEffect(() => {
    getTargetRef.current = getTarget
    streamColorRef.current = streamColor
    canPourRef.current = canPour
    cbRef.current = { onPourStart, onPourTick, onPourEnd }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')

    // Displayed (eased) state — distinct from the instantaneous target.
    const view = {
      level: 0,
      color: { r: 224, g: 240, b: 250, a: 0.32 },
      tilt: 0, // bottle tilt 0..1
      shimmer: 0,
      danger: 0,
      foam: 0,
      glow: 0, // generic reaction luminescence
    }
    const bubbles = []
    const precip = []
    const ripples = []
    const drops = [] // falling droplets from the pour stream
    const mist = [] // gas plume puffs above the surface
    const blooms = [] // expanding colour-change flashes
    let sediment = 0 // settled precipitate fraction 0..1
    let prevColor = { r: 224, g: 240, b: 250 }
    let waveClock = 0

    let dims = { w: 0, h: 0, dpr: 1 }
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      dims = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // ── Pour gesture ──
    const pour = { active: false }
    function startPour() {
      if (!canPourRef.current || pour.active) return
      pour.active = true
      soundRef.current?.startPour()
      cbRef.current.onPourStart?.()
    }
    function endPour() {
      if (!pour.active) return
      pour.active = false
      soundRef.current?.stopPour()
      cbRef.current.onPourEnd?.()
    }
    function onDown(e) {
      e.preventDefault()
      startPour()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', endPour)
    canvas.addEventListener('pointercancel', endPour)
    canvas.addEventListener('pointerleave', endPour)
    window.addEventListener('pointerup', endPour)

    function beakerGeom() {
      const { w, h } = dims
      const bw = Math.min(w * 0.46, 196)
      const bh = Math.min(h * 0.54, 240)
      const bx = w / 2 - bw / 2
      const by = h - bh - 26
      return { w, h, bw, bh, bx, by, cx: w / 2 }
    }

    function spawnBubble(g, surfaceY) {
      const r = 1.4 + Math.random() * 3.4
      bubbles.push({
        x: g.bx + 14 + Math.random() * (g.bw - 28),
        y: g.by + g.bh - 8 - Math.random() * 12,
        r,
        vy: 16 + Math.random() * 34 + r * 3,
        phase: Math.random() * Math.PI * 2,
        wob: 1 + Math.random() * 2,
        surfaceY,
      })
    }
    function spawnPrecip(g, color, surfaceY) {
      precip.push({
        x: g.bx + 12 + Math.random() * (g.bw - 24),
        y: surfaceY + 2 + Math.random() * 10,
        r: 1.1 + Math.random() * 2.4,
        vy: 6 + Math.random() * 16,
        drift: (Math.random() - 0.5) * 8,
        color,
      })
    }
    function spawnRipple(g, surfaceY, strength = 1) {
      ripples.push({ x: g.cx + (Math.random() - 0.5) * 10, y: surfaceY, r: 2, alpha: 0.5 * strength })
    }
    function spawnDrop(g, fromY) {
      drops.push({
        x: g.cx + (Math.random() - 0.5) * 4,
        y: fromY,
        vy: 120 + Math.random() * 80,
        r: 1.6 + Math.random() * 1.8,
      })
    }
    function spawnMist(g, surfaceY, color) {
      mist.push({
        x: g.bx + 16 + Math.random() * (g.bw - 32),
        y: surfaceY - 2,
        r: 4 + Math.random() * 7,
        vy: 22 + Math.random() * 26,
        life: 1,
        color,
      })
    }
    function spawnBloom(g, surfaceY, color) {
      blooms.push({ x: g.cx, y: (surfaceY + g.by + g.bh) / 2, r: 6, max: g.bw * 0.75, alpha: 0.6, color })
    }

    let last = performance.now()
    let rippleClock = 0
    let dropClock = 0
    let raf = 0

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      waveClock += dt
      const target = getTargetRef.current?.() || {}
      const g = beakerGeom()

      // Pour: feed volume to the page and tilt the bottle.
      if (pour.active && canPourRef.current) {
        cbRef.current.onPourTick?.(dt)
      }
      view.tilt += easeFactor(dt, 0.18) * ((pour.active ? 1 : 0) - view.tilt)

      // Ease visual state toward targets.
      const tLevel = clamp((target.volume || 0) / MAX_VOLUME, 0, 1)
      view.level += easeFactor(dt, 0.4) * (tLevel - view.level)
      const tc = target.color || view.color
      const kc = easeFactor(dt, 0.6)
      view.color.r += kc * (tc.r - view.color.r)
      view.color.g += kc * (tc.g - view.color.g)
      view.color.b += kc * (tc.b - view.color.b)
      view.color.a += kc * ((tc.a ?? 0.32) - view.color.a)
      view.shimmer += easeFactor(dt, 0.5) * ((target.exothermic ? 1 : 0) - view.shimmer)
      view.danger += easeFactor(dt, 0.25) * ((target.danger ? 1 : 0) - view.danger)
      view.foam += easeFactor(dt, 0.6) * ((target.gas?.foam && target.gas?.active ? 1 : 0) - view.foam)
      view.glow += easeFactor(dt, 0.7) * ((target.glow ? 1 : 0) - view.glow)

      const surfaceY = g.by + g.bh - view.level * (g.bh - 10)

      // Detect a fast colour change → trigger a one-shot colour bloom.
      const dColor = Math.abs(tc.r - prevColor.r) + Math.abs(tc.g - prevColor.g) + Math.abs(tc.b - prevColor.b)
      if (dColor > 120 && view.level > 0.05 && blooms.length < 3) {
        spawnBloom(g, surfaceY, { r: tc.r, g: tc.g, b: tc.b })
      }
      prevColor = { r: tc.r, g: tc.g, b: tc.b }

      // ── Particle spawning ──
      const gas = target.gas || {}
      if (gas.active && view.level > 0.04) {
        const n = Math.round(gas.rate * 4)
        for (let i = 0; i < n; i++) if (Math.random() < 0.7) spawnBubble(g, surfaceY)
        // Vigorous reactions push an oxygen/CO2 plume above the surface.
        if (gas.rate > 0.6 && mist.length < 60 && Math.random() < gas.rate) {
          spawnMist(g, surfaceY, gas.foam ? { r: 255, g: 255, b: 255 } : { r: 235, g: 240, b: 248 })
        }
      }
      const precipTarget = target.precipitate || {}
      if (precipTarget.active && view.level > 0.04) {
        const want = Math.min(150, Math.round(precipTarget.amount * 11))
        if (precip.length < want && Math.random() < 0.55) spawnPrecip(g, precipTarget.color, surfaceY)
        sediment += easeFactor(dt, 2.5) * (Math.min(1, precipTarget.amount / 12) - sediment)
      }
      if (pour.active) {
        rippleClock += dt
        if (rippleClock > 0.12) {
          rippleClock = 0
          spawnRipple(g, surfaceY)
        }
        dropClock += dt
        if (dropClock > 0.045) {
          dropClock = 0
          spawnDrop(g, g.by - 18)
        }
      }

      // ── Update particles ──
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        b.y -= b.vy * dt
        b.phase += dt * 6
        if (b.y <= surfaceY + 2) {
          if (Math.random() < 0.5) spawnRipple(g, surfaceY, 0.4)
          bubbles.splice(i, 1)
        }
      }
      for (let i = precip.length - 1; i >= 0; i--) {
        const p = precip[i]
        const floor = g.by + g.bh - 6 - sediment * 20
        if (p.y < floor) {
          p.y += p.vy * dt
          p.x += p.drift * dt
        } else p.y = floor
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        rp.r += dt * 70
        rp.alpha -= dt * 1.1
        if (rp.alpha <= 0) ripples.splice(i, 1)
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.vy += 420 * dt
        d.y += d.vy * dt
        if (d.y >= surfaceY) {
          spawnRipple(g, surfaceY, 0.8)
          drops.splice(i, 1)
        }
      }
      for (let i = mist.length - 1; i >= 0; i--) {
        const m = mist[i]
        m.y -= m.vy * dt
        m.r += dt * 6
        m.life -= dt * 0.9
        if (m.life <= 0) mist.splice(i, 1)
      }
      for (let i = blooms.length - 1; i >= 0; i--) {
        const bl = blooms[i]
        bl.r += dt * 220
        bl.alpha -= dt * 1.0
        if (bl.alpha <= 0 || bl.r > bl.max) blooms.splice(i, 1)
      }

      // Continuous bubbling sound follows the gas state.
      if (gas.active && !soundRef.current?.bubbleTimer) soundRef.current?.startBubbles()
      if (!gas.active && soundRef.current?.bubbleTimer) soundRef.current?.stopBubbles()

      draw(g, surfaceY)
      raf = requestAnimationFrame(frame)
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
    }

    // Curved meniscus surface path (clipped inside the glass). Adds a gentle,
    // animated wave so the liquid surface reads as a real liquid, not a flat line.
    function liquidSurfacePath(g, surfaceY, dipFn) {
      const steps = 16
      ctx.beginPath()
      ctx.moveTo(g.bx, g.by + g.bh)
      ctx.lineTo(g.bx, surfaceY + dipFn(0))
      for (let i = 1; i <= steps; i++) {
        const fx = i / steps
        ctx.lineTo(g.bx + fx * g.bw, surfaceY + dipFn(fx))
      }
      ctx.lineTo(g.bx + g.bw, g.by + g.bh)
      ctx.closePath()
    }

    function draw(g, surfaceY) {
      const { w, h, bw, bh, bx, by, cx } = g
      ctx.clearRect(0, 0, w, h)

      // ── Background: soft vertical gradient + vignette ──
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#fbfdff')
      bg.addColorStop(1, '#eef3f8')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Contact shadow under the beaker.
      ctx.save()
      ctx.fillStyle = 'rgba(20,28,46,0.16)'
      ctx.beginPath()
      ctx.ellipse(cx, by + bh + 10, bw * 0.5, 12, 0, 0, Math.PI * 2)
      ctx.filter = 'blur(1px)'
      ctx.fill()
      ctx.restore()

      // Heat shimmer above the beaker (exothermic reactions).
      if (view.shimmer > 0.02) {
        ctx.save()
        for (let i = 0; i < 6; i++) {
          const t = performance.now() / 600 + i
          const x = bx + 18 + (i / 5) * (bw - 36)
          const sway = Math.sin(t) * 7 * view.shimmer
          const grad = ctx.createLinearGradient(0, by - 54, 0, by)
          grad.addColorStop(0, 'rgba(255,170,90,0)')
          grad.addColorStop(1, `rgba(255,150,70,${0.16 * view.shimmer})`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.moveTo(x - 5, by)
          ctx.quadraticCurveTo(x - 5 + sway, by - 28, x, by - 54)
          ctx.quadraticCurveTo(x + 5 + sway, by - 28, x + 5, by)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }

      // Gas plume / mist drifting above the surface.
      for (const m of mist) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, m.life) * 0.4
        ctx.fillStyle = `rgb(${m.color.r | 0},${m.color.g | 0},${m.color.b | 0})`
        ctx.filter = 'blur(2px)'
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Danger glow halo around the beaker.
      if (view.danger > 0.02) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 140)
        ctx.save()
        ctx.shadowColor = `rgba(225,60,45,${0.6 * view.danger})`
        ctx.shadowBlur = 26 + pulse * 18 * view.danger
        ctx.strokeStyle = `rgba(225,60,45,${0.55 * view.danger})`
        ctx.lineWidth = 4
        roundRect(bx - 3, by - 3, bw + 6, bh + 6, 16)
        ctx.stroke()
        ctx.restore()
      }

      // ── Source bottle (tilts while pouring) ──
      drawBottle(g)

      // ── Pour stream + droplets ──
      if (view.tilt > 0.05 && streamColorRef.current) {
        const spoutX = cx
        const topY = by - 70 * view.tilt - 18
        ctx.save()
        ctx.strokeStyle = streamColorRef.current
        ctx.globalAlpha = 0.85 * view.tilt
        ctx.lineWidth = 4.5
        ctx.lineCap = 'round'
        ctx.beginPath()
        const wob = Math.sin(performance.now() / 60) * 2.4
        ctx.moveTo(spoutX, topY)
        ctx.bezierCurveTo(spoutX + wob, (topY + surfaceY) / 2, spoutX - wob, (topY + surfaceY) / 2, spoutX, surfaceY)
        ctx.stroke()
        ctx.restore()
      }
      for (const d of drops) {
        ctx.save()
        ctx.fillStyle = streamColorRef.current || 'rgba(180,210,235,0.9)'
        ctx.globalAlpha = 0.9
        ctx.beginPath()
        ctx.ellipse(d.x, d.y, d.r * 0.7, d.r * 1.3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // ── Beaker liquid (clipped to glass) ──
      ctx.save()
      roundRect(bx, by, bw, bh, 14)
      ctx.clip()

      const dipFn = (fx) => {
        // concave meniscus (edges pulled up) + small travelling wave
        const edge = Math.cos((fx - 0.5) * Math.PI) // 1 centre → 0 edges
        const meniscus = -(1 - edge) * 5
        const wave = Math.sin(fx * 7 + waveClock * 2.2) * 1.4 * Math.min(1, view.level * 3)
        return meniscus + wave
      }

      if (view.level > 0.002) {
        const c = view.color
        const a = Math.min(0.96, c.a)
        // Depth gradient: a touch darker/denser toward the bottom.
        const grad = ctx.createLinearGradient(0, surfaceY, 0, by + bh)
        grad.addColorStop(0, `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${a * 0.86})`)
        grad.addColorStop(1, `rgba(${(c.r * 0.82) | 0},${(c.g * 0.82) | 0},${(c.b * 0.82) | 0},${Math.min(0.98, a + 0.06)})`)
        ctx.fillStyle = grad
        liquidSurfacePath(g, surfaceY, dipFn)
        ctx.fill()

        // Soft caustic light bands near the bottom.
        ctx.save()
        ctx.globalAlpha = 0.10 + view.glow * 0.15
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 2
        for (let i = 0; i < 3; i++) {
          const yy = by + bh - 14 - i * 10
          ctx.beginPath()
          for (let x = bx + 6; x < bx + bw - 6; x += 6) {
            const off = Math.sin(x * 0.12 + waveClock * 1.6 + i) * 3
            if (x === bx + 6) ctx.moveTo(x, yy + off)
            else ctx.lineTo(x, yy + off)
          }
          ctx.stroke()
        }
        ctx.restore()

        // Bright surface highlight along the meniscus.
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i <= 16; i++) {
          const fx = i / 16
          const x = bx + fx * bw
          const y = surfaceY + dipFn(fx)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Sediment layer at the bottom (settled precipitate).
      if (sediment > 0.01) {
        const pc = getTargetRef.current?.().precipitate?.color || { r: 230, g: 230, b: 235 }
        const sg = ctx.createLinearGradient(0, by + bh - 6 - sediment * 20, 0, by + bh)
        sg.addColorStop(0, `rgba(${pc.r | 0},${pc.g | 0},${pc.b | 0},0.6)`)
        sg.addColorStop(1, `rgba(${(pc.r * 0.85) | 0},${(pc.g * 0.85) | 0},${(pc.b * 0.85) | 0},0.95)`)
        ctx.fillStyle = sg
        ctx.beginPath()
        ctx.moveTo(bx, by + bh)
        for (let x = bx; x <= bx + bw; x += 8) {
          const top = by + bh - 6 - sediment * 20 + Math.sin(x * 0.3) * 1.5
          ctx.lineTo(x, top)
        }
        ctx.lineTo(bx + bw, by + bh)
        ctx.closePath()
        ctx.fill()
      }

      // Precipitate particles (suspended cloud).
      for (const pt of precip) {
        ctx.fillStyle = `rgba(${pt.color.r | 0},${pt.color.g | 0},${pt.color.b | 0},0.9)`
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Gas bubbles with a little specular dot.
      for (const b of bubbles) {
        const bxp = b.x + Math.sin(b.phase) * b.wob
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.beginPath()
        ctx.arc(bxp, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 0.6
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.beginPath()
        ctx.arc(bxp - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, Math.PI * 2)
        ctx.fill()
      }

      // Colour-change blooms (radial flash from the centre of the liquid).
      for (const bl of blooms) {
        const rg = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r)
        rg.addColorStop(0, `rgba(${bl.color.r | 0},${bl.color.g | 0},${bl.color.b | 0},${bl.alpha})`)
        rg.addColorStop(1, `rgba(${bl.color.r | 0},${bl.color.g | 0},${bl.color.b | 0},0)`)
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Foam cap (peroxide / vigorous gas) — clustered rounded bubbles.
      if (view.foam > 0.02) {
        for (let i = 0; i < 30; i++) {
          const fx = bx + 6 + ((i * 37) % (bw - 12))
          const fy = surfaceY - Math.random() * 18 * view.foam
          const fr = 3 + Math.random() * 4 * view.foam
          ctx.fillStyle = `rgba(255,255,255,${0.85 * view.foam})`
          ctx.beginPath()
          ctx.arc(fx, fy, fr, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `rgba(255,255,255,${0.95 * view.foam})`
          ctx.beginPath()
          ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Splash ripples on the surface.
      for (const rp of ripples) {
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, rp.alpha)})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.32, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()

      // ── Beaker glass: fill sheen, outline, graduations, rim, specular streak ──
      ctx.fillStyle = 'rgba(255,255,255,0.10)'
      roundRect(bx, by, bw, bh, 14)
      ctx.fill()

      ctx.strokeStyle = 'rgba(20,28,46,0.5)'
      ctx.lineWidth = 3
      roundRect(bx, by, bw, bh, 14)
      ctx.stroke()

      // Rim highlight.
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(bx + 8, by + 2)
      ctx.lineTo(bx + bw - 8, by + 2)
      ctx.stroke()

      // Graduation marks.
      ctx.strokeStyle = 'rgba(20,28,46,0.28)'
      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(20,28,46,0.42)'
      ctx.font = '10px ui-monospace, monospace'
      for (let i = 1; i <= 4; i++) {
        const my = by + bh - (i / 5) * (bh - 10)
        ctx.beginPath()
        ctx.moveTo(bx + bw - 22, my)
        ctx.lineTo(bx + bw - 8, my)
        ctx.stroke()
        ctx.fillText(`${i * 6}`, bx + bw - 20, my - 3)
      }

      // Moving specular streak across the glass.
      const t = (performance.now() / 2600) % 1
      const streakX = bx + t * bw
      const streak = ctx.createLinearGradient(streakX - 26, 0, streakX + 26, 0)
      streak.addColorStop(0, 'rgba(255,255,255,0)')
      streak.addColorStop(0.5, 'rgba(255,255,255,0.22)')
      streak.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.save()
      roundRect(bx, by, bw, bh, 14)
      ctx.clip()
      ctx.fillStyle = streak
      ctx.fillRect(streakX - 26, by, 52, bh)
      ctx.restore()

      // Fixed left-edge glass highlight.
      const sheen = ctx.createLinearGradient(bx, 0, bx + bw, 0)
      sheen.addColorStop(0, 'rgba(255,255,255,0.3)')
      sheen.addColorStop(0.12, 'rgba(255,255,255,0)')
      ctx.fillStyle = sheen
      roundRect(bx, by, bw, bh, 14)
      ctx.fill()
    }

    function drawBottle(g) {
      const { by, bw, cx } = g
      const bottleW = Math.min(64, bw * 0.42)
      const bottleH = bottleW * 1.5
      const anchorX = cx
      const anchorY = by - 80
      ctx.save()
      ctx.translate(anchorX, anchorY)
      ctx.rotate(view.tilt * -0.95)
      // Body.
      ctx.fillStyle = 'rgba(236,242,248,0.92)'
      ctx.strokeStyle = 'rgba(20,28,46,0.5)'
      ctx.lineWidth = 2.5
      roundRect(-bottleW / 2, 0, bottleW, bottleH, 10)
      ctx.fill()
      ctx.stroke()
      // Liquid inside (selected reagent colour).
      if (streamColorRef.current) {
        ctx.save()
        roundRect(-bottleW / 2 + 3, 3, bottleW - 6, bottleH - 6, 8)
        ctx.clip()
        ctx.fillStyle = streamColorRef.current
        ctx.globalAlpha = 0.6
        ctx.fillRect(-bottleW / 2, bottleH * 0.36, bottleW, bottleH)
        ctx.restore()
      }
      // Glass highlight on the bottle.
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      roundRect(-bottleW / 2 + 5, 6, 6, bottleH - 16, 3)
      ctx.fill()
      // Neck + spout pointing down.
      ctx.fillStyle = 'rgba(220,228,238,0.95)'
      ctx.strokeStyle = 'rgba(20,28,46,0.5)'
      roundRect(-7, -14, 14, 16, 4)
      ctx.fill()
      ctx.stroke()
      // Label band.
      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      ctx.fillRect(-bottleW / 2 + 4, bottleH * 0.28, bottleW - 8, 16)
      ctx.restore()
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', endPour)
      canvas.removeEventListener('pointercancel', endPour)
      canvas.removeEventListener('pointerleave', endPour)
      window.removeEventListener('pointerup', endPour)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const snd = soundRef.current
      snd?.stopPour()
      snd?.stopBubbles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={wrapRef} className="lab-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="lab-canvas"
        style={{ touchAction: 'none', cursor: canPour ? 'grab' : 'default' }}
        role="img"
        aria-label="Beaker simulation. Press and hold to pour the selected chemical."
      />
    </div>
  )
}
