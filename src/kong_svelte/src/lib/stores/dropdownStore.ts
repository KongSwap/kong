import { writable } from 'svelte/store';

export const activeDropdownId = writable<string | null>(null); 