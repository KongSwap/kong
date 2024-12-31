type SearchMatch = {
  type: 'name' | 'symbol' | 'canister' | null;
  query: string;
  matchedText?: string;
};

/**
 * Searches through token properties and returns match information
 */
export function searchToken(token: FE.Token, query: string): SearchMatch | null {
  if (!query) {
    return { type: null, query: '' };
  }
  
  const cleanQuery = query.trim().toLowerCase();
  
  // Check canister ID first
  if (token.canister_id.toLowerCase().includes(cleanQuery)) {
    return {
      type: 'canister',
      query: cleanQuery,
      matchedText: token.canister_id
    };
  }
  
  // Check name
  if (token.name?.toLowerCase().includes(cleanQuery)) {
    return {
      type: 'name',
      query: cleanQuery,
      matchedText: token.name
    };
  }
  
  // Check symbol
  if (token.symbol?.toLowerCase().includes(cleanQuery)) {
    return {
      type: 'symbol',
      query: cleanQuery,
      matchedText: token.symbol
    };
  }
  
  return null;
}

/**
 * Formats the matched text with highlighting
 */
export function getMatchDisplay(match: SearchMatch): string {
  if (!match.matchedText) return '';
  
  const query = match.query.toLowerCase();
  const text = match.matchedText;
  const index = text.toLowerCase().indexOf(query);
  
  if (index === -1) return text;
  
  const before = text.slice(0, index);
  const highlighted = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  
  return `${before}<span class="match-highlight">${highlighted}</span>${after}`;
} 