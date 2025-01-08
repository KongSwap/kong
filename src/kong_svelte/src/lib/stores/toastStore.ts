import { writable } from 'svelte/store';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    timestamp: number;
    timeoutId?: ReturnType<typeof setTimeout>;
    duration?: number;
}

export interface ToastOptions {
    title?: string;
    duration?: number;
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    const add = (toast: Omit<Toast, 'id' | 'timestamp'>): string => {
        const id = crypto.randomUUID();
        
        // Create timeout if duration is specified
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (toast.duration) {
            timeoutId = setTimeout(() => {
                dismiss(id);
            }, toast.duration);
        }

        update(toasts => [...toasts, {
            ...toast,
            id,
            timestamp: Date.now(),
            timeoutId // Store the timeout ID
        }]);
        return id;
    };

    const dismiss = (id: string) => {
        update(toasts => {
            const toast = toasts.find(t => t.id === id);
            if (toast?.timeoutId) {
                clearTimeout(toast.timeoutId);
            }
            return toasts.filter(t => t.id !== id);
        });
    };

    return {
        subscribe,
        add,
        dismiss,
        // Convenience methods with options
        success: (message: string, options: ToastOptions = {}): string => {
            return add({ 
                type: 'success', 
                message, 
                title: options.title,
                duration: options.duration || 5000 
            });
        },
        error: (message: string, options: ToastOptions = {}): string => {
            return add({ 
                type: 'error', 
                message, 
                title: options.title,
                duration: options.duration || 10000 // Longer default for errors
            });
        },
        warning: (message: string, options: ToastOptions = {}): string => {
            return add({ 
                type: 'warning', 
                message, 
                title: options.title,
                duration: options.duration || 10000
            });
        },
        info: (message: string, options: ToastOptions = {}): string => {
            return add({ 
                type: 'info', 
                message, 
                title: options.title,
                duration: options.duration || 5000
            });
        },
    };
}

export const toastStore = createToastStore();
