'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './apiClient';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Global in-memory cache map
const memoryCache = new Map<string, CacheEntry<any>>();
const listeners = new Map<string, Set<(data: any) => void>>();

export function getCacheKey(endpoint: string, params?: Record<string, any>): string {
  if (!params) return endpoint;
  const sorted = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return `${endpoint}?${new URLSearchParams(sorted as any).toString()}`;
}

export function setMemoryCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
  const set = listeners.get(key);
  if (set) {
    set.forEach((fn) => fn(data));
  }
}

export const mutateCache = setMemoryCache;

export function getMemoryCache<T>(key: string): T | undefined {
  return memoryCache.get(key)?.data;
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  const toDelete: string[] = [];
  memoryCache.forEach((_, k) => {
    if (k.startsWith(prefix)) {
      toDelete.push(k);
    }
  });
  toDelete.forEach((k) => memoryCache.delete(k));
}

/**
 * useSWRData hook for instant navigation with Stale-While-Revalidate caching.
 * Revisiting any page renders cached data instantly (0ms) and refreshes in background.
 */
export function useSWRData<T>(
  endpoint: string | null,
  params?: Record<string, any>,
  options: { revalidateOnFocus?: boolean; ttlMs?: number } = {}
) {
  const cacheKey = endpoint ? getCacheKey(endpoint, params) : null;
  const cached = cacheKey ? getMemoryCache<T>(cacheKey) : undefined;

  const [data, setData] = useState<T | undefined>(cached);
  const [loading, setLoading] = useState<boolean>(!cached && !!endpoint);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef<() => Promise<void>>();

  const fetchData = useCallback(async (isSilent = false) => {
    if (!endpoint || !cacheKey) return;
    if (!isSilent && !getMemoryCache(cacheKey)) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await api.get<T>(endpoint, params);
      if (res.success && res.data !== undefined) {
        setMemoryCache(cacheKey, res.data);
        setData(res.data);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, cacheKey, JSON.stringify(params)]);

  fetcherRef.current = fetchData;

  useEffect(() => {
    if (!cacheKey) return;

    // 1. Sync with memory cache if available
    const existing = getMemoryCache<T>(cacheKey);
    if (existing !== undefined) {
      setData(existing);
      setLoading(false);
      // Background revalidation
      fetchData(true);
    } else {
      fetchData(false);
    }

    // 2. Subscribe to cache updates from mutations
    const listener = (newData: T) => {
      setData(newData);
    };
    if (!listeners.has(cacheKey)) {
      listeners.set(cacheKey, new Set());
    }
    listeners.get(cacheKey)!.add(listener);

    return () => {
      listeners.get(cacheKey)?.delete(listener);
    };
  }, [cacheKey, fetchData]);

  const mutate = useCallback(
    (updater?: T | ((prev: T | undefined) => T)) => {
      if (!cacheKey) return;
      if (updater === undefined) {
        return fetchData(true);
      }
      setData((prev) => {
        const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
        setMemoryCache(cacheKey, next);
        return next;
      });
    },
    [cacheKey, fetchData]
  );

  const refresh = useCallback(() => {
    return fetchData(false);
  }, [fetchData]);

  return { data, loading, error, mutate, refresh };
}
