interface VirtualScrollOptions<T> {
  items: T[];
  containerHeight: number;
  scrollTop: number;
  itemHeight: number;
  buffer?: number;
}

interface VirtualScrollResult<T> {
  visible: { index: number; item: T }[];
  startOffset: number;
}

export function virtualScroll<T>({
  items,
  containerHeight,
  scrollTop,
  itemHeight,
  buffer = 5
}: VirtualScrollOptions<T>): VirtualScrollResult<T> {
  if (!containerHeight || !items.length) {
    return { visible: [], startOffset: 0 };
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * buffer;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  const visible = items
    .slice(startIndex, endIndex)
    .map((item, i) => ({ 
      index: startIndex + i, 
      item 
    }));

  return {
    visible,
    startOffset: startIndex * itemHeight
  };
} 