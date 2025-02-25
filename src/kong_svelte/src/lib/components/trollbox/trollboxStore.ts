import { writable, derived, get } from 'svelte/store';
import type { Message } from '$lib/api/trollbox';
import * as trollboxApi from '$lib/api/trollbox';
import { browser } from '$app/environment';
import { Principal } from '@dfinity/principal';

// Constants
const PENDING_MESSAGES_KEY = 'trollbox_pending_messages';
const MESSAGE_SUBMISSION_FLAG = 'trollbox_message_submission';

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
        if (now - state.lastLoadTime < 2000) return state;
        
        state.isLoading = true;
        state.lastLoadTime = now;
        
        // Load new messages asynchronously
        trollboxApi.getMessages().then(result => {
          update(state => {
            if (state.messages.length === 0) {
              // First load - set all messages
              state.messages = result.messages.sort((a, b) => Number(a.created_at - b.created_at));
              state.nextCursor = result.next_cursor;
              state.hasMoreMessages = result.next_cursor !== null;
              setTimeout(scrollToBottom, 0);
            } else {
              // Find new messages
              const existingMessageIds = new Set(state.messages.map(msg => msg.id.toString()));
              const newMessages = result.messages.filter(msg => !existingMessageIds.has(msg.id.toString()));
              
              if (newMessages.length > 0) {
                
                // Merge and sort messages
                const mergedMessages = [...state.messages, ...newMessages];
                state.messages = mergedMessages.sort((a, b) => Number(a.created_at - b.created_at));
                
                // Check for confirmed pending messages
                if (state.pendingMessages.length > 0) {
                  const initialPendingCount = state.pendingMessages.length;
                  state.pendingMessages = state.pendingMessages.filter(pending => {
                    // Look for matching message
                    for (const newMsg of newMessages) {
                      const timeDiff = Math.abs(Number(pending.created_at - newMsg.created_at));
                      const isRecentEnough = timeDiff < 120_000_000_000; // 2 minutes in nanoseconds
                      const contentMatch = pending.message === newMsg.message;
                      
                      if (isRecentEnough && contentMatch && state.pendingMessageIds.has(pending.id)) {
                        state.pendingMessageIds.delete(pending.id);
                        return false; // Remove from pending
                      }
                    }
                    return true; // Keep in pending
                  });
                  
                  // Update localStorage if needed
                  if (state.pendingMessages.length !== initialPendingCount) {
                    savePendingMessagesToStorage(state.pendingMessages);
                  }
                }
                
                // Scroll to bottom if needed
                if (wasAtBottom) {
                  setTimeout(scrollToBottom, 0);
                }
              }
              
              // More aggressive polling for pending messages
              if (state.pendingMessageIds.size > 0) {
                const timeElapsed = Date.now() - state.lastSubmissionTime;
                
                // For first 10 seconds, check every 2 seconds
                if (timeElapsed < 10000) {
                  setTimeout(() => this.loadMessages(wasAtBottom, scrollToBottom), 2000);
                }
                // For up to 1 minute, check every 5 seconds
                else if (timeElapsed < 60000) {
                  setTimeout(() => this.loadMessages(wasAtBottom, scrollToBottom), 5000);
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
        
        // Capture current scroll position
        const oldHeight = chatContainer.scrollHeight;
        const oldScroll = chatContainer.scrollTop;
        
        // Load older messages using the timestamp cursor
        trollboxApi.getMessages({
          cursor: state.nextCursor,
          limit: BigInt(20)
        }).then(result => {
          update(state => {
            if (result.messages.length === 0) {
              state.hasMoreMessages = false;
              state.isLoadingMore = false;
              return state;
            }
            
            // Sort and add older messages at the beginning
            const oldMessages = result.messages.sort((a, b) => Number(a.created_at - b.created_at));
            state.messages = [...oldMessages, ...state.messages];
            state.nextCursor = result.next_cursor;
            state.hasMoreMessages = result.next_cursor !== null;
            state.isLoadingMore = false;
            
            // Maintain scroll position after loading older messages
            setTimeout(() => {
              const newHeight = chatContainer.scrollHeight;
              chatContainer.scrollTop = newHeight - oldHeight + oldScroll;
              if (callback) callback();
            }, 0);
            
            return state;
          });
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
        
        // Save to localStorage immediately
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
    
    // Load pending messages from localStorage
    loadPendingMessagesFromStorage: () => {
      if (!browser) return;
      
      try {
        const storedPendingMessages = localStorage.getItem(PENDING_MESSAGES_KEY);
        if (storedPendingMessages) {
          const parsed = JSON.parse(storedPendingMessages);
          
          update(state => {
            // Convert dates back to BigInt
            state.pendingMessages = parsed.map(msg => ({
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
        console.error('Error loading pending messages from localStorage:', error);
      }
    },
    
    // Reset store to initial state
    reset: () => set(initialState)
  };
}

// Helper function to save pending messages to localStorage
function savePendingMessagesToStorage(pendingMessages: Array<{ message: string; created_at: bigint; id: string }>) {
  if (!browser) return;
  
  try {
    // Convert BigInt to string for JSON serialization
    const serializable = pendingMessages.map(msg => ({
      ...msg,
      created_at: msg.created_at.toString()
    }));
    
    localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(serializable));
  } catch (error) {
    console.error('Error saving pending messages to localStorage:', error);
  }
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