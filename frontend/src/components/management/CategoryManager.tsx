'use client';

import React, { useState, useMemo } from 'react';
import {
  Tags,
  Plus,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Package,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages } from '@/lib/api';
import { Category, Item } from '@/types/inventory';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/components/auth/AuthProvider';

export const CategoryManager = () => {
  const queryClient = useQueryClient();
  const { isManager } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => fetchAllPages(endpoints.categories),
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });

  const itemCountByCategory = useMemo(() => {
    const counts: Record<number, number> = {};
    items.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [items]);

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => api.post(endpoints.categories, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsAddModalOpen(false);
      setNewCategoryName('');
      setError(null);
    },
    onError: (e: any) => setError(extractErr(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string } }) =>
      api.patch(`${endpoints.categories}${id}/`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditingCategory(null);
      setError(null);
    },
    onError: (e: any) => setError(extractErr(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`${endpoints.categories}${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteConfirm(null);
    },
    onError: (e: any) => {
      setDeleteConfirm(null);
      alert(extractErr(e));
    },
  });

  const handleAdd = () => {
    setError(null);
    if (!newCategoryName.trim()) {
      setError('Category name is required.');
      return;
    }
    createMutation.mutate({ name: newCategoryName.trim() });
  };

  const handleUpdate = (category: Category) => {
    setError(null);
    if (!editValue.trim() || editValue === category.name) {
      setEditingCategory(null);
      return;
    }
    updateMutation.mutate({ id: category.id, data: { name: editValue.trim() } });
  };

  const handleDelete = (category: Category) => {
    deleteMutation.mutate(category.id);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Tags className="w-5 h-5 text-black" />
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Category Management</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{categories.length} categories</span>
        </div>
        {isManager && (
          <button
            onClick={() => {
              setError(null);
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <Plus className="w-3.5 h-3.5" /> Define New Category
          </button>
        )}
      </header>

      <div className="p-8 flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Structural Impact Note</p>
              <p className="text-sm text-amber-800 leading-relaxed">
                Renaming a category updates the label for all items currently assigned to it.
                Deleting a category that still has items assigned will fail — reassign or remove those items first.
              </p>
            </div>
          </div>

          {/* Category Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => {
              const count = itemCountByCategory[category.id] || 0;
              const isEditing = editingCategory?.id === category.id;

              return (
                <motion.div
                  layout
                  key={category.id}
                  className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <input
                        autoFocus
                        className="w-full px-3 py-2 bg-[#F9FAFB] border border-black rounded-lg text-sm font-bold outline-none"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(category)}
                      />
                      {error && (
                        <p className="text-[10px] font-bold text-rose-600">{error}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(category)}
                          disabled={updateMutation.isPending}
                          className="flex-1 py-2 bg-black text-white rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                        >
                          {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingCategory(null);
                            setError(null);
                          }}
                          className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-gray-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full justify-between gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#1A1A1A]">{category.name}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Package className="w-3 h-3 text-[#9CA3AF]" />
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                              {count} {count === 1 ? 'Item' : 'Items'} Assigned
                            </p>
                          </div>
                        </div>
                        {isManager && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingCategory(category);
                                setEditValue(category.name);
                                setError(null);
                              }}
                              className="p-1.5 text-[#6B7280] hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(category)}
                              className="p-1.5 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {categories.length === 0 && (
            <p className="text-center py-20 text-xs text-[#9CA3AF] font-bold uppercase tracking-widest">
              No categories defined yet
            </p>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold">New Category</h3>
                <p className="text-xs text-[#6B7280] font-medium mt-1">
                  Define a new structural category for inventory items.
                </p>
              </div>

              {error && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4 text-xs font-medium text-rose-700">
                  {error}
                </div>
              )}

              <input
                autoFocus
                placeholder="e.g., Disposables, Stationery"
                className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl text-sm font-bold outline-none focus:border-black transition-all"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setError(null);
                  }}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-2xl text-xs font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newCategoryName.trim() || createMutation.isPending}
                  className="flex-1 py-3 bg-black text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-lg shadow-black/10 disabled:opacity-30"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold">Remove Category?</h3>
              <p className="text-sm text-[#6B7280] mt-2 leading-relaxed">
                Are you sure you want to delete{' '}
                <span className="font-bold text-black">"{deleteConfirm.name}"</span>?
                {(itemCountByCategory[deleteConfirm.id] || 0) > 0 && (
                  <span className="block mt-1 text-rose-600 font-bold text-xs">
                    ⚠ This category has {itemCountByCategory[deleteConfirm.id]} items assigned — they must be reassigned first.
                  </span>
                )}
              </p>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-2xl text-xs font-bold uppercase tracking-widest text-[#6B7280]"
                >
                  Keep It
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-600/20 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
                </button>
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
