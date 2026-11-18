'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastCtx = createContext(() => {});

// Pemakaian: const toast = useToast(); toast({ title, description, variant: 'success' | 'error' })
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [list, setList] = useState([]);

  const toast = useCallback(({ title, description, variant = 'default' }) => {
    const id = Math.random().toString(36).slice(2);
    setList((l) => [...l, { id, title, description, variant }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 5500);
  }, []);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
    error: <AlertTriangle className="h-5 w-5 text-red-400" />,
    default: <Info className="h-5 w-5 text-primary" />,
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 print:hidden sm:left-auto sm:w-96">
        {list.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex animate-slide-up items-start gap-3 rounded-lg border bg-popover p-3.5 shadow-xl',
              t.variant === 'error' ? 'border-red-500/40' : t.variant === 'success' ? 'border-emerald-500/40' : 'border-border'
            )}
          >
            {icons[t.variant] || icons.default}
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-muted-foreground">{t.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
