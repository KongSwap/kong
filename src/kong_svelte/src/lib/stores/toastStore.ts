import { writable } from 'svelte/store';
import hyperid from 'hyperid';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    title?: string;
}

const generateId = hyperid();

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    const addToast = (
        message: string,
        type: ToastType = 'info',
        duration: number = 5000,
        title?: string
    ): string => {
        const id = generateId();

        if (type === 'error') {
            duration = duration || 8000;
        }

        const toast: Toast = {
            id,
            type,
            message,
            duration,
            title
        };

        update(toasts => [...toasts, toast]);

        if (duration && duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    };

    const removeToast = (id: string) => {
        update(toasts => toasts.filter(t => t.id !== id));
    };

    const clearToasts = () => {
        update(() => []);
    };

    const dismissToast = (id: string) => {
        update(toasts => toasts.filter(t => t.id !== id));
    };

    return {
        subscribe,
        success: (message: string, duration?: number, title?: string) => 
            addToast(message, 'success', duration, title),
        error: (message: string, duration?: number, title?: string) => 
            addToast(message, 'error', duration, title),
        warning: (message: string, duration?: number, title?: string) => 
            addToast(message, 'warning', duration, title),
        info: (message: string, duration?: number, title?: string) => 
            addToast(message, 'info', duration, title),
        remove: removeToast,
        clear: clearToasts,
        dismiss: dismissToast
    };
}

export const toastStore = createToastStore();
