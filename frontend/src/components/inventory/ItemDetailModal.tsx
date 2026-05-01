'use client';

import React, { useMemo } from 'react';
import {
  X,
  PackagePlus,
  Hammer,
  Trash2,
  ArrowRightLeft,
  Scale,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllPages, endpoints } from '@/lib/api';
import { Item, Transaction } from '@/types/inventory';
import { formatKD } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ItemDetailModalProps {
  item: Item;
  isOpen: boolean;
  onClose: () => void;
}

export const ItemDetailModal = ({ item, isOpen, onClose }: ItemDetailModalProps) => {
  const { data: allTransactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => fetchAllPages(endpoints.transactions),
  });

  // Filter transactions for this item
  const itemTx = useMemo(
    () => allTransactions.filter((t) => t.item === item.id),
    [allTransactions, item.id],
  );

  // ── Compute lifecycle metrics ───────────────────────────────────────
  const metrics = useMemo(() => {
    let totalPurchased = 0;
    let totalPurchasedValue = 0;
    let totalBreakage = 0;
    let totalBreakageValue = 0;
    let totalWriteOff = 0;
    let totalWriteOffValue = 0;
    let totalAdjustment = 0;
    let totalAdjustmentValue = 0;
    let totalTransferOut = 0;
    let totalTransferIn = 0;

    itemTx.forEach((tx) => {
      const qty = tx.quantity_delta;
      const val = Number(tx.value);

      switch (tx.type) {
        case 'PURCHASE':
          totalPurchased += qty;
          totalPurchasedValue += val;
          break;
        case 'BREAKAGE':
          totalBreakage += Math.abs(qty);
          totalBreakageValue += val;
          break;
        case 'WRITE_OFF':
          totalWriteOff += Math.abs(qty);
          totalWriteOffValue += val;
          break;
        case 'ADJUSTMENT':
          totalAdjustment += qty;
          totalAdjustmentValue += val;
          break;
        case 'TRANSFER':
          if (qty < 0) totalTransferOut += Math.abs(qty);
          else totalTransferIn += qty;
          break;
      }
    });

    const currentStock = item.stocks.reduce((a, s) => a + s.quantity, 0);
    const expectedStock = totalPurchased + totalAdjustment - totalBreakage - totalWriteOff;
    const variance = currentStock - expectedStock;

    return {
      totalPurchased,
      totalPurchasedValue,
      totalBreakage,
      totalBreakageValue,
      totalWriteOff,
      totalWriteOffValue,
      totalAdjustment,
      totalAdjustmentValue,
      totalTransferOut,
      totalTransferIn,
      currentStock,
      expectedStock,
      variance,
      transactionCount: itemTx.length,
    };
  }, [itemTx, item.stocks]);

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
            className="relative w-full max-w-3xl bg-white rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-black" /> Item Lifecycle
                </h2>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  {item.sku} — {item.name}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mt-1">
                  {item.category_name} • {metrics.transactionCount} transactions on record
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                icon={<PackagePlus className="w-4 h-4" />}
                label="Total Received"
                value={`+${metrics.totalPurchased}`}
                subValue={formatKD(metrics.totalPurchasedValue)}
                color="text-emerald-600"
                bg="bg-emerald-50"
                border="border-emerald-100"
              />
              <MetricCard
                icon={<TrendingUp className="w-4 h-4" />}
                label="In Stock Now"
                value={String(metrics.currentStock)}
                subValue={formatKD(metrics.currentStock * Number(item.unit_cost))}
                color="text-black"
                bg="bg-gray-50"
                border="border-gray-200"
              />
              <MetricCard
                icon={<Hammer className="w-4 h-4" />}
                label="Total Breakage"
                value={`-${metrics.totalBreakage}`}
                subValue={formatKD(metrics.totalBreakageValue)}
                color="text-amber-600"
                bg="bg-amber-50"
                border="border-amber-100"
              />
              <MetricCard
                icon={<Trash2 className="w-4 h-4" />}
                label="Total Write-off"
                value={`-${metrics.totalWriteOff}`}
                subValue={formatKD(metrics.totalWriteOffValue)}
                color="text-rose-600"
                bg="bg-rose-50"
                border="border-rose-100"
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Adjustments</span>
                </div>
                <p className="text-lg font-bold text-violet-600">
                  {metrics.totalAdjustment >= 0 ? '+' : ''}{metrics.totalAdjustment}
                </p>
              </div>
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Transfers</span>
                </div>
                <p className="text-sm font-bold">
                  <span className="text-rose-500">↑ {metrics.totalTransferOut} out</span>
                  {' · '}
                  <span className="text-emerald-500">↓ {metrics.totalTransferIn} in</span>
                </p>
              </div>
              <div className={`border rounded-2xl p-4 ${
                metrics.variance === 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : metrics.variance < 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {metrics.variance === 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  )}
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Variance</span>
                </div>
                <p className={`text-lg font-bold ${
                  metrics.variance === 0
                    ? 'text-emerald-600'
                    : metrics.variance < 0
                    ? 'text-rose-600'
                    : 'text-amber-600'
                }`}>
                  {metrics.variance === 0
                    ? '✓ Balanced'
                    : `${metrics.variance > 0 ? '+' : ''}${metrics.variance}`}
                </p>
              </div>
            </div>

            {/* Variance Explanation */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-4 mb-6">
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Variance Breakdown</p>
              <div className="grid grid-cols-1 gap-1 text-xs font-mono">
                <Row label="Purchased (POs)" value={`+${metrics.totalPurchased}`} color="text-emerald-600" />
                <Row label="Adjustments (Opening Bal)" value={`${metrics.totalAdjustment >= 0 ? '+' : ''}${metrics.totalAdjustment}`} color="text-violet-600" />
                <Row label="Breakage" value={`-${metrics.totalBreakage}`} color="text-amber-600" />
                <Row label="Write-offs" value={`-${metrics.totalWriteOff}`} color="text-rose-600" />
                <div className="border-t border-dashed border-[#D1D5DB] my-1" />
                <Row label="Expected Stock" value={String(metrics.expectedStock)} color="text-[#1A1A1A]" bold />
                <Row label="Actual Stock" value={String(metrics.currentStock)} color="text-[#1A1A1A]" bold />
                <div className="border-t border-[#D1D5DB] my-1" />
                <Row
                  label="Variance (Actual − Expected)"
                  value={`${metrics.variance > 0 ? '+' : ''}${metrics.variance}`}
                  color={metrics.variance === 0 ? 'text-emerald-600' : 'text-rose-600'}
                  bold
                />
              </div>
              {metrics.variance < 0 && (
                <p className="text-[10px] text-rose-600 font-medium mt-3">
                  ⚠ Negative variance indicates unaccounted loss (shrinkage, theft, or unrecorded breakage/transfers).
                </p>
              )}
              {metrics.variance > 0 && (
                <p className="text-[10px] text-amber-600 font-medium mt-3">
                  ⚠ Positive variance suggests items appeared without a PO — check for unrecorded purchases or data entry errors.
                </p>
              )}
            </div>

            {/* Stock by Outlet */}
            <div className="mb-2">
              <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-3">Current Stock by Outlet</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {item.stocks.map((s) => (
                  <div key={s.outlet} className="bg-white border border-[#E5E7EB] rounded-xl p-3">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{s.outlet_name}</p>
                    <p className="text-lg font-bold text-[#1A1A1A]">{s.quantity} <span className="text-xs font-normal text-[#9CA3AF]">{item.unit}</span></p>
                  </div>
                ))}
                {item.stocks.length === 0 && (
                  <p className="text-xs text-[#9CA3AF] col-span-full">No stock at any outlet</p>
                )}
              </div>
            </div>

            {/* Close */}
            <div className="mt-6">
              <button
                onClick={onClose}
                className="w-full py-3 border border-[#E5E7EB] rounded-xl text-xs font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────

const MetricCard = ({
  icon, label, value, subValue, color, bg, border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  color: string;
  bg: string;
  border: string;
}) => (
  <div className={`${bg} border ${border} rounded-2xl p-4`}>
    <div className="flex items-center gap-2 mb-2">
      <span className={color}>{icon}</span>
      <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
    <p className="text-[10px] font-medium text-[#9CA3AF] mt-0.5">{subValue}</p>
  </div>
);

const Row = ({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) => (
  <div className="flex justify-between items-center py-0.5">
    <span className={`text-[#6B7280] ${bold ? 'font-bold' : ''}`}>{label}</span>
    <span className={`${color} ${bold ? 'font-bold' : 'font-medium'}`}>{value}</span>
  </div>
);
