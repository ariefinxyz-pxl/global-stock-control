'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Boxes, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { seedDummy } from '@/lib/actions';
import { useToast } from '@/components/toast';

export function EmptyInventory() {
  const { isAdmin, actor } = useAuth();
  const { items } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const n = await seedDummy(actor, items);
      toast({ title: 'Data contoh dimuat', description: `${n} barang dummy ditambahkan.`, variant: 'success' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal memuat data contoh', description: e.message, variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <Boxes className="h-10 w-10 text-primary" />
      <h2 className="font-display text-lg font-semibold">Belum ada data barang</h2>
      {isAdmin ? (
        <>
          <p className="max-w-md text-sm text-muted-foreground">
            Mulai dengan mengimpor 6 file Excel Anda. Data contoh (dummy) hanya untuk mencoba aplikasi.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link href="/import" className={buttonVariants()}>
              <UploadCloud className="h-4 w-4" /> Import dari Excel
            </Link>
            <Button variant="outline" onClick={load} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Muat Data Contoh
            </Button>
          </div>
        </>
      ) : (
        <p className="max-w-md text-sm text-muted-foreground">Data barang belum diisi. Hubungi Admin untuk mengimpor data.</p>
      )}
    </Card>
  );
}
