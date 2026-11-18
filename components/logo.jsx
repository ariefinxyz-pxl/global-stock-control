import { cn } from '@/lib/utils';

// Logo BISNIS HOTEL (file: public/logo.png). Diletakkan di tile putih agar kontras di tema gelap.
export function Logo({ size = 40, className }) {
  return (
    <div
      className={cn('shrink-0 overflow-hidden rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-gold/40', className)}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Logo Bisnis Hotel" className="h-full w-full scale-[1.4] object-contain" />
    </div>
  );
}
