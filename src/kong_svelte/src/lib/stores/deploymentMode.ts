import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'kong_deployment_auto_mode';

// Create a store for the deployment mode (automatic or manual)
function createDeploymentModeStore() {
  // Default to automatic mode, but check localStorage for saved preference
  const initialValue = browser 
    ? localStorage.getItem(STORAGE_KEY) === 'false' ? false : true
    : true;
  
  const { subscribe, set, update } = writable<boolean>(initialValue);

  return {
    subscribe,
    
    // Toggle between automatic and manual mode
    toggle() {
      update(value => {
        const newValue = !value;
        if (browser) {
          localStorage.setItem(STORAGE_KEY, String(newValue));
        }
        return newValue;
      });
    },
    
    // Set to automatic mode
    setAutomatic() {
      set(true);
      if (browser) {
        localStorage.setItem(STORAGE_KEY, 'true');
      }
    },
    
    // Set to manual mode
    setManual() {
      set(false);
      if (browser) {
        localStorage.setItem(STORAGE_KEY, 'false');
      }
    }
  };
}

// Export the store
export const automaticMode = createDeploymentModeStore(); 
