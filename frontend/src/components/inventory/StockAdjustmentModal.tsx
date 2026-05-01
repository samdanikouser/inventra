'use client';

import React, { useState, useEffect } from 'react';
import { Scale, X, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints } from '@/lib/api';
import { Item, Outlet } from '@/types/inventory';
import { motion, AnimatePresence } from 'motion/react';

interface StockAdjustmentModalProps {
  item: Item;
  outlets: Outlet[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * "Set Stock Levels" modal.
 *
 * Shows all outlets with their current system quantity and lets the user
 * enter the actual physical count. On save, creates ADJUSTMENT transactions
 * for every outlet whose quantity changed.
 *
 * Use cases:
 *  - Opening balances (initial stock seeding)
 *  - Physical count corrections without a full Stock Take session
 *  - Ad-hoc adjustments for discrepancies
 */
export const StockAdjustmentModal = ({ item, outlets, isOpen, onClose }: StockAdjustmentModalProps) => {
  const queryClient = useQueryClient();

  // Map of outlet ID → new physical quantity
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Initialize quantities from current stock levels whenever the item changes
  useEffect(() => {
    if (!isOpen) return;
    const init: Record<number, number> = {};
    outlets.forEach((o) => {
      const stock = item.stocks.find((s) => s.outlet === o.id);
      init[o.id] = stock?.quantity ?? 0;
    });
    setQuantities(init);
    setError(null);
    setProgress({ current: 0, total: 0 });
  }, [isOpen, item.id, outlets]);

  const getSystemQty = (outletId: number) =>
    item.stocks.find((s) => s.outlet === outletId)?.quantity ?? 0;

  // Count how many outlets have changes
  const changedOutlets = outlets.filter((o) => {
    const systemQty = getSystemQty(o.id);
    const newQty = quantities[o.id] ?? systemQty;
    return newQty !== systemQty;
  });

  const totalNewStock = outlets.reduce((acc, o) => acc + (quantities[o.id] ?? 0), 0);
  const totalCurrentStock = item.stocks.reduce((acc, s) => acc + s.quantity, 0);
  const totalDelta = totalNewStock - totalCurrentStock;

  const handleSave = async () => {
    if (changedOutlets.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    setProgress({ current: 0, total: changedOutlets.length });

    try {
      for (let i = 0; i < changedOutlets.length; i++) {
        const outlet = changedOutlets[i];
        const systemQty = getSystemQty(outlet.id);
        const newQty = quantities[outlet.id] ?? systemQty;
        const delta = newQty - systemQty;

        if (delta === 0) continue;

        const ref = `ADJ-${Date.now().toString().slice(-6)}-${outlet.id}`;
        await api.post(endpoints.transactions, {
          ref,
          type: 'ADJUSTMENT',
          item: item.id,
          outlet: outlet.id,
          quantity_delta: delta,
          value: Math.abs(delta) * Number(item.unit_cost),
          reason: 'Opening balance / Stock adjustment',
          notes: `Set stock from ${systemQty} → ${newQty} at ${outlet.name}`,
        });

        setProgress({ current: i + 1, total: changedOutlets.length });
      }

      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    } catch (e: any) {
      const data = e?.response?.data;
      setError(
        data?.detail || data?.error || 'Failed to save adjustments. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Scale className="text-violet-600 w-5 h-5" /> Set Stock Levels
                </h2>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {item.sku} — {item.name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {/* Info banner */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex gap-3 mb-6 mt-4">
              <AlertCircle className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-violet-900 uppercase tracking-wide">
                  Opening Balance / Adjustment
                </p>
                <p className="text-sm text-violet-800 leading-relaxed">
                  Enter the actual physical count at each outlet. The system will create
                  adjustment transactions for the difference, preserving full audit trail.
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            {/* Outlet table */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden mb-6">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                      Outlet
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">
                      System Qty
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">
                      Actual Qty
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {outlets.map((outlet) => {
                    const systemQty = getSystemQty(outlet.id);
                    const newQty = quantities[outlet.id] ?? systemQty;
                    const variance = newQty - systemQty;

                    return (
                      <tr
                        key={outlet.id}
                        className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors"
                      >
                        <td className="px-6 py-3">
                          <div className="font-bold text-[#1A1A1A]">{outlet.name}</div>
                          <div className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">
                            {outlet.location || 'Central'}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="text-sm font-medium text-[#6B7280]">
                            {systemQty}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <input
                            type="number"
                            min={0}
                            className="w-24 mx-auto p-2 bg-gray-50 border border-[#E5E7EB] rounded-lg text-sm text-center font-bold focus:outline-none focus:border-black transition-colors"
                            value={newQty}
                            onChange={(e) =>
                              setQuantities({
                                ...quantities,
                                [outlet.id]: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            disabled={saving}
                          />
                        </td>
                        <td className="px-6 py-3 text-center">
                          {variance !== 0 ? (
                            <span
                              className={`text-sm font-bold ${
                                variance > 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {variance > 0 ? '+' : ''}{variance}
                            </span>
                          ) : (
                            <span className="text-sm text-[#D1D5DB]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                  <tr>
                    <td className="px-6 py-3 text-[10px] font-bold text-[#1A1A1A] uppercase tracking-wider">
                      Totals
                    </td>
                    <td className="px-6 py-3 text-center font-bold text-[#6B7280]">
                      {totalCurrentStock}
                    </td>
                    <td className="px-6 py-3 text-center font-bold text-[#1A1A1A]">
                      {totalNewStock}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {totalDelta !== 0 ? (
                        <span
                          className={`font-bold ${
                            totalDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {totalDelta > 0 ? '+' : ''}{totalDelta}
                        </span>
                      ) : (
                        <span className="text-[#D1D5DB]">—</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Summary */}
            {changedOutlets.length > 0 && (
              <p className="text-[11px] text-[#6B7280] mb-6">
                This will create <span className="font-bold text-[#1A1A1A]">{changedOutlets.length} adjustment transaction{changedOutlets.length > 1 ? 's' : ''}</span>{' '}
                with reason <span className="font-bold text-violet-600">"Opening balance / Stock adjustment"</span>.
              </p>
            )}

            {/* Progress bar */}
            {saving && progress.total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                  <span>Processing adjustments…</span>
                  <span>{progress.current}/{progress.total}</span>
                </div>
                <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-600 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 py-3 border border-[#E5E7EB] rounded-xl text-xs font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || changedOutlets.length === 0}
                className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : changedOutlets.length === 0
                  ? 'No Changes'
                  : `Apply ${changedOutlets.length} Adjustment${changedOutlets.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
