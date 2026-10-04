import { useCallback, useEffect, useState } from 'react';

import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_QUERY_LENGTH } from '@/config/ui';
import type { SearchOptions, SearchResults } from '@/types/api';
import { searchFiles } from '@/web/lib/api';

type SearchFlag = 'isCaseSensitive' | 'isWholeWord' | 'isRegex';
type SearchFilter = 'include' | 'exclude';

export interface ProjectSearchState {
  options: SearchOptions;
  // null until a search has finished for the current options.
  results: SearchResults | null;
  isSearching: boolean;
  isQueryTooShort: boolean;
  error: string | null;
  areFiltersVisible: boolean;
  setQuery: (query: string) => void;
  toggleFlag: (flag: SearchFlag) => void;
  setFilter: (filter: SearchFilter, value: string) => void;
  toggleFilters: () => void;
  // Runs the current search again, for example after files changed.
  searchAgain: () => void;
}

const INITIAL_OPTIONS: SearchOptions = {
  query: '',
  isCaseSensitive: false,
  isWholeWord: false,
  isRegex: false,
  include: '',
  exclude: '',
};

export function useProjectSearch(): ProjectSearchState {
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [runCount, setRunCount] = useState(0);

  // A regular expression can be short and still precise ("\d"), so the minimum is for text only.
  const isQueryTooShort = options.isRegex
    ? options.query === ''
    : options.query.trim().length < SEARCH_MIN_QUERY_LENGTH;

  useEffect(() => {
    if (isQueryTooShort) {
      setResults(null);
      setError(null);
      setIsSearching(false);
      return;
    }

    // Each change starts over: the pending search is dropped and the server is told to stop.
    const controller = new AbortController();
    setIsSearching(true);

    async function run() {
      const result = await searchFiles(options, controller.signal);
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
  }, [options, isQueryTooShort, runCount]);

  const setQuery = useCallback((query: string) => setOptions((current) => ({ ...current, query })), []);
  const toggleFlag = useCallback(
    (flag: SearchFlag) => setOptions((current) => ({ ...current, [flag]: !current[flag] })),
    [],
  );
  const setFilter = useCallback(
    (filter: SearchFilter, value: string) => setOptions((current) => ({ ...current, [filter]: value })),
    [],
  );
  const toggleFilters = useCallback(() => setAreFiltersVisible((current) => !current), []);
  const searchAgain = useCallback(() => setRunCount((current) => current + 1), []);

  return {
    options,
    results,
    isSearching,
    isQueryTooShort,
    error,
    areFiltersVisible,
    setQuery,
    toggleFlag,
    setFilter,
    toggleFilters,
    searchAgain,
  };
}
