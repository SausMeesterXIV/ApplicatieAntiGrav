import React, { useState, useEffect, useCallback } from 'react';

let addToastFn = null;

// Global function to show toasts from anywhere
export const showToast = (message, type = 'info') => {
  if (addToastFn) {
    addToastFn(message, type);
  }
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  const getColors = type => {
    switch (type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'info':
        return 'bg-blue-500';
    }
  };

  const getIcon = type => {
    switch (type) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
    }
  };

  return (
    // Onder de notch / statusbalk van de iPhone (safe area), anders 1rem van boven
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-[90%] max-w-sm"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${getColors(toast.type)} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300`}
          onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
        >
          <span className="material-icons-round text-sm">{getIcon(toast.type)}</span>
          <span className="text-sm font-medium flex-1">{toast.message}</span>
        </div>
      ))}
    </div>
  );
};
