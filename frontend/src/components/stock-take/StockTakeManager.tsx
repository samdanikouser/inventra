'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { StockTakeSession, Outlet } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';

export const StockTakeManager = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();

  const [step, setStep] = useState<'LIST' | 'CREATE' | 'COUNT'>('LIST');
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [newOutlet, setNewOutlet] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: () => fetchAllPages(endpoints.outlets),
  });
  const { data: sessions = [] } = useQuery<StockTakeSession[]>({
    queryKey: ['stock-takes'],
    queryFn: () => fetchAllPages(endpoints.stockTakes),
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const createSession = useMutation({
    mutationFn: (data: any) => api.post(endpoints.stockTakes, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-takes'] });
      setActiveSessionId(res.data.id);
      setStep('COUNT');
      setError(null);
    },
    onError: (e: any) =>
      setError(e?.response?.data?.detail || 'Failed to start stock take.'),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.patch(`${endpoints.stockTakeItems}${id}/`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-takes'] }),
  });

  const submitSession = useMutation({
    mutationFn: (id: number) => api.post(`${endpoints.stockTakes}${id}/submit/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stock-takes'] }),
    onError: (e: any) =>
      setError(e?.response?.data?.detail || 'Failed to submit session.'),
  });

  const approveSession = useMutation({
    mutationFn: (id: number) => api.post(`${endpoints.stockTakes}${id}/approve/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-takes'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (e: any) =>
      setError(e?.response?.data?.detail || 'Failed to approve session.'),
  });

  const handleCreateSession = () => {
    setError(null);
    if (!newOutlet) {
      setError('Please choose an outlet.');
      return;
    }
    const ref = `ST-${Date.now().toString().slice(-8)}`;
    createSession.mutate({ ref, outlet: Number(newOutlet), status: 'OPEN' });
  };

  const calculateProgress = (session: StockTakeSession) => {
    if (!session.items?.length) return 0;
    const counted = session.items.filter(
      (i) => i.physical_qty !== null && i.physical_qty !== undefined,
    ).length;
    return (counted / session.items.length) * 100;
  };

  const filteredSessionItems = useMemo(() => {
    if (!activeSession) return [];
    if (!search.trim()) return activeSession.items;
    const q = search.toLowerCase();
    return activeSession.items.filter(
      (i) => i.item_name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q),
    );
  }, [activeSession, search]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Stock Take</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Digital count & reconciliation</span>
        </div>
        {step === 'LIST' && (
          <button
            onClick={() => setStep('CREATE')}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <Plus className="w-3.5 h-3.5" /> Initialize New Count
          </button>
        )}
        {step !== 'LIST' && (
          <button
            onClick={() => {
              setStep('LIST');
              setError(null);
            }}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors"
          >
            Back to Sessions
          </button>
        )}
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        {error && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-6 text-xs font-medium text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {step === 'LIST' && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Outlet</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Progress</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const progress = calculateProgress(session);
                  return (
                    <tr key={session.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold">{session.ref}</td>
                      <td className="px-6 py-4 font-bold">{session.outlet_name}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider',
                            session.status === 'OPEN'
                              ? 'bg-amber-50 text-amber-600 border border-amber-100'
                              : session.status === 'SUBMITTED'
                              ? 'bg-blue-50 text-blue-600 border border-blue-100'
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-100',
                          )}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#9CA3AF] font-bold text-[10px]">
                        {new Date(session.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 w-24 mx-auto">
                          <div className="w-full h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[9px] font-bold text-[#9CA3AF] text-center">
                            {Math.round(progress)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setActiveSessionId(session.id);
                            setStep('COUNT');
                          }}
                          className="p-2 border border-[#E5E7EB] rounded-lg hover:bg-black hover:text-white transition-all shadow-sm"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sessions.length === 0 && (
              <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
                No stock take sessions yet
              </p>
            )}
          </div>
        )}

        {step === 'CREATE' && (
          <div className="max-w-md mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-center">Initialize Audit</h2>
            <div className="space-y-4">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                Select Outlet
              </label>
              <select
                className="w-full p-4 bg-gray-50 border border-[#E5E7EB] rounded-2xl font-bold"
                value={newOutlet}
                onChange={(e) => setNewOutlet(e.target.value === '' ? '' : Number(e.target.value))}
              >
                <option value="">Choose outlet…</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#9CA3AF]">
                A new session will be created with all items pre-loaded from the chosen outlet.
              </p>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setStep('LIST')}
                  className="flex-1 py-4 border border-[#E5E7EB] rounded-2xl font-bold uppercase text-xs"
                >
                  Discard
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={!newOutlet || createSession.isPending}
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-bold uppercase text-xs disabled:opacity-30"
                >
                  {createSession.isPending ? 'Initializing…' : 'Initialize'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'COUNT' && activeSession && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold">{activeSession.ref}</h3>
                <p className="text-xs text-[#9CA3AF] uppercase font-bold">
                  {activeSession.outlet_name} · {activeSession.status}
                </p>
              </div>
              <div className="w-48">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span>PROGRESS</span>
                  <span>{Math.round(calculateProgress(activeSession))}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${calculateProgress(activeSession)}%` }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {activeSession.status === 'OPEN' && (
                  <button
                    onClick={() => submitSession.mutate(activeSession.id)}
                    disabled={submitSession.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
                  >
                    Submit for Approval
                  </button>
                )}
                {activeSession.status === 'SUBMITTED' && isManager && (
                  <button
                    onClick={() => approveSession.mutate(activeSession.id)}
                    disabled={approveSession.isPending}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve & Reconcile
                  </button>
                )}
              </div>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Filter items…"
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
              <table className="w-full text-left font-sans text-sm border-collapse">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">System</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Physical</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Variance</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessionItems.map((item) => {
                    const variance =
                      item.physical_qty === null || item.physical_qty === undefined
                        ? null
                        : item.physical_qty - item.system_qty;
                    return (
                      <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold">{item.item_name}</span>
                            <span className="text-[10px] text-[#9CA3AF] font-bold uppercase">{item.sku}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-light">{item.system_qty}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <input
                              type="number"
                              disabled={activeSession.status !== 'OPEN'}
                              className="w-20 text-center p-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl font-bold outline-none focus:border-black disabled:opacity-50"
                              value={item.physical_qty ?? ''}
                              onBlur={(e) =>
                                updateItem.mutate({
                                  id: item.id,
                                  data: { physical_qty: e.target.value === '' ? null : Number(e.target.value) },
                                })
                              }
                              defaultValue={item.physical_qty ?? ''}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {variance === null ? (
                            <span className="text-[#9CA3AF]">—</span>
                          ) : (
                            <span
                              className={cn(
                                'px-2 py-1 rounded-lg text-xs font-bold',
                                variance === 0
                                  ? 'bg-gray-100 text-[#6B7280]'
                                  : variance < 0
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-emerald-50 text-emerald-600',
                              )}
                            >
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <input
                            disabled={activeSession.status !== 'OPEN'}
                            className="w-full p-2 bg-transparent border-b border-transparent focus:border-gray-200 outline-none text-xs disabled:opacity-50"
                            placeholder="Note…"
                            defaultValue={item.reason || ''}
                            onBlur={(e) =>
                              updateItem.mutate({ id: item.id, data: { reason: e.target.value } })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredSessionItems.length === 0 && (
                <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
                  No matching items
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
