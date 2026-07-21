import { describe, it, expect, vi } from 'vitest'
import { render, screen, renderHook, act, fireEvent } from '@testing-library/react'
import { NavigationProvider, useNavigation, useBreadcrumbs } from '../navigation-context'
import type { ReactNode } from 'react'

// ════════════════════════════════════════════════════════════
// NavigationProvider + useNavigation
// ════════════════════════════════════════════════════════════

describe('NavigationProvider', () => {
  it('wraps children without crashing', () => {
    render(
      <NavigationProvider>
        <span>child</span>
      </NavigationProvider>,
    )
    expect(screen.getByText('child')).toBeInTheDocument()
  })

  it('provides context with default empty breadcrumbs', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })
    expect(result.current.breadcrumbs).toEqual([])
  })

  it('throws when useNavigation is called outside provider', () => {
    // Suppress console.error for expected error boundary
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useNavigation())).toThrow(
      'useNavigation must be used within NavigationProvider',
    )
    spy.mockRestore()
  })
})

describe('useNavigation - setBreadcrumbs', () => {
  it('replaces breadcrumbs with setBreadcrumbs', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    const crumbs = [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Current Page' },
    ]

    act(() => {
      result.current.setBreadcrumbs(crumbs)
    })

    expect(result.current.breadcrumbs).toEqual(crumbs)
  })

  it('replaces breadcrumbs with empty array', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.setBreadcrumbs([{ label: 'Temp' }])
    })
    expect(result.current.breadcrumbs).toHaveLength(1)

    act(() => {
      result.current.setBreadcrumbs([])
    })
    expect(result.current.breadcrumbs).toEqual([])
  })
})

describe('useNavigation - pushSegment', () => {
  it('adds a segment to empty breadcrumbs', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'First', href: '/first' })
    })

    expect(result.current.breadcrumbs).toEqual([
      { label: 'First', href: '/first' },
    ])
  })

  it('appends a segment to existing breadcrumbs', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'First', href: '/first' })
    })
    act(() => {
      result.current.pushSegment({ label: 'Second', href: '/second' })
    })

    expect(result.current.breadcrumbs).toHaveLength(2)
    expect(result.current.breadcrumbs[0]).toEqual({ label: 'First', href: '/first' })
    expect(result.current.breadcrumbs[1]).toEqual({ label: 'Second', href: '/second' })
  })

  it('does not duplicate the last segment when same label and href', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'Same' })
    })
    expect(result.current.breadcrumbs).toHaveLength(1)

    act(() => {
      result.current.pushSegment({ label: 'Same' })
    })
    // No duplicate added
    expect(result.current.breadcrumbs).toHaveLength(1)
  })

  it('adds duplicate if same label but different href', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'Same', href: '/a' })
    })
    act(() => {
      result.current.pushSegment({ label: 'Same', href: '/b' })
    })
    expect(result.current.breadcrumbs).toHaveLength(2)
  })

  it('adds duplicate if same href but different label', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'A', href: '/x' })
    })
    act(() => {
      result.current.pushSegment({ label: 'B', href: '/x' })
    })
    expect(result.current.breadcrumbs).toHaveLength(2)
  })

  it('does not deduplicate against non-last segments', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'A' })
    })
    act(() => {
      result.current.pushSegment({ label: 'B' })
    })
    // Push A again — last is 'B', so A is not duplicate
    act(() => {
      result.current.pushSegment({ label: 'A' })
    })
    expect(result.current.breadcrumbs).toHaveLength(3)
  })
})

describe('useNavigation - popSegment', () => {
  it('removes the last segment', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'First' })
      result.current.pushSegment({ label: 'Second' })
    })
    expect(result.current.breadcrumbs).toHaveLength(2)

    act(() => {
      result.current.popSegment()
    })
    expect(result.current.breadcrumbs).toHaveLength(1)
    expect(result.current.breadcrumbs[0]).toEqual({ label: 'First' })
  })

  it('does nothing when already empty', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.popSegment()
    })
    expect(result.current.breadcrumbs).toEqual([])
  })

  it('pops down to empty array from a single segment', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'Only' })
    })
    act(() => {
      result.current.popSegment()
    })
    expect(result.current.breadcrumbs).toEqual([])
  })
})

describe('useNavigation - combined push/pop/set', () => {
  it('push then setBreadcrumbs replaces everything', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'A' })
      result.current.pushSegment({ label: 'B' })
    })
    expect(result.current.breadcrumbs).toHaveLength(2)

    act(() => {
      result.current.setBreadcrumbs([{ label: 'Z' }])
    })
    expect(result.current.breadcrumbs).toHaveLength(1)
    expect(result.current.breadcrumbs[0]).toEqual({ label: 'Z' })
  })

  it('setBreadcrumbs then push appends to new crumbs', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.setBreadcrumbs([
        { label: 'Root', href: '/' },
        { label: 'Page' },
      ])
    })
    act(() => {
      result.current.pushSegment({ label: 'Sub Page' })
    })
    expect(result.current.breadcrumbs).toHaveLength(3)
    expect(result.current.breadcrumbs[2]).toEqual({ label: 'Sub Page' })
  })

  it('pushSegment removes then re-adds is idempotent', () => {
    const { result } = renderHook(() => useNavigation(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NavigationProvider>{children}</NavigationProvider>
      ),
    })

    act(() => {
      result.current.pushSegment({ label: 'X' })
      result.current.pushSegment({ label: 'Y' })
    })
    act(() => {
      result.current.popSegment()
      result.current.pushSegment({ label: 'Z' })
    })
    expect(result.current.breadcrumbs).toHaveLength(2)
    expect(result.current.breadcrumbs[0]).toEqual({ label: 'X' })
    expect(result.current.breadcrumbs[1]).toEqual({ label: 'Z' })
  })
})

// ════════════════════════════════════════════════════════════
// useBreadcrumbs
// ════════════════════════════════════════════════════════════

describe('useBreadcrumbs', () => {
  it('sets breadcrumbs on mount', () => {
    const crumbs = [
      { label: 'Home', href: '/home' },
      { label: 'Detail' },
    ]

    // useBreadcrumbs itself doesn't return anything, so use a second
    // hook to read the breadcrumb state back
    const { result: readerResult } = renderHook(
      () => {
        useBreadcrumbs(crumbs)
        return useNavigation()
      },
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <NavigationProvider>{children}</NavigationProvider>
        ),
      },
    )

    expect(readerResult.current.breadcrumbs).toEqual(crumbs)
  })

  it('only sets breadcrumbs once on mount (empty deps)', () => {
    // Render useBreadcrumbs + useNavigation together, then re-render
    // useBreadcrumbs with different crumbs.
    // The hook uses empty deps, so re-render should NOT update.
    const initialCrumbs = [{ label: 'First' }]
    const { result, rerender } = renderHook(
      (crumbs: { label: string }[]) => {
        useBreadcrumbs(crumbs)
        return useNavigation()
      },
      {
        initialProps: initialCrumbs,
        wrapper: ({ children }: { children: ReactNode }) => (
          <NavigationProvider>{children}</NavigationProvider>
        ),
      },
    )

    expect(result.current.breadcrumbs).toEqual([{ label: 'First' }])

    // Re-render with different crumbs — should NOT update (empty deps)
    rerender([{ label: 'Second' }])
    expect(result.current.breadcrumbs).toEqual([{ label: 'First' }])
  })

  it('throws when used outside NavigationProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      renderHook(() => useBreadcrumbs([{ label: 'Test' }])),
    ).toThrow('useNavigation must be used within NavigationProvider')
    spy.mockRestore()
  })
})

// ════════════════════════════════════════════════════════════
// Integration: multiple consumers share same state
// ════════════════════════════════════════════════════════════

describe('NavigationProvider integration', () => {
  function TestConsumer({ label }: { label: string }) {
    const { breadcrumbs, pushSegment, popSegment } = useNavigation()
    return (
      <div>
        <span data-testid={`crumbs-${label}`}>
          {breadcrumbs.map((c) => c.label).join(',')}
        </span>
        <button onClick={() => pushSegment({ label })}>Push {label}</button>
        <button onClick={() => popSegment()}>Pop</button>
      </div>
    )
  }

  it('two consumers share breadcrumb state', () => {
    render(
      <NavigationProvider>
        <TestConsumer label="A" />
        <TestConsumer label="B" />
      </NavigationProvider>,
    )

    // Both consumers start with empty breadcrumbs
    expect(screen.getByTestId('crumbs-A').textContent).toBe('')
    expect(screen.getByTestId('crumbs-B').textContent).toBe('')

    // Push from consumer A
    fireEvent.click(screen.getByText('Push A'))
    expect(screen.getByTestId('crumbs-A').textContent).toBe('A')
    expect(screen.getByTestId('crumbs-B').textContent).toBe('A')

    // Push from consumer B
    fireEvent.click(screen.getByText('Push B'))
    expect(screen.getByTestId('crumbs-A').textContent).toBe('A,B')
    expect(screen.getByTestId('crumbs-B').textContent).toBe('A,B')

    // Pop from consumer A
    const popButtons = screen.getAllByText('Pop')
    fireEvent.click(popButtons[0])
    expect(screen.getByTestId('crumbs-A').textContent).toBe('A')
    expect(screen.getByTestId('crumbs-B').textContent).toBe('A')
  })
})
