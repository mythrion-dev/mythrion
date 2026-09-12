import type { Metadata } from 'next'
import Script from 'next/script'
import { Geist, Geist_Mono } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { I18nProvider } from '@/components/shared/I18nProvider'
import { NavigationProvider } from '@/lib/navigation-context'
import { SubscriptionProvider } from '@/lib/subscription-context'
import { GtmEventBridge } from '@/components/shared/GtmEventBridge'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Mythrion — Forge Your Legend',
  description:
    'Build worlds, create characters, and embark on epic campaigns with your friends.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PFX4W438"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {/* Set <html lang> from the saved preference before first paint. SSR is
            always English (hydration-safe); this mirrors the same storage key
            i18next uses, and React skips the lang check via suppressHydrationWarning. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem('mythrion_language');if(l&&l.indexOf('pt')===0){document.documentElement.lang='pt-BR'}}catch(e){}`,
          }}
        />
        {/* Google Tag Manager loader — Next.js injects beforeInteractive scripts into
            <head> regardless of placement, matching Google's 'as high as possible'. */}
        <Script
          id="google-tag-manager"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PFX4W438');`,
          }}
        />
        {/* Subtle top ornament */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none" />
        <AuthProvider>
          <GtmEventBridge />
          <I18nProvider>
            <SubscriptionProvider>
              <NavigationProvider>{children}</NavigationProvider>
            </SubscriptionProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  )
}