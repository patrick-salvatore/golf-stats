export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait: number
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
      timeout = undefined;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
  };

  debounced.flush = () => {
    if (timeout && lastArgs) {
      clearTimeout(timeout);
      fn(...lastArgs);
      timeout = undefined;
    }
  };

  return debounced;
}


export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  wait: number
) {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - lastCall);
    lastArgs = args;

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastCall = Date.now();
        timeout = null;
        if (lastArgs) fn(...lastArgs);
      }, remaining);
    }
  };
}
