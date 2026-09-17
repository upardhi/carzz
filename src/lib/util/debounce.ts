import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Standard debounce function utility for any javascript function.
 * Returns a debounced version of the passed function with an attached `.cancel()` method.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait = 300,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

/**
 * React hook that returns a debounced version of the provided value.
 * Updates after `delay` milliseconds of inactivity.
 *
 * @example
 * const [query, setQuery] = useState('');
 * const debouncedQuery = useDebounce(query, 300);
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * React hook that returns a memoized debounced callback function.
 * Automatically cleans up timer on unmount.
 *
 * @example
 * const debouncedFetch = useDebouncedCallback((val: string) => {
 *   fetchResults(val);
 * }, 300);
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay = 300,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cancel;
  }, [cancel]);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      cancel();
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay, cancel],
  );

  return Object.assign(debounced, { cancel });
}
