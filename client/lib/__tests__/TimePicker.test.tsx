import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimePicker } from '@/components/shared/TimePicker'
import i18n from '@/i18n'

/** Hour select is the first combobox, minute the second. */
function hourSelect() {
  return screen.getAllByRole('combobox')[0] as HTMLSelectElement
}
function minuteSelect() {
  return screen.getAllByRole('combobox')[1] as HTMLSelectElement
}

afterEach(async () => {
  if (i18n.resolvedLanguage !== 'en') {
    await i18n.changeLanguage('en')
  }
})

describe('TimePicker', () => {
  describe('English (12h)', () => {
    it('renders empty selects with minute disabled when value is empty', () => {
      render(<TimePicker value="" onChange={vi.fn()} />)
      expect(hourSelect().value).toBe('')
      expect(minuteSelect()).toBeDisabled()
      expect(screen.getByRole('button', { name: 'AM' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'PM' })).toBeInTheDocument()
    })

    it('derives 12h fields from a morning 24h value', () => {
      render(<TimePicker value="08:00" onChange={vi.fn()} />)
      expect(hourSelect().value).toBe('8')
      expect(minuteSelect().value).toBe('00')
      expect(minuteSelect()).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'AM' }).className).toContain('tab-pill-active')
    })

    it('derives 12h fields with PM from an afternoon value', () => {
      render(<TimePicker value="13:30" onChange={vi.fn()} />)
      expect(hourSelect().value).toBe('1')
      expect(minuteSelect().value).toBe('30')
      expect(screen.getByRole('button', { name: 'PM' }).className).toContain('tab-pill-active')
    })

    it('maps midnight to 12 AM', () => {
      render(<TimePicker value="00:30" onChange={vi.fn()} />)
      expect(hourSelect().value).toBe('12')
      expect(screen.getByRole('button', { name: 'AM' }).className).toContain('tab-pill-active')
    })

    it('maps noon to 12 PM', () => {
      render(<TimePicker value="12:00" onChange={vi.fn()} />)
      expect(hourSelect().value).toBe('12')
      expect(screen.getByRole('button', { name: 'PM' }).className).toContain('tab-pill-active')
    })

    it.each<[string, () => void, string]>([
      ['the hour changes', () => fireEvent.change(hourSelect(), { target: { value: '10' } }), '10:00'],
      ['the period changes to PM', () => fireEvent.click(screen.getByRole('button', { name: 'PM' })), '20:00'],
      ['the minute changes', () => fireEvent.change(minuteSelect(), { target: { value: '45' } }), '08:45'],
    ])('emits a 24h value when %s', (_desc, interaction, expected) => {
      const onChange = vi.fn()
      render(<TimePicker value="08:00" onChange={onChange} />)
      interaction()
      expect(onChange).toHaveBeenCalledWith(expected)
    })

    it('maps 12 AM to 00:00 when hour is set to 12', () => {
      const onChange = vi.fn()
      render(<TimePicker value="08:00" onChange={onChange} />)
      fireEvent.change(hourSelect(), { target: { value: '12' } })
      expect(onChange).toHaveBeenCalledWith('00:00')
    })

    it('emits an empty string when the hour is cleared', () => {
      const onChange = vi.fn()
      render(<TimePicker value="08:00" onChange={onChange} />)
      fireEvent.change(hourSelect(), { target: { value: '' } })
      expect(onChange).toHaveBeenCalledWith('')
    })
  })

  describe('pt-BR (24h)', () => {
    it('renders a 24h clock with no AM/PM toggle', async () => {
      await i18n.changeLanguage('pt-BR')
      render(<TimePicker value="08:00" onChange={vi.fn()} />)
      expect(hourSelect().value).toBe('08')
      expect(minuteSelect().value).toBe('00')
      expect(screen.queryByRole('button', { name: 'AM' })).not.toBeInTheDocument()
      const options = Array.from(hourSelect().options).map((o) => o.value)
      expect(options).toContain('00')
      expect(options).toContain('23')
      expect(options).not.toContain('24')
    })

    it('emits a 24h value when the hour changes', async () => {
      await i18n.changeLanguage('pt-BR')
      const onChange = vi.fn()
      render(<TimePicker value="08:00" onChange={onChange} />)
      fireEvent.change(hourSelect(), { target: { value: '15' } })
      expect(onChange).toHaveBeenCalledWith('15:00')
    })

    it('emits a 24h value when the minute changes', async () => {
      await i18n.changeLanguage('pt-BR')
      const onChange = vi.fn()
      render(<TimePicker value="08:00" onChange={onChange} />)
      fireEvent.change(minuteSelect(), { target: { value: '30' } })
      expect(onChange).toHaveBeenCalledWith('08:30')
    })
  })
})
