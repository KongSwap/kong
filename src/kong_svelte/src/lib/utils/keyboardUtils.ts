interface SearchKeyboardHandlerOptions {
  searchQuery: string;
  searchInput: HTMLInputElement;
  onClear: () => void;
}

/**
 * Handles common keyboard shortcuts for search functionality
 */
export function handleSearchKeyboard(
  event: KeyboardEvent, 
  options: SearchKeyboardHandlerOptions
): void {
  const { searchQuery, searchInput, onClear } = options;

  // Clear search on Escape
  if (event.key === 'Escape' && searchQuery) {
    event.preventDefault();
    onClear();
    searchInput.focus();
  }
  // Focus search on forward slash
  else if (event.key === '/' && document.activeElement !== searchInput) {
    event.preventDefault();
    searchInput.focus();
  }
} 