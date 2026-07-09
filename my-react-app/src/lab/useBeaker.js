import { useCallback, useEffect, useRef, useState } from 'react'
import { createState, addChemical, derive, computeEvents, reactTick, rinse as rinseAcc } from './reactions.js'
import SoundEngine from './sound.js'

// Shared beaker engine for every "pour reagents into a flask" chemistry sim
// (indicators, precipitation, iodine–starch, peroxide, metals & acids). It owns
// the reaction accumulator, the eased render target, the sound engine and the
// press-and-hold pour gesture, and hands the host component a single `onCommit`
// callback fired once per completed pour. Each experiment supplies its OWN
// `onCommit` (goal logic, progress) so the sims behave as
// genuinely separate experiments rather than one shared acid–base beaker.
export function useBeaker({ onCommit, maxVolume = 30 }) {
  const [selectedChemical, setSelectedChemical] = useState('')
  const [flow, setFlow] = useState(2)
  const [muted, setMuted] = useState(false)
  const [readout, setReadout] = useState(() => derive(createState().acc))

  // All refs seeded from non-ref expressions (eslint react-hooks/refs).
  const accRef = useRef(createState().acc)
  const targetRef = useRef(derive(createState().acc))
  const flowRef = useRef(2)
  const selectedRef = useRef('')
  const beforePourRef = useRef(null)
  const pouredRef = useRef(0)
  const lastSyncRef = useRef(0)
  const resetNonceRef = useRef(0)
  const soundRef = useRef(null)
  const onCommitRef = useRef(onCommit)
  const maxRef = useRef(maxVolume)

  useEffect(() => {
    flowRef.current = flow
  }, [flow])
  useEffect(() => {
    selectedRef.current = selectedChemical
  }, [selectedChemical])
  useEffect(() => {
    onCommitRef.current = onCommit
    maxRef.current = maxVolume
  })

  const syncReadout = useCallback(() => {
    setReadout(targetRef.current)
  }, [])

  // Sound engine + the reaction clock. Reactions evolve over real time: metals
  // dissolve and consume acid, temperature climbs gradually toward the reaction
  // peak and cools back to room temperature afterwards.
  useEffect(() => {
    soundRef.current = new SoundEngine()
    let lastTick = performance.now()
    const clock = setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.5, (now - lastTick) / 1000)
      lastTick = now
      accRef.current = reactTick(accRef.current, dt)
      setTargetFromAcc(accRef.current)
      syncReadout()
    }, 150)
    const engine = soundRef.current
    return () => {
      clearInterval(clock)
      engine.dispose()
    }
  }, [syncReadout])

  useEffect(() => {
    soundRef.current?.setMuted(muted)
  }, [muted])

  const getTarget = useCallback(() => targetRef.current, [])

  const setTargetFromAcc = useCallback((acc) => {
    targetRef.current = { ...derive(acc), resetNonce: resetNonceRef.current }
    return targetRef.current
  }, [])

  const rinse = useCallback(() => {
    soundRef.current?.resume?.()
    soundRef.current?.clink?.()
    const { acc } = rinseAcc(accRef.current)
    accRef.current = acc
    setTargetFromAcc(acc)
    beforePourRef.current = null
    pouredRef.current = 0
    lastSyncRef.current = 0
    setReadout(targetRef.current)
    setSelectedChemical('')
  }, [setTargetFromAcc])

  const onPourStart = useCallback(() => {
    soundRef.current?.resume()
    beforePourRef.current = targetRef.current
    pouredRef.current = 0
  }, [])

  const onPourTick = useCallback(
    (dt) => {
      const sel = selectedRef.current
      if (!sel) return
      if (targetRef.current.volume >= maxRef.current) return
      const dv = flowRef.current * 0.8 * dt
      const { acc } = addChemical(accRef.current, sel, dv)
      pouredRef.current += dv
      accRef.current = acc
      setTargetFromAcc(acc)
      const now = performance.now()
      if (now - lastSyncRef.current > 110) {
        lastSyncRef.current = now
        syncReadout()
      }
    },
    [syncReadout],
  )

  const onPourEnd = useCallback(() => {
    const before = beforePourRef.current
    const after = targetRef.current
    syncReadout()
    if (!before || !selectedRef.current) return
    if (pouredRef.current < 0.05) return
    const sel = selectedRef.current
    const events = computeEvents(before, after, accRef.current)
    events.forEach((ev) => soundRef.current?.play(ev))
    onCommitRef.current?.({
      before,
      after,
      acc: accRef.current,
      events,
      poured: pouredRef.current,
      selected: sel,
      sound: soundRef.current,
    })
  }, [syncReadout])

  const selectChemical = useCallback((name) => {
    setSelectedChemical(name)
    soundRef.current?.resume()
    soundRef.current?.clink()
  }, [])

  // Rinse the flask back to empty. Host components reset their own goal state.
  const reset = useCallback(() => {
    accRef.current = createState().acc
    resetNonceRef.current += 1
    setTargetFromAcc(accRef.current)
    beforePourRef.current = null
    pouredRef.current = 0
    lastSyncRef.current = 0
    soundRef.current?.stopPour?.()
    soundRef.current?.stopBubbles?.()
    setReadout(targetRef.current)
    setSelectedChemical('')
  }, [setTargetFromAcc])

  return {
    selectedChemical,
    selectChemical,
    flow,
    setFlow,
    muted,
    setMuted,
    readout,
    getTarget,
    soundRef,
    reset,
    rinse,
    pourHandlers: { onPourStart, onPourTick, onPourEnd },
  }
}
