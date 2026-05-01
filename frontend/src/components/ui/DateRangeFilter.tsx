'use client';

import React, { useState, useMemo } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DatePreset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  preset: DatePreset;
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

function getPresetRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'this_week': {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = start
      const mon = new Date(now);
      mon.setDate(now.getDate() - diff);
      return {
        from: mon.toISOString().slice(0, 10),
        to: today,
      };
    }
    case 'this_month':
      return { from: `${yyyy}-${mm}-01`, to: today };
    case 'last_month': {
      const prev = new Date(yyyy, now.getMonth() - 1, 1);
      const lastDay = new Date(yyyy, now.getMonth(), 0);
      return {
        from: prev.toISOString().slice(0, 10),
        to: lastDay.toISOString().slice(0, 10),
      };
    }
    case 'this_year':
      return { from: `${yyyy}-01-01`, to: today };
    case 'all':
    default:
      return { from: '2000-01-01', to: '2099-12-31' };
  }
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export const DateRangeFilter = ({ value, onChange }: DateRangeFilterProps) => {
  const [showCustom, setShowCustom] = useState(value.preset === 'custom');

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      onChange({ ...value, preset: 'custom' });
    } else {
      setShowCustom(false);
      const range = getPresetRange(preset);
      onChange({ from: range.from, to: range.to, preset });
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
        <div className="relative">
          <select
            value={value.preset}
            onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
            className="appearance-none pl-3 pr-7 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] cursor-pointer hover:border-[#9CA3AF] transition-colors focus:outline-none focus:border-black"
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9CA3AF] pointer-events-none" />
        </div>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs font-medium text-[#374151] focus:outline-none focus:border-black transition-colors"
          />
          <span className="text-[10px] font-bold text-[#9CA3AF]">→</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-xs font-medium text-[#374151] focus:outline-none focus:border-black transition-colors"
          />
        </div>
      )}
    </div>
  );
};

/**
 * Hook that provides date-range state + a filter function for transactions.
 * Usage:
 *   const { dateRange, setDateRange, filterByDate } = useDateRangeFilter();
 *   const filtered = useMemo(() => items.filter(filterByDate), [items, filterByDate]);
 */
export function useDateRangeFilter(initialPreset: DatePreset = 'all') {
  const initial = getPresetRange(initialPreset);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: initial.from,
    to: initial.to,
    preset: initialPreset,
  });

  const filterByDate = useMemo(() => {
    const fromDate = new Date(dateRange.from + 'T00:00:00');
    const toDate = new Date(dateRange.to + 'T23:59:59');

    return (item: { date: string }) => {
      const d = new Date(item.date);
      return d >= fromDate && d <= toDate;
    };
  }, [dateRange.from, dateRange.to]);

  return { dateRange, setDateRange, filterByDate };
}
