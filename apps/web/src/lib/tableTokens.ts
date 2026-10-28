/**
 * Shared Table Tokens & Reference Design Styles (Round 10)
 * Treats the Admin Global Leads Registry table as the single gold standard
 * for every table in the CRM (Telecaller, Closer, Admin).
 */

export const TABLE_TOKENS = {
  // Container wrapper (matches Admin Card design)
  cardContainer: 'border border-slate-200/90 shadow-soft-sm overflow-hidden bg-white rounded-2xl',
  scrollWrapper: 'overflow-x-auto relative',

  // Table base
  table: 'w-full text-left text-xs border-collapse',

  // Thead reference
  thead: 'bg-slate-50 text-slate-700 font-bold border-b border-slate-200 select-none sticky top-0 z-20 shadow-soft-xs',
  th: 'p-3 text-slate-700 font-bold text-xs select-none',
  thCenter: 'p-3 text-slate-700 font-bold text-xs text-center select-none',
  thRight: 'p-3 text-slate-700 font-bold text-xs text-right select-none',

  // Sticky columns in thead
  thStickyCheckbox:
    'sticky left-0 z-30 bg-slate-50 border-r border-slate-200/60 w-12 min-w-[48px] max-w-[48px] p-3 text-center',
  thStickySerial:
    'sticky left-12 z-30 bg-slate-50 border-r border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] w-14 min-w-[56px] max-w-[56px] p-3 text-center text-slate-500 font-bold',
  thStickyActions:
    'sticky right-0 z-30 bg-slate-50 border-l border-slate-200/80 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)] w-24 min-w-[96px] max-w-[96px] p-3 text-right',

  // Tbody reference
  tbody: 'divide-y divide-slate-100 bg-white',
  tr: 'group hover:bg-slate-50/80 cursor-pointer transition-colors',
  trSelected: 'bg-sky-50/40 hover:bg-sky-50/60',

  // Cells
  td: 'p-3 text-xs text-slate-800 align-middle',
  tdCenter: 'p-3 text-xs text-slate-800 text-center align-middle',
  tdRight: 'p-3 text-xs text-slate-800 text-right align-middle',

  // Sticky cells in tbody
  tdStickyCheckbox:
    'sticky left-0 z-10 border-r border-slate-200/60 w-12 min-w-[48px] max-w-[48px] p-3 text-center bg-white group-hover:bg-slate-50',
  tdStickySerial:
    'sticky left-12 z-10 border-r border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] w-14 min-w-[56px] max-w-[56px] p-3 text-center text-slate-500 font-semibold bg-white group-hover:bg-slate-50',
  tdStickyActions:
    'sticky right-0 z-10 border-l border-slate-200/80 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)] w-24 min-w-[96px] max-w-[96px] p-3 text-right bg-white group-hover:bg-slate-50',

  // Form elements inside tables
  dropdown:
    'text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer shadow-soft-xs',

  // Badges & Pills
  badgeOutcome:
    'px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap inline-flex items-center gap-1',

  badgePipelineDefault:
    'px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap inline-flex items-center gap-1',

  badgePriorityDefault:
    'text-[11px] font-bold rounded-lg px-2 py-1 border whitespace-nowrap inline-flex items-center gap-1',

  // Empty and Loading States
  emptyState: 'p-12 text-center text-slate-400 font-medium text-xs',
  skeletonBar: 'bg-slate-200 rounded animate-pulse',
};
