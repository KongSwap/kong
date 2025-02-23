// Polyfill global for dfinity agent
if (typeof global === 'undefined') {
  (window as any).global = window;
}

import './app.css'
import App from './App.svelte'

// Declare global window type
declare global {
  interface Window {
    __CANISTER_ID__: string;
  }
}

const app = new App({
  target: document.getElementById('app')!,
})

export default app
