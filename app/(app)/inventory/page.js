'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { ItemFormModal } from '@/components/item-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyInventory } from '@/components/empty-inventory';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { CAT, CATEGORIES } from '@/lib/constants';
import { deleteItem } from '@/lib/actions';
import { cn, fmtNumber, fmtRupiah, statusStok } from '@/lib/utils';

const STATUS_FILTER = [
  { value: 'all', label: 'Semua status' },
  { value: 'aman', label: 'Aman' },
  { value: 'menipis', label: 'Menipis' },
  { value: 'habis', label: 'Habis' },
  { value: 'restok', label: 'Perlu restok (Menipis + Habis)' },
];

function matchStatus(item, filter) {
  if (filter === 'all') return true;
  const s = statusStok(item);
  if (filter === 'restok') return s !== 'aman';
  return s === filter;
}

function InventoryInner() {
  const sp = useSearchParams();
  const { items, itemsLoading } = useData();
  const { isAdmin, actor } = useAuth();
  const toast = useToast();

  const q0 = sp.get('q') || '';
  const [kat, setKat] = useState(sp.get('kategori') || 'all');
  const [status, setStatus] = useState(sp.get('status') || 'all');
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    const m = { all: items.length };
    CATEGORIES.forEach((c) => {
      m[c.key] = items.filter((i) => i.kategori === c.key).length;
    });
    return m;
  }, [items]);

  const filtered = useMemo(
    () => items.filter((i) => (kat === 'all' || i.kategori === kat) && matchStatus(i, status)),
    [items, kat, status]
  );

  const openNew = () => {
    setEditItem(null);
    setFormOpen(true);
  };
  const openEdit = (i) => {
    setEditItem(i);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteItem(toDelete, actor);
      toast({ title: 'Barang dihapus', description: `${toDelete.kode} - ${toDelete.nama}`, variant: 'success' });
      setToDelete(null);
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal menghapus', description: e.message, variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'kode', header: 'Kode', cell: (r) => <span className="font-mono text-xs">{r.kode}</span> },
    {
      key: 'nama',
      header: 'Nama Barang',
      cell: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium">{r.nama}</p>
          {r.kondisi && r.kondisi !== 'Baik' && <p className="text-xs text-yellow-400">{r.kondisi}</p>}
        </div>
      ),
    },
    {
      key: 'kategori',
      header: 'Kategori',
      accessor: (r) => CAT[r.kategori]?.short || r.kategori,
      cell: (r) => (
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: CAT[r.kategori]?.color }} />
          {CAT[r.kategori]?.short}
        </span>
      ),
    },
    { key: 'satuan', header: 'Satuan' },
    {
      key: 'sisa',
      header: 'Sisa',
      align: 'right',
      accessor: (r) => Number(r.sisa) || 0,
      cell: (r) => <span className="font-semibold">{fmtNumber(r.sisa)}</span>,
    },
    {
      key: 'stokMinimum',
      header: 'Min',
      align: 'right',
      accessor: (r) => Number(r.stokMinimum) || 0,
      cell: (r) => <span className="text-muted-foreground">{fmtNumber(r.stokMinimum)}</span>,
    },
    {
      key: 'harga',
      header: 'Harga',
      align: 'right',
      accessor: (r) => Number(r.harga) || 0,
      cell: (r) => fmtRupiah(r.harga),
    },
    { key: 'lokasi', header: 'Lokasi', cell: (r) => r.lokasi || '-' },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => statusStok(r),
      cell: (r) => <StatusBadge status={statusStok(r)} />,
    },
    {
      key: 'aksi',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDetail(r)} aria-label="Detail">
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Ubah">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setToDelete(r)} aria-label="Hapus" className="text-red-400 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const empty = !itemsLoading && items.length === 0;

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Master data barang di 6 kategori"
        actions={
          isAdmin && (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Tambah Barang
            </Button>
          )
        }
      />

      {empty ? (
        <EmptyInventory />
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ key: 'all', short: 'Semua' }, ...CATEGORIES].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setKat(c.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors',
                  kat === c.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {c.short}
                <span className="rounded-full bg-white/5 px-1.5 text-xs tabular-nums">{counts[c.key] ?? 0}</span>
              </button>
            ))}
          </div>

          <DataTable
            key={q0}
            columns={columns}
            data={filtered}
            loading={itemsLoading}
            defaultQuery={q0}
            searchPlaceholder="Cari kode, nama, lokasi..."
            searchText={(r) => `${r.kode} ${r.nama} ${r.lokasi || ''} ${CAT[r.kategori]?.short || ''} ${r.deskripsi || ''}`}
            initialSort={{ key: 'kode', dir: 'asc' }}
            emptyText="Tidak ada barang yang sesuai filter."
            toolbar={
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-64" aria-label="Filter status">
                {STATUS_FILTER.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            }
          />
        </div>
      )}

      <ItemFormModal open={formOpen} onClose={() => setFormOpen(false)} item={editItem} defaultKategori={kat} />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus barang?"
        description={toDelete ? `${toDelete.kode} - ${toDelete.nama}` : ''}
        confirmLabel="Ya, Hapus"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      >
        <p className="text-sm text-muted-foreground">
          Data barang akan dihapus permanen. Riwayat transaksi lama tetap tersimpan di laporan.
        </p>
      </ConfirmDialog>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.nama} description={detail ? `${detail.kode} · ${CAT[detail.kategori]?.label}` : ''} size="md">
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Info label="Satuan" value={detail.satuan} />
                <Info label="Kondisi" value={detail.kondisi || '-'} />
                <Info label="Harga Satuan" value={fmtRupiah(detail.harga)} />
                <Info label="Nilai Stok" value={fmtRupiah((Number(detail.sisa) || 0) * (Number(detail.harga) || 0))} />
                <Info label="Lokasi" value={detail.lokasi || '-'} />
                <Info label="Status" value={<StatusBadge status={statusStok(detail)} />} />
              </dl>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[
                ['Stok Awal', detail.stokAwal],
                ['Masuk', detail.totalMasuk],
                ['Terpakai', detail.totalTerpakai],
                ['Rusak', detail.totalRusak],
                ['Hilang', detail.totalHilang],
                ['Sisa', detail.sisa],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-border bg-muted/40 p-3 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums">{fmtNumber(v)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Sisa Stok = Stok Awal + Masuk − Terpakai − Rusak − Hilang. Stok minimum: {fmtNumber(detail.stokMinimum)}.
            </p>
            {detail.deskripsi && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Deskripsi</p>
                <p className="mt-1 text-sm">{detail.deskripsi}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      }
    >
      <InventoryInner />
    </Suspense>
  );
}
