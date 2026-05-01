'use client';

import React, { useMemo, useState } from 'react';
import {
  Hammer,
  Plus,
  X,
  TrendingDown,
  Lock as LockIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Transaction, Item, Outlet, InventorySnapshot } from '@/types/inventory';
import { formatKD, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DateRangeFilter, useDateRangeFilter } from '@/components/ui/DateRangeFilter';

const BREAKAGE_REASONS = ['Accidental Drop', 'Expired', 'Damaged during transport', 'Defective', 'Worn out'];

export const BreakageLog = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'log' | 'summary'>('log');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    item: '',
    outlet: '',
    quantity: 1,
    reason: BREAKAGE_REASONS[0],
    notes: '',
    date: todayStr,
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });
  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: () => fetchAllPages(endpoints.outlets),
  });
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => fetchAllPages(endpoints.transactions),
  });
  const { data: snapshots = [] } = useQuery<InventorySnapshot[]>({
    queryKey: ['snapshots'],
    queryFn: () => fetchAllPages(endpoints.snapshots),
  });

  const isMonthLocked = snapshots.some((s) => s.month === new Date().toISOString().slice(0, 7));

  const createTransaction = useMutation({
    mutationFn: (tx: any) => api.post(endpoints.transactions, tx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setIsModalOpen(false);
      setFormData({ item: '', outlet: '', quantity: 1, reason: BREAKAGE_REASONS[0], notes: '', date: todayStr });
      setError(null);
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      setError(data?.detail || data?.error || 'Failed to log breakage.');
    },
  });

  const handleLogBreakage = () => {
    setError(null);
    if (!formData.item || !formData.outlet) {
      setError('Item and outlet are required.');
      return;
    }
    if (formData.quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    const selectedItem = items.find((i) => i.id === Number(formData.item));
    if (!selectedItem) return;
    const stock = selectedItem.stocks.find((s) => s.outlet === Number(formData.outlet))?.quantity || 0;
    if (formData.quantity > stock) {
      setError(`Only ${stock} units available at the selected outlet.`);
      return;
    }

    const ref = `BRK-${Date.now().toString().slice(-8)}`;
    createTransaction.mutate({
      ref,
      type: 'BREAKAGE',
      item: Number(formData.item),
      outlet: Number(formData.outlet),
      quantity_delta: -formData.quantity,
      value: formData.quantity * Number(selectedItem.unit_cost),
      reason: formData.reason,
      notes: formData.notes,
      date: formData.date ? `${formData.date}T00:00:00Z` : undefined,
    });
  };

  const breakages = useMemo(
    () => transactions.filter((t) => t.type === 'BREAKAGE'),
    [transactions],
  );

  const { dateRange, setDateRange, filterByDate } = useDateRangeFilter();

  const filteredBreakages = useMemo(
    () => breakages.filter(filterByDate),
    [breakages, filterByDate],
  );

  const chartData = useMemo(
    () =>
      outlets.map((o) => ({
        name: o.name,
        value: filteredBreakages
          .filter((t) => t.outlet === o.id)
          .reduce((acc, t) => acc + Number(t.value), 0),
      })),
    [outlets, filteredBreakages],
  );

  const totalLoss = filteredBreakages.reduce((acc, t) => acc + Number(t.value), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isMonthLocked && (
        <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
          <LockIcon className="w-3 h-3" /> Books locked — breakage cannot be logged for this month
        </div>
      )}
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Breakage Analysis</h2>
          <div className="flex bg-[#F3F4F6] rounded-lg p-1">
            <button
              onClick={() => setActiveTab('log')}
              className={cn(
                'px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all',
                activeTab === 'log' ? 'bg-white text-black shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1A]',
              )}
            >
              Detailed Log
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={cn(
                'px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all',
                activeTab === 'summary' ? 'bg-white text-black shadow-sm' : 'text-[#6B7280] hover:text-[#1A1A1A]',
              )}
            >
              Summary
            </button>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isMonthLocked}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" /> Log New Breakage
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide space-y-6">
        <div className="flex items-center justify-between">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <span className="text-xs text-[#9CA3AF] font-medium">
            {filteredBreakages.length} records · Loss: {formatKD(totalLoss)}
          </span>
        </div>
        {activeTab === 'log' ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ref</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Outlet</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Qty</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Loss</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Staff</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredBreakages.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold">{tx.ref}</td>
                    <td className="px-6 py-4 font-bold">{tx.item_name}</td>
                    <td className="px-6 py-4 text-[10px] font-bold uppercase text-[#9CA3AF]">{tx.outlet_name}</td>
                    <td className="px-6 py-4 text-right text-rose-600 font-bold">-{Math.abs(tx.quantity_delta)}</td>
                    <td className="px-6 py-4 text-right font-light">{formatKD(tx.value)}</td>
                    <td className="px-6 py-4 text-[10px] font-bold uppercase text-[#6B7280]">{tx.reason}</td>
                    <td className="px-6 py-4 text-xs font-medium">{tx.staff_name}</td>
                    <td className="px-6 py-4 text-[10px] font-bold uppercase text-[#9CA3AF]">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {breakages.length === 0 && (
              <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
                No breakage incidents on file
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-8">Breakage by Outlet</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#6B7280' }}
                      width={120}
                    />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1A1A1A" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 flex flex-col justify-center items-center text-center">
              <TrendingDown className="w-12 h-12 text-rose-500 mb-4" />
              <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-widest">Total Period Loss</p>
              <p className="text-4xl font-light tracking-tight text-rose-600">{formatKD(totalLoss)}</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Hammer className="text-rose-600 w-5 h-5" /> Log Breakage
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <select
                  className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                >
                  <option value="">Select an item…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.sku} — {i.name}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    min={1}
                    placeholder="Quantity"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 0 })}
                  />
                  <select
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.outlet}
                    onChange={(e) => setFormData({ ...formData, outlet: e.target.value })}
                  >
                    <option value="">Select outlet…</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                >
                  {BREAKAGE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">Date</label>
                    <input
                      type="date"
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div />
                </div>
                <textarea
                  placeholder="Notes (optional)"
                  className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm h-20 resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogBreakage}
                  disabled={createTransaction.isPending}
                  className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {createTransaction.isPending ? 'Submitting…' : 'Log Incident'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
