import './globals.css';
import { ReactNode } from 'react';
import { AuthProvider } from '@/lib/authContext';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TenderProcure CRM | Enterprise Lead Management',
  description: 'Production-grade sales & lead management system for telecalling teams, enterprise demos, and conversion workflows.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
