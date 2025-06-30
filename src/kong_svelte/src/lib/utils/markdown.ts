/**
 * Enhanced markdown parser for comments
 * Supports: bold, italic, links, images, code, quotes, lists, and more
 */
export function parseBasicMarkdown(text: string): string {
  // Escape HTML to prevent XSS
  const escapeHtml = (str: string) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // Start with escaped HTML
  let parsed = escapeHtml(text);

  // Parse code blocks first (to prevent other parsing inside code)
  // Multi-line code blocks ```
  parsed = parsed.replace(
    /```([\s\S]*?)```/g,
    (match, code) => {
      const trimmedCode = code.trim();
      if (!trimmedCode) return match;
      return `<pre><code>${trimmedCode}</code></pre>`;
    }
  );

  // Inline code `code`
  parsed = parsed.replace(
    /`([^`]+)`/g,
    '<code>$1</code>'
  );

  // Parse images ![alt text](url)
  parsed = parsed.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (match, altText, url) => {
      // Validate URL - allow common image extensions and known GIF services
      const imageExtensionPattern = /^https?:\/\/[^\s<>]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<>]*)?$/i;
      const gifServicePattern = /^https?:\/\/(media\.giphy\.com|i\.giphy\.com|media[0-9]*\.giphy\.com|tenor\.com|c\.tenor\.com|imgur\.com|i\.imgur\.com)/i;
      
      const isValidUrl = imageExtensionPattern.test(url) || gifServicePattern.test(url);
      
      if (isValidUrl) {
        const escapedAlt = altText || 'Image';
        return `<img src="${url}" alt="${escapedAlt}" class="comment-image" loading="lazy" />`;
      } else {
        // Return the original text if URL is not safe
        return match;
      }
    }
  );

  // Parse links [text](url)
  parsed = parsed.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, linkText, url) => {
      // Basic URL validation
      const urlPattern = /^https?:\/\/[^\s<>]+$/i;
      if (urlPattern.test(url)) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
      }
      return match;
    }
  );

  // Parse blockquotes before lists to avoid conflicts
  parsed = parsed.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Parse lists - process line by line
  const lines = parsed.split('\n');
  let processedLines: string[] = [];
  let inList = false;
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for unordered list item
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    // Check for ordered list item
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        // Close previous list if it was ordered
        if (inList && listType === 'ol') {
          processedLines.push(`<ol>${listItems.join('')}</ol>`);
          listItems = [];
        }
        inList = true;
        listType = 'ul';
      }
      listItems.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (!inList || listType !== 'ol') {
        // Close previous list if it was unordered
        if (inList && listType === 'ul') {
          processedLines.push(`<ul>${listItems.join('')}</ul>`);
          listItems = [];
        }
        inList = true;
        listType = 'ol';
      }
      listItems.push(`<li>${olMatch[2]}</li>`);
    } else {
      // Not a list item
      if (inList) {
        // Close the current list
        processedLines.push(`<${listType}>${listItems.join('')}</${listType}>`);
        listItems = [];
        inList = false;
        listType = null;
      }
      processedLines.push(line);
    }
  }
  
  // Close any remaining list
  if (inList && listType) {
    processedLines.push(`<${listType}>${listItems.join('')}</${listType}>`);
  }
  
  parsed = processedLines.join('\n');

  // Parse bold text (**text**)
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Parse italic text (*text* or _text_)
  // Handle underscores
  parsed = parsed.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Handle single asterisks (but not if they're part of **)
  // Using a simpler approach without negative lookbehind for browser compatibility
  parsed = parsed.replace(/([^*]|^)\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');

  // Convert line breaks to <br> tags
  parsed = parsed.replace(/\n/g, '<br>');

  // Clean up any excessive line breaks
  parsed = parsed.replace(/(<br>\s*){3,}/g, '<br><br>');
  
  // Clean up line breaks around block elements
  parsed = parsed.replace(/<br>(<(?:ul|ol|blockquote|pre)>)/g, '$1');
  parsed = parsed.replace(/(<\/(?:ul|ol|blockquote|pre)>)<br>/g, '$1');

  return parsed;
}

/**
 * Strip markdown formatting from text
 * Useful for previews or text-only contexts
 */
export function stripMarkdown(text: string): string {
  // Remove bold markers
  let stripped = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  
  // Remove italic markers
  stripped = stripped.replace(/\*([^*]+)\*/g, '$1');
  stripped = stripped.replace(/_([^_]+)_/g, '$1');
  
  return stripped;
}