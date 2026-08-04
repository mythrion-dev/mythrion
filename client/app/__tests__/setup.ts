import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import '@/i18n'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
})

// Polyfill ResizeObserver for jsdom
class ResizeObserverMock {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    // Fire a dummy entry so the observer's callback gets exercised
    const entry: ResizeObserverEntry = {
      target,
      contentRect: { top: 0, left: 0, width: 400, height: 600, x: 0, y: 0, toJSON: () => {} },
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    }
    this.callback([entry], this)
  }
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
})

// Polyfill Element.prototype.scrollIntoView (jsdom doesn't implement it)
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function () {}
}

// Polyfill HTMLFormElement.prototype.requestSubmit (jsdom doesn't implement it)
if (typeof HTMLFormElement.prototype.requestSubmit !== 'function') {
  HTMLFormElement.prototype.requestSubmit = function (
    submitter?: HTMLElement,
  ) {
    if (submitter) {
      submitter.click()
    } else {
      // Fall back to dispatching a submit event so React's onSubmit fires
      this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    }
  }
}
