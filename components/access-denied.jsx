import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function AccessDenied({ message = 'Halaman ini hanya dapat diakses oleh Admin.' }) {
  return (
    <Card className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <ShieldAlert className="h-10 w-10 text-primary" />
      <h2 className="font-display text-lg font-semibold">Akses dibatasi</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}
