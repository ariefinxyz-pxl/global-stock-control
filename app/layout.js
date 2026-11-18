import './globals.css';
import { Inter, Playfair_Display } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });

export const metadata = {
  title: 'GLOBAL STOCK CONTROL - BISNIS HOTEL',
  description: 'Sistem kontrol aset & perlengkapan BISNIS HOTEL',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B1426',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${display.variable}`}>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
