'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CAT } from '@/lib/constants';
import { fmtNumber, norm } from '@/lib/utils';

// Pemilih barang dengan pencarian (kode / nama), nyaman dipakai di HP.
export function ItemPicker({ items, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef(null);
  const selected = items.find((i) => i.id === value);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const list = useMemo(() => {
    const t = norm(q);
    return items.filter((i) => !t || norm(`${i.kode}${i.nama}`).includes(t)).slice(0, 60);
  }, [items, q]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          disabled={disabled}
          value={open ? q : selected ? `${selected.kode} — ${selected.nama}` : q}
          placeholder="Cari kode atau nama barang..."
          onFocus={() => {
            setOpen(true);
            setQ('');
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          className="pl-9"
        />
      </div>
      {open && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
          {list.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Barang tidak ditemukan</li>
          )}
          {list.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(i);
                  setOpen(false);
                  setQ('');
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.nama}</span>
                  <span className="text-xs text-muted-foreground">
                    {i.kode} · {CAT[i.kategori]?.short}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Sisa {fmtNumber(i.sisa)} {i.satuan}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
