import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { PageAnalytics } from '@/components/page-analytics'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ThemeToggle } from '@/components/theme-toggle'

export const metadata: Metadata = {
  title: 'Cozy Health Provider Dashboard',
  description: 'Cozy Health provider portal',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider nonce={nonce} attribute="class" defaultTheme="system" enableSystem>
          <ThemeToggle />
          {children}
          <Toaster />
        </ThemeProvider>
          <PageAnalytics />
      </body>
    </html>
  )
}
