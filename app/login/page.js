'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

function pesanError(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau password salah.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan.';
    default:
      return 'Gagal masuk. Silakan coba lagi.';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/');
    } catch (err) {
      setError(pesanError(err.code));
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) return setError('Isi email dulu, lalu klik "Lupa password".');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Tautan reset password sudah dikirim ke email Anda.');
    } catch (err) {
      setError(pesanError(err.code));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={84} className="p-2" />
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-wide text-gold">GLOBAL STOCK CONTROL</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">Bisnis Hotel</p>
          <div className="mt-4 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div>
            <h2 className="font-display text-xl font-semibold">Masuk</h2>
            <p className="mt-1 text-sm text-muted-foreground">Kontrol aset & perlengkapan hotel.</p>
          </div>

          {!isFirebaseConfigured && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Firebase belum dikonfigurasi. Salin <code>.env.local.example</code> menjadi <code>.env.local</code>, isi
                nilainya, lalu jalankan ulang aplikasi.
              </span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {info && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{info}</div>}

          <Field label="Email">
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@hotel.com"
                className="pl-9"
              />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="px-9"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <Button type="submit" className="w-full" size="lg" disabled={busy || !isFirebaseConfigured}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Masuk
          </Button>
          <button type="button" onClick={reset} className="w-full text-center text-xs text-muted-foreground hover:text-primary">
            Lupa password?
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Akun dibuat oleh Admin. Hubungi Admin jika belum memiliki akses.
        </p>
      </div>
    </div>
  );
}
