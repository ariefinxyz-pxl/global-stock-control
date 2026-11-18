'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

/**
 * Tabel generik dengan pencarian, sort, dan pagination.
 * columns: [{ key, header, accessor?(row), cell?(row), sortable?, align?, className? }]
 */
export function DataTable({
  columns,
  data,
  rowKey = 'id',
  searchPlaceholder = 'Cari...',
  searchText,
  defaultQuery = '',
  toolbar,
  initialSort = null,
  pageSize: initialPageSize = 10,
  emptyText = 'Belum ada data.',
  loading = false,
}) {
  const [q, setQ] = useState(defaultQuery);
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || !searchText) return data;
    return data.filter((r) => searchText(r).toLowerCase().includes(term));
  }, [data, q, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const get = col.accessor || ((r) => r[col.key]);
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const r =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va ?? '').localeCompare(String(vb ?? ''), 'id', { numeric: true, sensitivity: 'base' });
      return sort.dir === 'asc' ? r : -r;
    });
    return arr;
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages);
  const start = (cur - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  const toggleSort = (key) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  return (
    <div className="space-y-3">
      {(searchText || toolbar) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {searchText && (
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="pl-9"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false && c.key !== 'aksi';
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      'whitespace-nowrap px-3 py-3 font-semibold',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      c.className
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          'inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground',
                          active && 'text-primary'
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r[rowKey] ?? i} className="transition-colors hover:bg-accent/40">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-3 py-2.5 align-middle',
                        c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : 'text-left',
                        c.className
                      )}
                    >
                      {c.cell ? c.cell(r) : (c.accessor ? c.accessor(r) : r[c.key]) ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {sorted.length === 0
            ? '0 data'
            : `Menampilkan ${start + 1}–${Math.min(start + pageSize, sorted.length)} dari ${sorted.length} data`}
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 w-[88px] text-xs"
            aria-label="Baris per halaman"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / hal
              </option>
            ))}
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Sebelumnya">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[64px] text-center text-xs">
            {cur} / {pages}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Berikutnya">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
