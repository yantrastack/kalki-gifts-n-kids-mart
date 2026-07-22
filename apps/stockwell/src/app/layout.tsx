import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/ui';
import { UserProvider } from '@/components/UserContext';
import { BrandProvider } from '@/components/BrandProvider';
import { LanguageProvider } from '@/i18n';

export const metadata: Metadata = {
  title: 'Inventory',
  description: 'Inventory & POS',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-density="comfortable" data-sidebar="expanded">
      <body>
        <ToastProvider>
          <LanguageProvider>
            <BrandProvider>
              <UserProvider>
                <AppShell>{children}</AppShell>
              </UserProvider>
            </BrandProvider>
          </LanguageProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
