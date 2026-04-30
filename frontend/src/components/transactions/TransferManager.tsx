'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Plus,
  ArrowRight,
  X,
  CheckCircle2,
  Lock as LockIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Item, Transaction, Outlet, InventorySnapshot } from '@/types/inventory';
import { formatKD } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export const TransferManager = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    item: '',
    outlet: '',
    target_outlet: '',
    quantity: 0,
    notes: '',
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
      setFormData({ item: '', outlet: '', target_outlet: '', quantity: 0, notes: '' });
      setError(null);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.detail || e?.response?.data?.error || 'Failed to execute transfer.');
    },
  });

  const handleTransfer = () => {
    setError(null);
    if (!formData.item || !formData.outlet || !formData.target_outlet) {
      setError('Item, source, and target outlet are required.');
      return;
    }
    if (formData.outlet === formData.target_outlet) {
      setError('Source and target outlets must differ.');
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
      setError(`Only ${stock} units available at the source outlet.`);
      return;
    }

    const ref = `TRF-${Date.now().toString().slice(-8)}`;
    createTransaction.mutate({
      ref,
      type: 'TRANSFER',
      item: Number(formData.item),
      outlet: Number(formData.outlet),
      target_outlet: Number(formData.target_outlet),
      quantity_delta: -formData.quantity,
      value: formData.quantity * Number(selectedItem.unit_cost),
      notes: formData.notes,
    });
  };

  const transfers = useMemo(
    () => transactions.filter((t) => t.type === 'TRANSFER'),
    [transactions],
  );

  const monthlyVolume = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return transfers
      .filter((t) => t.date.startsWith(m))
      .reduce((acc, t) => acc + Math.abs(t.quantity_delta), 0);
  }, [transfers]);

  const monthlyValue = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return transfers
      .filter((t) => t.date.startsWith(m))
      .reduce((acc, t) => acc + Number(t.value), 0);
  }, [transfers]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isMonthLocked && (
        <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
          <LockIcon className="w-3 h-3" /> Books locked — transfers cannot be executed for this month
        </div>
      )}

      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Stock Transfers</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Inter-outlet logistics</span>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isMonthLocked}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" /> Initialize New Transfer
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
            <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Total Transfers</p>
            <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{transfers.length}</p>
          </div>
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
            <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Volume Moved (MTD)</p>
            <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{monthlyVolume} units</p>
          </div>
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
            <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Value Moved (MTD)</p>
            <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{formatKD(monthlyValue)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">Recent Transfers</h3>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ref</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Route</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Qty</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Staff</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold">{tx.ref}</td>
                    <td className="px-6 py-4 font-bold">{tx.item_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 rounded-md text-[#6B7280]">
                          {tx.outlet_name}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 rounded-md text-blue-600">
                          {tx.target_outlet_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">{Math.abs(tx.quantity_delta)}</td>
                    <td className="px-6 py-4 text-xs font-medium">{tx.staff_name}</td>
                    <td className="px-6 py-4 text-[10px] uppercase font-bold text-[#9CA3AF]">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Completed</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transfers.length === 0 && (
              <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
                No transfers recorded yet
              </p>
            )}
          </div>
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
                  <ArrowRightLeft className="text-blue-600 w-5 h-5" /> Stock Transfer
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
                <div className="grid grid-cols-2 gap-4">
                  <select
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.outlet}
                    onChange={(e) => setFormData({ ...formData, outlet: e.target.value })}
                  >
                    <option value="">Source outlet</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.target_outlet}
                    onChange={(e) => setFormData({ ...formData, target_outlet: e.target.value })}
                  >
                    <option value="">Target outlet</option>
                    {outlets
                      .filter((o) => o.id !== Number(formData.outlet))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </div>
                <select
                  className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                  value={formData.item}
                  onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                >
                  <option value="">Select an item…</option>
                  {items.map((i) => {
                    const stock = i.stocks.find((s) => s.outlet === Number(formData.outlet))?.quantity || 0;
                    return (
                      <option key={i.id} value={i.id}>
                        {i.sku} — {i.name} ({stock} on hand)
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Quantity"
                  className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) || 0 })}
                />
                <textarea
                  placeholder="Reason / notes"
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
                  onClick={handleTransfer}
                  disabled={createTransaction.isPending}
                  className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-80 disabled:opacity-50"
                >
                  {createTransaction.isPending ? 'Transferring…' : 'Execute Transfer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
