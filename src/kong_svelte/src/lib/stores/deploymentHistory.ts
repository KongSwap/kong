import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

// Define the structure for a deployment
export interface DeploymentHistoryEntry {
  id: string; // Unique ID for the deployment (timestamp + random)
  tokenName: string;
  tokenSymbol: string;
  canisterId?: string;
  timestamp: number;
  steps: DeploymentStepEntry[];
  completed: boolean;
  error?: string;
}

// Define the structure for a deployment step
export interface DeploymentStepEntry {
  step: number;
  stepName: string;
  timestamp: number;
  success: boolean;
  data?: any;
  error?: string;
}

const STORAGE_KEY = 'kong_deployment_history';

function createDeploymentHistoryStore() {
  // Initialize with empty array or stored data
  const initialHistory = browser 
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') 
    : [];
  
  const { subscribe, update } = writable<DeploymentHistoryEntry[]>(initialHistory);

  return {
    subscribe,
    
    // Add a new deployment to history
    addDeployment(deployment: DeploymentHistoryEntry) {
      update(history => {
        // Check if deployment already exists
        const existingIndex = history.findIndex(d => d.id === deployment.id);
        
        let updatedHistory;
        if (existingIndex >= 0) {
          // Update existing deployment
          updatedHistory = [...history];
          updatedHistory[existingIndex] = deployment;
        } else {
          // Add new deployment
          updatedHistory = [deployment, ...history];
        }
        
        // Limit history to 20 entries
        if (updatedHistory.length > 20) {
          updatedHistory = updatedHistory.slice(0, 20);
        }
        
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        }
        return updatedHistory;
      });
    },
    
    // Add a step to an existing deployment
    addStep(deploymentId: string, step: DeploymentStepEntry) {
      update(history => {
        const deploymentIndex = history.findIndex(d => d.id === deploymentId);
        if (deploymentIndex < 0) return history;
        
        const updatedHistory = [...history];
        const deployment = { ...updatedHistory[deploymentIndex] };
        
        // Check if step already exists
        const stepIndex = deployment.steps.findIndex(s => s.step === step.step);
        
        if (stepIndex >= 0) {
          // Update existing step
          deployment.steps[stepIndex] = step;
        } else {
          // Add new step
          deployment.steps.push(step);
        }
        
        // Update completion status if step is successful and it's the final step
        if (step.success && step.step === 5) { // 5 is COMPLETED step
          deployment.completed = true;
        }
        
        // Update error status
        if (!step.success) {
          deployment.error = step.error;
        }
        
        updatedHistory[deploymentIndex] = deployment;
        
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        }
        return updatedHistory;
      });
    },
    
    // Get a deployment by ID
    getDeployment(id: string): DeploymentHistoryEntry | undefined {
      const history = get({ subscribe });
      return history.find(deployment => deployment.id === id);
    },
    
    // Get steps for a deployment
    getSteps(deploymentId: string): DeploymentStepEntry[] {
      const deployment = this.getDeployment(deploymentId);
      return deployment ? deployment.steps : [];
    },
    
    // Update a deployment with partial data
    updateDeployment(deploymentId: string, updates: Partial<DeploymentHistoryEntry>) {
      update(history => {
        const deploymentIndex = history.findIndex(d => d.id === deploymentId);
        if (deploymentIndex < 0) return history;
        
        const updatedHistory = [...history];
        const deployment = { ...updatedHistory[deploymentIndex], ...updates };
        
        updatedHistory[deploymentIndex] = deployment;
        
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        }
        return updatedHistory;
      });
    },
    
    // Remove a deployment from history
    removeDeployment(id: string) {
      update(history => {
        const updatedHistory = history.filter(deployment => deployment.id !== id);
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        }
        return updatedHistory;
      });
    },
    
    // Clear all deployment history
    clearHistory() {
      update(() => {
        if (browser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        }
        return [];
      });
    }
  };
}

export const deploymentHistoryStore = createDeploymentHistoryStore(); 
