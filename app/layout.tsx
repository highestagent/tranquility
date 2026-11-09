import { SessionNotifications } from "@/modules/session/notifications"
import type { Metadata, Viewport } from "next"
import { Geist_Mono, Instrument_Sans, Newsreader } from "next/font/google"

import "./globals.css"
import Image from "next/image"
import Link from "next/link"
import { AppNav } from "@/components/app-nav"
import { AccountGate } from "@/modules/account/account-gate"
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

const title = "Tranquility"
const description =
  "Explore how sleep, mood, and stress relate to your focus and memory."
const siteUrl = process.env.SITE_URL

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title,
  description,
  icons: {
    icon: { url: "/tranquility.svg", type: "image/svg+xml", sizes: "any" },
  },
  openGraph: { type: "website", siteName: title, title, description },
  twitter: { card: "summary_large_image" },
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
            <AccountGate>
              <div className="app-shell mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 lg:px-10">
                <header className="app-brand flex h-16 shrink-0 items-center">
                  <Link
                    href="/"
                    className="flex min-h-11 items-center gap-2.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Image
                      src="/tranquility.svg"
                      alt=""
                      width={24}
                      height={24}
                    />
                    <span className="font-voice text-lg">Tranquility</span>
                  </Link>
                </header>
                <SessionNotifications />
                <main className="mx-auto flex w-full max-w-lg min-w-0 flex-1 flex-col">
                  {children}
                </main>
                <AppNav />
              </div>
            </AccountGate>
          </AccountProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
