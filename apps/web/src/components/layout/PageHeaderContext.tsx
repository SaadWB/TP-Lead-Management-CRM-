'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, ReactNode } from 'react';

export interface HeaderState {
  title: string;
  subtitle?: string;
  onOpenCreateLead?: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
}

export interface HeaderInput {
  title: string;
  subtitle?: string;
  onOpenCreateLead?: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
}

export interface HeaderContextType {
  header: HeaderState;
  setHeader: (state: HeaderInput) => void;
  updateCallbacks?: (callbacks: { onOpenCreateLead?: () => void; onSearchChange?: (val: string) => void }) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [headerState, setHeaderState] = useState<{
    title: string;
    subtitle?: string;
    searchTerm?: string;
    searchPlaceholder?: string;
    hasOpenCreateLead: boolean;
    hasSearchChange: boolean;
  }>({
    title: 'TenderProcure CRM',
    subtitle: '',
    hasOpenCreateLead: false,
    hasSearchChange: false,
  });

  const callbacksRef = useRef<{
    onOpenCreateLead?: () => void;
    onSearchChange?: (val: string) => void;
  }>({});

  const updateCallbacks = useCallback(
    (callbacks: { onOpenCreateLead?: () => void; onSearchChange?: (val: string) => void }) => {
      callbacksRef.current = callbacks;
    },
    []
  );

  const setHeader = useCallback((input: HeaderInput) => {
    callbacksRef.current = {
      onOpenCreateLead: input.onOpenCreateLead,
      onSearchChange: input.onSearchChange,
    };

    setHeaderState((prev) => {
      const nextTitle = input.title;
      const nextSubtitle = input.subtitle;
      const nextSearchTerm = input.searchTerm;
      const nextSearchPlaceholder = input.searchPlaceholder;
      const nextHasOpen = Boolean(input.onOpenCreateLead);
      const nextHasSearch = Boolean(input.onSearchChange);

      if (
        prev.title === nextTitle &&
        prev.subtitle === nextSubtitle &&
        prev.searchTerm === nextSearchTerm &&
        prev.searchPlaceholder === nextSearchPlaceholder &&
        prev.hasOpenCreateLead === nextHasOpen &&
        prev.hasSearchChange === nextHasSearch
      ) {
        return prev;
      }

      return {
        title: nextTitle,
        subtitle: nextSubtitle,
        searchTerm: nextSearchTerm,
        searchPlaceholder: nextSearchPlaceholder,
        hasOpenCreateLead: nextHasOpen,
        hasSearchChange: nextHasSearch,
      };
    });
  }, []);

  const handleOpenCreateLead = useCallback(() => {
    callbacksRef.current.onOpenCreateLead?.();
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    callbacksRef.current.onSearchChange?.(val);
  }, []);

  const header = useMemo<HeaderState>(
    () => ({
      title: headerState.title,
      subtitle: headerState.subtitle,
      searchTerm: headerState.searchTerm,
      searchPlaceholder: headerState.searchPlaceholder,
      onOpenCreateLead: headerState.hasOpenCreateLead ? handleOpenCreateLead : undefined,
      onSearchChange: headerState.hasSearchChange ? handleSearchChange : undefined,
    }),
    [headerState, handleOpenCreateLead, handleSearchChange]
  );

  const value = useMemo<HeaderContextType>(
    () => ({
      header,
      setHeader,
      updateCallbacks,
    }),
    [header, setHeader, updateCallbacks]
  );

  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

export function useHeaderContext() {
  return useContext(HeaderContext);
}
