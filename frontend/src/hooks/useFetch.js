import { useCallback, useEffect, useRef, useState } from 'react';

// useFetch com AbortController:
//  - cancela o request ao desmontar;
//  - cancela o request anterior quando a dependência muda;
//  - impede respostas antigas de sobrescreverem respostas novas
//    (mesmo que o abort não seja observado pelo transporte);
//  - mantém loading/error/data consistentes;
//  - mantém refetch funcional.
//
// O fetcher recebe um AbortSignal opcional como 1º argumento:
//   useFetch((signal) => api.get('/x', { signal }), deps)
export function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // Versão única da requisição "actual": só o request mais recente pode gravar estado.
  const requestSeq = useRef(0);

  const run = useCallback(async () => {
    const seq = ++requestSeq.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(controller.signal);
      if (seq !== requestSeq.current) return result;
      setData(result?.data ?? result);
      return result;
    } catch (err) {
      if (seq !== requestSeq.current) throw err;
      setError(err);
      setData(undefined);
      throw err;
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const seq = ++requestSeq.current;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcherRef.current(controller.signal);
        if (!active || seq !== requestSeq.current) return;
        setData(result?.data ?? result);
      } catch (err) {
        if (active && seq === requestSeq.current) {
          setError(err);
          setData(undefined);
        }
      } finally {
        if (active && seq === requestSeq.current) setLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, setData, refetch: run };
}
