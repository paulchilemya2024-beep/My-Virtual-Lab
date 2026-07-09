import test from 'node:test'
import assert from 'node:assert/strict'
import { addChemical, createState } from './reactions.js'

test('solid metals add a much larger visible amount when poured', () => {
  const base = createState().acc
  const result = addChemical(base, 'Magnesium ribbon', 1)

  assert.equal(result.acc.contents['Magnesium ribbon'] > 1, true)
  assert.equal(result.acc.contents['Magnesium ribbon'] >= 8, true)
})

test('distilled water mixes into an existing solution instead of clearing it', () => {
  const base = createState().acc
  const withIndicator = addChemical(base, 'Universal indicator', 2).acc
  const result = addChemical(withIndicator, 'Distilled water', 3)

  assert.equal(result.acc.contents['Universal indicator'] > 0, true)
  assert.equal(result.acc.contents['Distilled water'] > 0, true)
  assert.equal(result.acc.totalVolume > 2, true)
})

test('distilled water preserves earlier reagents while adding volume', () => {
  const base = createState().acc
  const withSilver = addChemical(base, 'Silver nitrate', 2).acc
  const result = addChemical(withSilver, 'Distilled water', 4)

  assert.equal(result.acc.contents['Silver nitrate'] > 0, true)
  assert.equal(result.acc.contents['Distilled water'] > 0, true)
  assert.equal(result.acc.totalVolume > 2, true)
})
