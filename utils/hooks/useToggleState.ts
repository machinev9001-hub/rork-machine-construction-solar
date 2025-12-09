import { useState, useCallback } from 'react';

export function useToggleState(initialState: Record<string, boolean> = {}) {
  const [state, setState] = useState<Record<string, boolean>>(initialState);

  const toggle = useCallback((key: string, value?: boolean) => {
    setState(prev => ({
      ...prev,
      [key]: value !== undefined ? value : !prev[key],
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  return { state, toggle, reset };
}
