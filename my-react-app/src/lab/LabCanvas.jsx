import { useEffect, useRef } from 'react'

// Cinematic canvas renderer for the flask scene. A single requestAnimationFrame
// loop reads everything it needs from refs, so React re-renders never restart the
// animation. Displayed state (level, colour, particles, foam, glow) eases smoothly
// toward the targets supplied by `getTarget()`.
//
// The vessel is a proper conical (Erlenmeyer) flask drawn with bezier shoulders:
// narrow neck, sloping sides, wide base. Rendering is layered back-to-front:
// dark bench + contact glow, heat shimmer, danger halo, neck vapour, source
// bottle, pour stream + droplets, glass body, then the flask-clipped liquid
// (depth gradient, animated wavy surface, caustics), solids (metal ribbon /
// granules shrinking as they dissolve), sediment, precipitate, wobbling bubbles
// with rim + highlight, foam, ripples and colour blooms, finishing with the
// glass outline, neck reflection, graduations and a moving specular streak.
//
// Interaction: press-and-hold (mouse or touch) pours the selected reagent.

const MAX_VOLUME = 30 // mL — full flask

function easeFactor(dt, tau) {
  return 1 - Math.exp(-dt / tau)
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function getSolidTopY({ surfaceY, shoulderY, baseY, hasLiquid = false }) {
  const minY = shoulderY + 12
  const maxY = baseY - 24
  const fallbackOffset = hasLiquid ? 0 : 22
  return Math.max(minY, Math.min(maxY, surfaceY + 6 + fallbackOffset))
}

export default function LabCanvas({
  getTarget,
  streamColor,
  canPour,
  onPourStart,
  onPourTick,
  onPourEnd,
  soundRef,
  banner,
}) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  // Live prop mirrors so the rAF loop always sees the latest values.
  const getTargetRef = useRef(getTarget)
  const streamColorRef = useRef(streamColor)
  const canPourRef = useRef(canPour)
  const cbRef = useRef({ onPourStart, onPourTick, onPourEnd })
  const bannerRef = useRef(banner || null)

  useEffect(() => {
    getTargetRef.current = getTarget
    streamColorRef.current = streamColor
    canPourRef.current = canPour
    cbRef.current = { onPourStart, onPourTick, onPourEnd }
    bannerRef.current = banner || null
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
      glow: 0,
    }
    const bubbles = []
    const precip = []
    const ripples = []
    const drops = [] // falling droplets from the pour stream
    const vapor = [] // gas vapour rising from the flask neck
    const blooms = [] // expanding colour-change flashes
    let sediment = 0
    let resetNonce = 0
    let prevColor = { r: 224, g: 240, b: 250 }
    let waveClock = 0
    let bannerAlpha = 0 // eased fade for the reaction-outcome banner

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

    // ── Conical flask geometry ──
    function flaskGeom() {
      const { w, h } = dims
      const bw = Math.min(w * 0.52, 230) // base (widest) width
      const bh = Math.min(h * 0.62, 268) // total flask height
      const bx = w / 2 - bw / 2
      const by = h - bh - 22 // y of the neck mouth
      const cx = w / 2
      const neckW = Math.max(28, bw * 0.24)
      const neckH = bh * 0.28
      const shoulderY = by + neckH
      const baseY = by + bh
      return { w, h, bw, bh, bx, by, cx, neckW, neckH, shoulderY, baseY }
    }

    // Interior half-width of the flask at a given y (used to keep liquid,
    // bubbles and solids inside the glass).
    function halfWidthAt(g, y) {
      const neckHalf = g.neckW / 2 - 2
      if (y <= g.shoulderY) return neckHalf
      const baseHalf = g.bw / 2 - 8
      const t = clamp((y - g.shoulderY) / (g.baseY - g.shoulderY), 0, 1)
      return neckHalf + t * (baseHalf - neckHalf)
    }

    // The Erlenmeyer outline: neck → bezier shoulders → sloped conical sides →
    // gently rounded base.
    function flaskPath(g) {
      const nl = g.cx - g.neckW / 2
      const nr = g.cx + g.neckW / 2
      const bl = g.bx + 8
      const br = g.bx + g.bw - 8
      const sh = 18 // shoulder curve depth
      ctx.beginPath()
      ctx.moveTo(nl, g.by)
      ctx.lineTo(nl, g.shoulderY)
      // Left shoulder eases from the neck onto the conical side.
      ctx.bezierCurveTo(nl, g.shoulderY + sh * 0.7, nl - 6, g.shoulderY + sh, nl - 10, g.shoulderY + sh + 6)
      // Conical side down to the base-left corner.
      ctx.lineTo(bl + 4, g.baseY - 10)
      ctx.quadraticCurveTo(bl, g.baseY, bl + 12, g.baseY)
      // Base.
      ctx.lineTo(br - 12, g.baseY)
      ctx.quadraticCurveTo(br, g.baseY, br - 4, g.baseY - 10)
      // Right conical side up to the shoulder.
      ctx.lineTo(nr + 10, g.shoulderY + sh + 6)
      ctx.bezierCurveTo(nr + 6, g.shoulderY + sh, nr, g.shoulderY + sh * 0.7, nr, g.shoulderY)
      ctx.lineTo(nr, g.by)
      ctx.closePath()
    }

    function spawnBubble(g, surfaceY) {
      const r = 1.6 + Math.random() * 3.6
      const spawnY = g.baseY - 10 - Math.random() * 16
      const hw = halfWidthAt(g, spawnY) - 10
      bubbles.push({
        x: g.cx + (Math.random() - 0.5) * 2 * Math.max(6, hw),
        y: spawnY,
        r,
        vy: 16 + Math.random() * 34 + r * 3,
        vx: (Math.random() - 0.5) * 8,
        phase: Math.random() * Math.PI * 2,
        wob: 1 + Math.random() * 2,
        surfaceY,
      })
    }
    function spawnPrecip(g, color, surfaceY) {
      const y = surfaceY + 2 + Math.random() * 10
      const hw = halfWidthAt(g, Math.max(y, g.shoulderY + 10)) - 8
      precip.push({
        x: g.cx + (Math.random() - 0.5) * 2 * Math.max(6, hw),
        y,
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
    // Vapour puffs escaping the flask NECK while gas is produced: rise, expand,
    // drift and fade out completely before leaving the canvas.
    function spawnVapor(g) {
      vapor.push({
        x: g.cx + (Math.random() - 0.5) * 8,
        y: g.by - 2,
        r: 4 + Math.random() * 4,
        vy: -(24 + Math.random() * 26),
        vx: (Math.random() - 0.5) * 10,
        grow: 14 + Math.random() * 10,
        life: 1,
      })
    }
    function spawnBloom(g, surfaceY, color) {
      blooms.push({ x: g.cx, y: (surfaceY + g.baseY) / 2, r: 6, max: g.bw * 0.75, alpha: 0.6, color })
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
      const g = flaskGeom()

      if (target.resetNonce !== undefined && target.resetNonce !== resetNonce) {
        resetNonce = target.resetNonce
        bubbles.length = 0
        precip.length = 0
        ripples.length = 0
        drops.length = 0
        vapor.length = 0
        blooms.length = 0
        sediment = 0
        view.level = 0
        view.color = { r: 224, g: 240, b: 250, a: 0.32 }
        view.tilt = 0
        view.shimmer = 0
        view.danger = 0
        view.foam = 0
        view.glow = 0
        bannerAlpha = 0
      }

      if (pour.active && canPourRef.current) {
        cbRef.current.onPourTick?.(dt)
      }
      view.tilt += easeFactor(dt, 0.18) * ((pour.active ? 1 : 0) - view.tilt)

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

      // Liquid fills the conical body (bottom 65% of the flask height).
      const usable = g.bh * 0.66
      const surfaceY = g.baseY - view.level * usable

      const dColor = Math.abs(tc.r - prevColor.r) + Math.abs(tc.g - prevColor.g) + Math.abs(tc.b - prevColor.b)
      if (dColor > 120 && view.level > 0.05 && blooms.length < 3) {
        spawnBloom(g, surfaceY, { r: tc.r, g: tc.g, b: tc.b })
      }
      prevColor = { r: tc.r, g: tc.g, b: tc.b }

      // ── Particle spawning ──
      // Bubble spawn rate follows the reaction intensity: vigorous magnesium ≈
      // 3–5 per frame, moderate zinc ≈ 1–2, slow iron ≈ occasional, none ≈ 0.
      const gas = target.gas || {}
      if (gas.active && view.level > 0.04) {
        const n = gas.rate >= 0.9 ? 3 + (Math.random() < 0.7 ? 1 : 0) : gas.rate >= 0.45 ? 1 + (Math.random() < 0.6 ? 1 : 0) : Math.random() < gas.rate * 1.4 ? 1 : 0
        for (let i = 0; i < n; i++) spawnBubble(g, surfaceY)
        if (vapor.length < 42 && Math.random() < 0.25 + gas.rate * 0.5) spawnVapor(g)
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
        b.x += b.vx * dt
        b.vy *= 1 - 0.4 * dt // liquid resistance near the surface
        b.phase += dt * 6
        if (b.y <= surfaceY + 2) {
          // Pop: brief expanding ring at the surface.
          if (Math.random() < 0.6) spawnRipple(g, surfaceY, 0.45)
          bubbles.splice(i, 1)
        }
      }
      for (let i = precip.length - 1; i >= 0; i--) {
        const p = precip[i]
        const floor = g.baseY - 6 - sediment * 20
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
      for (let i = vapor.length - 1; i >= 0; i--) {
        const m = vapor[i]
        m.y += m.vy * dt
        m.x += m.vx * dt
        m.r += m.grow * dt
        m.life -= dt * 0.55
        if (m.life <= 0 || m.y < -20) vapor.splice(i, 1)
      }
      for (let i = blooms.length - 1; i >= 0; i--) {
        const bl = blooms[i]
        bl.r += dt * 220
        bl.alpha -= dt * 1.0
        if (bl.alpha <= 0 || bl.r > bl.max) blooms.splice(i, 1)
      }

      if (gas.active && !soundRef.current?.bubbleTimer) soundRef.current?.startBubbles()
      if (!gas.active && soundRef.current?.bubbleTimer) soundRef.current?.stopBubbles()

      bannerAlpha += easeFactor(dt, 0.3) * ((bannerRef.current ? 1 : 0) - bannerAlpha)

      draw(g, surfaceY, target)
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

    // Animated wavy liquid-surface path spanning the flask's interior width at
    // the surface, closed down around the conical body (the clip trims edges).
    function liquidSurfacePath(g, surfaceY, dipFn) {
      const hw = halfWidthAt(g, surfaceY) + 6
      const steps = 16
      ctx.beginPath()
      ctx.moveTo(g.cx - hw, g.baseY + 2)
      ctx.lineTo(g.cx - hw, surfaceY + dipFn(0))
      for (let i = 1; i <= steps; i++) {
        const fx = i / steps
        ctx.lineTo(g.cx - hw + fx * hw * 2, surfaceY + dipFn(fx))
      }
      ctx.lineTo(g.cx + hw, g.baseY + 2)
      ctx.closePath()
    }

    // Solids sitting in the flask: magnesium ribbon (a solid metallic strip that
    // shortens as it dissolves — NOT dashed, NOT a liquid), granular metals, or
    // an unreactive strip resting on the base.
    function drawSolid(g, solid, surfaceY) {
      const hasLiquid = surfaceY < g.baseY - 4
      const topY = getSolidTopY({ surfaceY, shoulderY: g.shoulderY, baseY: g.baseY, hasLiquid })
      if (solid.kind === 'ribbon') {
        const maxLen = Math.min(64, g.baseY - 14 - topY)
        const len = Math.max(6, maxLen * solid.remaining)
        const ribbonX = g.cx + 10
        const path = []
        for (let y = topY; y <= topY + len; y += 3) {
          path.push([ribbonX + Math.sin(y * 0.4) * 4, y])
        }
        ctx.save()
        // Metallic gradient along the strip's width — solid, continuous.
        const grad = ctx.createLinearGradient(ribbonX - 3, 0, ribbonX + 3, 0)
        grad.addColorStop(0, '#a8a8a8')
        grad.addColorStop(0.4, '#ffffff')
        grad.addColorStop(0.7, '#cfcfcf')
        grad.addColorStop(1, '#8f8f8f')
        ctx.strokeStyle = grad
        ctx.lineWidth = 6
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
        ctx.stroke()
        // Bright edge shine down the left side.
        ctx.strokeStyle = 'rgba(255,255,255,0.65)'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x - 2, y) : ctx.lineTo(x - 2, y)))
        ctx.stroke()
        ctx.restore()
      } else if (solid.kind === 'strip') {
        // Copper strip leaning against the flask wall — never dissolves.
        ctx.save()
        ctx.translate(g.cx - halfWidthAt(g, g.baseY - 12) * 0.55, g.baseY - 8)
        ctx.rotate(-0.5)
        ctx.fillStyle = solid.color
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'
        ctx.lineWidth = 1
        roundRect(-4, -34, 8, 34, 3)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      } else {
        // Granules scattered on the base, count shrinking as they dissolve.
        const count = Math.max(2, Math.round(10 * solid.remaining))
        ctx.fillStyle = solid.color
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 0.8
        for (let i = 0; i < count; i++) {
          const fx = ((i * 73) % 100) / 100 - 0.5
          const gy = g.baseY - 6 - ((i * 37) % 3) * 4
          const gx = g.cx + fx * (halfWidthAt(g, gy) * 1.4)
          const gr = 2.4 + ((i * 29) % 3)
          ctx.beginPath()
          ctx.arc(gx, gy, gr, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    function draw(g, surfaceY, target) {
      const { w, h, bx, bw, by, cx } = g
      ctx.clearRect(0, 0, w, h)

      // ── Background: dark stage so liquids and glassware glow ──
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#0c162c')
      bg.addColorStop(1, '#080f1e')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Contact glow under the flask.
      ctx.save()
      ctx.fillStyle = 'rgba(120,180,220,0.18)'
      ctx.beginPath()
      ctx.ellipse(cx, g.baseY + 8, bw * 0.5, 12, 0, 0, Math.PI * 2)
      ctx.filter = 'blur(1px)'
      ctx.fill()
      ctx.restore()

      // Heat shimmer above the flask (exothermic reactions).
      if (view.shimmer > 0.02) {
        ctx.save()
        for (let i = 0; i < 5; i++) {
          const t = performance.now() / 600 + i
          const x = cx - g.neckW + (i / 4) * g.neckW * 2
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

      // Gas vapour escaping the neck.
      for (const m of vapor) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, m.life) * 0.25
        ctx.fillStyle = 'rgba(200,220,255,0.6)'
        ctx.filter = 'blur(2px)'
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Danger glow halo around the flask.
      if (view.danger > 0.02) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 140)
        ctx.save()
        ctx.shadowColor = `rgba(225,60,45,${0.6 * view.danger})`
        ctx.shadowBlur = 26 + pulse * 18 * view.danger
        ctx.strokeStyle = `rgba(225,60,45,${0.55 * view.danger})`
        ctx.lineWidth = 4
        flaskPath(g)
        ctx.stroke()
        ctx.restore()
      }

      // ── Source bottle (tilts while pouring) ──
      drawBottle(g)

      // ── Pour stream + droplets (falls through the neck) ──
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

      // ── Subtle glass body fill (behind the liquid) ──
      const glassGradient = ctx.createLinearGradient(bx, 0, bx + bw, 0)
      glassGradient.addColorStop(0, 'rgba(140,200,255,0.08)')
      glassGradient.addColorStop(0.3, 'rgba(200,230,255,0.04)')
      glassGradient.addColorStop(0.7, 'rgba(200,230,255,0.04)')
      glassGradient.addColorStop(1, 'rgba(140,200,255,0.08)')
      ctx.fillStyle = glassGradient
      flaskPath(g)
      ctx.fill()

      // ── Flask liquid + everything inside the glass (clipped) ──
      ctx.save()
      flaskPath(g)
      ctx.clip()

      const dipFn = (fx) => {
        const edge = Math.cos((fx - 0.5) * Math.PI) // 1 centre → 0 edges
        const meniscus = -(1 - edge) * 5
        const wave = Math.sin(fx * 7 + waveClock * 2.2) * 1.6 * Math.min(1, view.level * 3)
        return meniscus + wave
      }

      if (view.level > 0.002) {
        const c = view.color
        const a = Math.min(0.96, c.a)
        const grad = ctx.createLinearGradient(0, surfaceY, 0, g.baseY)
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
          const yy = g.baseY - 14 - i * 10
          const hw = halfWidthAt(g, yy) - 6
          ctx.beginPath()
          for (let x = cx - hw; x < cx + hw; x += 6) {
            const off = Math.sin(x * 0.12 + waveClock * 1.6 + i) * 3
            if (x <= cx - hw + 6) ctx.moveTo(x, yy + off)
            else ctx.lineTo(x, yy + off)
          }
          ctx.stroke()
        }
        ctx.restore()

        // Bright surface highlight along the wavy meniscus.
        const hwS = halfWidthAt(g, surfaceY)
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        for (let i = 0; i <= 16; i++) {
          const fx = i / 16
          const x = cx - hwS + fx * hwS * 2
          const y = surfaceY + dipFn(fx)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Solids in the flask (metal ribbon / granules / strip).
      for (const s of target.solids || []) drawSolid(g, s, surfaceY)

      // Sediment layer (settled precipitate).
      if (sediment > 0.01) {
        const pc = target.precipitate?.color || { r: 230, g: 230, b: 235 }
        const sg = ctx.createLinearGradient(0, g.baseY - 6 - sediment * 20, 0, g.baseY)
        sg.addColorStop(0, `rgba(${pc.r | 0},${pc.g | 0},${pc.b | 0},0.6)`)
        sg.addColorStop(1, `rgba(${(pc.r * 0.85) | 0},${(pc.g * 0.85) | 0},${(pc.b * 0.85) | 0},0.95)`)
        ctx.fillStyle = sg
        ctx.beginPath()
        ctx.moveTo(bx, g.baseY)
        for (let x = bx; x <= bx + bw; x += 8) {
          const top = g.baseY - 6 - sediment * 20 + Math.sin(x * 0.3) * 1.5
          ctx.lineTo(x, top)
        }
        ctx.lineTo(bx + bw, g.baseY)
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

      // Gas bubbles: translucent body, bright rim, specular highlight, wobble.
      for (const b of bubbles) {
        const bxp = b.x + Math.sin(b.phase) * b.wob
        ctx.fillStyle = 'rgba(220,240,255,0.15)'
        ctx.beginPath()
        ctx.arc(bxp, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(200,230,255,0.8)'
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.beginPath()
        ctx.arc(bxp - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }

      // Colour-change blooms.
      for (const bl of blooms) {
        const rg = ctx.createRadialGradient(bl.x, bl.y, 0, bl.x, bl.y, bl.r)
        rg.addColorStop(0, `rgba(${bl.color.r | 0},${bl.color.g | 0},${bl.color.b | 0},${bl.alpha})`)
        rg.addColorStop(1, `rgba(${bl.color.r | 0},${bl.color.g | 0},${bl.color.b | 0},0)`)
        ctx.fillStyle = rg
        ctx.beginPath()
        ctx.arc(bl.x, bl.y, bl.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Foam cap (peroxide / vigorous gas).
      if (view.foam > 0.02) {
        const hwF = halfWidthAt(g, surfaceY)
        for (let i = 0; i < 26; i++) {
          const fx = cx - hwF + ((i * 37) % Math.max(20, hwF * 2))
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

      // ── Flask glass: outline, neck reflection, graduations, specular streak ──
      ctx.strokeStyle = 'rgba(150,210,255,0.5)'
      ctx.lineWidth = 2.5
      flaskPath(g)
      ctx.stroke()

      // Rim (mouth) highlight.
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx - g.neckW / 2 - 3, by)
      ctx.lineTo(cx + g.neckW / 2 + 3, by)
      ctx.stroke()

      // Inner neck reflection (left side).
      ctx.beginPath()
      ctx.moveTo(cx - g.neckW / 2 + 4, by + 4)
      ctx.lineTo(cx - g.neckW / 2 + 4, g.shoulderY - 4)
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Graduation marks on the conical body.
      ctx.strokeStyle = 'rgba(226,236,255,0.32)'
      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(226,236,255,0.5)'
      ctx.font = '10px ui-monospace, monospace'
      for (let i = 1; i <= 3; i++) {
        const my = g.baseY - (i / 4) * (g.baseY - g.shoulderY - 14)
        const hw = halfWidthAt(g, my)
        ctx.beginPath()
        ctx.moveTo(cx + hw - 18, my)
        ctx.lineTo(cx + hw - 6, my)
        ctx.stroke()
        ctx.fillText(`${i * 8}`, cx + hw - 34, my + 3)
      }

      // Moving specular streak across the glass.
      const t = (performance.now() / 2600) % 1
      const streakX = bx + t * bw
      const streak = ctx.createLinearGradient(streakX - 26, 0, streakX + 26, 0)
      streak.addColorStop(0, 'rgba(255,255,255,0)')
      streak.addColorStop(0.5, 'rgba(255,255,255,0.18)')
      streak.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.save()
      flaskPath(g)
      ctx.clip()
      ctx.fillStyle = streak
      ctx.fillRect(streakX - 26, by, 52, g.bh)
      ctx.restore()

      // ── Reaction-outcome banner (e.g. "No reaction") — fades in above the flask ──
      if (bannerAlpha > 0.02 && bannerRef.current) {
        ctx.save()
        ctx.globalAlpha = bannerAlpha
        ctx.font = 'bold 13px ui-monospace, monospace'
        ctx.textAlign = 'center'
        const textY = Math.max(18, by - 92)
        const textW = ctx.measureText(bannerRef.current).width
        ctx.fillStyle = 'rgba(8,15,30,0.72)'
        roundRect(cx - textW / 2 - 10, textY - 14, textW + 20, 22, 6)
        ctx.fill()
        ctx.fillStyle = '#ffcc66'
        ctx.fillText(bannerRef.current, cx, textY + 2)
        ctx.textAlign = 'start'
        ctx.restore()
      }
    }

    function drawBottle(g) {
      const { by, bw, cx } = g
      const bottleW = Math.min(64, bw * 0.42)
      const bottleH = bottleW * 1.5
      const anchorX = cx
      const anchorY = by - 84
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
        aria-label="Conical flask simulation. Press and hold to pour the selected chemical."
      />
    </div>
  )
}
