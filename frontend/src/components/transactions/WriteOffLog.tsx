'use client';

import React, { useMemo, useState } from 'react';
import { Trash2, Plus, X, Lock as LockIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Transaction, Item, Outlet, InventorySnapshot } from '@/types/inventory';
import { formatKD } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DateRangeFilter, useDateRangeFilter } from '@/components/ui/DateRangeFilter';

const WRITE_OFF_REASONS = ['Expired', 'Damaged', 'Theft', 'Obsolete', 'Health & Safety', 'Other'];

export const WriteOffLog = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    item: '',
    outlet: '',
    quantity: 1,
    reason: WRITE_OFF_REASONS[0],
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
      setFormData({ item: '', outlet: '', quantity: 1, reason: WRITE_OFF_REASONS[0], notes: '', date: todayStr });
      setError(null);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail || e?.response?.data?.error || 'Failed to record write-off.');
    },
  });

  const handleWriteOff = () => {
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

    const ref = `WO-${Date.now().toString().slice(-8)}`;
    createTransaction.mutate({
      ref,
      type: 'WRITE_OFF',
      item: Number(formData.item),
      outlet: Number(formData.outlet),
      quantity_delta: -formData.quantity,
      value: formData.quantity * Number(selectedItem.unit_cost),
      reason: formData.reason,
      notes: formData.notes,
      date: formData.date ? `${formData.date}T00:00:00Z` : undefined,
    });
  };

  const writeOffs = useMemo(
    () => transactions.filter((t) => t.type === 'WRITE_OFF'),
    [transactions],
  );

  const { dateRange, setDateRange, filterByDate } = useDateRangeFilter();

  const filteredWriteOffs = useMemo(
    () => writeOffs.filter(filterByDate),
    [writeOffs, filterByDate],
  );

  const totalLoss = filteredWriteOffs.reduce((acc, t) => acc + Number(t.value), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isMonthLocked && (
        <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
          <LockIcon className="w-3 h-3" /> Books locked — write-offs cannot be recorded for this month
        </div>
      )}

      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
            <Trash2 className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Write-Off Ledger</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Total period loss: {formatKD(totalLoss)}</span>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isMonthLocked}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" /> Record Write-off
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-6 scrollbar-hide">
        <div className="flex items-center justify-between">
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <span className="text-xs text-[#9CA3AF] font-medium">
            {filteredWriteOffs.length} records
          </span>
        </div>
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
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Approved By</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredWriteOffs.map((tx) => (
                <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold">{tx.ref}</td>
                  <td className="px-6 py-4 font-bold">{tx.item_name}</td>
                  <td className="px-6 py-4 text-[10px] font-bold uppercase text-[#9CA3AF]">{tx.outlet_name}</td>
                  <td className="px-6 py-4 text-right text-rose-600 font-bold">-{Math.abs(tx.quantity_delta)}</td>
                  <td className="px-6 py-4 text-right font-light">{formatKD(tx.value)}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-md text-[9px] font-black uppercase tracking-wider">
                      {tx.reason}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">{tx.staff_name}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-[#9CA3AF]">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {writeOffs.length === 0 && (
            <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
              No write-offs on file
            </p>
          )}
        </div>
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
                  <Trash2 className="text-rose-600 w-5 h-5" /> Record Write-off
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
                  {WRITE_OFF_REASONS.map((r) => (
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
                  onClick={handleWriteOff}
                  disabled={createTransaction.isPending}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                >
                  {createTransaction.isPending ? 'Submitting…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
