'use client';

import { AuthGuard } from '@/components/auth-guard';
import { AppShell } from '@/components/app-shell';
import { DataProvider } from '@/lib/data-context';

export default function AppLayout({ children }) {
  return (
    <AuthGuard>
      <DataProvider>
        <AppShell>{children}</AppShell>
      </DataProvider>
    </AuthGuard>
  );
}
