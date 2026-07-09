import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeaker } from './useBeaker.js'
import BeakerStage from './BeakerStage.jsx'
import { getChemical } from './chemicals.js'
import { AnimatedNumber, Thermometer, GoalTracker } from './Instruments.jsx'

// Metals & acids — discover the reactivity series. Magnesium fizzes violently in
// HCl, zinc steadily, iron slowly, and copper not at all (it sits below hydrogen
// in the series). Distilled water never reacts with any of them. A carbonate
// fizzes CO₂ for comparison. Feedback is a short on-canvas + on-screen banner
// (no chat) that reads "No reaction" for copper or water, or names the gas.
const FALLBACK = ['Magnesium ribbon', 'Zinc granules', 'Iron filings', 'Copper strip', 'Sodium carbonate', 'HCl', 'Distilled water']
const METAL_IDS = ['Magnesium ribbon', 'Zinc granules', 'Iron filings', 'Copper strip']

export default function MetalAcidLab({ lab }) {
  const { experiment, setProgress, setSummary } = lab
  const total = experiment?.steps?.length || 5
  const chemicals = experiment?.availableChemicals?.length ? experiment.availableChemicals : FALLBACK

  const testedRef = useRef(new Set())
  const [tested, setTested] = useState([])
  const [banner, setBanner] = useState(null)
  const bannerTimeoutRef = useRef(0)

  const showBanner = useCallback((text) => {
    setBanner(text)
    clearTimeout(bannerTimeoutRef.current)
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), 4000)
  }, [])
  useEffect(() => () => clearTimeout(bannerTimeoutRef.current), [])

  const onCommit = useCallback(
    ({ after, acc, selected }) => {
      const acidPresent = acc.molesAcid - acc.molesBase > 0.02
      const metalPresent = METAL_IDS.some((id) => (acc.contents[id] || 0) > 0 || (acc.salts?.[id] || 0) > 0)

      // ── Feedback banner (short, on-canvas + on-screen — no chat) ──
      if (selected === 'Distilled water' && metalPresent) {
        showBanner('No reaction — water alone cannot displace hydrogen')
      } else if (selected === 'Distilled water' && !metalPresent && (acc.totalVolume > 0 || Object.keys(acc.contents || {}).length > 0)) {
        showBanner('Flask rinsed — ready for a fresh test')
      } else if (selected === 'Copper strip' && acidPresent) {
        showBanner('No reaction — copper is below hydrogen in the series')
      } else if ((acc.contents['Copper strip'] || 0) > 0 && selected === 'HCl' && !after.gas.active) {
        showBanner('No reaction — copper is below hydrogen in the series')
      } else if (after.gas.active && after.gas.name === 'H₂') {
        const label =
          after.gas.rate >= 0.9
            ? 'Vigorous reaction — H₂ gas + strong heat'
            : after.gas.rate >= 0.45
              ? 'Steady reaction — H₂ gas + gentle heat'
              : 'Slow reaction — a few H₂ bubbles'
        showBanner(label)
      } else if (after.gas.active && after.gas.name === 'CO₂') {
        showBanner('CO₂ gas — a carbonate reaction, not a metal reaction')
      }

      // ── Progress: each metal tested WITH acid + the carbonate = 5 steps ──
      if (acidPresent) {
        for (const id of METAL_IDS) {
          if ((acc.contents[id] || 0) > 0 || (acc.salts?.[id] || 0) > 0) testedRef.current.add(id)
        }
      }
      if (after.gas.name === 'CO₂') testedRef.current.add('Sodium carbonate')
      const list = [...testedRef.current]
      setTested(list)
      setProgress({ completed: Math.min(total, list.length), total })
      setSummary({ precisionAchieved: list.length >= 4 })
    },
    [total, setProgress, setSummary, showBanner],
  )

  const sim = useBeaker({ onCommit })

  const reset = () => {
    testedRef.current = new Set()
    setTested([])
    setBanner(null)
    sim.reset()
    setProgress({ completed: Math.max(0, Math.min(total, 1)), total })
  }

  const gas = sim.readout.gas
  const temp = sim.readout.temp

  // Reactivity ranking built live from what the student has tested.
  const ranked = METAL_IDS.filter((id) => tested.includes(id))

  const readouts = (
    <div className="sim-readouts">
      <div className="readout-chip thermo-chip">
        <span className="readout-label">Temp</span>
        <AnimatedNumber className="readout-value" value={temp} decimals={1} suffix=" °C" />
        <Thermometer temp={temp} />
      </div>
      <div className="readout-chip">
        <span className="readout-label">Gas coming off</span>
        <span className="readout-value" style={{ fontSize: '1.1rem' }}>{gas.active ? gas.name : 'None'}</span>
        <span className="readout-sub">
          {gas.active ? (gas.rate >= 0.9 ? 'vigorous effervescence' : gas.rate >= 0.45 ? 'steady bubbles' : 'slow bubbles') : 'no reaction'}
        </span>
      </div>
      <div className="readout-chip">
        <span className="readout-label">Materials tested</span>
        <AnimatedNumber className="readout-value" value={tested.length} decimals={0} suffix=" / 5" />
        <span className="readout-sub">{ranked.length ? ranked.map((id) => getChemical(id).formula).join(' > ') : 'build the reactivity series'}</span>
      </div>
    </div>
  )

  const extra = (
    <GoalTracker
      title="Build the reactivity series"
      goals={[
        { label: 'Magnesium + acid — vigorous H₂ (hot!)', done: tested.includes('Magnesium ribbon') },
        { label: 'Zinc + acid — steady H₂', done: tested.includes('Zinc granules') },
        { label: 'Iron + acid — slow H₂', done: tested.includes('Iron filings') },
        { label: 'Copper + acid — NO reaction', done: tested.includes('Copper strip') },
        { label: 'Carbonate + acid — CO₂ for comparison', done: tested.includes('Sodium carbonate') },
      ]}
    />
  )

  return (
    <div className="sim chemistry-lab">
      <BeakerStage
        sim={sim}
        chemicals={chemicals}
        hint="Add a metal first, then pour hydrochloric acid on it and watch the reaction. Rinse with distilled water between tests if you want to start fresh."
        readouts={readouts}
        extra={extra}
        onReset={reset}
        banner={banner}
      />
    </div>
  )
}
