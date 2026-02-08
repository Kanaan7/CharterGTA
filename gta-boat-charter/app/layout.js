import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b1220',
};

export const metadata = {
  title: 'GTA Boat Charter - Lake Ontario Adventures',
  description: 'Book premium boat charters across Port Credit, Toronto Harbour, and Hamilton Harbour',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
