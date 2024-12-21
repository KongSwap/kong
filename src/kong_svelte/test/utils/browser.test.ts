import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMobileBrowser, isPwa, isIOS, isPlugAvailable } from '../../src/lib/utils/browser';

describe('Browser Utils', () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  beforeEach(() => {
    // Reset window.matchMedia mock before each test
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    // Restore original navigator and window after each test
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true
    });
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true
    });
  });

  describe('isMobileBrowser', () => {
    it('should return true for mobile user agents', () => {
      const mockUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)';
      Object.defineProperty(global.navigator, 'userAgent', {
        value: mockUserAgent,
        writable: true
      });

      expect(isMobileBrowser()).toBe(true);
    });

    it('should return false for desktop user agents', () => {
      const mockUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      Object.defineProperty(global.navigator, 'userAgent', {
        value: mockUserAgent,
        writable: true
      });

      expect(isMobileBrowser()).toBe(false);
    });

    it('should return false when running as PWA', () => {
      const mockUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)';
      Object.defineProperty(global.navigator, 'userAgent', {
        value: mockUserAgent,
        writable: true
      });

      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isMobileBrowser()).toBe(false);
    });
  });

  describe('isPwa', () => {
    beforeEach(() => {
      // Reset window and navigator properties before each test
      Object.defineProperty(window, 'navigator', {
        value: { standalone: false },
        writable: true
      });
      
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      // Reset document.referrer
      Object.defineProperty(document, 'referrer', {
        value: '',
        writable: true
      });
    });

    it('should return true when running as standalone on iOS', () => {
      Object.defineProperty(window.navigator, 'standalone', {
        value: true,
        writable: true
      });

      expect(isPwa()).toBe(true);
    });

    it('should return true when display-mode is standalone', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isPwa()).toBe(true);
    });

    it('should return false when not running as PWA', () => {
      // Ensure all PWA conditions are false
      Object.defineProperty(window.navigator, 'standalone', {
        value: false,
        writable: true
      });
      
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      Object.defineProperty(document, 'referrer', {
        value: '',
        writable: true
      });

      expect(isPwa()).toBe(false);
    });
  });

  describe('isIOS', () => {
    it('should return true for iOS devices', () => {
      const mockUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X)';
      Object.defineProperty(global.navigator, 'userAgent', {
        value: mockUserAgent,
        writable: true
      });

      expect(isIOS()).toBe(true);
    });

    it('should return false for non-iOS devices', () => {
      const mockUserAgent = 'Mozilla/5.0 (Android 10; Mobile)';
      Object.defineProperty(global.navigator, 'userAgent', {
        value: mockUserAgent,
        writable: true
      });

      expect(isIOS()).toBe(false);
    });
  });

  describe('isPlugAvailable', () => {
    beforeEach(() => {
      // Reset window.ic before each test
      if ('ic' in window) {
        delete (window as any).ic;
      }
    });

    it('should return true when IC object is available', () => {
      Object.defineProperty(window, 'ic', {
        value: {},
        configurable: true
      });

      expect(isPlugAvailable()).toBe(true);
    });

    it('should return false when IC object is not available', () => {
      // Ensure ic is not defined
      if ('ic' in window) {
        delete (window as any).ic;
      }

      expect(isPlugAvailable()).toBe(false);
    });
  });
}); 