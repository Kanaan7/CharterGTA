import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'GTA Boat Charter - Lake Ontario Adventures',
  description: 'Book premium boat charters across Port Credit, Toronto Harbour, and Hamilton Harbour',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}