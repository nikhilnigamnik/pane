import { useCallback, useEffect, useState } from 'react';

import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH } from '@/config/ui';
import type { SearchResults } from '@/types/api';
import { searchFiles } from '@/web/lib/api';

export interface ProjectSearchState {
  query: string;
  isCaseSensitive: boolean;
  // null until a search has finished for the current query.
  results: SearchResults | null;
  isSearching: boolean;
  isQueryTooShort: boolean;
  error: string | null;
  setQuery: (query: string) => void;
  toggleCaseSensitive: () => void;
  // Runs the current query again, for example after files changed.
  searchAgain: () => void;
}

export function useProjectSearch(): ProjectSearchState {
  const [query, setQuery] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

  const isQueryTooShort = query.trim().length < SEARCH_MIN_QUERY_LENGTH;

  useEffect(() => {
    if (isQueryTooShort) {
      setResults(null);
      setError(null);
      setIsSearching(false);
      return;
    }

    // Each keystroke starts over: the pending search is dropped and the server is told to stop.
    const controller = new AbortController();
    setIsSearching(true);

    async function run() {
      const result = await searchFiles(query, isCaseSensitive, controller.signal);
      if (controller.signal.aborted) return;
      setIsSearching(false);
      setResults(result.success ? result.data : null);
      setError(result.success ? null : result.error.message);
    }

    const timer = setTimeout(() => void run(), SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isCaseSensitive, isQueryTooShort, runCount]);

  const toggleCaseSensitive = useCallback(() => setIsCaseSensitive((current) => !current), []);
  const searchAgain = useCallback(() => setRunCount((current) => current + 1), []);

  return {
    query,
    isCaseSensitive,
    results,
    isSearching,
    isQueryTooShort,
    error,
    setQuery,
    toggleCaseSensitive,
    searchAgain,
  };
}
