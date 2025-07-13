import { writable, type Writable } from 'svelte/store';

// Modal types and interfaces
export type ModalType = 
  | 'confirmation' 
  | 'form' 
  | 'selector' 
  | 'signature' 
  | 'qr' 
  | 'custom';

export interface BaseModalProps {
  title?: string;
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  width?: string;
  height?: string;
  className?: string;
}

export interface ConfirmationModalProps extends BaseModalProps {
  type: 'confirmation';
  variant?: 'danger' | 'warning' | 'info' | 'success';
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface FormModalProps extends BaseModalProps {
  type: 'form';
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'password' | 'textarea';
    required?: boolean;
    placeholder?: string;
    validation?: (value: any) => string | null;
  }>;
  onSubmit?: (data: Record<string, any>) => void | Promise<void>;
  submitText?: string;
}

export interface SelectorModalProps<T = any> extends BaseModalProps {
  type: 'selector';
  items: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  displayKey?: keyof T | ((item: T) => string);
  onSelect?: (item: T) => void;
  renderItem?: (item: T) => any;
}

export interface SignatureModalProps extends BaseModalProps {
  type: 'signature';
  message: string;
  error?: string;
  onSignatureComplete?: () => void;
}

export interface QRModalProps extends BaseModalProps {
  type: 'qr';
  qrData: string;
  address?: string;
}

export interface CustomModalProps extends BaseModalProps {
  type: 'custom';
  component: any;
  props?: Record<string, any>;
}

export type ModalProps = 
  | ConfirmationModalProps 
  | FormModalProps 
  | SelectorModalProps 
  | SignatureModalProps 
  | QRModalProps 
  | CustomModalProps;

export interface ModalState {
  id: string;
  props: ModalProps;
  timestamp: number;
  zIndex: number;
  resolvePromise?: (value: any) => void;
  rejectPromise?: (reason?: any) => void;
}

interface ModalManagerState {
  modals: ModalState[];
  nextId: number;
}

const BASE_Z_INDEX = 100010;
const Z_INDEX_INCREMENT = 10;

// Performance optimization: Modal recycling pool
const modalPool = new Map<string, ModalState[]>();
const MAX_POOL_SIZE = 5; // Max modals to keep in pool per type

// Performance optimization: Debounced updates
let updateTimeout: number | null = null;

function createModalManager() {
  const { subscribe, update, set }: Writable<ModalManagerState> = writable({
    modals: [],
    nextId: 1
  });

  function generateId(): string {
    let id: string;
    update(state => {
      id = `modal_${state.nextId}`;
      return { ...state, nextId: state.nextId + 1 };
    });
    return id!;
  }

  function calculateZIndex(timestamp: number, modals: ModalState[]): number {
    const sortedModals = [...modals].sort((a, b) => a.timestamp - b.timestamp);
    const index = sortedModals.findIndex(modal => modal.timestamp === timestamp);
    return BASE_Z_INDEX + (index * Z_INDEX_INCREMENT);
  }

  // Performance monitoring
  const performanceMetrics = {
    totalOpened: 0,
    totalClosed: 0,
    averageOpenTime: 0,
    peakConcurrentModals: 0
  };

  // Modal recycling functions
  function getFromPool(type: string): ModalState | null {
    const pool = modalPool.get(type);
    return pool?.pop() || null;
  }

  function returnToPool(modal: ModalState) {
    const type = modal.props.type;
    let pool = modalPool.get(type);
    
    if (!pool) {
      pool = [];
      modalPool.set(type, pool);
    }
    
    if (pool.length < MAX_POOL_SIZE) {
      // Reset modal state for reuse
      const recycledModal = {
        ...modal,
        id: '',
        timestamp: 0,
        zIndex: 0,
        resolvePromise: undefined,
        rejectPromise: undefined
      };
      
      pool.push(recycledModal);
    }
  }

  // Debounced batch updates for better performance
  function scheduleUpdate(updateFn: () => void) {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    
    updateTimeout = setTimeout(() => {
      updateFn();
      updateTimeout = null;
    }, 0) as any;
  }

  return {
    subscribe,

    /**
     * Open a modal with promise-based resolution and recycling
     */
    open<T = any>(props: ModalProps): Promise<T> {
      return new Promise((resolve, reject) => {
        // Try to get a recycled modal first
        let newModal = getFromPool(props.type);
        
        if (newModal) {
          // Reuse recycled modal
          newModal.id = generateId();
          newModal.props = props;
          newModal.timestamp = Date.now();
          newModal.resolvePromise = resolve;
          newModal.rejectPromise = reject;
        } else {
          // Create new modal
          newModal = {
            id: generateId(),
            props,
            timestamp: Date.now(),
            zIndex: 0, // Will be calculated below
            resolvePromise: resolve,
            rejectPromise: reject
          };
        }

        scheduleUpdate(() => {
          update(state => {
            const newModals = [...state.modals, newModal!];
            
            // Recalculate z-indexes for all modals
            newModals.forEach(modal => {
              modal.zIndex = calculateZIndex(modal.timestamp, newModals);
            });

            // Update performance metrics
            performanceMetrics.totalOpened++;
            performanceMetrics.peakConcurrentModals = Math.max(
              performanceMetrics.peakConcurrentModals,
              newModals.length
            );

            return { ...state, modals: newModals };
          });
        });
      });
    },

    /**
     * Close a specific modal by ID with recycling
     */
    close(id: string, result?: any): void {
      scheduleUpdate(() => {
        update(state => {
          const modalIndex = state.modals.findIndex(modal => modal.id === id);
          if (modalIndex === -1) return state;

          const modal = state.modals[modalIndex];
          
          // Resolve the promise if it exists
          if (modal.resolvePromise) {
            modal.resolvePromise(result);
          }

          // Return modal to pool for reuse
          returnToPool(modal);

          const newModals = state.modals.filter(modal => modal.id !== id);
          
          // Recalculate z-indexes
          newModals.forEach(modal => {
            modal.zIndex = calculateZIndex(modal.timestamp, newModals);
          });

          // Update performance metrics
          performanceMetrics.totalClosed++;

          return { ...state, modals: newModals };
        });
      });
    },

    /**
     * Close the topmost modal
     */
    closeTop(result?: any): void {
      update(state => {
        if (state.modals.length === 0) return state;

        const topModal = state.modals.reduce((top, modal) => 
          modal.timestamp > top.timestamp ? modal : top
        );

        return state;
      });

      // Use the close method to handle the actual closing
      const currentState = get({ subscribe });
      if (currentState.modals.length > 0) {
        const topModal = currentState.modals.reduce((top, modal) => 
          modal.timestamp > top.timestamp ? modal : top
        );
        this.close(topModal.id, result);
      }
    },

    /**
     * Close all modals
     */
    closeAll(): void {
      update(state => {
        // Reject all promises
        state.modals.forEach(modal => {
          if (modal.rejectPromise) {
            modal.rejectPromise(new Error('Modal closed'));
          }
        });

        return { ...state, modals: [] };
      });
    },

    /**
     * Get modal by ID
     */
    getModal(id: string): ModalState | undefined {
      const currentState = get({ subscribe });
      return currentState.modals.find(modal => modal.id === id);
    },

    /**
     * Check if any modals are open
     */
    hasOpenModals(): boolean {
      const currentState = get({ subscribe });
      return currentState.modals.length > 0;
    },

    /**
     * Get count of open modals
     */
    getOpenCount(): number {
      const currentState = get({ subscribe });
      return currentState.modals.length;
    },

    /**
     * Get all open modals
     */
    getOpenModals(): ModalState[] {
      const currentState = get({ subscribe });
      return [...currentState.modals];
    },

    /**
     * Update modal props
     */
    updateModal(id: string, props: Partial<ModalProps>): void {
      scheduleUpdate(() => {
        update(state => {
          const modalIndex = state.modals.findIndex(modal => modal.id === id);
          if (modalIndex === -1) return state;

          const updatedModals = [...state.modals];
          updatedModals[modalIndex] = {
            ...updatedModals[modalIndex],
            props: { ...updatedModals[modalIndex].props, ...props }
          };

          return { ...state, modals: updatedModals };
        });
      });
    },

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
      return { ...performanceMetrics };
    },

    /**
     * Clear modal pool to free memory
     */
    clearModalPool(): void {
      modalPool.clear();
    },

    /**
     * Get modal pool size for debugging
     */
    getPoolSize(): number {
      let total = 0;
      for (const pool of modalPool.values()) {
        total += pool.length;
      }
      return total;
    },

    /**
     * Preload modal components (to be called by ModalRenderer)
     */
    async preloadModalComponents(types: string[] = ['confirmation', 'form']): Promise<void> {
      // This will be implemented by the component that imports this
      // Just a placeholder for the API
    }
  };
}

// Helper function to access store state
function get(store: { subscribe: any }) {
  let value: any;
  store.subscribe((v: any) => { value = v; })();
  return value;
}

// Create and export the modal manager instance
export const modalManager = createModalManager();

// Convenience functions for common modal types
export const modals = {
  /**
   * Show confirmation dialog
   */
  confirm(props: Omit<ConfirmationModalProps, 'type'>): Promise<boolean> {
    return modalManager.open({ ...props, type: 'confirmation' });
  },

  /**
   * Show form modal
   */
  form<T = Record<string, any>>(props: Omit<FormModalProps, 'type'>): Promise<T> {
    return modalManager.open({ ...props, type: 'form' });
  },

  /**
   * Show selector modal
   */
  select<T>(props: Omit<SelectorModalProps<T>, 'type'>): Promise<T> {
    return modalManager.open({ ...props, type: 'selector' });
  },

  /**
   * Show signature modal
   */
  signature(props: Omit<SignatureModalProps, 'type'>): Promise<void> {
    return modalManager.open({ ...props, type: 'signature' });
  },

  /**
   * Show QR modal
   */
  qr(props: Omit<QRModalProps, 'type'>): Promise<void> {
    return modalManager.open({ ...props, type: 'qr' });
  },

  /**
   * Show custom modal
   */
  custom<T = any>(props: Omit<CustomModalProps, 'type'>): Promise<T> {
    return modalManager.open({ ...props, type: 'custom' });
  }
};

// Export backward compatibility stores (will be deprecated)
export { modalStack } from './modalStore';
export { signatureModalStore } from './signatureModalStore';
export { qrModalStore } from './qrModalStore';