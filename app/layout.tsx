import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'POD Design Checker',
  description: 'Fast print-readiness and design confidence checker for POD',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
