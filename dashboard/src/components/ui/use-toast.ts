import * as React from 'react';

export type ToastVariant = 'default' | 'destructive' | 'success';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

function reducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case 'ADD':
      return [action.toast, ...state].slice(0, 5);
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

const listeners: Array<(action: ToastAction) => void> = [];
let memoryState: Toast[] = [];

function dispatch(action: ToastAction) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(action));
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2);
  dispatch({ type: 'ADD', toast: { ...props, id } });
  setTimeout(() => dispatch({ type: 'REMOVE', id }), 4000);
}

export function useToast() {
  const [toasts, setToasts] = React.useState<Toast[]>(memoryState);

  React.useEffect(() => {
    const handler = () => setToasts([...memoryState]);
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return { toasts };
}
