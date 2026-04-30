'use client';

import React, { useMemo, useState } from 'react';
import {
  Lock as LockIcon,
  History as HistoryIcon,
  ChevronRight,
  Download,
  TrendingUp,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { InventorySnapshot, Item } from '@/types/inventory';
import { formatKD } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/auth/AuthProvider';

export const ClosingManager = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();

  const [view, setView] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedSnapshot, setSelectedSnapshot] = useState<InventorySnapshot | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });
  const { data: snapshots = [] } = useQuery<InventorySnapshot[]>({
    queryKey: ['snapshots'],
    queryFn: () => fetchAllPages(endpoints.snapshots),
  });

  const closeMutation = useMutation({
    mutationFn: (data: any) => api.post(endpoints.snapshots, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      setIsClosing(false);
      setSelectedSnapshot(res.data);
      setView('DETAIL');
      setError(null);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail || e?.response?.data?.error || 'Failed to seal books.');
    },
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isMonthAlreadyClosed = snapshots.some((s) => s.month === currentMonth);

  const liveValuation = useMemo(
    () =>
      items.reduce((acc, item) => {
        const totalStock = item.stocks.reduce((a, s) => a + s.quantity, 0);
        return acc + totalStock * Number(item.unit_cost);
      }, 0),
    [items],
  );

  const finalizeClosing = () => {
    setError(null);
    // Backend will compute valuation from current state when items omitted.
    closeMutation.mutate({ month: currentMonth });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
            <LockIcon className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Monthly Closing</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Immutable financial seals</span>
        </div>
        <div className="flex items-center gap-3">
          {view === 'DETAIL' && (
            <button
              onClick={() => setView('LIST')}
              className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50"
            >
              Back to Archive
            </button>
          )}
          {view === 'LIST' && !isMonthAlreadyClosed && isManager && (
            <button
              onClick={() => setIsClosing(true)}
              className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 shadow-lg shadow-black/10"
            >
              Initialize {new Date().toLocaleString('default', { month: 'long' })} Closing
            </button>
          )}
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        {view === 'LIST' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#1A1A1A] text-white p-8 rounded-3xl relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <h3 className="text-3xl font-light italic">
                    {isMonthAlreadyClosed ? 'Books are securely locked.' : 'Period is still active.'}
                  </h3>
                  <p className="text-sm text-white/50">
                    Monthly closing creates an immutable digital record of inventory valuation.
                    Once sealed, no further transactions can be recorded against the period.
                  </p>
                </div>
                <HistoryIcon className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5" />
              </div>
              <div className="bg-white border border-[#E5E7EB] p-8 rounded-3xl shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] text-[#9CA3AF] font-bold uppercase">Live Appraisal</p>
                    <h3 className="text-2xl font-bold">
                      {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                  </div>
                  <TrendingUp className="text-emerald-500" />
                </div>
                <p className="text-3xl font-light tracking-tight mt-6">{formatKD(liveValuation)}</p>
                <p className="text-[10px] text-[#9CA3AF] font-bold uppercase mt-2">
                  {items.length} SKUs • Aggregated WAC
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
              <table className="w-full text-left font-sans text-sm">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase">Period</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase">Valuation</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase">Auditor</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase">Sealed At</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snp) => (
                    <tr
                      key={snp.id}
                      className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <td className="px-8 py-6 font-bold">
                        {new Date(snp.month + '-01').toLocaleString('default', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-8 py-6 font-light">{formatKD(snp.total_valuation)}</td>
                      <td className="px-8 py-6 font-bold text-xs">{snp.closed_by_name}</td>
                      <td className="px-8 py-6 text-xs text-[#9CA3AF] font-medium">
                        {new Date(snp.closed_at).toLocaleString()}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedSnapshot(snp);
                            setView('DETAIL');
                          }}
                          className="p-2 hover:bg-black hover:text-white rounded-lg transition-all"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {snapshots.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-xs font-bold uppercase tracking-widest text-[#9CA3AF]">
                        No snapshots sealed yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-light italic">
                  Inventory Audit:{' '}
                  {selectedSnapshot &&
                    new Date(selectedSnapshot.month + '-01').toLocaleString('default', {
                      month: 'long',
                      year: 'numeric',
                    })}
                </h3>
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">
                  Snapshot ID: {selectedSnapshot?.ref} • Sealed Record
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportSnapshotCsv(selectedSnapshot!)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-[10px] font-bold uppercase shadow-xl"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
              <table className="w-full text-left font-sans text-xs">
                <thead className="bg-[#F9FAFB] sticky top-0 border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-6 py-4 font-bold text-[#6B7280] uppercase">Item / SKU</th>
                    <th className="px-6 py-4 font-bold text-[#6B7280] uppercase text-right">Qty</th>
                    <th className="px-6 py-4 font-bold text-[#6B7280] uppercase text-right">WAC</th>
                    <th className="px-6 py-4 font-bold text-[#6B7280] uppercase text-right">Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSnapshot?.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-[9px] text-[#9CA3AF] font-bold uppercase">{item.sku}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">{item.total_stock}</td>
                      <td className="px-6 py-4 text-right">{formatKD(item.unit_cost)}</td>
                      <td className="px-6 py-4 text-right font-bold">{formatKD(item.valuation)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F9FAFB] font-bold">
                    <td className="px-6 py-4 uppercase tracking-widest text-[10px]">Total</td>
                    <td colSpan={2} />
                    <td className="px-6 py-4 text-right">
                      {selectedSnapshot && formatKD(selectedSnapshot.total_valuation)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isClosing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => !closeMutation.isPending && setIsClosing(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[40px] p-12 max-w-lg w-full text-center space-y-8 shadow-2xl"
            >
              <div className="w-20 h-20 bg-rose-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3">
                <LockIcon className="w-10 h-10" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-bold tracking-tight">Seal Books?</h2>
                <p className="text-sm text-[#6B7280]">
                  This action is permanent. It will lock the inventory valuation
                  for {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}.
                  Live valuation: <strong>{formatKD(liveValuation)}</strong>.
                </p>
              </div>
              {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 pt-4">
                <button
                  onClick={finalizeClosing}
                  disabled={closeMutation.isPending}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold text-xs uppercase shadow-xl disabled:opacity-50"
                >
                  {closeMutation.isPending ? 'Sealing…' : 'Confirm & Certify Period'}
                </button>
                <button
                  onClick={() => setIsClosing(false)}
                  disabled={closeMutation.isPending}
                  className="w-full py-4 bg-gray-50 text-[#6B7280] border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function exportSnapshotCsv(snapshot: InventorySnapshot) {
  const rows = [
    ['SKU', 'Name', 'Total Stock', 'Unit Cost', 'Valuation'],
    ...snapshot.items.map((it) => [
      it.sku,
      it.name,
      String(it.total_stock),
      String(it.unit_cost),
      String(it.valuation),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${snapshot.ref}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
