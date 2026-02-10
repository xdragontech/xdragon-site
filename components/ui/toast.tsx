import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

type ToastContextValue = {
  toast: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const base =
    "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg";
  const styles =
    toast.kind === "success"
      ? "border-green-200 bg-green-50 text-green-900"
      : toast.kind === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-neutral-200 bg-white text-neutral-900";

  return (
    <div className={`${base} ${styles}`} role="status" aria-live="polite">
      <div className="mt-0.5">{toast.kind === "success" ? "✅" : toast.kind === "error" ? "⚠️" : "ℹ️"}</div>
      <div className="flex-1 leading-snug">{toast.message}</div>
      <button
        type="button"
        className="rounded-lg px-2 py-1 text-xs font-semibold hover:bg-black/5"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        Close
      </button>
    </div>
  );
}

/**
 * Clean, dependency-free toaster.
 * - Mount ToastProvider once (pages/_app.tsx)
 * - Call useToast().toast(kind, message) anywhere in React tree
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) window.clearTimeout(timer);
    delete timers.current[id];
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const next: Toast = { id, kind, message };
      setToasts((prev) => {
        // keep it tidy
        const trimmed = prev.slice(-2);
        return [...trimmed, next];
      });

      timers.current[id] = window.setTimeout(() => {
        dismiss(id);
      }, 2600);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((t) => window.clearTimeout(t));
      timers.current = {};
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toaster mount */}
      <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider> (mount it in pages/_app.tsx)");
  }
  return ctx;
}
