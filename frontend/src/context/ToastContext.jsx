import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

// Small confirmations in the corner: toast('Saved'), toast('Something failed', 'error')
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message, type = 'info', { action, duration } = {}) => {
      const id = ++idRef.current;
      setItems((list) => [...list.slice(-3), { id, message, type, action }]);
      setTimeout(() => dismiss(id), duration || (action ? 7000 : type === 'error' ? 5200 : 3200));
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.message}</span>
            {t.action && <button className="toast-action" onClick={() => { dismiss(t.id); t.action.onClick(); }}>{t.action.label}</button>}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
