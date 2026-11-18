'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { AccessDenied } from '@/components/access-denied';
import { CategoryIcon } from '@/components/category-icon';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/label';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { CAT, CATEGORIES } from '@/lib/constants';
import { deleteDummyItems, importCategory, isDummyItem, seedDummy } from '@/lib/actions';
import { ACTION_LABEL, FIELDS, analyzeRows, autoMap, downloadTemplate, guessCategory, readWorkbookFile } from '@/lib/excel';
import { cn, fmtNumber, fmtRupiah } from '@/lib/utils';

const STATUS_UI = {
  baru: ['Baru', 'success'],
  duplikat: ['Duplikat', 'warning'],
  'duplikat-file': ['Duplikat di file', 'warning'],
  error: ['Tidak valid', 'danger'],
};

// Baris hasil analisis + keputusan pengguna (override) => baris siap diimpor
function buildRows(slot, kategori, items) {
  if (!slot?.rows) return [];
  const existing = items.filter((i) => i.kategori === kategori);
  const noStok = slot.mapping.jumlah < 0;
  return analyzeRows(slot.rows, slot.mapping, kategori, existing, slot.defaultDup || 'skip').map((r) => {
    const options = r.options.filter((o) => !(o === 'update' && noStok));
    let action = slot.decisions?.[r.rowNo] ?? r.action;
    if (!options.includes(action)) action = 'skip';
    return { ...r, options, action };
  });
}

function count(rows) {
  const c = { create: 0, update: 0, skip: 0, error: 0, attention: 0 };
  rows.forEach((r) => {
    if (r.status === 'error') c.error += 1;
    if (r.action === 'create') c.create += 1;
    else if (r.action === 'update') c.update += 1;
    else c.skip += 1;
    if (r.status !== 'baru' || r.issues.length) c.attention += 1;
  });
  return c;
}

/* ------------------------------- Kartu kategori ------------------------------ */

function ImportCard({ cat, slot = {}, items, onFile, onPatch, onImport, onReset }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const rows = useMemo(() => buildRows(slot, cat.key, items), [slot, cat.key, items]);
  const c = useMemo(() => count(rows), [rows]);
  const status = slot.status || 'idle';
  const hasFile = Boolean(slot.rows);
  const canImport = hasFile && slot.mapping.nama >= 0 && c.create + c.update > 0 && status === 'ready';
  const view = slot.view || (c.attention > 0 ? 'attention' : 'all');
  const shown = (view === 'attention' ? rows.filter((r) => r.status !== 'baru' || r.issues.length) : rows).slice(0, 100);
  const total = view === 'attention' ? c.attention : rows.length;
  const open = slot.open !== false;
  const guess = slot.guess && slot.guess !== cat.key ? slot.guess : null;

  const pick = (file) => file && onFile(cat.key, file);
  const setMap = (field, idx) => onPatch(cat.key, { mapping: { ...slot.mapping, [field]: idx }, decisions: {} });
  const setDecision = (rowNo, action) => onPatch(cat.key, { decisions: { ...(slot.decisions || {}), [rowNo]: action } });

  return (
    <Card className="overflow-hidden">
      {/* Header kartu */}
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: `${cat.color}1f`, color: cat.color }}>
            <CategoryIcon kategori={cat.key} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold">{cat.label}</p>
            <p className="truncate text-xs text-muted-foreground" title={cat.hint}>
              {cat.hint}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(cat.key)}>
            <Download className="h-4 w-4" /> Download Template Excel
          </Button>
          {hasFile && status !== 'importing' && (
            <Button variant="ghost" size="sm" onClick={() => onReset(cat.key)}>
              <RotateCcw className="h-4 w-4" /> Ganti File
            </Button>
          )}
        </div>
      </div>

      {/* Area upload */}
      {!hasFile && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'm-4 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
            drag ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60 hover:bg-accent/30'
          )}
        >
          {slot.loading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <UploadCloud className="h-7 w-7 text-primary" />}
          <span className="text-sm font-medium">{slot.loading ? 'Membaca file...' : 'Pilih atau seret file .xlsx ke sini'}</span>
          <span className="text-xs text-muted-foreground">File Excel kategori {cat.short} (.xlsx / .xls / .csv)</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      )}
      {slot.error && (
        <p className="mx-4 mb-4 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {slot.error}
        </p>
      )}

      {/* Sudah diimpor */}
      {status === 'done' && slot.result && (
        <div className="m-4 flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-300">Import selesai — data sudah muncul di Inventory</p>
            <p className="text-muted-foreground">
              {fmtNumber(slot.result.created)} barang baru · {fmtNumber(slot.result.updated)} stok diperbarui ·{' '}
              {fmtNumber(slot.result.skipped)} dilewati
            </p>
          </div>
        </div>
      )}

      {/* Preview, mapping, duplikat */}
      {hasFile && status !== 'done' && (
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <span className="font-medium">{slot.fileName}</span>
            <span className="text-xs text-muted-foreground">
              Sheet “{slot.sheetName}” · {fmtNumber(slot.rows.length)} baris
            </span>
            <button type="button" onClick={() => onPatch(cat.key, { open: !open })} className="ml-auto text-xs text-primary hover:underline">
              {open ? 'Sembunyikan pengaturan & preview' : 'Tampilkan pengaturan & preview'}
            </button>
          </div>

          {guess && (
            <p className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Nama file tampak seperti kategori “{CAT[guess].short}”, tetapi diunggah di
              kotak “{cat.short}”. Pastikan sudah benar.
            </p>
          )}

          {open && (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold">Mapping kolom</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Dicocokkan otomatis dari judul kolom. Jika berbeda (mis. “Nama Item” untuk Nama Barang), pilih kolomnya secara manual.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FIELDS.map((f) => (
                    <Field key={f.key} label={f.label} required={f.required}>
                      <Select value={slot.mapping[f.key]} onChange={(e) => setMap(f.key, Number(e.target.value))}>
                        <option value={-1}>— Tidak dipakai —</option>
                        {slot.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>
                {slot.mapping.nama < 0 && (
                  <p className="mt-2 text-sm text-red-400">Kolom Nama Barang wajib dipilih sebelum import.</p>
                )}
                {slot.mapping.jumlah < 0 && (
                  <p className="mt-2 text-xs text-yellow-300">
                    Kolom Jumlah/Stok Awal tidak dipilih: barang baru diberi stok 0 dan opsi “Update Stok” dinonaktifkan.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <Badge variant="success">{fmtNumber(c.create)} dibuat baru</Badge>
                <Badge variant="info">{fmtNumber(c.update)} update stok</Badge>
                <Badge variant="muted">{fmtNumber(c.skip)} dilewati</Badge>
                {c.error > 0 && <Badge variant="danger">{fmtNumber(c.error)} tidak valid</Badge>}
                <div className="ml-auto flex items-center gap-2">
                  <label className="text-xs text-muted-foreground" htmlFor={`dup-${cat.key}`}>
                    Untuk semua data duplikat:
                  </label>
                  <Select
                    id={`dup-${cat.key}`}
                    value={slot.defaultDup || 'skip'}
                    onChange={(e) => onPatch(cat.key, { defaultDup: e.target.value, decisions: {} })}
                    className="h-9 w-40 text-xs"
                  >
                    <option value="skip">Skip</option>
                    <option value="update" disabled={slot.mapping.jumlah < 0}>
                      Update Stok
                    </option>
                    <option value="create">Buat Baru</option>
                  </Select>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <p className="font-semibold">Preview data</p>
                  <div className="ml-auto inline-flex rounded-md border border-border p-0.5 text-xs">
                    {[
                      ['attention', `Perlu perhatian (${c.attention})`],
                      ['all', `Semua baris (${rows.length})`],
                    ].map(([k, l]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => onPatch(cat.key, { view: k })}
                        className={cn('rounded px-2.5 py-1', view === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-max text-xs">
                    <thead className="bg-muted/60 uppercase tracking-wide text-muted-foreground">
                      <tr>
                        {['Baris', 'Nama Barang', 'Kode', 'Satuan', 'Stok', 'Harga', 'Lokasi', 'Status', 'Tindakan'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shown.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                            {view === 'attention' ? 'Tidak ada baris yang perlu perhatian.' : 'Tidak ada data.'}
                          </td>
                        </tr>
                      )}
                      {shown.map((r) => {
                        const [label, variant] = STATUS_UI[r.status] || ['-', 'muted'];
                        return (
                          <tr key={r.rowNo} className={cn(r.action === 'skip' && 'opacity-60')}>
                            <td className="px-3 py-2 text-muted-foreground">{r.rowNo}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium">{r.data.nama || '—'}</p>
                              {r.issues.map((m) => (
                                <p key={m} className="text-[11px] text-yellow-400">
                                  {m}
                                </p>
                              ))}
                              {r.existing && (
                                <p className="text-[11px] text-muted-foreground">
                                  Sudah ada: {r.existing.kode} (sisa {fmtNumber(r.existing.sisa)})
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono">{r.data.kode || <span className="text-muted-foreground">otomatis</span>}</td>
                            <td className="px-3 py-2">{r.data.satuan}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(r.data.stokAwal)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtRupiah(r.data.harga)}</td>
                            <td className="px-3 py-2">{r.data.lokasi || '-'}</td>
                            <td className="px-3 py-2">
                              <Badge variant={variant}>{label}</Badge>
                            </td>
                            <td className="px-3 py-2">
                              {r.options.length > 1 ? (
                                <Select value={r.action} onChange={(e) => setDecision(r.rowNo, e.target.value)} className="h-8 w-36 text-xs">
                                  {r.options.map((o) => (
                                    <option key={o} value={o}>
                                      {ACTION_LABEL[o]}
                                    </option>
                                  ))}
                                </Select>
                              ) : (
                                <span className="text-muted-foreground">{ACTION_LABEL[r.action]}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {total > shown.length && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Menampilkan {shown.length} dari {fmtNumber(total)} baris. Baris lain tetap diproses sesuai pilihan “Untuk semua data duplikat”.
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Duplikat dideteksi dari Nama Barang yang sama. <b>Update Stok</b> menyamakan Sisa Stok dengan jumlah di Excel;{' '}
                  <b>Buat Baru</b> membuat barang baru dengan kode baru.
                </p>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
            {status === 'importing' && (
              <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan ke Firestore... {slot.progress || 0}%
              </div>
            )}
            <Button onClick={() => onImport(cat.key)} disabled={!canImport}>
              {status === 'importing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Import {fmtNumber(c.create + c.update)} Barang
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------- Halaman --------------------------------- */

export default function ImportPage() {
  const { isAdmin, actor } = useAuth();
  const { items } = useData();
  const toast = useToast();

  const [slots, setSlots] = useState({});
  const [busyAll, setBusyAll] = useState(false);
  const [busyDummy, setBusyDummy] = useState(false);
  const [confirmDummy, setConfirmDummy] = useState(false);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = (key, p) => setSlots((s) => ({ ...s, [key]: { ...(s[key] || {}), ...p } }));
  const dummyCount = items.filter(isDummyItem).length;

  if (!isAdmin) return <AccessDenied message="Import data hanya dapat dilakukan oleh Admin." />;

  const handleFile = async (key, file) => {
    patch(key, { loading: true, error: '' });
    try {
      const wb = await readWorkbookFile(file);
      patch(key, {
        loading: false,
        fileName: file.name,
        sheetName: wb.sheetName,
        headers: wb.headers,
        rows: wb.rows,
        mapping: autoMap(wb.headers),
        decisions: {},
        defaultDup: 'skip',
        view: undefined,
        status: 'ready',
        open: true,
        result: null,
        progress: 0,
        guess: guessCategory(file.name),
      });
    } catch (e) {
      console.error(e);
      patch(key, { loading: false, error: e.message || 'File tidak dapat dibaca. Pastikan formatnya .xlsx.' });
    }
  };

  const reset = (key) => setSlots((s) => ({ ...s, [key]: {} }));

  const runImport = async (key) => {
    const slot = slotsRef.current[key];
    const current = itemsRef.current;
    const rows = buildRows(slot, key, current);
    patch(key, { status: 'importing', progress: 0, error: '' });
    try {
      const res = await importCategory(key, rows, actor, current.filter((i) => i.kategori === key), (done, total) =>
        patch(key, { progress: Math.round((done / total) * 100) })
      );
      patch(key, { status: 'done', result: res });
      toast({
        title: `Import ${CAT[key].short} selesai`,
        description: `${res.created} baru, ${res.updated} update stok, ${res.skipped} dilewati`,
        variant: 'success',
      });
      return true;
    } catch (e) {
      console.error(e);
      patch(key, { status: 'ready', error: e.message || 'Gagal menyimpan' });
      toast({ title: `Import ${CAT[key].short} gagal`, description: e.message, variant: 'error' });
      return false;
    }
  };

  const readyKeys = CATEGORIES.map((c) => c.key).filter((k) => {
    const s = slots[k];
    if (!s?.rows || s.status !== 'ready' || s.mapping.nama < 0) return false;
    const c = count(buildRows(s, k, items));
    return c.create + c.update > 0;
  });

  const importAll = async () => {
    setBusyAll(true);
    for (const key of readyKeys) {
      // eslint-disable-next-line no-await-in-loop
      await runImport(key);
    }
    setBusyAll(false);
  };

  const loadDummy = async () => {
    setBusyDummy(true);
    try {
      const n = await seedDummy(actor, itemsRef.current);
      toast({ title: 'Data contoh dimuat', description: `${n} barang dummy ditambahkan.`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Gagal memuat data contoh', description: e.message, variant: 'error' });
    } finally {
      setBusyDummy(false);
    }
  };

  const removeDummy = async () => {
    setBusyDummy(true);
    try {
      const n = await deleteDummyItems(itemsRef.current, actor);
      toast({ title: 'Data contoh dihapus', description: `${n} barang dummy dihapus.`, variant: 'success' });
      setConfirmDummy(false);
    } catch (e) {
      toast({ title: 'Gagal menghapus data contoh', description: e.message, variant: 'error' });
    } finally {
      setBusyDummy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Import Data dari Excel"
        description="Unggah 6 file Excel (satu per kategori) sekaligus, cek preview, atur mapping kolom, lalu simpan ke Firestore."
        actions={
          <Button size="lg" onClick={importAll} disabled={readyKeys.length === 0 || busyAll}>
            {busyAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Import Semua ({readyKeys.length} file siap)
          </Button>
        }
      />

      <div className="space-y-4">
        {CATEGORIES.map((cat) => (
          <ImportCard
            key={cat.key}
            cat={cat}
            slot={slots[cat.key]}
            items={items}
            onFile={handleFile}
            onPatch={patch}
            onImport={runImport}
            onReset={reset}
          />
        ))}
      </div>

      <Card className="mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display font-semibold">Data contoh (dummy)</p>
          <p className="text-sm text-muted-foreground">
            Untuk mencoba aplikasi sebelum memasukkan data asli. Hapus sebelum mulai memakai data sebenarnya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadDummy} disabled={busyDummy}>
            {busyDummy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Muat Data Contoh
          </Button>
          <Button variant="outline" onClick={() => setConfirmDummy(true)} disabled={busyDummy || dummyCount === 0}>
            <Trash2 className="h-4 w-4" /> Hapus Data Contoh ({dummyCount})
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDummy}
        title="Hapus semua data contoh?"
        description={`${dummyCount} barang dummy akan dihapus. Barang dari import Excel tidak ikut terhapus.`}
        confirmLabel="Ya, Hapus"
        destructive
        loading={busyDummy}
        onClose={() => setConfirmDummy(false)}
        onConfirm={removeDummy}
      />
    </div>
  );
}
