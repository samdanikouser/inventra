'use client';

import React, { useMemo, useState } from 'react';
import {
  PackagePlus,
  Plus,
  Warehouse,
  Truck,
  X,
  Lock as LockIcon,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Item, Supplier, Transaction, Outlet, InventorySnapshot } from '@/types/inventory';
import { formatKD, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const PAGE_SIZE = 30;

export const PurchaseManager = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const todayStr = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    item: '',
    outlet: '',
    supplier: '',
    quantity_delta: 0,
    unitCost: 0,
    notes: '',
    date: todayStr,
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetchAllPages(endpoints.suppliers),
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
      setFormData({ item: '', outlet: '', supplier: '', quantity_delta: 0, unitCost: 0, notes: '', date: todayStr });
      setError(null);
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      setError(data?.detail || data?.error || 'Failed to record purchase. Please retry.');
    },
  });

  const handlePurchase = () => {
    setError(null);
    if (!formData.item || !formData.outlet) {
      setError('Item and destination outlet are required.');
      return;
    }
    if (formData.quantity_delta <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (formData.unitCost <= 0) {
      setError('Unit cost must be greater than zero.');
      return;
    }
    const ref = `PO-${Date.now().toString().slice(-8)}`;
    createTransaction.mutate({
      ref,
      type: 'PURCHASE',
      item: Number(formData.item),
      outlet: Number(formData.outlet),
      supplier: formData.supplier ? Number(formData.supplier) : undefined,
      quantity_delta: formData.quantity_delta,
      value: formData.quantity_delta * formData.unitCost,
      notes: formData.notes,
      date: formData.date ? `${formData.date}T00:00:00Z` : undefined,
    });
  };

  const purchases = useMemo(
    () => transactions.filter((t) => t.type === 'PURCHASE'),
    [transactions],
  );

  const monthInbound = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return purchases.filter((p) => p.date.startsWith(m));
  }, [purchases]);

  const visiblePurchases = purchases.slice(0, page * PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isMonthLocked && (
        <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
          <LockIcon className="w-3 h-3" /> Books locked — purchases cannot be recorded for this month
        </div>
      )}

      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <PackagePlus className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Purchase Management</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Inbound Stock & Procurement</span>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={isMonthLocked}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" /> New Purchase Order
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Stat label="Active POs" value={String(purchases.length)} />
          <Stat
            label="Stock Inbound (MTD)"
            value={`+${monthInbound.reduce((acc, t) => acc + t.quantity_delta, 0)} units`}
            color="text-emerald-600"
          />
          <Stat
            label="Total Spend (MTD)"
            value={formatKD(monthInbound.reduce((acc, t) => acc + Number(t.value), 0))}
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">Recent Purchase Ledger</h3>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ref</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Vendor & Target</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Qty</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Value</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {visiblePurchases.map((tx) => (
                  <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-bold">{tx.ref}</td>
                    <td className="px-6 py-4 font-bold">{tx.item_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3 h-3 text-[#6B7280]" />
                          <span className="text-[10px] font-bold">{tx.supplier_name || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[#9CA3AF]">
                          <Warehouse className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase">{tx.outlet_name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">+{tx.quantity_delta}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatKD(tx.value)}</td>
                    <td className="px-6 py-4 text-[10px] uppercase font-bold text-[#9CA3AF]">
                      {new Date(tx.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {purchases.length > visiblePurchases.length && (
              <div className="text-center p-4">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="px-6 py-2 border border-[#E5E7EB] rounded-lg text-[10px] font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50"
                >
                  Load more ({purchases.length - visiblePurchases.length} more)
                </button>
              </div>
            )}
            {purchases.length === 0 && (
              <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
                No purchases recorded yet
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
                  <PackagePlus className="text-emerald-600 w-5 h-5" /> New Purchase Order
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
                <Field label="Item">
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
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Supplier">
                    <select
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    >
                      <option value="">No supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Destination">
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
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Quantity">
                    <input
                      type="number"
                      min={1}
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={formData.quantity_delta}
                      onChange={(e) =>
                        setFormData({ ...formData, quantity_delta: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                  <Field label="Unit Cost (KD)">
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={formData.unitCost}
                      onChange={(e) =>
                        setFormData({ ...formData, unitCost: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-[11px] text-[#6B7280] flex items-end">
                    Total: <span className="font-bold text-[#1A1A1A] ml-1">{formatKD(formData.quantity_delta * formData.unitCost)}</span>
                  </div>
                  <Field label="Date">
                    <input
                      type="date"
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm h-20 resize-none"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </Field>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={createTransaction.isPending}
                  className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {createTransaction.isPending ? 'Submitting…' : 'Confirm Order'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
    <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">{label}</p>
    <p className={cn('text-2xl font-light tracking-tight', color || 'text-[#1A1A1A]')}>{value}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">{label}</label>
    {children}
  </div>
);
