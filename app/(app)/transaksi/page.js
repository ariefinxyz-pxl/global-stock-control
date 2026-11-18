'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AlertTriangle, Loader2, PackageMinus, PackagePlus, PackageSearch, PackageX, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/label';
import { ItemPicker } from '@/components/item-picker';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { CAT, JENIS } from '@/lib/constants';
import { addTransaction } from '@/lib/actions';
import { cn, fmtDate, fmtNumber, statusStok, todayISO, hitungSisa } from '@/lib/utils';

const UI = {
  masuk: { icon: PackagePlus, tone: 'text-emerald-400', desc: 'Barang masuk menambah sisa stok.' },
  terpakai: { icon: PackageMinus, tone: 'text-sky-400', desc: 'Barang terpakai mengurangi sisa stok.' },
  rusak: { icon: PackageX, tone: 'text-orange-400', desc: 'Barang rusak mengurangi sisa stok.' },
  hilang: { icon: PackageSearch, tone: 'text-rose-400', desc: 'Barang hilang mengurangi sisa stok.' },
};

const blank = {
  itemId: '',
  jumlah: '',
  supplier: '',
  noInvoice: '',
  keperluan: '',
  pemakai: '',
  penyebab: '',
  kronologi: '',
  penanggungJawab: '',
  catatan: '',
};

export default function TransaksiPage() {
  const { items, itemsById } = useData();
  const { canWrite, actor } = useAuth();
  const toast = useToast();

  const [jenis, setJenis] = useState('masuk');
  const [tanggal, setTanggal] = useState(todayISO());
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    if (!db) return undefined;
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(300));
    return onSnapshot(
      q,
      (snap) => {
        setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setHistLoading(false);
      },
      (err) => {
        console.error(err);
        setHistLoading(false);
      }
    );
  }, []);

  const item = itemsById[f.itemId];
  const qty = Number(f.jumlah) || 0;
  const meta = JENIS[jenis];
  const sisaSetelah = item ? hitungSisa(item.stokAwal, { ...item, [meta.field]: (Number(item[meta.field]) || 0) + qty }) : null;
  const kurang = item && meta.sign < 0 && sisaSetelah < 0;

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const pickJenis = (j) => {
    setJenis(j);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!item) return setError('Pilih barang terlebih dahulu.');
    if (!(qty > 0)) return setError('Jumlah harus lebih dari 0.');
    if (kurang) return setError(`Stok tidak cukup. Sisa saat ini ${fmtNumber(item.sisa)} ${item.satuan}.`);
    if (jenis === 'terpakai' && !f.keperluan.trim()) return setError('Isi keperluan pemakaian.');
    if (jenis === 'terpakai' && !f.pemakai.trim()) return setError('Isi nama pemakai.');
    if (jenis === 'rusak' && !f.penyebab.trim()) return setError('Isi penyebab kerusakan.');
    if (jenis === 'hilang' && !f.kronologi.trim()) return setError('Isi kronologi kehilangan.');
    if (jenis === 'hilang' && !f.penanggungJawab.trim()) return setError('Isi penanggung jawab.');

    setSaving(true);
    try {
      const res = await addTransaction(
        {
          itemId: item.id,
          jenis,
          jumlah: qty,
          tanggal,
          detail: {
            supplier: f.supplier.trim() || undefined,
            noInvoice: f.noInvoice.trim() || undefined,
            keperluan: f.keperluan.trim() || undefined,
            pemakai: f.pemakai.trim() || undefined,
            penyebab: f.penyebab.trim() || undefined,
            kronologi: f.kronologi.trim() || undefined,
            penanggungJawab: f.penanggungJawab.trim() || undefined,
            catatan: f.catatan.trim() || undefined,
          },
        },
        actor
      );
      toast({
        title: `${meta.label} tersimpan`,
        description: `${res.kode} - ${res.nama}. Sisa stok sekarang ${fmtNumber(res.sisa)}.`,
        variant: 'success',
      });
      setF(blank);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => history.filter((h) => h.jenis === jenis), [history, jenis]);

  const columns = [
    { key: 'tanggal', header: 'Tanggal', accessor: (r) => r.tanggal, cell: (r) => fmtDate(r.tanggal) },
    { key: 'kode', header: 'Kode', cell: (r) => <span className="font-mono text-xs">{r.kode}</span> },
    { key: 'nama', header: 'Nama Barang', cell: (r) => <span className="font-medium">{r.nama}</span> },
    {
      key: 'jumlah',
      header: 'Jumlah',
      align: 'right',
      accessor: (r) => Number(r.jumlah) || 0,
      cell: (r) => (
        <span className={cn('font-semibold', UI[r.jenis]?.tone)}>
          {meta.sign > 0 ? '+' : '−'}
          {fmtNumber(r.jumlah)}
        </span>
      ),
    },
    { key: 'sisaSetelah', header: 'Sisa Setelah', align: 'right', accessor: (r) => Number(r.sisaSetelah) || 0, cell: (r) => fmtNumber(r.sisaSetelah) },
    { key: 'keterangan', header: 'Keterangan', cell: (r) => <span className="block max-w-xs whitespace-normal text-muted-foreground">{r.keterangan || '-'}</span> },
    { key: 'petugas', header: 'Petugas', cell: (r) => r.petugas || '-' },
  ];

  return (
    <div>
      <PageHeader title="Transaksi" description="Catat stok masuk, terpakai, rusak, dan hilang. Semua tercatat di riwayat." />

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.keys(JENIS).map((k) => {
          const Icon = UI[k].icon;
          const active = jenis === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => pickJenis(k)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors',
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? '' : UI[k].tone)} />
              {JENIS[k].label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Input {meta.label}</CardTitle>
            <p className="text-sm text-muted-foreground">{UI[jenis].desc}</p>
          </CardHeader>
          <CardContent>
            {!canWrite ? (
              <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Akun Anda berperan <b>Viewer</b> (hanya lihat). Hubungi Admin untuk akses input transaksi.
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                <Field label="Barang" required>
                  <ItemPicker items={items} value={f.itemId} onChange={(i) => setF((s) => ({ ...s, itemId: i.id }))} />
                </Field>

                {item && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/40 p-3 text-center text-xs">
                    <div>
                      <p className="uppercase tracking-wider text-muted-foreground">Sisa saat ini</p>
                      <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                        {fmtNumber(item.sisa)} <span className="text-xs font-normal text-muted-foreground">{item.satuan}</span>
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wider text-muted-foreground">Setelah</p>
                      <p className={cn('mt-1 font-display text-lg font-semibold tabular-nums', kurang && 'text-red-400')}>
                        {qty > 0 ? fmtNumber(sisaSetelah) : '–'}
                      </p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wider text-muted-foreground">Status</p>
                      <div className="mt-1.5">
                        <StatusBadge status={statusStok(item)} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tanggal" required>
                    <Input type="date" value={tanggal} max={todayISO()} onChange={(e) => setTanggal(e.target.value)} required />
                  </Field>
                  <Field label={`Jumlah ${meta.short}`} required>
                    <Input type="number" min="0" step="any" inputMode="decimal" value={f.jumlah} onChange={set('jumlah')} placeholder="0" />
                  </Field>
                </div>

                {jenis === 'masuk' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Supplier">
                      <Input value={f.supplier} onChange={set('supplier')} placeholder="Nama supplier" />
                    </Field>
                    <Field label="No. Invoice">
                      <Input value={f.noInvoice} onChange={set('noInvoice')} placeholder="INV-0001" />
                    </Field>
                  </div>
                )}
                {jenis === 'terpakai' && (
                  <>
                    <Field label="Untuk keperluan apa" required>
                      <Input value={f.keperluan} onChange={set('keperluan')} placeholder="Contoh: Pergantian linen kamar 305" />
                    </Field>
                    <Field label="Pemakai" required>
                      <Input value={f.pemakai} onChange={set('pemakai')} placeholder="Nama staff / departemen" />
                    </Field>
                  </>
                )}
                {jenis === 'rusak' && (
                  <Field label="Penyebab kerusakan" required>
                    <Textarea value={f.penyebab} onChange={set('penyebab')} placeholder="Jelaskan penyebab barang rusak" />
                  </Field>
                )}
                {jenis === 'hilang' && (
                  <>
                    <Field label="Kronologi" required>
                      <Textarea value={f.kronologi} onChange={set('kronologi')} placeholder="Kapan, di mana, dan bagaimana barang hilang" />
                    </Field>
                    <Field label="Penanggung jawab" required>
                      <Input value={f.penanggungJawab} onChange={set('penanggungJawab')} placeholder="Nama penanggung jawab" />
                    </Field>
                  </>
                )}

                <Field label="Catatan tambahan">
                  <Input value={f.catatan} onChange={set('catatan')} placeholder="Opsional" />
                </Field>

                <Button type="submit" className="w-full" size="lg" disabled={saving || kurang}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan {meta.label}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Riwayat {meta.label}</CardTitle>
            <p className="text-sm text-muted-foreground">300 transaksi terbaru. Gunakan menu Laporan untuk periode lain.</p>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={rows}
              loading={histLoading}
              pageSize={10}
              searchPlaceholder="Cari barang, petugas..."
              searchText={(r) => `${r.kode} ${r.nama} ${r.petugas || ''} ${r.keterangan || ''} ${CAT[r.kategori]?.short || ''}`}
              emptyText={`Belum ada transaksi ${meta.label.toLowerCase()}.`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
