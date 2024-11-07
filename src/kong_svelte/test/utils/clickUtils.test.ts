import { describe, it, expect, vi } from 'vitest';
import { closeOnOutsideClick } from '$lib/utils/clickUtils';

describe('closeOnOutsideClick', () => {
  it('should call the callback when clicking outside the node', () => {
    // Create a mock callback function
    const callback = vi.fn();

    // Create a DOM element to act as the node
    const node = document.createElement('div');
    document.body.appendChild(node);

    // Initialize the function
    const { destroy } = closeOnOutsideClick(node, callback);

    // Simulate a click outside the node
    const outsideClickEvent = new MouseEvent('click', { bubbles: true });
    document.body.dispatchEvent(outsideClickEvent);

    // Assert that the callback was called
    expect(callback).toHaveBeenCalled();

    // Clean up
    destroy();
    document.body.removeChild(node);
  });

  it('should not call the callback when clicking inside the node', () => {
    const callback = vi.fn();
    const node = document.createElement('div');
    document.body.appendChild(node);

    const { destroy } = closeOnOutsideClick(node, callback);

    // Simulate a click inside the node
    const insideClickEvent = new MouseEvent('click', { bubbles: true });
    node.dispatchEvent(insideClickEvent);

    // Assert that the callback was not called
    expect(callback).not.toHaveBeenCalled();

    // Clean up
    destroy();
    document.body.removeChild(node);
  });
});