import { useEffect, useState } from 'react';

// Devuelve `value` solo después de que deje de cambiar durante `ms` milisegundos.
export function useDebounce(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
