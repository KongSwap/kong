import { writable, derived } from 'svelte/store';
import type { Message } from '$lib/api/trollbox';
import * as trollboxApi from '$lib/api/trollbox';
import { browser } from '$app/environment';
import { Principal } from '@dfinity/principal';

// Constants
const TROLLBOX_NAMESPACE = 'trollbox';
const PENDING_MESSAGES_KEY = `${TROLLBOX_NAMESPACE}:pending_messages`;
const MESSAGE_SUBMISSION_FLAG = `${TROLLBOX_NAMESPACE}:message_submission`;

// Define store state
interface TrollboxState {
  messages: Message[];
  pendingMessages: Array<{ message: string; created_at: bigint; id: string }>;
  pendingMessageIds: Set<string>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreMessages: boolean;
  nextCursor: bigint | null;
  lastSubmissionTime: number;
  lastLoadTime: number;
  errorMessage: string;
  bannedUsers: Map<string, bigint>;
}

// Initial state
const initialState: TrollboxState = {
  messages: [],
  pendingMessages: [],
  pendingMessageIds: new Set(),
  isLoading: false,
  isLoadingMore: false,
  hasMoreMessages: true,
  nextCursor: null,
  lastSubmissionTime: 0,
  lastLoadTime: 0,
  errorMessage: '',
  bannedUsers: new Map()
};

// Helper function to save pending messages to localStorage
async function savePendingMessagesToStorage(pendingMessages: Array<{ message: string; created_at: bigint; id: string }>) {
  if (!browser) return;
  
  try {
    // Convert BigInt to string for JSON serialization
    const serializable = pendingMessages.map(msg => ({
      ...msg,
      created_at: msg.created_at.toString()
    }));
    
    localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.error('Error saving pending messages to storage:', error);
  }
}

// Create the store
function createTrollboxStore() {
  const { subscribe, update, set } = writable<TrollboxState>(initialState);

  return {
    subscribe,
    
    // Load messages from API
    loadMessages: async (wasAtBottom: boolean = false, scrollToBottom: () => void) => {
      return update(state => {
        // Prevent loading too frequently
        const now = Date.now();
        if (now - state.lastLoadTime < 1000) return state;
        
        state.isLoading = true;
        state.lastLoadTime = now;
        
        // Load new messages asynchronously
        trollboxApi.getMessages().then(result => {
          update(state => {
            // Preserve pending messages - create a safe copy before any modifications
            const currentPendingMessages = [...state.pendingMessages];
            const currentPendingIds = new Set(state.pendingMessageIds);
            
            // Sort server messages first
            const sortedServerMessages = result.messages.sort((a, b) => Number(a.created_at - b.created_at));
            
            // Ensure there are no duplicate IDs in the messages array
            const uniqueMessages = [];
            const seenIds = new Set();
            
            for (const msg of sortedServerMessages) {
              const idStr = msg.id.toString();
              if (!seenIds.has(idStr)) {
                seenIds.add(idStr);
                uniqueMessages.push(msg);
              } else {
                console.warn(`Duplicate message ID detected: ${idStr}. Skipping duplicate.`);
              }
            }
            
            // Quick check if we need to update the messages array
            const needsUpdate = 
              state.messages.length !== uniqueMessages.length ||
              !state.messages.every((msg, i) => msg.id.toString() === uniqueMessages[i].id.toString());
              
            if (state.messages.length === 0 || needsUpdate) {
              // Update messages array if needed
              state.messages = uniqueMessages;
              state.nextCursor = result.next_cursor;
              state.hasMoreMessages = result.next_cursor !== null;
              
              if (wasAtBottom) {
                setTimeout(scrollToBottom, 0);
              }
              
              // Only process pending messages if we actually got new server messages
              if (currentPendingMessages.length > 0) {
                // Check for confirmed pending messages
                state.pendingMessages = currentPendingMessages.filter(pending => {
                  // Consider a pending message to be confirmed if ANY server message matches it
                  for (const serverMsg of uniqueMessages) {
                    // Check for matching content
                    if (pending.message === serverMsg.message) {
                      // Also check for reasonable time proximity (2 minutes)
                      const timeDiff = Math.abs(Number(pending.created_at - serverMsg.created_at));
                      const isRecentEnough = timeDiff < 120_000_000_000; // 2 minutes in nanoseconds
                      
                      if (isRecentEnough) {
                        // This pending message has been confirmed by the server
                        currentPendingIds.delete(pending.id);
                        return false; // Remove from pending
                      }
                    }
                  }
                  return true; // Keep in pending list
                });
                
                // Update the pending IDs set
                state.pendingMessageIds = currentPendingIds;
                
                // Update storage if needed
                if (state.pendingMessages.length !== currentPendingMessages.length) {
                  savePendingMessagesToStorage(state.pendingMessages);
                }
              }
            }
            
            // More aggressive polling for pending messages
            if (state.pendingMessageIds.size > 0) {
              const timeElapsed = Date.now() - state.lastSubmissionTime;
              
              // For first 10 seconds, check every 2 seconds
              if (timeElapsed < 10000) {
                // Use direct function call to loadMessages with closure variables
                setTimeout(() => {
                  trollboxStore.loadMessages(wasAtBottom, scrollToBottom);
                }, 2000);
              }
              // For up to 1 minute, check every 5 seconds
              else if (timeElapsed < 60000) {
                setTimeout(() => {
                  trollboxStore.loadMessages(wasAtBottom, scrollToBottom);
                }, 5000);
              }
              // For up to 5 minutes, fall back to normal polling
              else if (timeElapsed > 150000) {
                // After 5 minutes, assume the message failed and clean up
                state.pendingMessages = state.pendingMessages.filter(msg => {
                  const msgAge = Date.now() - Number(msg.created_at) / 1000000;
                  return msgAge < 150000; // Keep only messages less than 2 minutes old
                });
                state.pendingMessageIds = new Set(state.pendingMessages.map(msg => msg.id));
                savePendingMessagesToStorage(state.pendingMessages);
              }
            }
            
            state.isLoading = false;
            return state;
          });
        }).catch(error => {
          console.error('Error loading messages:', error);
          update(state => {
            state.isLoading = false;
            return state;
          });
        });
        
        return state;
      });
    },
    
    // Load older messages
    loadMoreMessages: async (
      chatContainer: HTMLElement,
      callback?: () => void
    ) => {
      return update(state => {
        if (state.nextCursor === null || state.isLoadingMore || !state.hasMoreMessages) return state;
        
        state.isLoadingMore = true;
        
        // Find the first visible message element for better position anchoring
        const messageElements = chatContainer.querySelectorAll('.message-item');
        let firstVisibleMessageId = null;
        
        if (messageElements.length > 0) {
          for (let i = 0; i < messageElements.length; i++) {
            const element = messageElements[i] as HTMLElement;
            const rect = element.getBoundingClientRect();
            // If the element is visible in the viewport
            if (rect.top >= 0 || rect.bottom > 0) {
              firstVisibleMessageId = element.getAttribute('data-message-id');
              break;
            }
          }
        }
        
        // Load older messages using the timestamp cursor
        trollboxApi.getMessages({
          cursor: state.nextCursor,
          limit: BigInt(20)
        }).then(result => {
          if (result.messages.length === 0) {
            update(state => {
              state.hasMoreMessages = false;
              state.isLoadingMore = false;
              return state;
            });
            return;
          }
          
          // Sort older messages
          const oldMessages = result.messages.sort((a, b) => Number(a.created_at - b.created_at));
          
          // Update state with new messages
          update(state => {
            // Add older messages at the beginning
            state.messages = [...oldMessages, ...state.messages];
            state.nextCursor = result.next_cursor;
            state.hasMoreMessages = result.next_cursor !== null;
            state.isLoadingMore = false;
            return state;
          });
          
          // Handle scroll position in a separate step after state update
          setTimeout(() => {
            // Find the previously first message in the new list
            if (firstVisibleMessageId) {
              const messageElements = chatContainer.querySelectorAll('.message-item');
              
              // Find the element that corresponds to our reference message
              for (let i = 0; i < messageElements.length; i++) {
                const element = messageElements[i] as HTMLElement;
                const messageId = element.getAttribute('data-message-id');
                
                if (messageId === firstVisibleMessageId) {
                  // Found our reference message, scroll to it
                  element.scrollIntoView({ block: 'start', behavior: 'auto' });
                  break;
                }
              }
            }
            
            if (callback) callback();
          }, 50); // Longer timeout to ensure DOM is fully updated
          
        }).catch(error => {
          console.error('Error loading more messages:', error);
          update(state => {
            state.hasMoreMessages = false;
            state.isLoadingMore = false;
            return state;
          });
        });
        
        return state;
      });
    },
    
    // Add a pending message
    addPendingMessage: (message: string) => {
      return update(state => {
        const pendingId = crypto.randomUUID();
        const pendingMessage = {
          message,
          created_at: BigInt(Date.now() * 1000000),
          id: pendingId
        };
        
        state.pendingMessages = [...state.pendingMessages, pendingMessage];
        state.pendingMessageIds.add(pendingId);
        state.lastSubmissionTime = Date.now();
        
        // Set flag that we're starting a message submission (for page reloads)
        if (browser) {
          localStorage.setItem(MESSAGE_SUBMISSION_FLAG, 'true');
        }
        
        // Save to storage immediately
        savePendingMessagesToStorage(state.pendingMessages);
        
        return state;
      });
    },
    
    // Remove a pending message
    removePendingMessage: (id: string) => {
      return update(state => {
        state.pendingMessages = state.pendingMessages.filter(msg => msg.id !== id);
        state.pendingMessageIds.delete(id);
        savePendingMessagesToStorage(state.pendingMessages);
        return state;
      });
    },
    
    // Add a new confirmed message
    addMessage: (message: Message) => {
      return update(state => {
        // Check if the message is already in our list
        const messageExists = state.messages.some(msg => msg.id === message.id);
        if (!messageExists) {
          state.messages = [...state.messages, message];
          // Ensure messages are sorted
          state.messages = state.messages.sort((a, b) => Number(a.created_at - b.created_at));
        }
        return state;
      });
    },
    
    // Delete a message
    deleteMessage: (messageId: bigint) => {
      return update(state => {
        // More efficient approach - direct filter without creating copies first
        state.messages = state.messages.filter(msg => msg.id !== messageId);
        return state;
      });
    },
    
    // Set error message
    setErrorMessage: (message: string) => {
      return update(state => {
        state.errorMessage = message;
        return state;
      });
    },
    
    // Clear error message
    clearErrorMessage: () => {
      return update(state => {
        state.errorMessage = '';
        return state;
      });
    },
    
    // Check banned users
    checkBannedUsers: async () => {
      return update(state => {
        if (!state.messages.length) return state;
        
        // Get all unique user principals
        const uniqueUsers = [...new Set(state.messages.map(m => m.principal.toText()))];
        
        // Check ban status for each user
        uniqueUsers.forEach(async (principalText) => {
          try {
            const principal = Principal.fromText(principalText);
            const remainingTime = await trollboxApi.checkBanStatus(principal);
            
            update(state => {
              if (remainingTime !== null) {
                // User is banned
                state.bannedUsers.set(principalText, remainingTime);
              } else {
                // User is not banned, remove from the map if they were previously banned
                if (state.bannedUsers.has(principalText)) {
                  state.bannedUsers.delete(principalText);
                }
              }
              return state;
            });
          } catch (error) {
            console.error('Error checking ban status:', error);
          }
        });
        
        return state;
      });
    },
    
    // Load pending messages from storage
    loadPendingMessagesFromStorage: async () => {
      if (!browser) return;
      
      try {
        const stored = localStorage.getItem(PENDING_MESSAGES_KEY);
        const storedPendingMessages = stored ? JSON.parse(stored) as any[] : null;
        
        if (storedPendingMessages && Array.isArray(storedPendingMessages)) {
          update(state => {
            // Convert dates back to BigInt
            state.pendingMessages = storedPendingMessages.map(msg => ({
              ...msg,
              created_at: BigInt(msg.created_at)
            }));
            
            // Rebuild the Set of pending IDs
            state.pendingMessageIds = new Set(state.pendingMessages.map(msg => msg.id));
            
            // Set last submission time if recent
            const mostRecent = Math.max(...state.pendingMessages.map(msg => 
              Number(msg.created_at) / 1000000)); // Convert ns to ms
            
            if (Date.now() - mostRecent < 60000) { // Within the last minute
              state.lastSubmissionTime = mostRecent;
            }
            
            return state;
          });
        }
      } catch (error) {
        console.error('Error loading pending messages from storage:', error);
      }
    },
    
    // Reset store to initial state
    reset: () => set(initialState)
  };
}

// Create and export the store
export const trollboxStore = createTrollboxStore();

// Derived stores for convenience
export const messages = derived(trollboxStore, $store => $store.messages);
export const pendingMessages = derived(trollboxStore, $store => $store.pendingMessages);
export const isLoading = derived(trollboxStore, $store => $store.isLoading);
export const isLoadingMore = derived(trollboxStore, $store => $store.isLoadingMore);
export const hasMoreMessages = derived(trollboxStore, $store => $store.hasMoreMessages);
export const errorMessage = derived(trollboxStore, $store => $store.errorMessage); 