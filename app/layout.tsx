import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { AppNav } from "@/components/app-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Tranquility",
  description:
    "A personal research agent that investigates what shapes your thinking. Your data stays on your device.",
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
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>
          <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-8 px-4 py-6">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Tranquility</p>
              <AppNav />
            </div>
            <main className="flex flex-1 flex-col gap-6">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
