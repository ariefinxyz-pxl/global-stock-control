'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Boxes, PackageMinus, PackagePlus, PackageSearch, PackageX, Warehouse } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyInventory } from '@/components/empty-inventory';
import { useData } from '@/lib/data-context';
import { CATEGORIES, CAT } from '@/lib/constants';
import { fmtNumber, statusStok } from '@/lib/utils';

const TOOLTIP = {
  contentStyle: {
    background: '#0E182E',
    border: '1px solid #1F2D4A',
    borderRadius: 10,
    color: '#E5E7EB',
    fontSize: 13,
  },
  labelStyle: { color: '#D4AF37', fontWeight: 600 },
  itemStyle: { color: '#E5E7EB' },
};

export default function DashboardPage() {
  const { items, itemsLoading, lowStock } = useData();

  const stats = useMemo(() => {
    const sum = (f) => items.reduce((s, i) => s + (Number(i[f]) || 0), 0);
    return {
      totalItem: items.length,
      masuk: sum('totalMasuk'),
      terpakai: sum('totalTerpakai'),
      rusak: sum('totalRusak'),
      hilang: sum('totalHilang'),
      sisa: sum('sisa'),
    };
  }, [items]);

  const perCat = useMemo(
    () =>
      CATEGORIES.map((c) => {
        const list = items.filter((i) => i.kategori === c.key);
        return {
          key: c.key,
          name: c.short,
          color: c.color,
          jumlahItem: list.length,
          sisa: list.reduce((s, i) => s + (Number(i.sisa) || 0), 0),
          terpakai: list.reduce((s, i) => s + (Number(i.totalTerpakai) || 0), 0),
        };
      }),
    [items]
  );

  const cards = [
    { label: 'Total Item', value: stats.totalItem, icon: Boxes, tone: 'text-primary bg-primary/10' },
    { label: 'Total Masuk', value: stats.masuk, icon: PackagePlus, tone: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Terpakai', value: stats.terpakai, icon: PackageMinus, tone: 'text-sky-400 bg-sky-500/10' },
    { label: 'Rusak', value: stats.rusak, icon: PackageX, tone: 'text-orange-400 bg-orange-500/10' },
    { label: 'Hilang', value: stats.hilang, icon: PackageSearch, tone: 'text-rose-400 bg-rose-500/10' },
    { label: 'Sisa Stok', value: stats.sisa, icon: Warehouse, tone: 'text-primary bg-primary/10' },
  ];

  const empty = !itemsLoading && items.length === 0;

  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan kontrol aset & perlengkapan BISNIS HOTEL" />

      {empty ? (
        <EmptyInventory />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
                    <span className={`rounded-lg p-2 ${c.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{fmtNumber(c.value)}</p>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Stok per Kategori</CardTitle>
                <p className="text-sm text-muted-foreground">Sisa stok dan total terpakai di setiap kategori</p>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={perCat} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1F2D4A" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
                      <Bar dataKey="sisa" name="Sisa Stok" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="terpakai" name="Terpakai" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Komposisi 6 Kategori</CardTitle>
                <p className="text-sm text-muted-foreground">Jumlah jenis barang per kategori</p>
              </CardHeader>
              <CardContent>
                <div className="relative h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={perCat}
                        dataKey="jumlahItem"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={2}
                        stroke="#0B1426"
                        strokeWidth={2}
                      >
                        {perCat.map((c) => (
                          <Cell key={c.key} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip {...TOOLTIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-3xl font-semibold">{fmtNumber(stats.totalItem)}</span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Item</span>
                  </div>
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {perCat.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="tabular-nums">{fmtNumber(c.jumlahItem)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Barang Stok Menipis</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Sisa stok sudah sama dengan atau di bawah stok minimum</p>
              </div>
              {lowStock.length > 0 && (
                <Link href="/inventory?status=restok" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  Lihat semua ({lowStock.length}) <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada barang yang menipis. Semua stok aman.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-max text-sm">
                    <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 text-left">Kode</th>
                        <th className="px-3 py-3 text-left">Nama Barang</th>
                        <th className="px-3 py-3 text-left">Kategori</th>
                        <th className="px-3 py-3 text-right">Sisa</th>
                        <th className="px-3 py-3 text-right">Minimum</th>
                        <th className="px-3 py-3 text-left">Lokasi</th>
                        <th className="px-3 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lowStock.slice(0, 8).map((i) => (
                        <tr key={i.id} className="hover:bg-accent/40">
                          <td className="px-3 py-2.5 font-mono text-xs">{i.kode}</td>
                          <td className="px-3 py-2.5 font-medium">{i.nama}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{CAT[i.kategori]?.short}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {fmtNumber(i.sisa)} {i.satuan}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtNumber(i.stokMinimum)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{i.lokasi || '-'}</td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={statusStok(i)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
