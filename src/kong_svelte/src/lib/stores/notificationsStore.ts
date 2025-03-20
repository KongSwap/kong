import { writable, derived } from 'svelte/store';
import { toastStore, type Toast } from './toastStore';

export interface NotificationState {
  history: Toast[];
  unreadCount: number;
}

function createNotificationsStore() {
  // Initialize the store
  const { subscribe, update, set } = writable<NotificationState>({
    history: [],
    unreadCount: 0
  });

  // Subscribe to toast changes to update the notifications history
  toastStore.subscribe(currentToasts => {
    if (currentToasts.length > 0) {
      update(state => {
        // Filter only success toasts
        const successToasts = currentToasts.filter(toast => toast.type === 'success');
        
        // If no success toasts, don't update anything
        if (successToasts.length === 0) {
          return state;
        }
        
        // Add new success toasts to history
        const allNotifications = [...state.history, ...successToasts];
        
        // Find unique notifications
        const uniqueNotifications = [...new Map(
          allNotifications.map(toast => [toast.id, toast])
        ).values()];
        
        // Sort by timestamp (newest first)
        const sortedNotifications = uniqueNotifications
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50); // Keep up to 50 notifications
          
        // Calculate unread count (only for success toasts not in history)
        const existingIds = new Set(state.history.map(toast => toast.id));
        const newUnreadCount = successToasts.filter(toast => !existingIds.has(toast.id)).length;
        
        return {
          history: sortedNotifications,
          unreadCount: state.unreadCount + newUnreadCount
        };
      });
    }
  });

  return {
    subscribe,
    
    /**
     * Mark all notifications as read
     */
    markAllAsRead: () => {
      update(state => ({
        ...state,
        unreadCount: 0
      }));
    },
    
    /**
     * Clear all notifications history
     */
    clearAll: () => {
      set({
        history: [],
        unreadCount: 0
      });
    },
    
    /**
     * Remove a specific notification by ID
     */
    remove: (id: string) => {
      update(state => ({
        ...state,
        history: state.history.filter(notification => notification.id !== id)
      }));
    },
    
    /**
     * Get notification count by type
     */
    countByType: (type: 'success' | 'error' | 'warning' | 'info') => {
      let count = 0;
      update(state => {
        count = state.history.filter(notification => notification.type === type).length;
        return state;
      });
      return count;
    }
  };
}

export const notificationsStore = createNotificationsStore();

// Create a derived store for today's notifications
export const todaysNotifications = derived(
  notificationsStore,
  ($notificationsStore) => {
    const today = new Date().setHours(0, 0, 0, 0);
    return $notificationsStore.history.filter(notification => 
      new Date(notification.timestamp).setHours(0, 0, 0, 0) === today
    );
  }
); 