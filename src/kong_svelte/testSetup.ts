import { expect, afterEach, vi } from 'vitest';

// Mock process.env
process.env = {
  ...process.env,
  DFX_NETWORK: 'local',
  CANISTER_ID_KONG_SVELTE: 'rrkah-fqaaa-aaaaa-aaaaq-cai',
  CANISTER_ID_KONG_BACKEND: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
  KONG_BACKEND_CANISTER_ID: 'ryjl3-tyaaa-aaaaa-aaaba-cai'
};

// Cleanup after each test
afterEach(() => {
  document.body.innerHTML = '';
});

// Mock import.meta.env
vi.mock('$env/dynamic/public', () => ({
  env: {
    KONG_BACKEND_CANISTER_ID: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
    PUBLIC_DFX_NETWORK: 'local',
    CANISTER_ID_KONG_BACKEND: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
    DEV: true
  }
}));

// Mock import.meta.env directly
global.import = {
  meta: {
    env: {
      DEV: true,
      PROD: false,
      MODE: 'test',
      KONG_BACKEND_CANISTER_ID: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
      CANISTER_ID_KONG_BACKEND: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
      DFX_NETWORK: 'local'
    }
  }
} as any;

// Add window.matchMedia mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock $app/environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test'
}));

// Add other SvelteKit mocks as needed
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn()
}));

vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn()
  },
  navigating: {
    subscribe: vi.fn()
  },
  updated: {
    subscribe: vi.fn()
  }
})); 