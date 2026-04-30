import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional className for the sheet panel itself (default: bg-tm-bg-sunk + border + max-h-[85vh]). */
  panelClassName?: string;
}

/**
 * Mobile-only slide-up bottom sheet. Uses Tailwind transitions only — no animation library.
 *
 * Renders a fixed-position bottom panel with a translucent backdrop. We mount the sheet
 * for one tick after `open` flips to true so the initial transform is `translate-y-full`,
 * then transition to `translate-y-0`. On close we reverse and unmount after the transition
 * completes so dismissed sheets don't sit in the DOM.
 *
 * Esc handling lives in the parent (Markets already wires Esc → setSelection(null)).
 * Backdrop click calls onClose.
 */
export function BottomSheet({ open, onClose, children, panelClassName }: BottomSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      setMounted(true);
      // Next frame: flip to visible so transform animates from translate-y-full → 0.
      const id = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(id);
    }
    setVisible(false);
    closeTimer.current = window.setTimeout(() => {
      setMounted(false);
      closeTimer.current = null;
    }, 220);
    return () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="md:hidden fixed inset-0 z-40">
      <div
        className={cn(
          'absolute inset-0 bg-black/60 transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute left-0 right-0 bottom-0 max-h-[85vh] flex flex-col bg-tm-bg-sunk border-t border-tm-bd rounded-t-lg shadow-xl transform transition-transform duration-200 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
          panelClassName,
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </div>
    </div>
  );
}
