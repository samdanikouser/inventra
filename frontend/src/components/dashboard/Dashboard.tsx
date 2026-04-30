'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Package,
  ArrowRight,
  PackagePlus,
  ArrowRightLeft,
  Hammer,
  Trash2,
  Plus,
  X,
  Lock as LockIcon,
  Download
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { endpoints, fetchAllPages, downloadCsv } from '@/lib/api';
import { formatKD, cn } from '@/lib/utils';
import { Item, Transaction, InventorySnapshot } from '@/types/inventory';
import { useAuth } from '@/components/auth/AuthProvider';

export const Dashboard = () => {
  const router = useRouter();
  const { role, user } = useAuth();
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => fetchAllPages(endpoints.transactions),
  });

  const { data: snapshots = [] } = useQuery<InventorySnapshot[]>({
    queryKey: ['snapshots'],
    queryFn: () => fetchAllPages(endpoints.snapshots),
  });

  const breakageTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'BREAKAGE'),
    [transactions],
  );

  const totalAssetValue = useMemo(
    () =>
      items.reduce((acc, item) => {
        const itemTotal = item.stocks.reduce((a, b) => a + b.quantity, 0);
        return acc + itemTotal * Number(item.unit_cost);
      }, 0),
    [items],
  );

  const lowStockItems = useMemo(
    () => items.filter((item) => item.stocks.some((s) => s.quantity < item.min_stock)),
    [items],
  );
  const lowStockCount = lowStockItems.length;

  const monthlyBreakageKD = useMemo(() => {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    return breakageTransactions
      .filter((t) => t.date.startsWith(month))
      .reduce((acc, t) => acc + Math.abs(Number(t.value)), 0);
  }, [breakageTransactions]);

  const movementData = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });
    return last7.map((date) => {
      const day = transactions.filter((t) => t.date.startsWith(date));
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        purchases: day
          .filter((t) => t.type === 'PURCHASE')
          .reduce((acc, t) => acc + Number(t.value), 0),
        transfers: day
          .filter((t) => t.type === 'TRANSFER')
          .reduce((acc, t) => acc + Number(t.value), 0),
      };
    });
  }, [transactions]);

  const topBroken = useMemo(() => {
    return items
      .map((item) => {
        const value = breakageTransactions
          .filter((t) => t.item === item.id)
          .reduce((acc, t) => acc + Math.abs(Number(t.value)), 0);
        return { ...item, totalValue: value };
      })
      .filter((i) => i.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 8);
  }, [items, breakageTransactions]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isMonthLocked = snapshots.some((s) => s.month === currentMonth);

  const stats = [
    ...(role === 'MANAGER'
      ? [{ label: 'TOTAL ASSET VALUE', value: formatKD(totalAssetValue), color: 'text-[#1A1A1A]' }]
      : []),
    {
      label: 'LOW STOCK ALERTS',
      value: `${lowStockCount} items`,
      color: 'text-[#EF4444]',
    },
    { label: 'BREAKAGE (MTD)', value: formatKD(monthlyBreakageKD), color: 'text-orange-600' },
    ...(role === 'MANAGER'
      ? [{ label: 'ASSETS UNDER MGMT', value: `${items.length}`, color: 'text-emerald-600' }]
      : []),
  ];

  const handleExport = async () => {
    setExportingCsv(true);
    try {
      await downloadCsv(
        endpoints.itemsExport,
        `inventra-items-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (e) {
      console.error('Export failed', e);
      alert('Export failed. Please ensure you have manager access.');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isMonthLocked && (
        <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
          <LockIcon className="w-3 h-3" />
          Period Secured:{' '}
          {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} books are locked
        </div>
      )}

      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">
            {user ? `Welcome, ${user.full_name || user.username}` : 'Executive Overview'}
          </h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {role === 'MANAGER' && (
            <button
              onClick={handleExport}
              disabled={exportingCsv}
              className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> {exportingCsv ? 'Exporting…' : 'Export Data'}
            </button>
          )}
          {role === 'MANAGER' && !isMonthLocked && (
            <button
              onClick={() => router.push('/monthly-closing')}
              className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              <LockIcon className="w-3.5 h-3.5" /> Close Month
            </button>
          )}
          {role !== 'STAFF' && (
            <button
              onClick={() => setIsActionsOpen(true)}
              disabled={isMonthLocked}
              className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> {isMonthLocked ? 'System Locked' : 'New Transaction'}
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {isActionsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsActionsOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] border border-[#E5E7EB] shadow-2xl p-8 overflow-hidden"
            >
              <div className="mb-8 flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold italic tracking-tight">Quick Action Launchpad</h2>
                  <p className="text-sm text-[#6B7280]">Select a transaction module to initiate work.</p>
                </div>
                <button
                  onClick={() => setIsActionsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Purchases', id: 'purchases', icon: PackagePlus, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Inbound POs', href: '/purchases' },
                  { label: 'Transfers', id: 'transfers', icon: ArrowRightLeft, color: 'text-blue-600', bg: 'bg-blue-50', desc: 'Inter-outlet', href: '/transfers' },
                  { label: 'Breakage', id: 'breakage', icon: Hammer, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Asset loss', href: '/breakage' },
                  { label: 'Write-off', id: 'write-offs', icon: Trash2, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Disposals', href: '/write-offs' },
                  { label: 'Closing', id: 'monthly-closing', icon: LockIcon, color: 'text-gray-900', bg: 'bg-gray-100', desc: 'Monthly Seal', href: '/monthly-closing' },
                ]
                  .filter((a) => {
                    if (role === 'MANAGER') return true;
                    if (role === 'SUPERVISOR') return !['write-offs', 'monthly-closing'].includes(a.id);
                    return ['purchases', 'transfers', 'breakage'].includes(a.id);
                  })
                  .map((action) => (
                    <button
                      key={action.id}
                      onClick={() => {
                        router.push(action.href);
                        setIsActionsOpen(false);
                      }}
                      className="p-6 rounded-2xl border border-[#E5E7EB] hover:border-black hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col gap-3 group"
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', action.bg)}>
                        <action.icon className={cn('w-5 h-5', action.color)} />
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-tight">{action.label}</p>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{action.desc}</p>
                      </div>
                    </button>
                  ))}
              </div>

              <button
                onClick={() => {
                  router.push('/inventory');
                  setIsActionsOpen(false);
                }}
                className="w-full mt-6 py-4 bg-gray-50 border border-[#E5E7EB] rounded-2xl text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] hover:bg-gray-100 transition-colors"
              >
                Access Full Inventory Ledger
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="p-8 flex-1 overflow-y-auto space-y-6 scrollbar-hide">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm space-y-1">
              <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">{stat.label}</p>
              <p className={cn('text-2xl font-light tracking-tight', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {lowStockCount > 0 && (
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 overflow-hidden relative group">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-rose-900 uppercase tracking-tight">Critical Low Stock Alerts</h3>
                  <p className="text-xs text-rose-700 font-medium opacity-70">
                    {lowStockCount} items have fallen below their safety threshold across outlets.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => router.push('/inventory')}
                    className="flex-shrink-0 bg-white/60 backdrop-blur-sm border border-rose-200 p-3 rounded-xl flex items-center gap-3 hover:bg-white transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded bg-white p-1">
                      {item.photo ? (
                        <img src={item.photo} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Package className="w-4 h-4 text-rose-300" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-rose-900 truncate max-w-[80px]">{item.name}</span>
                      <span className="text-[8px] font-extrabold text-rose-600 uppercase tracking-widest">{item.sku}</span>
                    </div>
                  </div>
                ))}
                {lowStockCount > 5 && (
                  <button
                    onClick={() => router.push('/inventory')}
                    className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-200 text-rose-600 flex items-center justify-center text-[10px] font-bold hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                  >
                    +{lowStockCount - 5}
                  </button>
                )}
              </div>
            </div>
            <AlertCircle className="absolute -right-8 -bottom-8 w-32 h-32 text-rose-100 group-hover:scale-110 transition-transform duration-500" />
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 flex flex-col shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                  Inventory Movement (Last 7 Days)
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-black rounded-full" />
                    <span className="text-[10px] font-bold text-[#6B7280]">PURCHASE</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-bold text-[#6B7280]">TRANSFERS</span>
                  </div>
                </div>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={movementData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                      tickFormatter={(val) => `KD ${val}`}
                    />
                    <Tooltip
                      contentStyle={{
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        fontFamily: 'sans-serif',
                        fontSize: 12,
                      }}
                      cursor={{ fill: '#F9FAFB', radius: 4 }}
                    />
                    <Bar dataKey="purchases" name="Purchases" fill="#1A1A1A" radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="transfers" name="Transfers" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-6">Top Breakage Audit</h3>
            <div className="space-y-5 flex-1">
              {topBroken.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.photo ? (
                        <img src={item.photo} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                      ) : (
                        <Package className="w-5 h-5 text-[#E5E7EB]" />
                      )}
                    </div>
                    <div
                      className={cn(
                        'absolute -top-1.5 -left-1.5 w-4 h-4 flex items-center justify-center rounded-full text-[8px] font-bold text-white shadow-sm',
                        idx === 0
                          ? 'bg-[#EF4444]'
                          : idx === 1
                          ? 'bg-orange-500'
                          : idx === 2
                          ? 'bg-amber-500'
                          : 'bg-[#9CA3AF]',
                      )}
                    >
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[#1A1A1A] truncate">{item.name}</p>
                    <p className="text-[9px] text-[#9CA3AF] uppercase font-bold tracking-tight truncate">
                      {item.category_name} • {item.sku}
                    </p>
                  </div>
                  <p className="text-xs font-bold text-rose-600 whitespace-nowrap">{formatKD(item.totalValue)}</p>
                </div>
              ))}

              {topBroken.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 opacity-30">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No Breakage Data</p>
                </div>
              )}
            </div>
            <button
              onClick={() => router.push('/breakage')}
              className="w-full mt-8 py-2.5 border border-[#E5E7EB] rounded-xl text-[10px] font-bold uppercase tracking-wider text-[#6B7280] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              Full Detailed Log <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
