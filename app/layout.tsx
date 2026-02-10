import React from "react"
import type { Metadata } from 'next'
import { Prompt } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppSidebar } from '@/components/app-sidebar'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const prompt = Prompt({ 
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt"
});

export const metadata: Metadata = {
  title: 'Commission Dashboard',
  description: 'Track and manage sales commissions',
  icons: {
    icon: [
      {
        url: '/revenue.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/revenue.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/revenue.png',
        type: 'image/svg+xml',
      },
    ],
    apple: '/revenue.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${prompt.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <div className="flex min-h-screen">
            <AppSidebar />
            <main className="flex-1 lg:ml-64">
              <div className="container mx-auto px-4 py-8 lg:px-8 pt-20 lg:pt-8">
                {children}
              </div>
            </main>
          </div>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
