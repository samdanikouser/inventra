'use client';

import React, { useState } from 'react';
import {
  Warehouse,
  MapPin,
  Plus,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Outlet, Item } from '@/types/inventory';
import { formatKD } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/auth/AuthProvider';

export const OutletManager = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [formData, setFormData] = useState({ name: '', location: '' });
  const [error, setError] = useState<string | null>(null);

  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: () => fetchAllPages(endpoints.outlets),
  });
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(endpoints.outlets, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      setIsModalOpen(false);
      setError(null);
    },
    onError: (e: any) => setError(extractErr(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.patch(`${endpoints.outlets}${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      setIsModalOpen(false);
      setError(null);
    },
    onError: (e: any) => setError(extractErr(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`${endpoints.outlets}${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outlets'] }),
    onError: (e: any) => alert(extractErr(e)),
  });

  const handleOpenModal = (outlet?: Outlet) => {
    setError(null);
    if (outlet) {
      setEditingOutlet(outlet);
      setFormData({ name: outlet.name, location: outlet.location || '' });
    } else {
      setEditingOutlet(null);
      setFormData({ name: '', location: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setError(null);
    if (!formData.name.trim()) {
      setError('Outlet name is required.');
      return;
    }
    if (editingOutlet) {
      updateMutation.mutate({ id: editingOutlet.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (outlet: Outlet) => {
    const stockCount = items.reduce(
      (acc, item) => acc + (item.stocks.find((s) => s.outlet === outlet.id)?.quantity || 0),
      0,
    );
    if (
      !confirm(
        stockCount > 0
          ? `${outlet.name} still holds ${stockCount} units. Delete anyway? Stock records will also be removed.`
          : `Permanently delete ${outlet.name}?`,
      )
    )
      return;
    deleteMutation.mutate(outlet.id);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Outlet Management</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{outlets.length} active locations</span>
        </div>
        {isManager && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Register New Outlet
          </button>
        )}
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outlets.map((outlet) => {
            const outletValue = items.reduce((acc, item) => {
              const stock = item.stocks.find((s) => s.outlet === outlet.id);
              return acc + (stock ? stock.quantity * Number(item.unit_cost) : 0);
            }, 0);
            const itemCount = items.filter((i) =>
              i.stocks.some((s) => s.outlet === outlet.id && s.quantity > 0),
            ).length;

            return (
              <div
                key={outlet.id}
                className="bg-white border border-[#E5E7EB] rounded-3xl p-6 shadow-sm hover:border-black transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-[#1A1A1A] group-hover:bg-black group-hover:text-white transition-colors shadow-sm">
                    <Warehouse className="w-6 h-6" />
                  </div>
                  {isManager && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(outlet)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(outlet)}
                        className="p-2 hover:bg-rose-50 rounded-lg text-rose-500"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-bold text-[#1A1A1A]">{outlet.name}</h3>
                  <div className="flex items-center gap-1.5 text-[#9CA3AF]">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {outlet.location || 'Central Location'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between border-t border-[#F3F4F6] pt-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Inventory Value</p>
                    <p className="text-sm font-bold text-emerald-600">{formatKD(outletValue)}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Active SKUs</p>
                    <p className="text-sm font-bold text-[#1A1A1A]">{itemCount}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {outlets.length === 0 && (
          <p className="text-center py-20 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
            No outlets registered yet
          </p>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <h2 className="text-2xl font-bold">{editingOutlet ? 'Update Facility' : 'New Facility'}</h2>
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
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Outlet Name
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Location (optional)
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 border border-[#E5E7EB] rounded-xl font-bold uppercase text-xs tracking-widest text-[#6B7280] hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex-1 py-3 bg-black text-white rounded-xl font-bold uppercase text-xs tracking-widest hover:opacity-80 disabled:opacity-50"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save Outlet'}
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

function extractErr(e: any): string {
  const data = e?.response?.data;
  if (!data) return 'Something went wrong.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const flat: string[] = [];
  Object.entries(data).forEach(([k, v]) => {
    flat.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  });
  return flat.join(' • ') || 'Validation error.';
}
