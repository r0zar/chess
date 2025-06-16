import React from "react"
import type { Metadata } from "next"
import { Inter, Playfair_Display, Crimson_Text } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import GlobalEventsProvider from "@/components/global-events-provider"

const inter = Inter({ subsets: ["latin"] })

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap"
})

const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson",
  display: "swap"
})

export const metadata: Metadata = {
  title: "Chess Game",
  description: "Play chess online",
  openGraph: {
    images: [
      {
        url: '/image.png',
        width: 1200,
        height: 630,
        alt: 'Stacks Chess - Strategic Chess Mastery',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stacks Chess - Strategic Chess Mastery',
    description: 'Engage in classic chess battles on the Stacks blockchain. Every move earns EXP, every victory builds your legacy.',
    images: [
      {
        url: '/image.png',
        width: 1200,
        height: 630,
        alt: 'Stacks Chess - Strategic Chess Mastery',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${playfairDisplay.variable} ${crimsonText.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <GlobalEventsProvider>
            {children}
            <Toaster />
          </GlobalEventsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
