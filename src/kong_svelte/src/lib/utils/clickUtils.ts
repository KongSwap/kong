export function closeOnOutsideClick(node: HTMLElement, callback: () => void) {
  function handleClick(event: MouseEvent) {
    if (node && !node.contains(event.target as Node)) {
      callback();
    }
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('click', handleClick);
  }

  return {
    destroy() {
      if (typeof window !== 'undefined') {
        document.removeEventListener('click', handleClick);
      }
    }
  };
}