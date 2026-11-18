'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  Boxes,
  ClipboardCheck,
  FileBarChart,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { CAT, HOTEL_NAME, ROLES } from '@/lib/constants';
import { cn, fmtNumber, norm } from '@/lib/utils';
import { Logo } from '@/components/logo';
import { StatusBadge } from '@/components/status-badge';
import { statusStok } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/transaksi', label: 'Transaksi', icon: ArrowLeftRight },
  { href: '/stock-opname', label: 'Stock Opname', icon: ClipboardCheck },
  { href: '/laporan', label: 'Laporan', icon: FileBarChart },
  { href: '/import', label: 'Import Data', icon: UploadCloud, admin: true },
  { href: '/riwayat', label: 'Riwayat', icon: History },
  { href: '/pengguna', label: 'Pengguna', icon: Users, admin: true },
];

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener('mousedown', fn);
    document.addEventListener('touchstart', fn);
    return () => {
      document.removeEventListener('mousedown', fn);
      document.removeEventListener('touchstart', fn);
    };
  }, [ref, handler]);
}

function SidebarContent({ onNavigate }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const nav = NAV.filter((n) => !n.admin || isAdmin);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <Logo size={46} />
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-wide text-gold">GLOBAL STOCK</p>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Control · {HOTEL_NAME}
          </p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary))]'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/5 px-5 py-4 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} {HOTEL_NAME}
      </div>
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const { items } = useData();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  const results = useMemo(() => {
    const t = norm(q);
    if (!t) return [];
    return items.filter((i) => norm(`${i.kode}${i.nama}${i.lokasi || ''}`).includes(t)).slice(0, 8);
  }, [items, q]);

  const go = (value) => {
    setOpen(false);
    setQ('');
    router.push(`/inventory?q=${encodeURIComponent(value)}`);
  };

  return (
    <div ref={ref} className="relative min-w-0 flex-1 sm:max-w-md">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) go(q.trim());
        }}
        placeholder="Cari barang, kode, lokasi..."
        className="h-10 w-full rounded-full border border-input bg-background/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          {results.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">Tidak ada barang yang cocok</p>
          ) : (
            <ul className="max-h-80 overflow-auto p-1">
              {results.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => go(i.kode)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{i.nama}</span>
                      <span className="text-xs text-muted-foreground">
                        {i.kode} · {CAT[i.kategori]?.short}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">Sisa {fmtNumber(i.sisa)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => go(q.trim())}
            className="w-full border-t border-border px-4 py-2.5 text-left text-xs text-primary hover:bg-accent"
          >
            Lihat semua hasil untuk “{q.trim()}” di Inventory
          </button>
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { lowStock } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClick(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifikasi stok menipis"
        className="relative rounded-full border border-input bg-background/60 p-2.5 text-muted-foreground hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {lowStock.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {lowStock.length > 99 ? '99+' : lowStock.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-display text-sm font-semibold">Stok Menipis</p>
            <span className="text-xs text-muted-foreground">{lowStock.length} barang</span>
          </div>
          {lowStock.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Semua stok aman 👍</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-auto">
              {lowStock.slice(0, 10).map((i) => (
                <li key={i.id}>
                  <Link
                    href={`/inventory?q=${encodeURIComponent(i.kode)}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{i.nama}</span>
                      <span className="text-xs text-muted-foreground">
                        {i.kode} · Sisa {fmtNumber(i.sisa)} / Min {fmtNumber(i.stokMinimum)}
                      </span>
                    </span>
                    <StatusBadge status={statusStok(i)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {lowStock.length > 0 && (
            <Link
              href="/inventory?status=restok"
              onClick={() => setOpen(false)}
              className="block border-t border-border px-4 py-2.5 text-center text-xs text-primary hover:bg-accent"
            >
              Lihat semua barang yang perlu restok
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }) {
  const { nama, role, logout } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/5 bg-[hsl(221,60%,6%)] lg:block print:hidden">
        <SidebarContent />
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/70" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in border-r border-white/5 bg-[hsl(221,60%,6%)]">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Tutup menu"
              className="absolute right-3 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-white/5"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6 print:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Buka menu"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-3">
            <Notifications />
            <div className="hidden text-right leading-tight sm:block">
              <p className="max-w-[160px] truncate text-sm font-medium">{nama}</p>
              <p className="text-[11px] uppercase tracking-wider text-primary">{ROLES[role] || role}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="Keluar"
              title="Keluar"
              className="rounded-full border border-input bg-background/60 p-2.5 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
