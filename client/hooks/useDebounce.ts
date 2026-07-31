'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

/**
 * Returns a debounced version of the value.
 * The returned value only updates after the specified delay
 * of inactivity.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}

/**
 * Returns a debounced version of the callback.
 * The callback only fires after the specified delay
 * of inactivity since the last call.
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delayMs: number,
): T {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedFn = useCallback(
    ((...args: any[]) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        callback(...args)
      }, delayMs)
    }) as T,
    [callback, delayMs],
  )

  return debouncedFn
}
