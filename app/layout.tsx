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
        url: '/cozy-favicon-32.png?v=2',
        type: 'image/png',
        sizes: '32x32',
      },
      {
        url: '/cozy-favicon-48.png?v=2',
        type: 'image/png',
        sizes: '48x48',
      },
    ],
    apple: [{ url: '/cozy-apple-icon.png?v=2', type: 'image/png', sizes: '180x180' }],
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
