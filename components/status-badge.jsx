import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL } from '@/lib/utils';

// Aman = hijau, Menipis = kuning, Habis = merah
const VARIANT = { aman: 'success', menipis: 'warning', habis: 'danger' };

export function StatusBadge({ status }) {
  return <Badge variant={VARIANT[status] || 'muted'}>{STATUS_LABEL[status] || status}</Badge>;
}
