import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
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
  title: 'Harmonogram Svozu Odpadu - Rychvald',
  description:
    'Interaktivní kalendář svozu odpadu pro město Rychvald. Vyhledejte si termíny pro vaši ulici - SKO, separovaný odpad.',
  keywords: [
    'Rychvald',
    'odpad',
    'svoz odpadu',
    'kalendář',
    'harmonogram',
    'SKO',
    'plast',
    'papír',
  ],
  authors: [{ name: 'Město Rychvald', url: 'https://www.rychvald.cz' }],
  openGraph: {
    title: 'Harmonogram Svozu Odpadu - Rychvald',
    description: 'Zjistěte, kdy vám vyvezou popelnice. Vyhledávání dle ulice.',
    url: 'https://rychvald.cz',
    siteName: 'Odpadové hospodářství Rychvald',
    images: [
      {
        url: 'https://rychvald.cz/wp-content/uploads/2021/02/znak_rychvald.png',
        width: 800,
        height: 600,
        alt: 'Znak města Rychvald',
      },
    ],
    locale: 'cs_CZ',
    type: 'website',
  },
  icons: {
    icon: 'https://rychvald.cz/wp-content/uploads/2021/02/znak_rychvald.png',
    apple: 'https://rychvald.cz/wp-content/uploads/2021/02/znak_rychvald.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='cs'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
