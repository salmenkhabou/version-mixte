import { useEffect, useRef, useState } from 'react';

export function usePersistentState(storageKey, initialValue, options = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [value, setValue] = useState(() => {
    const {
      normalize = (nextValue) => nextValue,
      readErrorLabel = storageKey,
    } = optionsRef.current;

    try {
      const raw = globalThis.localStorage?.getItem(storageKey);
      if (!raw) return initialValue;

      const parsed = JSON.parse(raw);
      const normalized = normalize(parsed);
      return normalized ?? initialValue;
    } catch (error) {
      console.error(`Error loading ${readErrorLabel}:`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    const {
      removeWhen = () => false,
      writeErrorLabel = storageKey,
    } = optionsRef.current;

    try {
      if (removeWhen(value)) {
        globalThis.localStorage?.removeItem(storageKey);
        return;
      }

      globalThis.localStorage?.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${writeErrorLabel}:`, error);
    }
  }, [storageKey, value]);

  return [value, setValue];
}
