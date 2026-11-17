'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { Button } from '../ui/Button';
import {
  Search,
  Plus,
  Menu,
  X,
  Loader2,
  Phone,
  Building2,
  User,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useHeaderContext } from './PageHeaderContext';
import { Lead } from '@crm/shared';
import { api } from '@/lib/apiClient';
import { WhatsAppIcon } from '../leads/WhatsAppButton';
import { openWhatsAppChat } from '@/lib/whatsapp';
import { getStageColor, getPriorityColor } from '@/lib/utils';

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onOpenCreateLead?: () => void;
  searchPlaceholder?: string;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

export function TopBar(props: TopBarProps) {
  const { user } = useAuth();
  const router = useRouter();
  const headerContext = useHeaderContext();

  const title = props.title ?? headerContext?.header.title ?? 'TenderProcure CRM';
  const subtitle = props.subtitle ?? headerContext?.header.subtitle;
  const onOpenCreateLead = props.onOpenCreateLead ?? headerContext?.header.onOpenCreateLead;

  // Universal Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch live suggestions debounced
  const fetchSuggestions = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q || q.length < 1) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.get<Lead[]>('/leads', {
        search: q,
        limit: 8,
        includeWebsite: 'true',
      });
      if (res.success && res.data) {
        setSuggestions(res.data);
        setIsDropdownOpen(true);
        setSelectedIndex(-1);
      }
    } catch (err) {
      console.error('Universal search suggestions error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 200);
  };

  // Keyboard shortcut Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (searchQuery.trim() && suggestions.length > 0) {
          setIsDropdownOpen(true);
        }
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, suggestions.length]);

  // Click outside listener to close suggestions dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation inside search input
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && searchQuery.trim()) {
        handleFullSearchSubmit();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        handleSelectLead(suggestions[selectedIndex]);
      } else {
        handleFullSearchSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  // When a suggestion lead is clicked, open global lead drawer
  const handleSelectLead = (lead: Lead) => {
    setIsDropdownOpen(false);
    setIsMobileSearchOpen(false);
    if (headerContext?.openGlobalLeadDrawer) {
      headerContext.openGlobalLeadDrawer(lead.id);
    } else {
      // Fallback: navigate to leads page with id
      router.push(`/admin/leads?search=${encodeURIComponent(lead.companyName)}`);
    }
  };

  // Submit full search navigation based on user role
  const handleFullSearchSubmit = () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsDropdownOpen(false);
    setIsMobileSearchOpen(false);

    if (user?.role === 'SUPER_ADMIN') {
      router.push(`/admin/leads?search=${encodeURIComponent(q)}`);
    } else if (user?.role === 'SALESMAN') {
      router.push(`/salesman/leads?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`/telecaller/leads?search=${encodeURIComponent(q)}`);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSuggestions([]);
    setIsDropdownOpen(false);
    searchInputRef.current?.focus();
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-40">
        {/* Left: Hamburger (mobile/tablet) + Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => headerContext?.toggleMobileSidebar()}
            className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 font-normal truncate hidden sm:block">{subtitle}</p>}
          </div>
        </div>

        {/* Middle: Universal Search Bar (Always active on tablet & desktop) */}
        <div ref={searchContainerRef} className="hidden md:flex items-center flex-1 max-w-lg relative mx-2">
          <div className="relative w-full">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim() && suggestions.length > 0) {
                  setIsDropdownOpen(true);
                }
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="Search company, phone, contact across CRM..."
              className="w-full pl-10 pr-20 py-2 bg-slate-50/90 hover:bg-slate-50 focus:bg-white border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 shadow-soft-xs transition-all"
            />

            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-auto">
              {isLoading && <Loader2 className="h-3.5 w-3.5 text-sky-600 animate-spin" />}
              {searchQuery && !isLoading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden lg:inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300/60 select-none">
                Ctrl K
              </kbd>
            </div>
          </div>

          {/* Autocomplete Suggestion Dropdown */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl shadow-soft-2xl border border-slate-200/90 overflow-hidden animate-fade-in max-h-[75vh] flex flex-col">
              {/* Header */}
              <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span>CRM Leads Matching</span>
                  <span className="text-sky-700 font-bold bg-sky-100/70 px-1.5 py-0.2 rounded-full text-[10px]">
                    {suggestions.length}
                  </span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
                  ↑↓ Navigate • ↵ View • Esc to close
                </span>
              </div>

              {/* Suggestions List */}
              <div className="overflow-y-auto divide-y divide-slate-100 max-h-[380px] scrollbar-thin">
                {suggestions.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <Search className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">No leads found across CRM</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Check company spelling or try search by contact person or phone number.
                    </p>
                  </div>
                ) : (
                  suggestions.map((lead, idx) => {
                    const isSelected = selectedIndex === idx;
                    const stageMeta = getStageColor(lead.pipelineStage);
                    const priorityMeta = getPriorityColor(lead.priority);

                    return (
                      <div
                        key={lead.id}
                        onClick={() => handleSelectLead(lead)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`p-3 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected ? 'bg-sky-50/70 ring-1 ring-sky-300/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Company & Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 truncate group-hover:text-sky-600">
                              {lead.companyName}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded border truncate max-w-[120px] ${stageMeta.bg} ${stageMeta.text} ${stageMeta.border}`}
                            >
                              {lead.pipelineStage}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 truncate">
                            {lead.contactPerson && (
                              <span className="flex items-center gap-1 font-medium text-slate-700 truncate">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{lead.contactPerson}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 font-semibold text-emerald-700 shrink-0 font-mono">
                              <Phone className="h-3 w-3 shrink-0" />
                              {lead.phone}
                            </span>
                            {lead.serviceProduct && (
                              <span className="text-slate-400 truncate hidden lg:inline max-w-[140px]" title={lead.serviceProduct}>
                                • {lead.serviceProduct}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`tel:${lead.phone}`}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title={`Call ${lead.phone}`}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              openWhatsAppChat({
                                phone: lead.phone,
                                leadId: lead.id,
                                callerName: user?.name,
                                message: `Hello ${lead.contactPerson || lead.companyName}, connecting regarding ${lead.serviceProduct || 'your inquiry'}.`,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Chat on WhatsApp"
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectLead(lead)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={handleFullSearchSubmit}
                  className="text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded hover:bg-sky-50"
                >
                  <span>Press Enter to search entire database for &ldquo;{searchQuery}&rdquo;</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Actions: Mobile Search Button + Notifications + New Lead Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile search trigger icon */}
          <button
            type="button"
            onClick={() => {
              setIsMobileSearchOpen(true);
              setTimeout(() => mobileInputRef.current?.focus(), 100);
            }}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Universal Search"
            title="Universal Search"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* Notifications */}
          <NotificationPopover />

          {/* Quick Add Lead Button - Admin Only */}
          {user?.role === 'SUPER_ADMIN' && onOpenCreateLead && (
            <Button
              size="sm"
              onClick={onOpenCreateLead}
              icon={<Plus className="h-4 w-4" />}
              className="hidden sm:inline-flex"
            >
              New Lead
            </Button>
          )}
        </div>
      </header>

      {/* Mobile Universal Search Overlay Modal */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-950/60 backdrop-blur-xs flex flex-col">
          <div className="bg-white p-3 border-b border-slate-200 shadow-soft-lg flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={mobileInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search CRM by company, phone, contact..."
                className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(false)}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Mobile Results Area */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-2">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400">
                <Loader2 className="h-6 w-6 text-sky-600 animate-spin mx-auto mb-2" />
                <span className="text-xs font-medium">Searching CRM...</span>
              </div>
            ) : suggestions.length === 0 && searchQuery ? (
              <div className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-400">
                <Search className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No matching leads found</p>
                <p className="text-[11px] text-slate-400 mt-1">Try searching by company or phone number.</p>
              </div>
            ) : (
              suggestions.map((lead) => {
                const stageMeta = getStageColor(lead.pipelineStage);
                return (
                  <div
                    key={lead.id}
                    onClick={() => handleSelectLead(lead)}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-soft-xs space-y-2 active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-slate-900 block truncate">
                          {lead.companyName}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {lead.contactPerson || 'No contact'} {lead.serviceProduct ? `• ${lead.serviceProduct}` : ''}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${stageMeta.bg} ${stageMeta.text} ${stageMeta.border}`}>
                        {lead.pipelineStage}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-mono"
                      >
                        <Phone className="h-3 w-3" />
                        <span>{lead.phone}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleSelectLead(lead)}
                        className="text-xs font-bold text-sky-700 flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
