import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isMobileBrowser } from '$lib/utils/browser';

describe('isMobileBrowser', () => {
  let originalNavigator: any;
  let originalWindow: any;
  let originalDocument: any;

  beforeEach(() => {
    // Store original values
    originalNavigator = global.navigator;
    originalWindow = global.window;
    originalDocument = global.document;

    // Mock document
    Object.defineProperty(global, 'document', {
      value: {
        referrer: '',
        body: { innerHTML: '' }
      },
      configurable: true,
      writable: true
    });

    // Mock window and navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        userAgent: '',
        vendor: '',
      },
      configurable: true,
      writable: true
    });

    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: {
          userAgent: '',
          vendor: '',
        },
        opera: null
      },
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    // Restore original values
    global.navigator = originalNavigator;
    global.window = originalWindow;
    global.document = originalDocument;
    vi.clearAllMocks();
  });

  it('should return false when navigator is undefined', () => {
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      configurable: true,
      writable: true
    });
    expect(isMobileBrowser()).toBe(false);
  });

  it('should return false for PWA standalone mode', () => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
        navigator: { userAgent: 'iPhone' },
        opera: null
      },
      configurable: true,
      writable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'iPhone' },
      configurable: true,
      writable: true
    });
    expect(isMobileBrowser()).toBe(false);
  });

  it('should return false for iOS standalone mode', () => {
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { standalone: true },
        opera: null
      },
      configurable: true,
      writable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'iPhone' },
      configurable: true,
      writable: true
    });
    expect(isMobileBrowser()).toBe(false);
  });

  it('should return false for Android TWA', () => {
    Object.defineProperty(global, 'document', {
      value: {
        referrer: 'android-app://com.example.app',
        body: { innerHTML: '' }
      },
      configurable: true,
      writable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent: 'Android' },
      configurable: true,
      writable: true
    });
    expect(isMobileBrowser()).toBe(false);
  });

  it('should return true for iPhone mobile browser', () => {
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1';
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { userAgent },
        opera: null
      },
      configurable: true,
      writable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent },
      configurable: true,
      writable: true
    });
    expect(isMobileBrowser()).toBe(true);
  });

  it('should return true for Android mobile browser', () => {
    const userAgent = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { userAgent },
        opera: null
      },
      configurable: true,
      writable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent },
      configurable: true,
      writable: true
    });
    expect(isMobileBrowser()).toBe(true);
  });

  it('should return false for desktop browser', () => {
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { userAgent },
        opera: null
      },
      configurable: true,
      writable: true
    });
    Object.defineProperty(global, 'navigator', {
      value: { userAgent },
      configurable: true,
      writable: true
    });
    expect(isMobileBrowser()).toBe(false);
  });
}); 