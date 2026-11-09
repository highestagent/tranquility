import { SessionNotifications } from "@/modules/session/notifications"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Instrument_Sans, Newsreader } from "next/font/google"

import "./globals.css"
import Link from "next/link"
import { PoolMark } from "@/components/pool-mark"
import { AppNav } from "@/components/app-nav"
import { AccountProvider } from "@/modules/account/account-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const fontSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

/** The agent's voice. Everything it says to you is set in this face. */
const fontVoice = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-voice",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Tranquility",
  description:
    "A personal research agent that investigates what shapes your thinking. Your data is stored on your device.",
}

export const viewport: Viewport = {
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
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
      className={cn(
        "antialiased",
        fontMono.variable,
        fontVoice.variable,
        fontSans.variable,
        "font-sans"
      )}
    >
      <body>
        <ThemeProvider>
          <AccountProvider>
            <div className="app-shell mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 lg:px-10">
              <header className="app-brand flex h-16 shrink-0 items-center">
                <Link
                  href="/"
                  className="flex min-h-11 items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PoolMark className="size-5" />
                  <span className="font-voice text-lg">Tranquility</span>
                </Link>
              </header>
              <SessionNotifications />
              <main className="mx-auto flex w-full max-w-lg min-w-0 flex-1 flex-col">
                {children}
              </main>
              <AppNav />
            </div>
          </AccountProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
