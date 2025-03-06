import { writable } from 'svelte/store';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title?: string;
    message: string;
    timestamp: number;
    timeoutId?: ReturnType<typeof setTimeout>;
    duration?: number;
    action?: {
        label: string;
        callback: () => void;
    };
}

export interface ToastOptions {
    title?: string;
    duration?: number;
    id?: string;
    action?: {
        label: string;
        callback: () => void;
    };
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    const add = (toast: Omit<Toast, 'id' | 'timestamp'> & { id?: string }): string => {
        const id = toast.id || crypto.randomUUID();
        
        // Create timeout if duration is specified
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (toast.duration) {
            timeoutId = setTimeout(() => {
                dismiss(id);
            }, toast.duration);
        }

        update(toasts => {
            // If toast with this ID exists, update it
            if (toast.id) {
                return toasts.map(t => 
                    t.id === toast.id 
                        ? { ...t, ...toast, timeoutId }
                        : t
                );
            }
            // Otherwise add new toast
            return [...toasts, {
                ...toast,
                id,
                timestamp: Date.now(),
                timeoutId
            }];
        });
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
                duration: options.duration || 5000,
                id: options.id
            });
        },
        error: (message: string, options: ToastOptions = {}): string => {
            return add({ 
                type: 'error', 
                message, 
                title: options.title,
                duration: options.duration || 10000,
                id: options.id
            });
        },
        warning: (message: string, options: ToastOptions = {}): string => {
            return add({ 
                type: 'warning', 
                message, 
                title: options.title,
                duration: options.duration || 10000,
                id: options.id
            });
        },
        info: (message: string, options: ToastOptions = {}): string => {
            return add({ 
                type: 'info', 
                message, 
                title: options.title,
                duration: options.duration || 5000,
                id: options.id
            });
        },
    };
}

export const toastStore = createToastStore();
