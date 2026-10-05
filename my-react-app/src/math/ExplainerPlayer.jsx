import { useEffect, useRef, useState } from 'react'
import { makeViewport, sizeCanvas } from './plot.js'
import { Narrator, estimateReadMs, speechSupported } from './narration.js'

// An animated explainer: a sequence of drawn scenes with a voice talking over
// them. This is the "video" for a maths lab, except it is rendered live from a
// few kilobytes of drawing code instead of streamed as megabytes of pixels —
// which is the only way an hour of explanation can reach a student on a slow
// connection.
//
// Each scene declares how long its animation runs and what the narrator says.
// A scene ends when BOTH the animation has finished and the voice has stopped,
// so the picture never races ahead of the explanation on a slow voice, and
// never stalls behind it on a fast one.

const EASE = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const PANE_GAP = 14
const PAD = { left: 52, right: 18, top: 18, bottom: 28 }

// Builds the canvas + viewports for a scene. Two-pane scenes get a second
// viewport sharing the same x-range, so f and f' stay vertically aligned
// exactly as they do in the interactive lab.
//
// Module-level rather than a component method: it depends only on its
// arguments, so keeping it out of the component stops it from invalidating the
// animation effect on every render.
function buildStage(canvas, wrap, scene) {
  if (!canvas || !wrap || !scene) return null
  const cssW = wrap.clientWidth
  if (cssW < 10) return null
  const cssH = Math.max(300, Math.min(520, cssW * 0.58))
  const { ctx, width, height } = sizeCanvas(canvas, cssW, cssH)

  const view = scene.view
  const two = Boolean(view.lower)
  const paneH = two ? (height - PANE_GAP) / 2 : height

  const vp = makeViewport({
    width, height: paneH, xMin: view.xMin, xMax: view.xMax,
    yMin: view.yMin, yMax: view.yMax, pad: PAD,
  })
  const vpLower = two
    ? makeViewport({
      width, height: paneH, xMin: view.xMin, xMax: view.xMax,
      yMin: view.lower.yMin, yMax: view.lower.yMax, pad: PAD,
    })
    : null

  // Scene authors call stage.lower(() => ...) to draw into the second pane
  // without having to manage the translate themselves.
  const lower = (fn) => {
    if (!vpLower) return
    ctx.save()
    ctx.translate(0, paneH + PANE_GAP)
    fn(vpLower)
    ctx.restore()
  }

  return { ctx, width, height, vp, vpLower, paneH, gap: PANE_GAP, lower }
}

function paintBackground(ctx, width, height) {
  ctx.clearRect(0, 0, width, height)
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, '#0c162c')
  bg.addColorStop(1, '#080f1e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
}

export default function ExplainerPlayer({ explainer, onFinish }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const progressRef = useRef(null)
  const narratorRef = useRef(null)

  const [sceneIndex, setSceneIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [finished, setFinished] = useState(false)

  const scenes = explainer?.scenes || []
  const scene = scenes[sceneIndex] || null

  // One narrator for the lifetime of the player.
  useEffect(() => {
    narratorRef.current = new Narrator()
    return () => {
      narratorRef.current?.dispose()
      narratorRef.current = null
    }
  }, [])

  // Static paint: whenever the scene changes or we are paused, show the scene's
  // final frame so there is always something meaningful on screen.
  useEffect(() => {
    if (playing) return undefined
    const paint = () => {
      const stage = buildStage(canvasRef.current, wrapRef.current, scene)
      if (!stage || !scene) return
      paintBackground(stage.ctx, stage.width, stage.height)
      scene.draw(stage.ctx, stage, 1)
    }
    paint()
    const ro = new ResizeObserver(paint)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [playing, scene])

  // The running scene: animation clock + narration, advancing when both finish.
  useEffect(() => {
    if (!playing || !scene) return undefined

    const narrator = narratorRef.current
    let raf = 0
    let speechDone = false
    const started = narrator?.speak(muted ? '' : scene.narration, () => {
      speechDone = true
    })
    const readMs = estimateReadMs(scene.narration)
    const animMs = scene.duration
    // If speech never started (muted, unsupported, or it failed), fall back to
    // holding the caption for a readable length of time.
    const fallbackMs = started ? 0 : readMs
    // Safety net so a voice that never fires onend cannot freeze the lesson.
    const hardCapMs = animMs + readMs * 2 + 6000

    const start = performance.now()

    const frame = (now) => {
      const elapsed = now - start
      const t = Math.min(1, elapsed / animMs)

      const stage = buildStage(canvasRef.current, wrapRef.current, scene)
      if (stage) {
        paintBackground(stage.ctx, stage.width, stage.height)
        scene.draw(stage.ctx, stage, EASE(t))
      }

      if (progressRef.current) {
        const overall = started
          ? Math.min(1, elapsed / Math.max(animMs, readMs))
          : Math.min(1, elapsed / Math.max(animMs, fallbackMs))
        progressRef.current.style.width = `${overall * 100}%`
      }

      const animDone = t >= 1
      const voiceDone = started ? speechDone : elapsed >= fallbackMs
      if ((animDone && voiceDone) || elapsed > hardCapMs) {
        if (sceneIndex < scenes.length - 1) {
          setSceneIndex(sceneIndex + 1)
        } else {
          setPlaying(false)
          setFinished(true)
        }
        return
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      narrator?.cancel()
    }
  }, [playing, sceneIndex, muted, scene, scenes.length])

  function goTo(index) {
    narratorRef.current?.cancel()
    setSceneIndex(Math.max(0, Math.min(scenes.length - 1, index)))
    setFinished(false)
  }

  function togglePlay() {
    if (finished) {
      setFinished(false)
      setSceneIndex(0)
      setPlaying(true)
      return
    }
    setPlaying((p) => !p)
  }

  function toggleMute() {
    setMuted((m) => {
      narratorRef.current?.setMuted(!m)
      return !m
    })
  }

  if (!scene) return null

  return (
    <div className="explainer">
      <div className="explainer-head">
        <div>
          <p className="explainer-eyebrow">Watch first</p>
          <h2 className="explainer-title">{explainer.title}</h2>
        </div>
        <span className="explainer-count">
          Scene {sceneIndex + 1} of {scenes.length}
        </span>
      </div>

      <div className="explainer-stage" ref={wrapRef}>
        <canvas ref={canvasRef} className="explainer-canvas" />
        {!playing && (
          <button
            type="button"
            className="explainer-overlay"
            onClick={togglePlay}
            aria-label={finished ? 'Replay the explainer' : 'Play the explainer'}
          >
            <span className="explainer-overlay-btn">{finished ? '↻' : '▶'}</span>
            <span className="explainer-overlay-label">
              {finished ? 'Replay from the start' : sceneIndex === 0 ? 'Play the explainer' : 'Resume'}
            </span>
          </button>
        )}
      </div>

      <div className="explainer-progress">
        <span ref={progressRef} className="explainer-progress-fill" />
      </div>

      <p className="explainer-caption" aria-live="polite">
        <strong>{scene.title}.</strong> {scene.narration}
      </p>

      <div className="explainer-transport">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => goTo(sceneIndex - 1)}
          disabled={sceneIndex === 0}
          aria-label="Previous scene"
        >
          ◀ Back
        </button>
        <button
          type="button"
          className="explainer-play"
          onClick={togglePlay}
          title={playing ? 'Pause' : 'Play — resuming restarts the current scene'}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : finished ? '↻' : '▶'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => goTo(sceneIndex + 1)}
          disabled={sceneIndex >= scenes.length - 1}
          aria-label="Next scene"
        >
          Next ▶
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={toggleMute}
          aria-pressed={muted}
          title={speechSupported() ? 'Mute the voice-over' : 'Voice-over is unavailable in this browser'}
        >
          {muted || !speechSupported() ? '🔇 Voice off' : '🔊 Voice on'}
        </button>
      </div>

      <ol className="explainer-chapters">
        {scenes.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={`explainer-chapter ${i === sceneIndex ? 'is-active' : ''} ${i < sceneIndex ? 'is-past' : ''}`}
              onClick={() => goTo(i)}
            >
              <span className="explainer-chapter-num">{i + 1}</span>
              {s.title}
            </button>
          </li>
        ))}
      </ol>

      {finished && onFinish && (
        <button type="button" className="btn btn-primary btn-full" onClick={onFinish}>
          I have watched this — read the notes →
        </button>
      )}

      {!speechSupported() && (
        <p className="explainer-note">
          This browser has no built-in voice, so the explanation is shown as captions under each scene.
        </p>
      )}
    </div>
  )
}
