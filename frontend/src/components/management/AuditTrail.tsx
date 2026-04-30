'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowDownCircle,
  ArrowRightLeft,
  Hammer,
  Trash2,
  Download,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { endpoints, fetchAllPages } from '@/lib/api';
import { Transaction, Outlet } from '@/types/inventory';
import { formatKD, cn } from '@/lib/utils';

const PAGE_SIZE = 50;

export const AuditTrail = () => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('All');
  const [filterOutlet, setFilterOutlet] = useState<string>('All');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [page, setPage] = useState(1);

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => fetchAllPages(endpoints.transactions),
  });

  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: () => fetchAllPages(endpoints.outlets),
  });

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchSearch = `${tx.ref} ${tx.item_name} ${tx.staff_name} ${tx.notes || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchType = filterType === 'All' || tx.type === filterType;
      const matchOutlet = filterOutlet === 'All' || tx.outlet === Number(filterOutlet);
      const date = new Date(tx.date);
      const matchFrom = !from || date >= new Date(from);
      const matchTo = !to || date <= new Date(`${to}T23:59:59`);
      return matchSearch && matchType && matchOutlet && matchFrom && matchTo;
    });
  }, [transactions, search, filterType, filterOutlet, from, to]);

  const visibleTransactions = filteredTransactions.slice(0, page * PAGE_SIZE);

  const getIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return <ArrowDownCircle className="w-4 h-4 text-emerald-500" />;
      case 'BREAKAGE':
        return <Hammer className="w-4 h-4 text-red-500" />;
      case 'WRITE_OFF':
        return <Trash2 className="w-4 h-4 text-rose-500" />;
      case 'TRANSFER':
        return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      case 'ADJUSTMENT':
        return <ArrowUpDown className="w-4 h-4 text-amber-500" />;
      default:
        return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    }
  };

  const handleExport = () => {
    const rows = [
      ['Ref', 'Type', 'Date', 'Item', 'Outlet', 'Target', 'Delta', 'Value', 'Staff', 'Reason', 'Notes'],
      ...filteredTransactions.map((tx) => [
        tx.ref,
        tx.type,
        new Date(tx.date).toISOString(),
        tx.item_name,
        tx.outlet_name,
        tx.target_outlet_name || '',
        String(tx.quantity_delta),
        String(tx.value),
        tx.staff_name,
        tx.reason || '',
        tx.notes || '',
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Audit Ledger</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{filteredTransactions.length} events</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search events…"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-[#E5E7EB] rounded-lg text-xs font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </header>

      <div className="px-8 py-3 bg-white border-b border-[#E5E7EB] flex items-center gap-3 flex-wrap">
        <select
          className="text-[10px] font-bold bg-gray-50 border border-[#E5E7EB] rounded px-2 py-1"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="All">All Types</option>
          <option value="PURCHASE">Purchase</option>
          <option value="BREAKAGE">Breakage</option>
          <option value="TRANSFER">Transfer</option>
          <option value="WRITE_OFF">Write-off</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>
        <select
          className="text-[10px] font-bold bg-gray-50 border border-[#E5E7EB] rounded px-2 py-1"
          value={filterOutlet}
          onChange={(e) => setFilterOutlet(e.target.value)}
        >
          <option value="All">All Outlets</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="text-[10px] font-bold bg-gray-50 border border-[#E5E7EB] rounded px-2 py-1"
        />
        <span className="text-[10px] text-[#9CA3AF]">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="text-[10px] font-bold bg-gray-50 border border-[#E5E7EB] rounded px-2 py-1"
        />
        {(from || to || filterType !== 'All' || filterOutlet !== 'All' || search) && (
          <button
            onClick={() => {
              setSearch('');
              setFilterType('All');
              setFilterOutlet('All');
              setFrom('');
              setTo('');
            }}
            className="text-[10px] font-bold text-[#6B7280] hover:text-rose-600 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <table className="w-full text-left font-sans text-sm border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ref</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Entity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Outlet</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Delta</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Value</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Staff</th>
              </tr>
            </thead>
            <tbody>
              {visibleTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-6 py-4">{getIcon(tx.type)}</td>
                  <td className="px-6 py-4 font-mono text-xs font-bold underline decoration-[#E5E7EB]">{tx.ref}</td>
                  <td className="px-6 py-4">
                    <p className="text-[10px] font-bold uppercase">{new Date(tx.date).toLocaleDateString()}</p>
                    <p className="text-[9px] text-[#9CA3AF] font-bold">
                      {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold">{tx.item_name}</span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-bold uppercase text-[#9CA3AF]">
                    {tx.outlet_name}
                    {tx.target_outlet_name && <span> → {tx.target_outlet_name}</span>}
                  </td>
                  <td
                    className={cn(
                      'px-6 py-4 text-right font-light text-sm',
                      tx.quantity_delta > 0 ? 'text-emerald-600' : 'text-rose-600',
                    )}
                  >
                    {tx.quantity_delta > 0 ? '+' : ''}
                    {tx.quantity_delta}
                  </td>
                  <td className="px-6 py-4 text-right font-light text-sm">{formatKD(tx.value)}</td>
                  <td className="px-6 py-4 text-xs font-medium">{tx.staff_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTransactions.length === 0 && (
            <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
              No matching events
            </p>
          )}
          {filteredTransactions.length > visibleTransactions.length && (
            <div className="text-center p-4">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-6 py-2 border border-[#E5E7EB] rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50"
              >
                Load more ({filteredTransactions.length - visibleTransactions.length} remaining)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
