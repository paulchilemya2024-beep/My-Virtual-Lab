import { useEffect, useRef } from 'react'

// Imperative canvas renderer for the beaker scene. It owns a single
// requestAnimationFrame loop and reads everything it needs from refs, so React
// re-renders never restart the animation. Visual state (liquid level, colour,
// particles) eases smoothly toward the targets supplied by `getTarget()`.
//
// Interaction: press-and-hold (mouse or touch) pours the selected reagent. The
// longer you hold, the more is added — releasing early adds less. The source
// bottle tilts and a stream falls into the beaker while held.

const MAX_VOLUME = 30 // mL — full beaker

function easeFactor(dt, tau) {
  return 1 - Math.exp(-dt / tau)
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
    }
    const bubbles = []
    const precip = []
    const ripples = []
    let sediment = 0 // settled precipitate fraction 0..1

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
    // Releasing outside the canvas should still stop the pour.
    window.addEventListener('pointerup', endPour)

    function beakerGeom() {
      const { w, h } = dims
      const bw = Math.min(w * 0.46, 190)
      const bh = Math.min(h * 0.52, 230)
      const bx = w / 2 - bw / 2
      const by = h - bh - 24
      return { w, h, bw, bh, bx, by, cx: w / 2 }
    }

    function spawnBubble(g, surfaceY) {
      bubbles.push({
        x: g.bx + 14 + Math.random() * (g.bw - 28),
        y: g.by + g.bh - 8 - Math.random() * 12,
        r: 1.6 + Math.random() * 3,
        vy: 18 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
        surfaceY,
      })
    }
    function spawnPrecip(g, color, surfaceY) {
      precip.push({
        x: g.bx + 12 + Math.random() * (g.bw - 24),
        y: surfaceY + 4 + Math.random() * 8,
        r: 1.2 + Math.random() * 2.2,
        vy: 8 + Math.random() * 14,
        color,
      })
    }
    function spawnRipple(g, surfaceY) {
      ripples.push({ x: g.cx, y: surfaceY, r: 2, alpha: 0.5 })
    }

    let last = performance.now()
    let rippleClock = 0
    let raf = 0

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const target = getTargetRef.current?.() || {}
      const g = beakerGeom()

      // Pour: feed volume to the page and tilt the bottle.
      if (pour.active && canPourRef.current) {
        cbRef.current.onPourTick?.(dt)
      }
      view.tilt += (easeFactor(dt, 0.18)) * ((pour.active ? 1 : 0) - view.tilt)

      // Ease visual state toward targets (gradual colour / level changes).
      const tLevel = Math.min(1, (target.volume || 0) / MAX_VOLUME)
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

      const surfaceY = g.by + g.bh - view.level * (g.bh - 10)

      // ── Particle spawning ──
      const gas = target.gas || {}
      if (gas.active && view.level > 0.04) {
        const n = Math.round(gas.rate * 3)
        for (let i = 0; i < n; i++) if (Math.random() < 0.7) spawnBubble(g, surfaceY)
      }
      const precipTarget = target.precipitate || {}
      if (precipTarget.active && view.level > 0.04) {
        const want = Math.min(140, Math.round(precipTarget.amount * 10))
        if (precip.length < want && Math.random() < 0.5) {
          spawnPrecip(g, precipTarget.color, surfaceY)
        }
        sediment += easeFactor(dt, 2.5) * (Math.min(1, precipTarget.amount / 12) - sediment)
      }
      if (pour.active) {
        rippleClock += dt
        if (rippleClock > 0.12) {
          rippleClock = 0
          spawnRipple(g, surfaceY)
        }
      }

      // ── Update particles ──
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        b.y -= b.vy * dt
        b.phase += dt * 6
        if (b.y <= surfaceY + 2) bubbles.splice(i, 1)
      }
      for (let i = precip.length - 1; i >= 0; i--) {
        const p = precip[i]
        const floor = g.by + g.bh - 6 - sediment * 18
        if (p.y < floor) p.y += p.vy * dt
        else if (p.y > floor) p.y = floor
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        rp.r += dt * 70
        rp.alpha -= dt * 1.1
        if (rp.alpha <= 0) ripples.splice(i, 1)
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

    function draw(g, surfaceY) {
      const { w, h, bw, bh, bx, by, cx } = g
      ctx.clearRect(0, 0, w, h)

      // Background wash.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)

      // Heat shimmer above the beaker (exothermic reactions).
      if (view.shimmer > 0.02) {
        ctx.save()
        for (let i = 0; i < 5; i++) {
          const t = performance.now() / 600 + i
          const x = bx + 20 + (i / 4) * (bw - 40)
          const sway = Math.sin(t) * 6 * view.shimmer
          const grad = ctx.createLinearGradient(0, by - 46, 0, by)
          grad.addColorStop(0, `rgba(255,170,90,0)`)
          grad.addColorStop(1, `rgba(255,150,70,${0.14 * view.shimmer})`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.moveTo(x - 5, by)
          ctx.quadraticCurveTo(x - 5 + sway, by - 24, x, by - 46)
          ctx.quadraticCurveTo(x + 5 + sway, by - 24, x + 5, by)
          ctx.closePath()
          ctx.fill()
        }
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

      // ── Pour stream ──
      if (view.tilt > 0.05 && streamColorRef.current) {
        const spoutX = cx
        const topY = by - 70 * view.tilt - 18
        ctx.save()
        ctx.strokeStyle = streamColorRef.current
        ctx.globalAlpha = 0.85 * view.tilt
        ctx.lineWidth = 4
        ctx.beginPath()
        const wob = Math.sin(performance.now() / 60) * 2
        ctx.moveTo(spoutX, topY)
        ctx.bezierCurveTo(spoutX + wob, (topY + surfaceY) / 2, spoutX - wob, (topY + surfaceY) / 2, spoutX, surfaceY)
        ctx.stroke()
        ctx.restore()
      }

      // ── Beaker liquid (clipped to glass) ──
      ctx.save()
      roundRect(bx, by, bw, bh, 14)
      ctx.clip()
      if (view.level > 0.002) {
        const c = view.color
        ctx.fillStyle = `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${Math.min(0.96, c.a)})`
        ctx.fillRect(bx, surfaceY, bw, by + bh - surfaceY)
        // Surface highlight line.
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(bx, surfaceY)
        ctx.lineTo(bx + bw, surfaceY)
        ctx.stroke()
      }
      // Sediment layer at the bottom.
      if (sediment > 0.01) {
        const pc = getTargetRef.current?.().precipitate?.color || { r: 230, g: 230, b: 235 }
        ctx.fillStyle = `rgba(${pc.r | 0},${pc.g | 0},${pc.b | 0},0.9)`
        ctx.fillRect(bx, by + bh - 6 - sediment * 18, bw, 6 + sediment * 18)
      }
      // Precipitate particles.
      for (const pt of precip) {
        ctx.fillStyle = `rgba(${pt.color.r | 0},${pt.color.g | 0},${pt.color.b | 0},0.92)`
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2)
        ctx.fill()
      }
      // Gas bubbles.
      for (const b of bubbles) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.beginPath()
        ctx.arc(b.x + Math.sin(b.phase) * 2, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
      }
      // Foam (peroxide decomposition).
      if (view.foam > 0.02) {
        ctx.fillStyle = `rgba(255,255,255,${0.85 * view.foam})`
        for (let i = 0; i < 26; i++) {
          const fx = bx + 6 + ((i * 37) % (bw - 12))
          const fy = surfaceY - Math.random() * 16 * view.foam
          ctx.beginPath()
          ctx.arc(fx, fy, 3 + Math.random() * 4 * view.foam, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // Splash ripples.
      for (const rp of ripples) {
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, rp.alpha)})`
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.ellipse(rp.x, rp.y, rp.r, rp.r * 0.32, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()

      // ── Beaker glass outline + graduation marks ──
      ctx.strokeStyle = 'rgba(20,28,46,0.45)'
      ctx.lineWidth = 3
      roundRect(bx, by, bw, bh, 14)
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      roundRect(bx, by, bw, bh, 14)
      ctx.fill()
      ctx.strokeStyle = 'rgba(20,28,46,0.22)'
      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(20,28,46,0.4)'
      ctx.font = '10px ui-monospace, monospace'
      for (let i = 1; i <= 4; i++) {
        const my = by + bh - (i / 5) * (bh - 10)
        ctx.beginPath()
        ctx.moveTo(bx + bw - 22, my)
        ctx.lineTo(bx + bw - 8, my)
        ctx.stroke()
        ctx.fillText(`${i * 6}`, bx + bw - 20, my - 3)
      }
      // Glass vertical highlight.
      const sheen = ctx.createLinearGradient(bx, 0, bx + bw, 0)
      sheen.addColorStop(0, 'rgba(255,255,255,0.28)')
      sheen.addColorStop(0.12, 'rgba(255,255,255,0)')
      ctx.fillStyle = sheen
      roundRect(bx, by, bw, bh, 14)
      ctx.fill()
    }

    function drawBottle(g) {
      const { by, bw, cx } = g
      const bottleW = Math.min(64, bw * 0.42)
      const bottleH = bottleW * 1.5
      // Anchor above the beaker; rotate around the neck/spout as we tilt.
      const anchorX = cx
      const anchorY = by - 78
      ctx.save()
      ctx.translate(anchorX, anchorY)
      ctx.rotate(view.tilt * -0.95) // tip the bottle toward the beaker mouth
      // Body.
      ctx.fillStyle = 'rgba(236,242,248,0.9)'
      ctx.strokeStyle = 'rgba(20,28,46,0.5)'
      ctx.lineWidth = 2.5
      roundRect(-bottleW / 2, 0, bottleW, bottleH, 10)
      ctx.fill()
      ctx.stroke()
      // Liquid inside the bottle (selected reagent colour).
      if (streamColorRef.current) {
        ctx.save()
        roundRect(-bottleW / 2 + 3, 0 + 3, bottleW - 6, bottleH - 6, 8)
        ctx.clip()
        ctx.fillStyle = streamColorRef.current
        ctx.globalAlpha = 0.55
        ctx.fillRect(-bottleW / 2, bottleH * 0.38, bottleW, bottleH)
        ctx.restore()
      }
      // Neck + spout pointing down.
      ctx.fillStyle = 'rgba(220,228,238,0.95)'
      ctx.strokeStyle = 'rgba(20,28,46,0.5)'
      roundRect(-7, -14, 14, 16, 4)
      ctx.fill()
      ctx.stroke()
      // Label band.
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
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
