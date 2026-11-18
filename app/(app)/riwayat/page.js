'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { fmtDateTime } from '@/lib/utils';

// Label & warna untuk tiap jenis aksi di audit log
const AKSI = {
  'item-baru': ['Barang Baru', 'success'],
  'item-ubah': ['Ubah Barang', 'info'],
  'item-hapus': ['Hapus Barang', 'danger'],
  'transaksi-masuk': ['Stok Masuk', 'success'],
  'transaksi-terpakai': ['Stok Terpakai', 'info'],
  'transaksi-rusak': ['Stok Rusak', 'warning'],
  'transaksi-hilang': ['Stok Hilang', 'danger'],
  'stock-opname': ['Stock Opname', 'default'],
  import: ['Import Excel', 'default'],
  'user-baru': ['Pengguna Baru', 'muted'],
  'user-role': ['Ubah Role', 'muted'],
  'hapus-contoh': ['Hapus Data Contoh', 'muted'],
};

export default function RiwayatPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(1000));
    return onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  }, []);

  const columns = [
    {
      key: 'createdAt',
      header: 'Waktu',
      accessor: (r) => r.createdAt?.seconds || 0,
      cell: (r) => <span className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</span>,
    },
    { key: 'user', header: 'Pengguna', cell: (r) => <span className="font-medium">{r.user || r.email || '-'}</span> },
    {
      key: 'aksi',
      header: 'Aksi',
      sortable: false,
      cell: (r) => {
        const a = AKSI[r.aksi];
        return <Badge variant={a?.[1] || 'muted'}>{a?.[0] || r.aksi}</Badge>;
      },
    },
    { key: 'detail', header: 'Detail', sortable: false, cell: (r) => <span className="text-sm">{r.detail}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Riwayat / Audit Log"
        description="Catatan seluruh aktivitas: siapa, kapan, dan berapa jumlahnya. Catatan tidak dapat diubah atau dihapus."
      />
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        pageSize={25}
        initialSort={{ key: 'createdAt', dir: 'desc' }}
        searchText={(r) => `${r.user || ''} ${r.email || ''} ${r.aksi || ''} ${AKSI[r.aksi]?.[0] || ''} ${r.detail || ''}`}
        searchPlaceholder="Cari pengguna / aksi / barang..."
        emptyText="Belum ada aktivitas tercatat."
      />
      <p className="mt-3 text-xs text-muted-foreground">Menampilkan hingga 1.000 aktivitas terbaru.</p>
    </div>
  );
}
