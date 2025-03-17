/**
 * Utility functions for interacting with the canister registration API
 */
import { writable, get } from 'svelte/store';
import type { Principal } from '@dfinity/principal';
import { canisterStore, type CanisterMetadata } from '../stores/canisters';

// The API URL for canister registration
// const CANISTER_API_URL = 'http://localhost:8080';
// const WEBSOCKET_URL = 'ws://localhost:8080/ws';
const CANISTER_API_URL = 'https://api.floppa.ai';
const WEBSOCKET_URL = 'wss://api.floppa.ai/ws';

let socket: WebSocket | null = null;
export const wsConnected = writable(false);
export const wsEvents = writable<{type: string, data: any, timestamp: Date}[]>([]);
export const notifications = writable<{message: string, type: string, id: number}[]>([]);
export const canistersList = writable<any[]>([]);

// Auto-incrementing ID for notifications
let notificationId = 0;

/**
 * Add a notification to the store
 */
export function addNotification(message: string, type: 'success' | 'error' | 'info' | 'warning') {
  const id = notificationId++;
  notifications.update(n => {
    const newNotifications = [...n, { message, type, id }];
    // Only keep the last 5 notifications
    if (newNotifications.length > 5) {
      return newNotifications.slice(newNotifications.length - 5);
    }
    return newNotifications;
  });
  
  // Auto-remove notification after 5 seconds
  setTimeout(() => {
    notifications.update(n => n.filter(notification => notification.id !== id));
  }, 5000);
}

/**
 * Add a WebSocket event to the store
 */
export function addWsEvent(type: string, data: any) {
  wsEvents.update(events => {
    const newEvents = [...events, { type, data, timestamp: new Date() }];
    // Only keep the last 20 events
    if (newEvents.length > 20) {
      return newEvents.slice(newEvents.length - 20);
    }
    return newEvents;
  });
}

/**
 * Connect to the WebSocket server
 */
export function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log('WebSocket already connected or connecting');
    return;
  }
  
  try {
    socket = new WebSocket(WEBSOCKET_URL);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      wsConnected.set(true);
      addWsEvent('connection', 'Connected to WebSocket server');
      addNotification('WebSocket connected successfully', 'success');
      fetchCanisters();
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      wsConnected.set(false);
      addWsEvent('connection', 'Disconnected from WebSocket server');
      addNotification('WebSocket disconnected', 'error');
      socket = null;
      
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          connectWebSocket();
        }
      }, 5000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      addWsEvent('error', 'WebSocket error');
      addNotification('WebSocket error', 'error');
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);
        addWsEvent(data.event, data.data);
        
        if (data.event === 'refresh' || data.event === 'refresh_requested') {
          addNotification('Received refresh notification', 'info');
          fetchCanisters();
        } else if (data.event === 'canister_registered') {
          addNotification(`New canister registered: ${data.data.canister_id} (${data.data.canister_type})`, 'success');
          fetchCanisters();
        }
      } catch (e) {
        console.error('Error parsing message:', e);
        addWsEvent('error', 'Failed to parse WebSocket message');
      }
    };
  } catch (e) {
    console.error('Failed to connect WebSocket:', e);
    addNotification('Failed to connect WebSocket: ' + e.message, 'error');
    addWsEvent('error', 'Failed to connect WebSocket: ' + e.message);
  }
}

/**
 * Disconnect from the WebSocket server
 */
export function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
    wsConnected.set(false);
  }
}

/**
 * Register a canister with the API
 * @param principal The principal ID of the user who created the canister (string or Principal object)
 * @param canisterId The canister ID to register
 * @param canisterType The type of canister ('token/token_backend' or 'miner' or 'ledger')
 * @returns A promise that resolves to the API response
 */
export async function registerCanister(
  principal: string | Principal,
  canisterId: string,
  canisterType: 'token' | 'token_backend' | 'miner' | 'ledger'
): Promise<any> {
  try {
    // Map token_backend to token for backward compatibility
    const apiCanisterType = canisterType === 'token_backend' ? 'token' : canisterType;
    
    addWsEvent('api_call', `Registering canister ${canisterId} (${apiCanisterType})`);
    
    // Convert principal to string if it's a Principal object
    const principalStr = typeof principal === 'string' ? principal : 
                         (principal && typeof principal.toText === 'function') ? principal.toText() : principal;
    
    const response = await fetch(`${CANISTER_API_URL}/canisters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        principal: principalStr,
        canister_id: canisterId,
        canister_type: apiCanisterType,
        module_hash: null
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error registering canister: ${errorText}`);
      addWsEvent('api_error', `Error registering canister: ${errorText}`);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    addWsEvent('api_success', `Successfully registered canister ${canisterId}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error registering canister:', error);
    addWsEvent('api_error', `Error registering canister: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all canisters from the API
 */
export async function fetchCanisters() {
  try {
    addWsEvent('api_call', 'Fetching canisters');
    
    const response = await fetch(`${CANISTER_API_URL}/canisters`);
    const data = await response.json();
    
    if (response.ok && data.data) {
      canistersList.set(data.data);
      addWsEvent('api_success', `Fetched ${data.data.length} canisters`);
      return data.data;
    } else {
      addWsEvent('api_error', `Failed to fetch canisters: ${data.message || 'Unknown error'}`);
      return [];
    }
  } catch (error) {
    console.error('Error fetching canisters:', error);
    addWsEvent('api_error', `Error fetching canisters: ${error.message}`);
    return [];
  }
}

/**
 * Sync API canisters with local canisterStore
 * This ensures canister data is consistent across devices
 * @param userPrincipal Optional principal ID to filter canisters by owner
 */
export async function syncCanistersToLocalStore(userPrincipal?: string): Promise<void> {
  try {
    // Fetch the latest canisters from API
    const apiCanisters = await fetchCanisters();
    if (!apiCanisters || !Array.isArray(apiCanisters)) {
      console.warn('Failed to fetch canisters from API for sync');
      return;
    }
    
    // Filter canisters by user principal if provided
    const filteredCanisters = userPrincipal 
      ? apiCanisters.filter(canister => canister.principal === userPrincipal)
      : apiCanisters;
    
    console.log(`Filtered ${apiCanisters.length} canisters to ${filteredCanisters.length} for principal ${userPrincipal}`);
    
    // Get current canisters from local store
    const localCanisters = get(canisterStore);
    
    // Create a map of local canisters for quick lookup
    const localCanistersMap = new Map<string, CanisterMetadata>();
    localCanisters.forEach(canister => {
      localCanistersMap.set(canister.id, canister);
    });
    
    // Process API canisters and merge with local data
    for (const apiCanister of filteredCanisters) {
      const canisterId = apiCanister.canister_id;
      const existingCanister = localCanistersMap.get(canisterId);
      
      // Normalize canister type (handle case sensitivity)
      const normalizedType = normalizeCanisterType(apiCanister.canister_type);
      
      // If canister exists locally, keep local metadata but update API fields
      if (existingCanister) {
        // Update type if needed (preserve other metadata like name, tags)
        canisterStore.updateCanister(canisterId, {
          wasmType: normalizedType
        });
      } else {
        // If not in local store, add it
        canisterStore.addCanister({
          id: canisterId,
          wasmType: normalizedType,
          createdAt: apiCanister.created_at ? apiCanister.created_at * 1000 : Date.now() // Convert to milliseconds if timestamp is provided
        });
      }
    }
    
    // If filtering by principal, remove canisters that don't belong to the user
    if (userPrincipal) {
      const filteredCanisterIds = new Set(filteredCanisters.map(c => c.canister_id));
      
      localCanisters.forEach(canister => {
        // If a canister in local store isn't in the filtered list, remove it
        if (!filteredCanisterIds.has(canister.id)) {
          canisterStore.removeCanister(canister.id);
        }
      });
    }
    
    addWsEvent('store_sync', `Synced ${filteredCanisters.length} canisters from API to local store`);
  } catch (error) {
    console.error('Error syncing canisters to local store:', error);
    addWsEvent('api_error', `Error syncing canisters: ${error.message}`);
  }
}

/**
 * Normalize canister type to handle case sensitivity and naming differences
 * @param type The canister type from the API
 * @returns Normalized canister type for local store
 */
function normalizeCanisterType(type: string): string {
  // Convert to lowercase for case-insensitive comparison
  const lowerType = typeof type === 'string' ? type.toLowerCase() : '';
  
  // Handle different variations of token types
  if (lowerType === 'token') {
    return 'token_backend';
  }
  
  // Handle different variations of miner types
  if (lowerType === 'miner') {
    return 'miner';
  }
  
  // Handle different variations of ledger types
  if (lowerType === 'ledger') {
    return 'ledger';
  }
  
  // Return the original type if no mapping is found
  return type;
}
