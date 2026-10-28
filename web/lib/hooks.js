'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

let catalogCache = null;
/** Metals + stones (+ priced shape/quality matrix), fetched once per page load. */
export function useCatalog() {
  const [data, setData] = useState(catalogCache);
  useEffect(() => {
    if (catalogCache) return;
    Promise.all([api('/metals'), api('/stones')]).then(([m, s]) => {
      catalogCache = { metals: m.items, stones: s.items, matrix: s.matrix };
      setData(catalogCache);
    }).catch(() => setData({ metals: [], stones: [], matrix: {}, error: true }));
  }, []);
  return data;
}

/** Debounced, abortable live quote; keeps the previous price visible (dimmed) while a new one loads. */
export function useQuote(designSlug, config, enabled = true) {
  const [state, setState] = useState({ quote: null, loading: false, error: null });
  const key = JSON.stringify(config);
  useEffect(() => {
    if (!designSlug || !config || !enabled) return;
    const ac = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const t = setTimeout(() => {
      api('/pricing/quote', { method: 'POST', body: { designSlug, config }, signal: ac.signal })
        .then((quote) => setState({ quote, loading: false, error: null }))
        .catch((e) => { if (e.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error: e.message })); });
    }, 120);
    return () => { clearTimeout(t); ac.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designSlug, key, enabled]);
  return state;
}
