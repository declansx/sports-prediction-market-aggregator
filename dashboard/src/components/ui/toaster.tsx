import { useToast } from './use-toast';
import { cn } from '../../lib/utils';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const accent =
          t.variant === 'destructive'
            ? 'border-tm-neg/40 bg-tm-neg/10'
            : t.variant === 'success'
            ? 'border-tm-pos/40 bg-tm-pos/10'
            : 'border-tm-bd bg-tm-bg-el';

        const titleColor =
          t.variant === 'destructive'
            ? 'text-tm-neg'
            : t.variant === 'success'
            ? 'text-tm-pos'
            : 'text-tm-tx';

        return (
          <div
            key={t.id}
            className={cn(
              'rounded-[var(--tm-rad)] border px-3 py-2.5 transition-all',
              accent,
            )}
          >
            <p
              className={cn(
                'font-mono text-[10px] font-semibold tracking-[0.18em]',
                titleColor,
              )}
            >
              {t.title.toUpperCase()}
            </p>
            {t.description && (
              <p className="mt-1 font-mono text-[11px] text-tm-tx-dim">{t.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
