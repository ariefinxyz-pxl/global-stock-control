'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { AlertTriangle, FileSpreadsheet, Loader2, Printer, RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/label';
import { DataTable } from '@/components/data-table';
import { useToast } from '@/components/toast';
import { useData } from '@/lib/data-context';
import { CAT, CATEGORIES, HOTEL_NAME, JENIS } from '@/lib/constants';
import { exportLaporan } from '@/lib/excel';
import { cn, fmtDate, fmtNumber, fmtRupiah, monthStartISO, todayISO } from '@/lib/utils';

const JENIS_BADGE = { masuk: 'success', terpakai: 'info', rusak: 'warning', hilang: 'danger' };
const stamp = (t) => t?.createdAt?.seconds || 0;

export default function LaporanPage() {
  const { items } = useData();
  const toast = useToast();

  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [kat, setKat] = useState('all');
  const [jenis, setJenis] = useState('all');
  const [tx, setTx] = useState([]);
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const rangeOk = from && to && from <= to;

  useEffect(() => {
    if (!db || !rangeOk) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const range = (name) =>
          query(collection(db, name), where('tanggal', '>=', from), where('tanggal', '<=', to), orderBy('tanggal', 'asc'));
        const [a, b] = await Promise.all([getDocs(range('transactions')), getDocs(range('opnames'))]);
        if (cancelled) return;
        setTx(a.docs.map((d) => ({ id: d.id, ...d.data() })));
        setOps(b.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e.message || 'Gagal memuat laporan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to, rangeOk, reload]);

  const txKat = useMemo(() => tx.filter((t) => kat === 'all' || t.kategori === kat), [tx, kat]);
  const opsKat = useMemo(() => ops.filter((o) => kat === 'all' || o.kategori === kat), [ops, kat]);
  const rows = useMemo(
    () =>
      txKat
        .filter((t) => jenis === 'all' || t.jenis === jenis)
        .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)) || stamp(a) - stamp(b)),
    [txKat, jenis]
  );

  const summary = useMemo(() => {
    const s = {};
    Object.keys(JENIS).forEach((k) => {
      const list = rows.filter((t) => t.jenis === k);
      s[k] = {
        count: list.length,
        qty: list.reduce((a, t) => a + (Number(t.jumlah) || 0), 0),
        nilai: list.reduce((a, t) => a + (Number(t.jumlah) || 0) * (Number(t.harga) || 0), 0),
      };
    });
    return s;
  }, [rows]);

  const kerugian = summary.rusak.nilai + summary.hilang.nilai;
  const katLabel = kat === 'all' ? 'Semua Kategori' : CAT[kat].label;
  const jenisLabel = jenis === 'all' ? 'Semua Jenis' : JENIS[jenis].label;

  const columns = [
    { key: 'tanggal', header: 'Tanggal', cell: (t) => fmtDate(t.tanggal) },
    { key: 'kode', header: 'Kode', className: 'font-mono text-xs' },
    { key: 'nama', header: 'Nama Barang', cell: (t) => <span className="font-medium">{t.nama}</span> },
    { key: 'kategori', header: 'Kategori', className: 'hidden md:table-cell', accessor: (t) => CAT[t.kategori]?.short || t.kategori },
    {
      key: 'jenis',
      header: 'Jenis',
      accessor: (t) => JENIS[t.jenis]?.label || t.jenis,
      cell: (t) => <Badge variant={JENIS_BADGE[t.jenis] || 'muted'}>{JENIS[t.jenis]?.short || t.jenis}</Badge>,
    },
    { key: 'jumlah', header: 'Jumlah', align: 'right', cell: (t) => fmtNumber(t.jumlah) },
    { key: 'sisaSetelah', header: 'Sisa Setelah', align: 'right', cell: (t) => fmtNumber(t.sisaSetelah) },
    {
      key: 'keterangan',
      header: 'Keterangan',
      className: 'hidden lg:table-cell max-w-xs',
      cell: (t) => <span className="line-clamp-2 text-xs text-muted-foreground">{t.keterangan || '-'}</span>,
    },
    { key: 'petugas', header: 'Petugas', className: 'hidden md:table-cell' },
  ];

  const doExport = () => {
    try {
      exportLaporan({ items, tx: txKat, opnames: opsKat, from, to, kategori: kat, jenis });
      toast({ title: 'Laporan Excel dibuat', description: '4 sheet: Ringkasan, Detail Transaksi, Rusak & Hilang, Stock Opname.', variant: 'success' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal membuat file Excel', description: e.message, variant: 'error' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Laporan"
        description="Filter transaksi berdasarkan periode, kategori, dan jenis, lalu export ke Excel atau cetak ke PDF."
        actions={
          <>
            <Button onClick={doExport} disabled={loading || !rangeOk}>
              <FileSpreadsheet className="h-4 w-4" /> EXPORT KE EXCEL
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={loading || !rangeOk}>
              <Printer className="h-4 w-4" /> Print ke PDF
            </Button>
          </>
        }
      />

      {/* ----------------------------- Tampilan layar ----------------------------- */}
      <div className="space-y-4 print:hidden">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Dari tanggal">
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="Sampai tanggal">
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Kategori">
              <Select value={kat} onChange={(e) => setKat(e.target.value)}>
                <option value="all">Semua kategori</option>
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jenis transaksi">
              <Select value={jenis} onChange={(e) => setJenis(e.target.value)}>
                <option value="all">Semua jenis</option>
                {Object.entries(JENIS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" className="w-full" onClick={() => setReload((n) => n + 1)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Muat ulang
              </Button>
            </div>
          </CardContent>
        </Card>

        {!rangeOk && (
          <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4" /> Rentang tanggal tidak valid. Tanggal awal harus sebelum atau sama dengan tanggal akhir.
          </p>
        )}
        {error && (
          <p className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Object.entries(JENIS).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{v.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtNumber(summary[k].qty)}</p>
              <p className="text-xs text-muted-foreground">{fmtNumber(summary[k].count)} transaksi</p>
            </div>
          ))}
          <div className="col-span-2 rounded-lg border border-border bg-card px-4 py-3 lg:col-span-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Nilai Rusak + Hilang</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-red-400">{fmtRupiah(kerugian)}</p>
            <p className="text-xs text-muted-foreground">berdasarkan harga satuan</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          pageSize={25}
          searchText={(t) => `${t.kode} ${t.nama} ${t.keterangan || ''} ${t.petugas || ''}`}
          searchPlaceholder="Cari kode / nama / keterangan..."
          emptyText="Tidak ada transaksi pada filter ini."
        />
        <p className="text-xs text-muted-foreground">
          Sheet “Ringkasan Stok Akhir” pada file Excel menampilkan posisi stok saat ini, sedangkan sheet transaksi mengikuti
          periode di atas.
        </p>
      </div>

      {/* --------------------------- Tampilan cetak / PDF --------------------------- */}
      <div className="hidden print:block">
        <div className="mb-3 border-b-2 border-black pb-2">
          <h1 className="text-xl font-bold">{HOTEL_NAME}</h1>
          <h2 className="text-base font-semibold">Laporan Transaksi Stok — GLOBAL STOCK CONTROL</h2>
          <p className="text-xs">
            Periode: {fmtDate(from)} s/d {fmtDate(to)} | Kategori: {katLabel} | Jenis: {jenisLabel}
          </p>
          <p className="text-xs">
            Tanggal cetak:{' '}
            {new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <table className="mb-3 w-full border-collapse text-xs">
          <thead>
            <tr>
              {Object.values(JENIS).map((v) => (
                <th key={v.label} className="border border-gray-500 px-2 py-1 text-left">
                  {v.label}
                </th>
              ))}
              <th className="border border-gray-500 px-2 py-1 text-left">Nilai Rusak + Hilang</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {Object.keys(JENIS).map((k) => (
                <td key={k} className="border border-gray-500 px-2 py-1">
                  {fmtNumber(summary[k].qty)} ({fmtNumber(summary[k].count)} trx)
                </td>
              ))}
              <td className="border border-gray-500 px-2 py-1">{fmtRupiah(kerugian)}</td>
            </tr>
          </tbody>
        </table>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-gray-200">
              {['Tanggal', 'Kode', 'Nama Barang', 'Kategori', 'Jenis', 'Jumlah', 'Sisa Setelah', 'Keterangan', 'Petugas'].map((h) => (
                <th key={h} className="border border-gray-500 px-1.5 py-1 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-gray-500 px-2 py-3 text-center">
                  Tidak ada transaksi pada filter ini.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} style={{ breakInside: 'avoid' }}>
                  <td className="border border-gray-400 px-1.5 py-0.5">{fmtDate(t.tanggal)}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5">{t.kode}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5">{t.nama}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5">{CAT[t.kategori]?.short || t.kategori}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5">{JENIS[t.jenis]?.label || t.jenis}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5 text-right">{fmtNumber(t.jumlah)}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5 text-right">{fmtNumber(t.sisaSetelah)}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5">{t.keterangan || '-'}</td>
                  <td className="border border-gray-400 px-1.5 py-0.5">{t.petugas || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
