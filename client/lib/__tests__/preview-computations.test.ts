import { describe, it, expect } from 'vitest'
import { computeResistances } from '@/lib/preview-computations'
import type { PreviewSheetState } from '@/lib/preview-types'

function makeState(overrides: Record<string, unknown> = {}): PreviewSheetState {
  return {
    template: { resistances: [] },
    resistanceManualValues: {},
    resistanceComponents: {},
    ...overrides,
  } as unknown as PreviewSheetState
}

describe('computeResistances', () => {
  it('returns an empty array when there are no resistances', () => {
    const state = makeState({ template: { resistances: null } as never })
    expect(computeResistances(state, {})).toEqual([])
  })

  it('returns an empty array when resistances is undefined', () => {
    const state = makeState({})
    expect(computeResistances(state, {})).toEqual([])
  })

  describe('MANUAL resistances', () => {
    it('computes total from the manual value and maps components', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'r1',
              name: 'Fire Res',
              calculationType: 'MANUAL',
              order: 0,
              components: [
                { id: 'c1', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 0 },
              ],
              attributeModifiers: [],
            },
          ],
        },
        resistanceManualValues: { r1: '7.5' },
        resistanceComponents: { c1: '2' },
      })
      const result = computeResistances(state, {})
      expect(result).toEqual([
        {
          id: 'r1',
          name: 'Fire Res',
          calculationType: 'MANUAL',
          total: 7.5,
          components: [{ id: 'c1', name: 'Base', value: 2, editableByPlayer: true }],
          manualValue: '7.5',
        },
      ])
    })

    it('falls back to total 0 and manualValue null when manual value is empty', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'r1',
              name: 'Fire Res',
              calculationType: 'MANUAL',
              order: 0,
              components: [
                { id: 'c1', name: 'Base', editableByPlayer: false, defaultValue: '0', order: 0 },
              ],
              attributeModifiers: [],
            },
          ],
        },
        resistanceManualValues: { r1: null },
        resistanceComponents: { c1: 'not-a-number' },
      })
      const result = computeResistances(state, {})
      expect(result[0].total).toBe(0)
      expect(result[0].manualValue).toBeNull()
      expect(result[0].components[0].value).toBe(0)
      expect(result[0].components[0].editableByPlayer).toBe(false)
    })

    it('parses integer manual values', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'r1',
              name: 'Cold Res',
              calculationType: 'MANUAL',
              order: 0,
              components: [],
              attributeModifiers: [],
            },
          ],
        },
        resistanceManualValues: { r1: '4' },
        resistanceComponents: {},
      })
      expect(computeResistances(state, {})[0].total).toBe(4)
    })
  })

  describe('CALCULATED resistances', () => {
    it('sums component values', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'r1',
              name: 'Acid Res',
              calculationType: 'CALCULATED',
              order: 0,
              components: [
                { id: 'c1', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 0 },
                { id: 'c2', name: 'Bonus', editableByPlayer: false, defaultValue: '0', order: 1 },
              ],
              attributeModifiers: [],
            },
          ],
        },
        resistanceComponents: { c1: '10', c2: '3.5' },
      })
      const result = computeResistances(state, {})
      expect(result[0]).toMatchObject({
        id: 'r1',
        name: 'Acid Res',
        calculationType: 'CALCULATED',
        total: 13.5,
        manualValue: null,
      })
      expect(result[0].components).toEqual([
        { id: 'c1', name: 'Base', value: 10, editableByPlayer: true },
        { id: 'c2', name: 'Bonus', value: 3.5, editableByPlayer: false },
      ])
    })

    it('treats invalid component values as 0', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'r1',
              name: 'Necro Res',
              calculationType: 'CALCULATED',
              order: 0,
              components: [
                { id: 'c1', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 0 },
              ],
              attributeModifiers: [],
            },
          ],
        },
        resistanceComponents: { c1: 'abc' },
      })
      expect(computeResistances(state, {})[0].total).toBe(0)
    })

    it('adds enabled attribute modifier results', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'r1',
              name: 'Phys Res',
              calculationType: 'CALCULATED',
              order: 0,
              components: [
                { id: 'c1', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 0 },
              ],
              attributeModifiers: [
                { id: 'am1', attributeId: 'str', enabled: true },
                { id: 'am2', attributeId: 'dex', enabled: true },
              ],
            },
          ],
        },
        resistanceComponents: { c1: '5' },
      })
      const result = computeResistances(state, { str: 3, dex: -1 })
      // 5 + 3 + (-1) = 7
      expect(result[0].total).toBe(7)
    })

    it('skips disabled attribute modifiers and missing modifier results', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'r1',
              name: 'Phys Res',
              calculationType: 'CALCULATED',
              order: 0,
              components: [
                { id: 'c1', name: 'Base', editableByPlayer: true, defaultValue: '0', order: 0 },
              ],
              attributeModifiers: [
                { id: 'am1', attributeId: 'str', enabled: false },
                { id: 'am2', attributeId: 'dex', enabled: true },
              ],
            },
          ],
        },
        resistanceComponents: { c1: '2' },
      })
      // dex has no entry in modifierResults → ?? 0
      expect(computeResistances(state, {})[0].total).toBe(2)
    })

    it('mixes MANUAL and CALCULATED resistances in one pass', () => {
      const state = makeState({
        template: {
          resistances: [
            {
              id: 'm1',
              name: 'Manual',
              calculationType: 'MANUAL',
              order: 0,
              components: [],
              attributeModifiers: [],
            },
            {
              id: 'c1',
              name: 'Calc',
              calculationType: 'CALCULATED',
              order: 1,
              components: [],
              attributeModifiers: [],
            },
          ],
        },
        resistanceManualValues: { m1: '9' },
        resistanceComponents: {},
      })
      const result = computeResistances(state, {})
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ id: 'm1', calculationType: 'MANUAL', total: 9 })
      expect(result[1]).toMatchObject({ id: 'c1', calculationType: 'CALCULATED', total: 0 })
    })
  })
})
