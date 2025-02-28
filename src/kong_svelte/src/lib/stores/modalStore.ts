import { writable } from 'svelte/store';

// Add shared modalStack store
export const modalStack = writable<{ [key: string]: { active: boolean; timestamp: number } }>({});
