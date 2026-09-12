const MARKETING_ATTRIBUTION_COOKIE = 'mythrion_marketing_attribution'
const COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60

export function captureMarketingAttribution(): void {
  if (typeof window === 'undefined' || !window.location.search) return

  // Keep the first campaign URL. OAuth callbacks and later navigations also
  // have query parameters, but must never replace the original attribution.
  if (getMarketingAttribution()) return

  const cookieValue = encodeURIComponent(window.location.href)
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${MARKETING_ATTRIBUTION_COOKIE}=${cookieValue}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`
}

export function getMarketingAttribution(): string | null {
  if (typeof document === 'undefined') return null

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${MARKETING_ATTRIBUTION_COOKIE}=`))
  if (!cookie) return null

  return decodeURIComponent(cookie.slice(MARKETING_ATTRIBUTION_COOKIE.length + 1))
}

export function clearMarketingAttribution(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${MARKETING_ATTRIBUTION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}
