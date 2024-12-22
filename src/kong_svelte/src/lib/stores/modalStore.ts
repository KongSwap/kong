import { writable } from 'svelte/store';
import hyperid from 'hyperid';
import type { ComponentType, SvelteComponent } from 'svelte';

export interface ModalConfig {
    id: string;
    component: ComponentType<SvelteComponent>;
    props?: Record<string, any>;
    onClose?: () => void;
    closeOnClickOutside?: boolean;
    closeOnEscape?: boolean;
}

const generateId = hyperid({ urlSafe: true });

function createModalStore() {
    const { subscribe, update } = writable<ModalConfig[]>([]);

    const addModal = (
        component: ComponentType<SvelteComponent>,
        props: Record<string, any> = {},
        options: {
            onClose?: () => void;
            closeOnClickOutside?: boolean;
            closeOnEscape?: boolean;
        } = {}
    ): string => {
        const id = generateId();
        const modal: ModalConfig = {
            id,
            component,
            props,
            onClose: options.onClose,
            closeOnClickOutside: options.closeOnClickOutside ?? true,
            closeOnEscape: options.closeOnEscape ?? true
        };

        update(modals => [...modals, modal]);
        return id;
    };

    const removeModal = (id: string) => {
        update(modals => {
            const modalToRemove = modals.find(m => m.id === id);
            if (modalToRemove?.onClose) {
                modalToRemove.onClose();
            }
            return modals.filter(m => m.id !== id);
        });
    };

    const removeAll = () => {
        update(modals => {
            modals.forEach(modal => {
                if (modal.onClose) {
                    modal.onClose();
                }
            });
            return [];
        });
    };

    return {
        subscribe,
        add: addModal,
        remove: removeModal,
        removeAll
    };
}
export const modalStore = createModalStore();

