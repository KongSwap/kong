import { writable } from 'svelte/store';

interface LoadingState {
    isLoading: boolean;
    loadingProgress: number;
    totalAssets: number;
    errors: string[];
}

const initialState: LoadingState = {
    isLoading: true,
    loadingProgress: 0,
    totalAssets: 0,
    errors: []
};

export const loadingState = writable<LoadingState>(initialState);

// Helper functions to update the loading state
export function updateLoadingProgress(progress: number) {
    loadingState.update(state => ({ ...state, loadingProgress: progress }));
}

export function setTotalAssets(total: number) {
    loadingState.update(state => ({ ...state, totalAssets: total }));
}

export function addError(error: string) {
    loadingState.update(state => ({ ...state, errors: [...state.errors, error] }));
}

export function clearErrors() {
    loadingState.update(state => ({ ...state, errors: [] }));
}

export function setLoading(isLoading: boolean) {
    loadingState.update(state => ({ ...state, isLoading }));
}
