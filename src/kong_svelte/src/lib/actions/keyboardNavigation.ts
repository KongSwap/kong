export interface KeyboardNavigationOptions {
  items: any[];
  focusedIndex: number;
  onNavigate: (index: number) => void;
  onSelect: (index: number) => void;
  onEscape?: () => void;
  onSearch?: () => void;
}

export function keyboardNavigation(node: HTMLElement, options: KeyboardNavigationOptions) {
  function handleKeyDown(event: KeyboardEvent) {
    const { items, focusedIndex, onNavigate, onSelect, onEscape, onSearch } = options;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        onNavigate(Math.min(focusedIndex + 1, items.length - 1));
        break;
        
      case "ArrowUp":
        event.preventDefault();
        onNavigate(Math.max(focusedIndex - 1, -1));
        break;
        
      case "Enter":
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          event.preventDefault();
          onSelect(focusedIndex);
        }
        break;
        
      case "Escape":
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
        
      case "/":
        if (onSearch && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          onSearch();
        }
        break;
    }
  }

  node.addEventListener("keydown", handleKeyDown);

  return {
    update(newOptions: KeyboardNavigationOptions) {
      options = newOptions;
    },
    destroy() {
      node.removeEventListener("keydown", handleKeyDown);
    }
  };
}