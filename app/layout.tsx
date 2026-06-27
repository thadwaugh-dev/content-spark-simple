import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'ContentSpark - Spark Viral Content in Seconds',
  description: 'Generate 10+ catchy captions, Twitter threads, hashtags, and video hooks instantly. Free tier available. Pro for unlimited.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-slate-50 text-slate-900">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
