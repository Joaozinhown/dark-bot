export interface ConnectionLimiterOptions {
  maxPerKey: number;
  maxTotal: number;
}

export function createConnectionLimiter(options: ConnectionLimiterOptions) {
  if (!Number.isSafeInteger(options.maxPerKey) || options.maxPerKey < 1) {
    throw new Error('maxPerKey must be a positive integer');
  }
  if (!Number.isSafeInteger(options.maxTotal) || options.maxTotal < options.maxPerKey) {
    throw new Error('maxTotal must be an integer greater than or equal to maxPerKey');
  }

  const activeByKey = new Map<string, number>();
  let total = 0;

  return {
    acquire(key: string): (() => void) | null {
      const activeForKey = activeByKey.get(key) ?? 0;
      if (activeForKey >= options.maxPerKey || total >= options.maxTotal) return null;
      activeByKey.set(key, activeForKey + 1);
      total += 1;

      let released = false;
      return () => {
        if (released) return;
        released = true;
        const remainingForKey = (activeByKey.get(key) ?? 1) - 1;
        if (remainingForKey === 0) activeByKey.delete(key);
        else activeByKey.set(key, remainingForKey);
        total -= 1;
      };
    },

    activeCount(): number {
      return total;
    },
  };
}
