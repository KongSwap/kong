import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { closeOnOutsideClick } from '$lib/utils/clickUtils';

describe('closeOnOutsideClick', () => {
  let node: HTMLDivElement;
  
  beforeEach(() => {
    // Set up a fresh DOM element before each test
    node = document.createElement('div');
    document.body.appendChild(node);
  });

  afterEach(() => {
    // Clean up after each test
    document.body.removeChild(node);
  });

  it('should call the callback when clicking outside the node', () => {
    const callback = vi.fn();
    const { destroy } = closeOnOutsideClick(node, callback);

    // Simulate a click outside the node
    const outsideClickEvent = new MouseEvent('click', { bubbles: true });
    document.body.dispatchEvent(outsideClickEvent);

    expect(callback).toHaveBeenCalled();

    // Clean up
    destroy();
  });

  it('should not call the callback when clicking inside the node', () => {
    const callback = vi.fn();
    const { destroy } = closeOnOutsideClick(node, callback);

    // Simulate a click inside the node
    const insideClickEvent = new MouseEvent('click', { bubbles: true });
    node.dispatchEvent(insideClickEvent);

    expect(callback).not.toHaveBeenCalled();

    // Clean up
    destroy();
  });
});