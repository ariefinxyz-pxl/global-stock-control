'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export function AuthGuard({ children }) {
  const router = useRouter();
  const { user, loading, canView, logout, role } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo size={64} />
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-primary" />
        <h1 className="font-display text-xl font-semibold">Akun tidak aktif</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {role === 'nonaktif'
            ? 'Akun Anda dinonaktifkan. Hubungi Admin untuk mengaktifkannya kembali.'
            : 'Profil akun belum tersedia. Silakan keluar lalu masuk kembali, atau hubungi Admin.'}
        </p>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4" /> Keluar
        </Button>
      </div>
    );
  }

  return children;
}
