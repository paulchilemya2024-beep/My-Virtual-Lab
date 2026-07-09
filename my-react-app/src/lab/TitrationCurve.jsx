import { useEffect, useRef } from 'react'

// A small live titration-curve graph: pH (y, 0–14) vs volume of base added
// (x, 0–35 mL). It redraws whenever a new point is plotted, so the classic
// S-curve emerges as the student adds NaOH. A dotted line marks pH 7 (the
// equivalence point); it turns green once the curve passes through it.

const X_MAX = 35
const Y_MAX = 14
const EQUIV_X = 25

export default function TitrationCurve({ points, reached }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pointsRef = useRef(points)
  const reachedRef = useRef(reached)

  useEffect(() => {
    pointsRef.current = points
    reachedRef.current = reached
    draw()
  })

  function draw() {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = wrap.clientWidth
    const h = wrap.clientHeight || 200
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const padL = 32
    const padR = 12
    const padT = 12
    const padB = 22
    const plotW = w - padL - padR
    const plotH = h - padT - padB
    const sx = (v) => padL + (v / X_MAX) * plotW
    const sy = (ph) => padT + (1 - ph / Y_MAX) * plotH

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0d1526'
    ctx.fillRect(0, 0, w, h)

    // Grid + axis labels
    ctx.strokeStyle = 'rgba(226,236,255,0.1)'
    ctx.fillStyle = 'rgba(226,236,255,0.55)'
    ctx.lineWidth = 1
    ctx.font = '9px ui-monospace, monospace'
    ctx.textAlign = 'center'
    for (let v = 0; v <= X_MAX; v += 5) {
      ctx.beginPath(); ctx.moveTo(sx(v), padT); ctx.lineTo(sx(v), padT + plotH); ctx.stroke()
      ctx.fillText(`${v}`, sx(v), h - 8)
    }
    ctx.textAlign = 'right'
    for (let p = 0; p <= Y_MAX; p += 2) {
      ctx.beginPath(); ctx.moveTo(padL, sy(p)); ctx.lineTo(padL + plotW, sy(p)); ctx.stroke()
      ctx.fillText(`${p}`, padL - 4, sy(p) + 3)
    }
    ctx.textAlign = 'center'
    ctx.fillText('mL of base added', padL + plotW / 2, h - 0.5)

    // Equivalence volume marker (25 mL)
    ctx.strokeStyle = 'rgba(226,236,255,0.18)'
    ctx.setLineDash([3, 4])
    ctx.beginPath(); ctx.moveTo(sx(EQUIV_X), padT); ctx.lineTo(sx(EQUIV_X), padT + plotH); ctx.stroke()

    // pH 7 equivalence line (green once reached)
    ctx.strokeStyle = reachedRef.current ? '#00e08a' : 'rgba(226,236,255,0.5)'
    ctx.lineWidth = reachedRef.current ? 2 : 1.5
    ctx.beginPath(); ctx.moveTo(padL, sy(7)); ctx.lineTo(padL + plotW, sy(7)); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = reachedRef.current ? '#00e08a' : 'rgba(226,236,255,0.6)'
    ctx.textAlign = 'left'
    ctx.font = 'bold 9px ui-monospace, monospace'
    ctx.fillText('Equivalence point (pH 7)', padL + 4, sy(7) - 4)

    // The curve
    const pts = pointsRef.current || []
    if (pts.length > 0) {
      ctx.strokeStyle = '#00B4A0'
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      pts.forEach((pt, i) => {
        const x = sx(pt.v)
        const y = sy(pt.ph)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      // Plotted dots (sparse so it stays readable)
      ctx.fillStyle = 'rgba(0,143,126,0.55)'
      const stride = Math.max(1, Math.floor(pts.length / 60))
      for (let i = 0; i < pts.length; i += stride) {
        ctx.beginPath(); ctx.arc(sx(pts[i].v), sy(pts[i].ph), 1.6, 0, Math.PI * 2); ctx.fill()
      }
      // Current point highlighted
      const cur = pts[pts.length - 1]
      ctx.fillStyle = '#008F7E'
      ctx.beginPath(); ctx.arc(sx(cur.v), sy(cur.ph), 4, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
    }
  }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={`titration-curve ${reached ? 'is-reached' : ''}`}>
      <div className="titration-curve-head">
        <span className="readout-label">Titration curve</span>
        {reached && <span className="equiv-flash">✓ Equivalence point reached!</span>}
      </div>
      <div ref={wrapRef} className="titration-curve-canvas-wrap">
        <canvas ref={canvasRef} role="img" aria-label="Titration curve: pH versus volume of base added." />
      </div>
    </div>
  )
}
