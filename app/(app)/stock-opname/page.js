'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { FileSpreadsheet, Loader2, RotateCcw, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/label';
import { DataTable } from '@/components/data-table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { CAT, CATEGORIES } from '@/lib/constants';
import { saveOpname } from '@/lib/actions';
import { exportOpname } from '@/lib/excel';
import { cn, fmtDate, fmtNumber, fmtRupiah, todayISO } from '@/lib/utils';

const tone = (n) => (n > 0 ? 'text-emerald-400' : n < 0 ? 'text-red-400' : 'text-muted-foreground');
const signed = (n) => (n > 0 ? '+' : '') + fmtNumber(n);
const signedRp = (n) => (n < 0 ? '-' : n > 0 ? '+' : '') + fmtRupiah(Math.abs(n));

function Stat({ label, value, className }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', className)}>{value}</p>
    </div>
  );
}

/* ----------------------------- Tab: Input SO ----------------------------- */

function InputTab() {
  const { items, itemsLoading } = useData();
  const { canWrite, isAdmin, actor, nama } = useAuth();
  const toast = useToast();

  const [kat, setKat] = useState(CATEGORIES[0].key);
  const [tanggal, setTanggal] = useState(todayISO());
  const [sesi, setSesi] = useState('');
  const [fisik, setFisik] = useState({});
  const [catatan, setCatatan] = useState({});
  const [apply, setApply] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const namaSesi = sesi.trim() || `Stock Opname ${fmtDate(tanggal)}`;
  const rows = useMemo(() => items.filter((i) => kat === 'all' || i.kategori === kat), [items, kat]);

  const parse = (v) => {
    if (v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  const counted = useMemo(
    () => items.map((item) => ({ item, fisik: parse(fisik[item.id]) })).filter((r) => r.fisik !== null),
    [items, fisik]
  );
  const invalid = counted.filter((r) => Number.isNaN(r.fisik)).length;
  const valid = counted.filter((r) => !Number.isNaN(r.fisik));
  const stat = useMemo(() => {
    let selisih = 0;
    let nilai = 0;
    let beda = 0;
    valid.forEach((r) => {
      const s = r.fisik - (Number(r.item.sisa) || 0);
      selisih += s;
      nilai += s * (Number(r.item.harga) || 0);
      if (s !== 0) beda += 1;
    });
    return { selisih, nilai, beda };
  }, [valid]);

  const columns = [
    { key: 'kode', header: 'Kode', className: 'font-mono text-xs' },
    { key: 'nama', header: 'Nama Barang', cell: (i) => <span className="font-medium">{i.nama}</span> },
    { key: 'satuan', header: 'Satuan', className: 'hidden md:table-cell' },
    { key: 'sisa', header: 'Stok Sistem', align: 'right', cell: (i) => fmtNumber(i.sisa) },
    {
      key: 'fisik',
      header: 'Stok Fisik',
      align: 'right',
      sortable: false,
      cell: (i) => (
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          disabled={!canWrite}
          value={fisik[i.id] ?? ''}
          onChange={(e) => setFisik((s) => ({ ...s, [i.id]: e.target.value }))}
          placeholder="—"
          className="ml-auto h-9 w-24 text-right"
          aria-label={`Stok fisik ${i.nama}`}
        />
      ),
    },
    {
      key: 'selisih',
      header: 'Selisih',
      align: 'right',
      sortable: false,
      cell: (i) => {
        const f = parse(fisik[i.id]);
        if (f === null || Number.isNaN(f)) return <span className="text-muted-foreground">-</span>;
        const s = f - (Number(i.sisa) || 0);
        return <span className={cn('font-semibold', tone(s))}>{signed(s)}</span>;
      },
    },
    {
      key: 'nilai',
      header: 'Nilai Selisih',
      align: 'right',
      sortable: false,
      className: 'hidden sm:table-cell',
      cell: (i) => {
        const f = parse(fisik[i.id]);
        if (f === null || Number.isNaN(f)) return <span className="text-muted-foreground">-</span>;
        const v = (f - (Number(i.sisa) || 0)) * (Number(i.harga) || 0);
        return <span className={tone(v)}>{signedRp(v)}</span>;
      },
    },
    {
      key: 'catatan',
      header: 'Catatan',
      sortable: false,
      className: 'hidden lg:table-cell',
      cell: (i) => (
        <Input
          disabled={!canWrite}
          value={catatan[i.id] ?? ''}
          onChange={(e) => setCatatan((s) => ({ ...s, [i.id]: e.target.value }))}
          placeholder="Opsional"
          className="h-9 w-44"
        />
      ),
    },
  ];

  const doSave = async () => {
    setSaving(true);
    try {
      const res = await saveOpname(
        {
          sesi: namaSesi,
          tanggal,
          rows: valid.map((r) => ({ item: r.item, fisik: r.fisik, catatan: catatan[r.item.id] || '' })),
          apply: isAdmin && apply,
        },
        actor
      );
      toast({
        title: 'Stock opname tersimpan',
        description: `${valid.length} barang · selisih ${signed(res.totalSelisih)} · ${signedRp(res.totalNilai)}`,
        variant: 'success',
      });
      setFisik({});
      setCatatan({});
      setApply(false);
      setConfirm(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal menyimpan stock opname', description: e.message, variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const doExport = () => {
    if (valid.length === 0) {
      toast({ title: 'Belum ada stok fisik yang diisi', variant: 'error' });
      return;
    }
    exportOpname(
      valid.map((r) => {
        const sistem = Number(r.item.sisa) || 0;
        const s = r.fisik - sistem;
        return {
          tanggal,
          sesi: namaSesi,
          kode: r.item.kode,
          nama: r.item.nama,
          kategori: r.item.kategori,
          stokSistem: sistem,
          stokFisik: r.fisik,
          selisih: s,
          harga: Number(r.item.harga) || 0,
          nilaiSelisih: s * (Number(r.item.harga) || 0),
          catatan: catatan[r.item.id] || '',
          petugas: nama,
        };
      }),
      namaSesi
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tampilkan kategori">
            <Select value={kat} onChange={(e) => setKat(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
              <option value="all">Semua kategori</option>
            </Select>
          </Field>
          <Field label="Tanggal hitung">
            <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
          <Field label="Nama sesi SO" className="sm:col-span-2" hint="Kosongkan untuk memakai nama otomatis.">
            <Input value={sesi} onChange={(e) => setSesi(e.target.value)} placeholder={`Stock Opname ${fmtDate(tanggal)}`} />
          </Field>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Barang dihitung" value={fmtNumber(valid.length)} />
        <Stat label="Barang berselisih" value={fmtNumber(stat.beda)} className={stat.beda ? 'text-yellow-400' : ''} />
        <Stat label="Total selisih (qty)" value={signed(stat.selisih)} className={tone(stat.selisih)} />
        <Stat label="Nilai selisih" value={signedRp(stat.nilai)} className={tone(stat.nilai)} />
      </div>

      {!canWrite && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          Akun Viewer hanya dapat melihat. Input stock opname dilakukan oleh Staff atau Admin.
        </p>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={itemsLoading}
        pageSize={25}
        searchText={(i) => `${i.kode} ${i.nama} ${i.lokasi || ''}`}
        searchPlaceholder="Cari kode / nama barang..."
        emptyText="Belum ada barang di kategori ini."
        toolbar={
          <>
            <Button variant="outline" onClick={doExport}>
              <FileSpreadsheet className="h-4 w-4" /> Export hasil SO
            </Button>
            {canWrite && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFisik({});
                  setCatatan({});
                }}
                disabled={counted.length === 0}
              >
                <RotateCcw className="h-4 w-4" /> Reset input
              </Button>
            )}
          </>
        }
      />

      {canWrite && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 text-sm">
              {isAdmin && (
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={apply}
                    onChange={(e) => setApply(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#D4AF37]"
                  />
                  <span>
                    Sesuaikan stok sistem dengan hasil hitungan fisik
                    <span className="block text-xs text-muted-foreground">
                      Stok Awal barang yang berselisih akan dikoreksi agar Sisa Stok sama dengan stok fisik (khusus Admin).
                    </span>
                  </span>
                </label>
              )}
              {invalid > 0 && (
                <p className="text-red-400">{invalid} isian stok fisik tidak valid (harus angka ≥ 0).</p>
              )}
            </div>
            <Button size="lg" onClick={() => setConfirm(true)} disabled={valid.length === 0 || invalid > 0}>
              <Save className="h-4 w-4" /> Simpan Hasil SO ({valid.length})
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        title="Simpan hasil stock opname?"
        confirmLabel="Simpan"
        loading={saving}
        onClose={() => setConfirm(false)}
        onConfirm={doSave}
      >
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Sesi: <span className="text-foreground">{namaSesi}</span> ({fmtDate(tanggal)})
          </p>
          <p>
            {valid.length} barang dihitung, {stat.beda} berselisih, nilai selisih{' '}
            <span className={tone(stat.nilai)}>{signedRp(stat.nilai)}</span>.
          </p>
          {isAdmin && apply ? (
            <p className="text-yellow-300">Stok sistem akan disesuaikan dengan hasil hitungan fisik.</p>
          ) : (
            <p>Stok sistem tidak diubah (hanya dicatat sebagai hasil SO).</p>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}

/* ---------------------------- Tab: Riwayat SO ---------------------------- */

function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kat, setKat] = useState('all');

  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, 'opnames'), orderBy('createdAt', 'desc'), limit(1500));
    return onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  const data = useMemo(() => rows.filter((r) => kat === 'all' || r.kategori === kat), [rows, kat]);

  const columns = [
    { key: 'tanggal', header: 'Tanggal', cell: (r) => fmtDate(r.tanggal) },
    { key: 'sesi', header: 'Sesi', className: 'hidden lg:table-cell', cell: (r) => <span className="text-xs">{r.sesi || '-'}</span> },
    { key: 'kode', header: 'Kode', className: 'font-mono text-xs' },
    { key: 'nama', header: 'Nama Barang', cell: (r) => <span className="font-medium">{r.nama}</span> },
    { key: 'kategori', header: 'Kategori', className: 'hidden md:table-cell', accessor: (r) => CAT[r.kategori]?.short || r.kategori },
    { key: 'stokSistem', header: 'Sistem', align: 'right', cell: (r) => fmtNumber(r.stokSistem) },
    { key: 'stokFisik', header: 'Fisik', align: 'right', cell: (r) => fmtNumber(r.stokFisik) },
    { key: 'selisih', header: 'Selisih', align: 'right', cell: (r) => <span className={cn('font-semibold', tone(r.selisih))}>{signed(r.selisih)}</span> },
    { key: 'nilaiSelisih', header: 'Nilai Selisih', align: 'right', className: 'hidden sm:table-cell', cell: (r) => <span className={tone(r.nilaiSelisih)}>{signedRp(r.nilaiSelisih || 0)}</span> },
    { key: 'petugas', header: 'Petugas', className: 'hidden md:table-cell' },
    {
      key: 'diterapkan',
      header: 'Stok Disesuaikan',
      className: 'hidden xl:table-cell',
      accessor: (r) => (r.diterapkan ? 1 : 0),
      cell: (r) => (r.diterapkan ? <Badge variant="warning">Ya</Badge> : <Badge variant="muted">Tidak</Badge>),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={loading}
      pageSize={25}
      searchText={(r) => `${r.kode} ${r.nama} ${r.sesi || ''} ${r.petugas || ''}`}
      searchPlaceholder="Cari kode / nama / sesi..."
      emptyText="Belum ada riwayat stock opname."
      toolbar={
        <>
          <Select value={kat} onChange={(e) => setKat(e.target.value)} className="w-52">
            <option value="all">Semua kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => exportOpname(data, kat === 'all' ? 'Semua Sesi' : CAT[kat].label)} disabled={data.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        </>
      }
    />
  );
}

/* --------------------------------- Page --------------------------------- */

export default function StockOpnamePage() {
  const [tab, setTab] = useState('input');
  return (
    <div>
      <PageHeader
        title="Stock Opname"
        description="Input stok fisik hasil hitungan lapangan. Selisih = Stok Fisik − Stok Sistem; Nilai Selisih = Selisih × Harga Satuan."
      />
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
        {[
          { k: 'input', l: 'Input Stock Opname' },
          { k: 'riwayat', l: 'Riwayat & Export' },
        ].map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.l}
          </button>
        ))}
      </div>
      {tab === 'input' ? <InputTab /> : <HistoryTab />}
    </div>
  );
}
