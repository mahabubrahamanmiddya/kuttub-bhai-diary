import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { NotesProvider } from '@/context/notes-context';
import { ServiceWorkerRegister } from '@/components/common/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'My Diary — Keep Notes & Hisaab',
  description: 'Simple, private digital diary for business hisaab, customer notes, reminders and ideas.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'My Diary',
  },
};

export const viewport: Viewport = {
  themeColor: '#F59E0B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-paper-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 selection:bg-amber-200">
        <AuthProvider>
          <NotesProvider>
            <ServiceWorkerRegister />
            {children}
          </NotesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
