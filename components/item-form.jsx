'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/label';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { useData } from '@/lib/data-context';
import { CAT, CATEGORIES, KONDISI, SATUAN } from '@/lib/constants';
import { createItem, updateItem } from '@/lib/actions';
import { isBahanBaku } from '@/lib/utils';

const emptyForm = (kategori) => ({
  kategori,
  nama: '',
  satuan: 'Pcs',
  stokAwal: '0',
  stokMinimum: '0',
  harga: '0',
  lokasi: 'Gudang Utama',
  kondisi: 'Baik',
  deskripsi: '',
});

export function ItemFormModal({ open, onClose, item, defaultKategori }) {
  const { actor } = useAuth();
  const { items } = useData();
  const toast = useToast();
  const editing = Boolean(item);

  const [f, setF] = useState(emptyForm('cafe'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (item) {
      setF({
        kategori: item.kategori,
        nama: item.nama || '',
        satuan: item.satuan || 'Pcs',
        stokAwal: String(item.stokAwal ?? 0),
        stokMinimum: String(item.stokMinimum ?? 0),
        harga: String(item.harga ?? 0),
        lokasi: item.lokasi || '',
        kondisi: item.kondisi || 'Baik',
        deskripsi: item.deskripsi || '',
      });
    } else {
      setF(emptyForm(defaultKategori && defaultKategori !== 'all' ? defaultKategori : 'cafe'));
    }
  }, [open, item, defaultKategori]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const nama = f.nama.trim();
    if (!nama) return setError('Nama barang wajib diisi.');
    if (f.kategori === 'cafe' && isBahanBaku(nama)) {
      return setError(
        'Kategori Inventory Cafe hanya untuk alat, aksesoris & perlengkapan, bukan bahan baku (kopi, susu, gula, dll).'
      );
    }
    const nums = [f.stokAwal, f.stokMinimum, f.harga].map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return setError('Stok dan harga harus berupa angka 0 atau lebih.');

    setSaving(true);
    try {
      if (editing) {
        await updateItem(item, { ...f, nama }, actor);
        toast({ title: 'Barang diperbarui', description: `${item.kode} - ${nama}`, variant: 'success' });
      } else {
        const kode = await createItem({ ...f, nama }, actor, items);
        toast({ title: 'Barang ditambahkan', description: `Kode otomatis: ${kode}`, variant: 'success' });
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Gagal menyimpan barang.');
    } finally {
      setSaving(false);
    }
  };

  const satuanList = SATUAN.includes(f.satuan) ? SATUAN : [...SATUAN, f.satuan];
  const kondisiList = KONDISI.includes(f.kondisi) ? KONDISI : [...KONDISI, f.kondisi];

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      size="md"
      title={editing ? `Ubah Barang · ${item.kode}` : 'Tambah Barang'}
      description={CAT[f.kategori]?.hint}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="item-form" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? 'Simpan Perubahan' : 'Simpan Barang'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Field label="Kategori" required>
          <Select value={f.kategori} onChange={set('kategori')} disabled={editing}>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kode Barang" hint={editing ? undefined : `Dibuat otomatis (${CAT[f.kategori].prefix}-001, dst.)`}>
          <Input value={editing ? item.kode : 'Otomatis'} disabled />
        </Field>
        <Field label="Nama Barang" required className="sm:col-span-2">
          <Input value={f.nama} onChange={set('nama')} placeholder="Contoh: Gelas Latte 250ml" />
        </Field>
        <Field label="Satuan" required>
          <Select value={f.satuan} onChange={set('satuan')}>
            {satuanList.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Kondisi">
          <Select value={f.kondisi} onChange={set('kondisi')}>
            {kondisiList.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Stok Awal" hint={editing ? 'Mengubah stok awal akan menghitung ulang sisa stok.' : undefined}>
          <Input type="number" min="0" inputMode="decimal" value={f.stokAwal} onChange={set('stokAwal')} />
        </Field>
        <Field label="Stok Minimum" hint="Notifikasi muncul jika sisa ≤ stok minimum.">
          <Input type="number" min="0" inputMode="decimal" value={f.stokMinimum} onChange={set('stokMinimum')} />
        </Field>
        <Field label="Harga Satuan (Rp)">
          <Input type="number" min="0" inputMode="numeric" value={f.harga} onChange={set('harga')} />
        </Field>
        <Field label="Lokasi / Gudang">
          <Input value={f.lokasi} onChange={set('lokasi')} placeholder="Contoh: Gudang Utama" />
        </Field>
        <Field label="Deskripsi" className="sm:col-span-2">
          <Textarea value={f.deskripsi} onChange={set('deskripsi')} placeholder="Keterangan tambahan (opsional)" />
        </Field>
      </form>
    </Modal>
  );
}
