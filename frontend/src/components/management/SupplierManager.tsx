'use client';

import React, { useMemo, useState } from 'react';
import {
  Mail,
  Phone,
  Clock,
  Plus,
  X,
  Edit2,
  Trash2,
  Search,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Supplier, Transaction } from '@/types/inventory';
import { formatKD } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/auth/AuthProvider';

export const SupplierManager = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    lead_time_days: 3,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetchAllPages(endpoints.suppliers),
  });
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => fetchAllPages(endpoints.transactions),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(endpoints.suppliers, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsModalOpen(false);
      setError(null);
    },
    onError: (e: any) => setError(extractErr(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.patch(`${endpoints.suppliers}${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsModalOpen(false);
      setError(null);
    },
    onError: (e: any) => setError(extractErr(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`${endpoints.suppliers}${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
    onError: (e: any) => alert(extractErr(e)),
  });

  const handleOpenModal = (supplier?: Supplier) => {
    setError(null);
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name,
        contact: supplier.contact,
        email: supplier.email,
        lead_time_days: supplier.lead_time_days,
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', contact: '', email: '', lead_time_days: 3 });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    setError(null);
    if (!formData.name.trim()) {
      setError('Vendor name is required.');
      return;
    }
    if (!formData.email.trim() || !/.+@.+\..+/.test(formData.email)) {
      setError('A valid email address is required.');
      return;
    }
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.contact.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Vendor Directory</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{suppliers.length} strategic partners</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search vendors…"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-[#E5E7EB] rounded-lg text-xs font-bold"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isManager && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          )}
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <table className="w-full text-left font-sans text-sm border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Lead Time</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Total Spend</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Orders</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => {
                const supplierTxs = transactions.filter(
                  (t) => t.type === 'PURCHASE' && t.supplier === supplier.id,
                );
                const totalSpend = supplierTxs.reduce((acc, t) => acc + Number(t.value), 0);

                return (
                  <tr
                    key={supplier.id}
                    className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group"
                  >
                    <td className="px-6 py-6 font-bold">{supplier.name}</td>
                    <td className="px-6 py-6 font-medium text-xs">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <Mail className="w-3 h-3 opacity-40" /> {supplier.email}
                        </span>
                        <span className="flex items-center gap-2">
                          <Phone className="w-3 h-3 opacity-40" /> {supplier.contact}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-extrabold uppercase">
                        <Clock className="w-3 h-3" /> {supplier.lead_time_days} Days
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right font-bold">{formatKD(totalSpend)}</td>
                    <td className="px-6 py-6 text-right font-medium text-[#6B7280]">{supplierTxs.length}</td>
                    <td className="px-6 py-6">
                      {isManager && (
                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenModal(supplier)}
                            className="p-2 text-[#6B7280] hover:text-black hover:bg-gray-100 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${supplier.name}?`)) {
                                deleteMutation.mutate(supplier.id);
                              }
                            }}
                            className="p-2 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredSuppliers.length === 0 && (
            <p className="text-center py-12 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
              No vendors match your search
            </p>
          )}
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
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <h2 className="text-2xl font-bold">
                  {editingSupplier ? 'Update Vendor' : 'New Vendor Entry'}
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
                <Field label="Vendor Name">
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Contact">
                    <input
                      type="text"
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={formData.contact}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    />
                  </Field>
                  <Field label="Lead time (days)">
                    <input
                      type="number"
                      min={0}
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={formData.lead_time_days}
                      onChange={(e) =>
                        setFormData({ ...formData, lead_time_days: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                </div>
                <Field label="Email">
                  <input
                    type="email"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </Field>
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
                    {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save Vendor'}
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
      {label}
    </label>
    {children}
  </div>
);

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
