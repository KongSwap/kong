import { browser } from '$app/environment';
import { searchStore } from '$lib/stores/searchStore';
import { keyboardShortcutsStore } from '$lib/stores/keyboardShortcutsStore';

// Define shortcut types
export interface KeyboardShortcut {
  id: string;
  key: string;
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  description: string;
  action: () => void;
  scope?: 'global' | 'search' | 'swap' | 'tokens' | 'wallets';
}

// Create a class to manage keyboard shortcuts
class KeyboardShortcutsService {
  private shortcuts: KeyboardShortcut[] = [];
  private isInitialized = false;
  private isMac = false;

  constructor() {
    if (browser) {
      this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    }
  }

  // Initialize the service
  initialize(): void {
    if (this.isInitialized || !browser) return;

    // Define default shortcuts
    this.registerDefaultShortcuts();

    // Add global event listener
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    this.isInitialized = true;
  }

  // Register default shortcuts
  private registerDefaultShortcuts(): void {
    // Global search shortcut
    this.registerShortcut({
      id: 'global-search',
      key: 'k',
      modifiers: {
        ctrl: !this.isMac,
        meta: this.isMac
      },
      description: 'Open global search',
      action: () => searchStore.open(),
      scope: 'global'
    });

    // Keyboard shortcuts help
    this.registerShortcut({
      id: 'keyboard-shortcuts-help',
      key: '?',
      modifiers: {
        shift: true
      },
      description: 'Show keyboard shortcuts',
      action: () => {
        keyboardShortcutsStore.openHelp();
      },
      scope: 'global'
    });

    // Add more default shortcuts here
    // Example:
    // this.registerShortcut({
    //   id: 'toggle-theme',
    //   key: 't',
    //   modifiers: {
    //     ctrl: !this.isMac,
    //     meta: this.isMac
    //   },
    //   description: 'Toggle theme',
    //   action: () => themeStore.toggleTheme(),
    //   scope: 'global'
    // });
  }

  // Register a new shortcut
  registerShortcut(shortcut: KeyboardShortcut): void {
    // Check if shortcut already exists
    const existingIndex = this.shortcuts.findIndex(s => s.id === shortcut.id);
    if (existingIndex >= 0) {
      // Replace existing shortcut
      this.shortcuts[existingIndex] = shortcut;
    } else {
      // Add new shortcut
      this.shortcuts.push(shortcut);
    }
  }

  // Remove a shortcut
  removeShortcut(id: string): void {
    this.shortcuts = this.shortcuts.filter(s => s.id !== id);
  }

  // Handle keydown events
  private handleKeyDown(event: KeyboardEvent): void {    
    // Skip if in input, textarea, or contentEditable
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      // Allow Escape key in search input
      if (event.key !== 'Escape') {
        return;
      }
    }

    // Find matching shortcuts
    const matchingShortcuts = this.shortcuts.filter(shortcut => {
      return (
        shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.modifiers.ctrl === event.ctrlKey &&
        !!shortcut.modifiers.alt === event.altKey &&
        !!shortcut.modifiers.shift === event.shiftKey &&
        !!shortcut.modifiers.meta === event.metaKey
      );
    });

    // Execute matching shortcuts
    if (matchingShortcuts.length > 0) {
      event.preventDefault();
      matchingShortcuts.forEach(shortcut => {
        shortcut.action();
      });
    }
  }

  // Get all shortcuts
  getShortcuts(): KeyboardShortcut[] {
    return [...this.shortcuts];
  }

  // Get shortcuts by scope
  getShortcutsByScope(scope: string): KeyboardShortcut[] {
    return this.shortcuts.filter(s => s.scope === scope);
  }

  // Format shortcut for display
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    
    if (shortcut.modifiers.ctrl) parts.push('Ctrl');
    if (shortcut.modifiers.alt) parts.push('Alt');
    if (shortcut.modifiers.shift) parts.push('Shift');
    if (shortcut.modifiers.meta) parts.push(this.isMac ? '⌘' : 'Win');
    
    parts.push(shortcut.key.toUpperCase());
    
    return parts.join('+');
  }

  // Check if user is on macOS
  isMacOS(): boolean {
    return this.isMac;
  }

  // Destroy the service
  destroy(): void {
    if (!this.isInitialized || !browser) return;
    
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    this.shortcuts = [];
    this.isInitialized = false;
  }
}

// Create and export a singleton instance
export const keyboardShortcuts = new KeyboardShortcutsService(); 