'use client';

import React, { useMemo, useState } from 'react';
import {
  PackagePlus,
  Plus,
  Warehouse,
  Truck,
  X,
  Lock as LockIcon,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Item, Supplier, Transaction, Outlet, InventorySnapshot } from '@/types/inventory';
import { formatKD, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DateRangeFilter, useDateRangeFilter } from '@/components/ui/DateRangeFilter';

const PAGE_SIZE = 30;

export const PurchaseManager = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Invoice-level state
  const [invoiceHeader, setInvoiceHeader] = useState({
    supplier: '',
    outlet: '',
    invoiceRef: '', // New editable field
    date: todayStr,
    notes: '',
  });

  const [invoiceItems, setInvoiceItems] = useState<{ itemId: string; qty: number; grossPrice: number; itemDiscount: number }[]>([
    { itemId: '', qty: 1, grossPrice: 0, itemDiscount: 0 },
  ]);

  const [discount, setDiscount] = useState({ type: 'AMOUNT' as 'AMOUNT' | 'PERCENT', value: 0 });

  // Step 1: Apply per-item discounts to get the "after item discount" subtotal
  const afterItemDiscountTotal = useMemo(
    () => invoiceItems.reduce((acc, item) => acc + item.qty * item.grossPrice * (1 - item.itemDiscount / 100), 0),
    [invoiceItems],
  );

  // Gross total (before any discounts) for display
  const grossTotal = useMemo(() => invoiceItems.reduce((acc, item) => acc + item.qty * item.grossPrice, 0), [invoiceItems]);

  // Step 2: Apply invoice-level discount on top of the after-item-discount total
  const netTotal = useMemo(() => {
    if (discount.type === 'AMOUNT') return Math.max(0, afterItemDiscountTotal - discount.value);
    return afterItemDiscountTotal * (1 - discount.value / 100);
  }, [afterItemDiscountTotal, discount]);

  // Ratio for distributing invoice-level discount across line items
  const invoiceDiscountRatio = afterItemDiscountTotal > 0 ? netTotal / afterItemDiscountTotal : 1;

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

  const createTransactions = useMutation({
    mutationFn: async (payloads: any[]) => {
      for (const p of payloads) {
        await api.post(endpoints.transactions, p);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setIsModalOpen(false);
      setEditingTx(null);
      setInvoiceItems([{ itemId: '', qty: 1, grossPrice: 0, itemDiscount: 0 }]);
      setDiscount({ type: 'AMOUNT', value: 0 });
      setInvoiceHeader({ ...invoiceHeader, invoiceRef: '' });
      setError(null);
    },
    onError: (e: any) => setError('Failed to record purchase.'),
  });

  const updateTransaction = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.patch(`${endpoints.transactions}${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setIsModalOpen(false);
      setEditingTx(null);
      setError(null);
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: (id: number) => api.delete(`${endpoints.transactions}${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const handleSaveInvoice = () => {
    setError(null);
    if (!invoiceHeader.outlet) return setError('Destination outlet is required.');
    if (invoiceItems.some((i) => !i.itemId || i.qty <= 0)) return setError('Complete all item lines.');

    const defaultRef = `INV-${Date.now().toString().slice(-6)}`;
    const finalRef = invoiceHeader.invoiceRef || defaultRef;

    const payloads = invoiceItems.map((line) => {
      // Chain: Gross → apply item discount → apply invoice discount
      const afterItemDisc = line.grossPrice * (1 - line.itemDiscount / 100);
      const finalUnitPrice = afterItemDisc * invoiceDiscountRatio;
      return {
        ref: finalRef,
        type: 'PURCHASE',
        item: Number(line.itemId),
        outlet: Number(invoiceHeader.outlet),
        supplier: invoiceHeader.supplier ? Number(invoiceHeader.supplier) : undefined,
        quantity_delta: line.qty,
        value: line.qty * finalUnitPrice,
        notes: invoiceHeader.notes,
        date: `${invoiceHeader.date}T00:00:00Z`,
      };
    });

    if (editingTx) {
      updateTransaction.mutate({ id: editingTx.id, data: payloads[0] });
    } else {
      createTransactions.mutate(payloads);
    }
  };

  const addItemLine = () => setInvoiceItems([...invoiceItems, { itemId: '', qty: 1, grossPrice: 0, itemDiscount: 0 }]);
  const removeItemLine = (idx: number) => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx));

  const openEdit = (tx: Transaction) => {
    setInvoiceHeader({
      supplier: tx.supplier ? String(tx.supplier) : '',
      outlet: String(tx.outlet),
      invoiceRef: tx.ref || '',
      date: tx.date.slice(0, 10),
      notes: tx.notes || '',
    });
    setInvoiceItems([{ itemId: String(tx.item), qty: tx.quantity_delta, grossPrice: tx.quantity_delta ? Number(tx.value) / tx.quantity_delta : 0, itemDiscount: 0 }]);
    setDiscount({ type: 'PERCENT', value: 0 });
    setEditingTx(tx);
    setIsModalOpen(true);
  };

  const handleDelete = (tx: Transaction) => {
    if (confirm(`Delete ${tx.ref}?`)) deleteTransaction.mutate(tx.id);
  };

  const purchases = useMemo(() => transactions.filter((t) => t.type === 'PURCHASE'), [transactions]);
  const { dateRange, setDateRange, filterByDate } = useDateRangeFilter();
  const [searchQuery, setSearchQuery] = useState('');
  const filteredPurchases = useMemo(() => {
    const dateFiltered = purchases.filter(filterByDate);
    if (!searchQuery.trim()) return dateFiltered;
    const q = searchQuery.toLowerCase();
    return dateFiltered.filter((t) =>
      (t.ref || '').toLowerCase().includes(q) ||
      (t.item_name || '').toLowerCase().includes(q) ||
      (t.supplier_name || '').toLowerCase().includes(q)
    );
  }, [purchases, filterByDate, searchQuery]);
  const visiblePurchases = filteredPurchases.slice(0, page * PAGE_SIZE);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isMonthLocked && (
        <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
          <LockIcon className="w-3 h-3" /> Books locked — purchases cannot be recorded
        </div>
      )}

      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <PackagePlus className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Purchase Management</h2>
        </div>
        <button
          onClick={() => {
            setEditingTx(null);
            setInvoiceItems([{ itemId: '', qty: 1, grossPrice: 0, itemDiscount: 0 }]);
            setDiscount({ type: 'AMOUNT', value: 0 });
            setInvoiceHeader({ supplier: '', outlet: '', invoiceRef: '', date: todayStr, notes: '' });
            setError(null);
            setIsModalOpen(true);
          }}
          disabled={isMonthLocked}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" /> New Receive Order
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search ref, item, vendor…"
                className="pl-9 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black placeholder:text-[#9CA3AF] w-56"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <span className="text-xs text-[#9CA3AF] font-medium">{filteredPurchases.length} records</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Stat label="Stock Inbound" value={`+${filteredPurchases.reduce((acc, t) => acc + t.quantity_delta, 0)} units`} color="text-emerald-600" />
          <Stat label="Total Spend" value={formatKD(filteredPurchases.reduce((acc, t) => acc + Number(t.value), 0))} />
        </div>

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
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePurchases.map((tx) => (
                <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold">{tx.ref}</td>
                  <td className="px-6 py-4 font-bold">{tx.item_name}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-tighter">
                      <span className="text-[#1A1A1A]">{tx.supplier_name || '—'}</span>
                      <span className="text-[#9CA3AF]">{tx.outlet_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-emerald-600">+{tx.quantity_delta}</td>
                  <td className="px-6 py-4 text-right font-bold">{formatKD(tx.value)}</td>
                  <td className="px-6 py-4 text-[10px] uppercase font-bold text-[#9CA3AF]">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(tx)} className="text-gray-400 hover:text-black transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(tx)} className="text-gray-400 hover:text-rose-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl p-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-start justify-between mb-6 flex-shrink-0">
                <h2 className="text-xl font-bold">{editingTx ? 'Edit Entry' : 'New Multi-Item Receipt'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-[#6B7280]" /></button>
              </div>

              {error && <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4 text-xs font-medium text-rose-700 shrink-0">{error}</div>}

              <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <Field label="Invoice / Ref #">
                    <input className="w-full p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-900 placeholder:text-emerald-300" value={invoiceHeader.invoiceRef} onChange={(e) => setInvoiceHeader({ ...invoiceHeader, invoiceRef: e.target.value })} placeholder="e.g. INV-998" />
                  </Field>
                  <Field label="Supplier">
                    <select className="w-full p-2.5 bg-gray-50 border border-[#E5E7EB] rounded-xl text-xs font-bold" value={invoiceHeader.supplier} onChange={(e) => setInvoiceHeader({ ...invoiceHeader, supplier: e.target.value })}>
                      <option value="">No supplier</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Destination">
                    <select className="w-full p-2.5 bg-gray-50 border border-[#E5E7EB] rounded-xl text-xs font-bold" value={invoiceHeader.outlet} onChange={(e) => setInvoiceHeader({ ...invoiceHeader, outlet: e.target.value })}>
                      <option value="">Select outlet…</option>
                      {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Date">
                    <input type="date" className="w-full p-2.5 bg-gray-50 border border-[#E5E7EB] rounded-xl text-xs font-bold" value={invoiceHeader.date} onChange={(e) => setInvoiceHeader({ ...invoiceHeader, date: e.target.value })} />
                  </Field>
                  <Field label="Notes">
                    <input className="w-full p-2.5 bg-gray-50 border border-[#E5E7EB] rounded-xl text-xs font-bold" value={invoiceHeader.notes} onChange={(e) => setInvoiceHeader({ ...invoiceHeader, notes: e.target.value })} placeholder="Optional…" />
                  </Field>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#9CA3AF]">Line Items</span>
                    {!editingTx && <button onClick={addItemLine} className="text-[10px] font-black uppercase text-emerald-600 hover:opacity-70 transition-opacity">+ Add Row</button>}
                  </div>
                  <div className="space-y-2">
                    {invoiceItems.map((line, idx) => (
                      <div key={idx} className="flex items-end gap-3 bg-[#F9FAFB] p-3 rounded-2xl border border-[#F3F4F6]">
                        <div className="flex-1">
                          <label className="block text-[8px] font-black uppercase text-[#9CA3AF] mb-1">Item</label>
                          <select className="w-full p-2 bg-white border border-[#E5E7EB] rounded-lg text-xs font-bold" value={line.itemId} onChange={(e) => {
                            const newLines = [...invoiceItems];
                            newLines[idx].itemId = e.target.value;
                            setInvoiceItems(newLines);
                          }}>
                            <option value="">Select item…</option>
                            {items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                          </select>
                        </div>
                        <div className="w-20">
                          <label className="block text-[8px] font-black uppercase text-[#9CA3AF] mb-1">Qty</label>
                          <input type="number" className="w-full p-2 bg-white border border-[#E5E7EB] rounded-lg text-xs font-bold text-center" value={line.qty} onChange={(e) => {
                            const newLines = [...invoiceItems];
                            newLines[idx].qty = Number(e.target.value) || 0;
                            setInvoiceItems(newLines);
                          }} />
                        </div>
                        <div className="w-28">
                          <label className="block text-[8px] font-black uppercase text-[#9CA3AF] mb-1">Unit Price</label>
                          <input type="number" step="0.001" className="w-full p-2 bg-white border border-[#E5E7EB] rounded-lg text-xs font-bold text-right" value={line.grossPrice} onChange={(e) => {
                            const newLines = [...invoiceItems];
                            newLines[idx].grossPrice = Number(e.target.value) || 0;
                            setInvoiceItems(newLines);
                          }} />
                        </div>
                        <div className="w-16">
                          <label className="block text-[8px] font-black uppercase text-[#9CA3AF] mb-1">Disc %</label>
                          <input type="number" min={0} max={100} step="0.01" className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-center text-amber-800" value={line.itemDiscount} onChange={(e) => {
                            const newLines = [...invoiceItems];
                            newLines[idx].itemDiscount = Number(e.target.value) || 0;
                            setInvoiceItems(newLines);
                          }} placeholder="0" />
                        </div>
                        <div className="w-24 text-right pb-3 pr-2">
                          <span className="text-[10px] font-bold text-[#1A1A1A]">{formatKD(line.qty * line.grossPrice * (1 - line.itemDiscount / 100))}</span>
                          {line.itemDiscount > 0 && <span className="block text-[8px] text-rose-400 line-through">{formatKD(line.qty * line.grossPrice)}</span>}
                        </div>
                        {!editingTx && invoiceItems.length > 1 && (
                          <button onClick={() => removeItemLine(idx)} className="pb-3 text-rose-400 hover:text-rose-600 transition-colors"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#F3F4F6] shrink-0 bg-white">
                <div className="flex flex-col md:flex-row items-end justify-between gap-6">
                  <div className="flex items-end gap-4">
                    <div className="w-32">
                      <label className="block text-[10px] font-black uppercase text-[#9CA3AF] mb-1">Invoice Discount</label>
                      <div className="flex bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl overflow-hidden">
                        <select className="bg-transparent text-[10px] font-black px-2 border-r border-[#E5E7EB]" value={discount.type} onChange={(e) => setDiscount({ ...discount, type: e.target.value as 'AMOUNT' | 'PERCENT' })}>
                          <option value="AMOUNT">KD</option>
                          <option value="PERCENT">%</option>
                        </select>
                        <input type="number" className="w-full p-2 bg-transparent text-xs font-bold outline-none" value={discount.value} onChange={(e) => setDiscount({ ...discount, value: Number(e.target.value) || 0 })} />
                      </div>
                    </div>
                    <div className="pb-2">
                      <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Invoice-level adjustment: {((1 - invoiceDiscountRatio) * 100).toFixed(2)}% off each item</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-4 text-xs font-bold text-[#9CA3AF]">
                      <span>Gross: {formatKD(grossTotal)}</span>
                      {afterItemDiscountTotal < grossTotal && <span>After Item Disc: {formatKD(afterItemDiscountTotal)}</span>}
                      {discount.value > 0 && <span>Invoice Disc: -{discount.type === 'AMOUNT' ? formatKD(discount.value) : formatKD(afterItemDiscountTotal * (discount.value / 100))}</span>}
                    </div>
                    <div className="text-3xl font-black tracking-tighter text-[#1A1A1A]">
                      {formatKD(netTotal)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 border border-[#E5E7EB] rounded-2xl font-black text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-colors">Discard</button>
                  <button onClick={handleSaveInvoice} disabled={createTransactions.isPending || updateTransaction.isPending} className="flex-2 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50">
                    {createTransactions.isPending ? 'Saving Multiple Items…' : 'Submit Receipt'}
                  </button>
                </div>
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
