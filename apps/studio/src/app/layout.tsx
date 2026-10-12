import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'PrintSync Creative Studio',
  description: 'PrintSync Creative Operating System — Brand-aware advertising engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
