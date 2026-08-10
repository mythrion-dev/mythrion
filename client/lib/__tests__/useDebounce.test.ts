import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce, useDebouncedCallback } from '@/hooks/useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } },
    )
    expect(result.current).toBe('a')
  })

  it('keeps the previous value until the delay elapses, then updates', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } },
    )
    expect(result.current).toBe('a')

    // Change the value — debounced value must stay stale during the delay.
    rerender({ value: 'b' })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe('b')
  })

  it('resets the timer when the value changes again mid-delay (trailing edge)', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    // New change before the timer fires — previous timer is discarded.
    rerender({ value: 'c' })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('c')
  })

  it('clears the pending timer on unmount (cleanup)', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'b' })
    unmount()

    // Advancing time after unmount must not throw / update state.
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1000)
      })
    }).not.toThrow()
    // Value is frozen at the last debounced value ('a' — 'b' never landed).
    expect(result.current).toBe('a')
  })

  it('re-runs the debounce when the delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 500 } },
    )

    rerender({ value: 'b', delay: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('b')
  })

  it('stays stale when advancing less than the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 400),
      { initialProps: { value: 'a' } },
    )
    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(399)
    })
    expect(result.current).toBe('a')
  })
})

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call the callback before the delay elapses', () => {
    const fn = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 500))

    act(() => {
      result.current('first')
    })
    expect(fn).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(fn).not.toHaveBeenCalled()
  })

  it('calls the callback once after the delay elapses, with the args', () => {
    const fn = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 500))

    act(() => {
      result.current('hello', 42)
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('hello', 42)
  })

  it('fires only once with the latest args when called repeatedly (trailing)', () => {
    const fn = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 300))

    act(() => {
      result.current('first')
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    act(() => {
      result.current('second')
    })
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('second')
  })

  it('clears a previous pending call when a new call is made', () => {
    const fn = vi.fn()
    const { result } = renderHook(() => useDebouncedCallback(fn, 200))

    act(() => {
      result.current('a')
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => {
      result.current('b')
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // Only 200ms after the LAST call → 'a' (scheduled at t=0, would fire t=200)
    // must NOT have fired; 'b' fires at t=200 (last call was at t=100).
    expect(fn).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })

  it('returns a stable reference until deps change', () => {
    const fn = vi.fn()
    const { result, rerender } = renderHook(
      ({ cb, delay }: { cb: typeof fn; delay: number }) =>
        useDebouncedCallback(cb, delay),
      { initialProps: { cb: fn, delay: 300 } },
    )

    const first = result.current
    rerender({ cb: fn, delay: 300 })
    // Same deps → same cached function.
    expect(result.current).toBe(first)

    rerender({ cb: fn, delay: 500 })
    // Changed delay → new function.
    expect(result.current).not.toBe(first)
  })

  it('uses the latest callback/delay after a rerender', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const { result, rerender } = renderHook(
      ({ cb, delay }: { cb: typeof fn1; delay: number }) =>
        useDebouncedCallback(cb, delay),
      { initialProps: { cb: fn1, delay: 300 } },
    )

    act(() => {
      result.current('old')
    })
    rerender({ cb: fn2, delay: 100 })

    // Calling the NEW debounced function clears the old pending timer.
    act(() => {
      result.current('new')
    })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith('new')
  })
})
