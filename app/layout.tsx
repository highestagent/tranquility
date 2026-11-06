import type { Metadata, Viewport } from "next"
import { Figtree, Geist_Mono, Newsreader } from "next/font/google"

import "./globals.css"
import { AppNav } from "@/components/app-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const fontSans = Figtree({ subsets: ["latin"], variable: "--font-sans" })

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
          {/* A phone-width column everywhere, so layouts have one shape to get right. */}
          <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5">
            <AppNav />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
