'use client';

import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { endpoints, fetchAllPages } from '@/lib/api';
import { Transaction, InventorySnapshot, Item } from '@/types/inventory';
import { formatKD, cn } from '@/lib/utils';

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleString('default', { month: 'short', year: '2-digit' });

export const MonthlyReports = () => {
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => fetchAllPages(endpoints.transactions),
  });
  const { data: snapshots = [] } = useQuery<InventorySnapshot[]>({
    queryKey: ['snapshots'],
    queryFn: () => fetchAllPages(endpoints.snapshots),
  });
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });

  // Build monthly buckets covering the last 6 months relative to today.
  const months = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }, []);

  const data = useMemo(() => {
    return months.map((month) => {
      const inMonth = transactions.filter((t) => t.date.startsWith(month));
      const purchases = inMonth
        .filter((t) => t.type === 'PURCHASE')
        .reduce((acc, t) => acc + Number(t.value), 0);
      const breakage = inMonth
        .filter((t) => t.type === 'BREAKAGE')
        .reduce((acc, t) => acc + Number(t.value), 0);
      const writeOff = inMonth
        .filter((t) => t.type === 'WRITE_OFF')
        .reduce((acc, t) => acc + Number(t.value), 0);
      const snap = snapshots.find((s) => s.month === month);
      const inventoryValue = snap ? Number(snap.total_valuation) : null;
      return {
        name: monthLabel(month),
        month,
        inventory: inventoryValue ?? 0,
        purchases,
        breakage,
        writeOff,
        loss: breakage + writeOff,
      };
    });
  }, [months, transactions, snapshots]);

  const liveValuation = useMemo(
    () =>
      items.reduce((acc, item) => {
        const total = item.stocks.reduce((a, b) => a + b.quantity, 0);
        return acc + total * Number(item.unit_cost);
      }, 0),
    [items],
  );

  const recent = data[data.length - 1];
  const prior = data[data.length - 2];
  const growth =
    recent && prior && prior.inventory > 0
      ? ((recent.inventory - prior.inventory) / prior.inventory) * 100
      : 0;
  const breakageRatio =
    recent && (recent.purchases || liveValuation)
      ? (recent.breakage / Math.max(recent.purchases || liveValuation, 1)) * 100
      : 0;
  const inStockRate =
    items.length > 0
      ? (items.filter(
          (i) => !i.stocks.some((s) => s.quantity < i.min_stock),
        ).length /
          items.length) *
        100
      : 0;

  const stats = [
    {
      label: 'Asset Growth (MoM)',
      value: `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`,
      trend: growth >= 0 ? 'up' : 'down',
      icon: growth >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: 'Breakage Ratio',
      value: `${breakageRatio.toFixed(2)}%`,
      trend: breakageRatio < 2 ? 'up' : 'down',
      icon: breakageRatio < 2 ? TrendingDown : TrendingUp,
    },
    {
      label: 'Live Valuation',
      value: formatKD(liveValuation),
      trend: 'up' as const,
      icon: TrendingUp,
    },
    {
      label: 'In-Stock Rate',
      value: `${inStockRate.toFixed(1)}%`,
      trend: inStockRate >= 90 ? 'up' : 'down',
      icon: inStockRate >= 90 ? TrendingUp : TrendingDown,
    },
  ];

  const handleExport = () => {
    const rows = [
      ['Month', 'Inventory Valuation (KD)', 'Purchases (KD)', 'Breakage (KD)', 'Write-off (KD)'],
      ...data.map((d) => [d.month, d.inventory, d.purchases, d.breakage, d.writeOff]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventra-monthly-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Financial Intelligence</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Last six months</span>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export Report
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col justify-between h-32"
            >
              <div className="flex justify-between items-start">
                <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-widest">
                  {stat.label}
                </p>
                <stat.icon
                  className={cn('w-4 h-4', stat.trend === 'up' ? 'text-emerald-500' : 'text-rose-500')}
                />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-light tracking-tighter text-[#1A1A1A]">{stat.value}</p>
                <span
                  className={cn(
                    'text-[10px] font-bold flex items-center gap-0.5',
                    stat.trend === 'up' ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] mb-8">
              Inventory Valuation by Snapshot
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                    tickFormatter={(v) => `KD ${v}`}
                  />
                  <Tooltip
                    formatter={(value: any) => formatKD(Number(value))}
                    contentStyle={{ borderRadius: 12, border: 'none' }}
                  />
                  <Area type="monotone" dataKey="inventory" stroke="#1A1A1A" fill="#F3F4F6" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] mb-8">
              Loss Streams (Breakage & Write-off)
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 'bold' }}
                    tickFormatter={(v) => `KD ${v}`}
                  />
                  <Tooltip formatter={(value: any) => formatKD(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 10, fontWeight: 'bold' }} />
                  <Bar dataKey="breakage" name="Breakage" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="writeOff" name="Write-off" fill="#F97316" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] mb-8">
            Period Detail
          </h3>
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                  Month
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">
                  Inventory
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">
                  Purchases
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">
                  Breakage
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">
                  Write-off
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month} className="border-b border-[#F3F4F6]">
                  <td className="px-4 py-3 font-bold text-xs">{d.name}</td>
                  <td className="px-4 py-3 text-right">{formatKD(d.inventory)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                    {formatKD(d.purchases)}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600 font-bold">{formatKD(d.breakage)}</td>
                  <td className="px-4 py-3 text-right text-orange-600 font-bold">{formatKD(d.writeOff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
