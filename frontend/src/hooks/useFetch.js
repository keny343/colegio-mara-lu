import { useCallback, useEffect, useRef, useState } from 'react';

export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result?.data ?? result);
      return result;
    } catch (err) {
      setError(err);
      setData(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current();
        if (!active) return;
        setData(result?.data ?? result);
      } catch (err) {
        if (active) {
          setError(err);
          setData(null);
        }
      } finally {
        if (active && !cancelled) setLoading(false);
      }
    })();

    return () => {
      active = false;
      cancelled = true;
    };
  }, deps);

  return { data, loading, error, setData, refetch: run };
}
