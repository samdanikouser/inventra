'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  ArrowRight,
  CheckCircle2,
  X,
  PackagePlus,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Item, Outlet, Supplier } from '@/types/inventory';
import { formatKD, cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/auth/AuthProvider';

export const ReorderList = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();

  const [poItem, setPoItem] = useState<Item | null>(null);
  const [poSupplier, setPoSupplier] = useState<number | ''>('');
  const [poOutlet, setPoOutlet] = useState<number | ''>('');
  const [poQty, setPoQty] = useState(0);
  const [poCost, setPoCost] = useState(0);
  const [poError, setPoError] = useState<string | null>(null);

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });
  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: () => fetchAllPages(endpoints.outlets),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetchAllPages(endpoints.suppliers),
  });

  const reorderItems = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          totalStock: item.stocks.reduce((acc, s) => acc + s.quantity, 0),
        }))
        .filter((item) => item.totalStock <= item.min_stock)
        .sort((a, b) => a.totalStock - b.totalStock),
    [items],
  );

  const createPo = useMutation({
    mutationFn: (tx: any) => api.post(endpoints.transactions, tx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setPoItem(null);
    },
    onError: (e: any) =>
      setPoError(e?.response?.data?.detail || e?.response?.data?.error || 'Failed to create PO.'),
  });

  const openPo = (item: Item & { totalStock: number }) => {
    setPoError(null);
    setPoItem(item);
    setPoSupplier('');
    setPoOutlet(item.stocks[0]?.outlet || (outlets[0]?.id ?? ''));
    setPoQty(Math.max(item.par_level - item.totalStock, 1));
    setPoCost(Number(item.unit_cost));
  };

  const submitPo = () => {
    if (!poItem) return;
    setPoError(null);
    if (!poOutlet) {
      setPoError('Destination outlet required.');
      return;
    }
    if (poQty <= 0 || poCost <= 0) {
      setPoError('Quantity and unit cost must be greater than zero.');
      return;
    }
    createPo.mutate({
      ref: `PO-${Date.now().toString().slice(-8)}`,
      type: 'PURCHASE',
      item: poItem.id,
      outlet: Number(poOutlet),
      supplier: poSupplier ? Number(poSupplier) : undefined,
      quantity_delta: poQty,
      value: poQty * poCost,
    });
  };

  const handleExportDraftPO = () => {
    const rows = [
      ['SKU', 'Name', 'Total Stock', 'Min Stock', 'Par Level', 'Reorder Qty', 'Unit Cost (KD)'],
      ...reorderItems.map((i) => [
        i.sku,
        i.name,
        String(i.totalStock),
        String(i.min_stock),
        String(i.par_level),
        String(Math.max(i.par_level - i.totalStock, 0)),
        String(i.unit_cost),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventra-reorder-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
            <AlertCircle className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Critical Reorder List</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{reorderItems.length} items below threshold</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportDraftPO}
            disabled={reorderItems.length === 0}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-gray-50 disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Export PO Draft
          </button>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        {reorderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30">
            <CheckCircle2 className="w-16 h-16 mb-4" />
            <p className="text-xl font-bold uppercase tracking-widest italic">All assets at optimal levels</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reorderItems.map((item) => {
              const urgency = item.totalStock === 0 ? 'CRITICAL' : 'LOW';
              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#E5E7EB] rounded-3xl p-6 shadow-sm hover:border-amber-500 transition-all group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className={cn(
                        'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter',
                        urgency === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : 'bg-amber-50 text-amber-600 border border-amber-100',
                      )}
                    >
                      {urgency}
                    </div>
                    <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">{item.category_name}</span>
                  </div>

                  <h3 className="text-lg font-bold mb-1">{item.name}</h3>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-6">{item.sku}</p>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold text-[#6B7280] uppercase">Available</span>
                      <span className="text-xl font-light text-rose-600">
                        {item.totalStock} / {item.par_level} {item.unit}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500"
                        style={{
                          width: `${Math.min((item.totalStock / Math.max(item.par_level, 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[#9CA3AF]">
                      Suggested order:{' '}
                      <span className="font-bold text-[#1A1A1A]">
                        {Math.max(item.par_level - item.totalStock, 0)} units
                      </span>{' '}
                      • Estimated:{' '}
                      <span className="font-bold text-[#1A1A1A]">
                        {formatKD(Math.max(item.par_level - item.totalStock, 0) * Number(item.unit_cost))}
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() => openPo(item)}
                    disabled={!isManager}
                    className="w-full py-4 bg-gray-50 group-hover:bg-black group-hover:text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isManager ? (
                      <>
                        Generate PO <ArrowRight className="w-3 h-3" />
                      </>
                    ) : (
                      'Manager approval required'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {poItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPoItem(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <PackagePlus className="w-5 h-5 text-emerald-600" /> Generate Purchase Order
                  </h2>
                  <p className="text-sm text-[#6B7280]">
                    {poItem.sku} — {poItem.name}
                  </p>
                </div>
                <button
                  onClick={() => setPoItem(null)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>
              {poError && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4 text-xs font-medium text-rose-700">
                  {poError}
                </div>
              )}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      Destination Outlet
                    </label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={poOutlet}
                      onChange={(e) => setPoOutlet(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">Select…</option>
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      Supplier (optional)
                    </label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={poSupplier}
                      onChange={(e) => setPoSupplier(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">No supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={poQty}
                      onChange={(e) => setPoQty(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      Unit Cost (KD)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.001"
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={poCost}
                      onChange={(e) => setPoCost(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#6B7280]">
                  Total: <span className="font-bold text-[#1A1A1A]">{formatKD(poQty * poCost)}</span>
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setPoItem(null)}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-xl font-bold uppercase text-xs tracking-widest text-[#6B7280] hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitPo}
                  disabled={createPo.isPending}
                  className="flex-1 py-3 bg-black text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:opacity-80 disabled:opacity-50"
                >
                  {createPo.isPending ? 'Submitting…' : 'Confirm PO'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
