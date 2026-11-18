'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth-context';
import { statusStok } from './utils';

const DataCtx = createContext({ items: [], itemsById: {}, itemsLoading: true, lowStock: [] });

export const useData = () => useContext(DataCtx);

export function DataProvider({ children }) {
  const { canView } = useAuth();
  const [raw, setRaw] = useState([]);
  const [itemsLoading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView || !db) return undefined;
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'items'),
      (snap) => {
        setRaw(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Gagal memuat data barang', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [canView]);

  const value = useMemo(() => {
    const items = [...raw].sort((a, b) =>
      String(a.kode || '').localeCompare(String(b.kode || ''), 'id', { numeric: true })
    );
    const itemsById = Object.fromEntries(items.map((i) => [i.id, i]));
    const lowStock = items
      .filter((i) => statusStok(i) !== 'aman')
      .sort((a, b) => (Number(a.sisa) || 0) - (Number(b.sisa) || 0));
    return { items, itemsById, itemsLoading, lowStock };
  }, [raw, itemsLoading]);

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}
