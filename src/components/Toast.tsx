import React, { useState, useEffect, useCallback } from 'react';

interface ToastMessage {
    id: number;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

let addToastFn: ((message: string, type: ToastMessage['type']) => void) | null = null;

// Global function to show toasts from anywhere
export const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    if (addToastFn) {
        addToastFn(message, type);
    }
};

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((message: string, type: ToastMessage['type']) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    useEffect(() => {
        addToastFn = addToast;
        return () => { addToastFn = null; };
    }, [addToast]);

    const getColors = (type: ToastMessage['type']) => {
        switch (type) {
            case 'success': return 'bg-green-500';
            case 'error': return 'bg-red-500';
            case 'warning': return 'bg-yellow-500';
            case 'info': return 'bg-blue-500';
        }
    };

    const getIcon = (type: ToastMessage['type']) => {
        switch (type) {
            case 'success': return 'check_circle';
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'info': return 'info';
        }
    };

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-[90%] max-w-sm">
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
