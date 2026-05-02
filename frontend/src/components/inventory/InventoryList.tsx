'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Grid2X2,
  List,
  Plus,
  ArrowRightLeft,
  Trash2,
  PackagePlus,
  Hammer,
  X,
  Download,
  Package,
  Pencil,
  Lock as LockIcon,
  Camera,
  Scale,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { endpoints, fetchAllPages, downloadCsv } from '@/lib/api';
import {
  Item,
  Category,
  Outlet,
  Supplier,
  TransactionType,
  InventorySnapshot,
} from '@/types/inventory';
import { formatKD, cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { StockAdjustmentModal } from '@/components/inventory/StockAdjustmentModal';
import { ItemDetailModal } from '@/components/inventory/ItemDetailModal';

const BREAKAGE_REASONS = ['Accidental Drop', 'Expired', 'Damaged during transport', 'Defective', 'Worn out'];
const WRITE_OFF_REASONS = ['Damaged', 'Expired', 'Theft', 'Obsolete', 'Sold'];

interface ItemFormState {
  sku: string;
  name: string;
  category: string;
  unit: string;
  min_stock: number;
  par_level: number;
  unit_cost: number;
  /** URL of an existing photo (when editing). */
  photoUrl: string | null;
  /** New file the user selected; will be uploaded as multipart on save. */
  photoFile: File | null;
  /** Local preview URL for the chosen file (object URL). */
  photoPreview: string | null;
  /** True if user clicked "Remove photo". */
  photoCleared: boolean;
}

const emptyItemForm: ItemFormState = {
  sku: '',
  name: '',
  category: '',
  unit: 'pcs',
  min_stock: 10,
  par_level: 50,
  unit_cost: 0,
  photoUrl: null,
  photoFile: null,
  photoPreview: null,
  photoCleared: false,
};

export const InventoryList = () => {
  const queryClient = useQueryClient();
  const { role, user } = useAuth();
  const isManager = role === 'MANAGER';

  // Filter / view state
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'All'>('All');
  const [selectedOutlet, setSelectedOutlet] = useState<number | 'All'>('All');

  // Item modal state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [itemError, setItemError] = useState<string | null>(null);

  // Transaction modal state
  const [txItem, setTxItem] = useState<Item | null>(null);
  const [txType, setTxType] = useState<TransactionType | null>(null);
  const [txQty, setTxQty] = useState(0);
  const [txCost, setTxCost] = useState(0);
  const [txOutlet, setTxOutlet] = useState<number | ''>('');
  const [txTargetOutlet, setTxTargetOutlet] = useState<number | ''>('');
  const [txReason, setTxReason] = useState('');
  const [txSupplier, setTxSupplier] = useState<number | ''>('');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState<string | null>(null);

  // Stock adjustment modal state
  const [adjItem, setAdjItem] = useState<Item | null>(null);

  // Item detail modal state
  const [detailItem, setDetailItem] = useState<Item | null>(null);

  // Data
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ['items'],
    queryFn: () => fetchAllPages(endpoints.items),
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => fetchAllPages(endpoints.categories),
  });
  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: () => fetchAllPages(endpoints.outlets),
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => fetchAllPages(endpoints.suppliers),
  });
  const { data: snapshots = [] } = useQuery<InventorySnapshot[]>({
    queryKey: ['snapshots'],
    queryFn: () => fetchAllPages(endpoints.snapshots),
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const isMonthLocked = snapshots.some((s) => s.month === currentMonth);

  // Mutations — items use multipart so photo uploads work alongside JSON fields.
  const createItem = useMutation({
    mutationFn: (payload: FormData) =>
      api.post(endpoints.items, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsItemModalOpen(false);
      setEditingItem(null);
      setItemForm(emptyItemForm);
    },
    onError: (e: any) => setItemError(extractErr(e)),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      api.patch(`${endpoints.items}${id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsItemModalOpen(false);
      setEditingItem(null);
      setItemForm(emptyItemForm);
    },
    onError: (e: any) => setItemError(extractErr(e)),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api.delete(`${endpoints.items}${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const createTransaction = useMutation({
    mutationFn: (tx: any) => api.post(endpoints.transactions, tx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      closeTxModal();
    },
    onError: (e: any) => setTxError(extractErr(e)),
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [items, search, selectedCategory]);

  const handleExport = async () => {
    try {
      await downloadCsv(
        endpoints.itemsExport,
        `inventra-items-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (e) {
      alert('Export failed. Manager access required.');
    }
  };

  // Helper: close modal and clean up any object URLs.
  const closeItemModal = () => {
    if (itemForm.photoPreview) URL.revokeObjectURL(itemForm.photoPreview);
    setIsItemModalOpen(false);
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setItemError(null);
  };

  const openCreateItem = () => {
    setEditingItem(null);
    setItemForm({
      ...emptyItemForm,
      category: categories[0]?.id ? String(categories[0].id) : '',
    });
    setItemError(null);
    setIsItemModalOpen(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItem(item);
    setItemForm({
      sku: item.sku,
      name: item.name,
      category: String(item.category),
      unit: item.unit,
      min_stock: item.min_stock,
      par_level: item.par_level,
      unit_cost: Number(item.unit_cost),
      photoUrl: item.photo || null,
      photoFile: null,
      photoPreview: null,
      photoCleared: false,
    });
    setItemError(null);
    setIsItemModalOpen(true);
  };

  const handlePhotoSelected = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setItemError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setItemError('Image must be smaller than 5 MB.');
      return;
    }
    setItemError(null);
    // Revoke prior preview URL to avoid leaks.
    if (itemForm.photoPreview) URL.revokeObjectURL(itemForm.photoPreview);
    setItemForm((prev) => ({
      ...prev,
      photoFile: file,
      photoPreview: URL.createObjectURL(file),
      photoCleared: false,
    }));
  };

  const handlePhotoRemove = () => {
    if (itemForm.photoPreview) URL.revokeObjectURL(itemForm.photoPreview);
    setItemForm((prev) => ({
      ...prev,
      photoFile: null,
      photoPreview: null,
      photoCleared: true,
    }));
  };

  const handleSaveItem = () => {
    setItemError(null);
    if (!itemForm.sku.trim() || !itemForm.name.trim() || !itemForm.category) {
      setItemError('SKU, name, and category are required.');
      return;
    }
    const fd = new FormData();
    fd.append('sku', itemForm.sku.trim());
    fd.append('name', itemForm.name.trim());
    fd.append('category', String(Number(itemForm.category)));
    fd.append('unit', itemForm.unit);
    fd.append('min_stock', String(itemForm.min_stock));
    fd.append('par_level', String(itemForm.par_level));
    fd.append('unit_cost', String(itemForm.unit_cost));
    if (itemForm.photoFile) {
      fd.append('photo', itemForm.photoFile, itemForm.photoFile.name);
    } else if (itemForm.photoCleared) {
      // Tell DRF to clear the existing photo on edit.
      fd.append('photo', '');
    }
    if (editingItem) updateItem.mutate({ id: editingItem.id, data: fd });
    else createItem.mutate(fd);
  };

  const openTxModal = (item: Item, type: TransactionType) => {
    if (isMonthLocked) {
      alert('Period is locked — transactions cannot be created for this month.');
      return;
    }
    setTxItem(item);
    setTxType(type);
    setTxQty(0);
    setTxCost(Number(item.unit_cost));
    setTxOutlet(typeof selectedOutlet === 'number' ? selectedOutlet : outlets[0]?.id || '');
    setTxTargetOutlet('');
    setTxReason(type === 'BREAKAGE' ? BREAKAGE_REASONS[0] : type === 'WRITE_OFF' ? WRITE_OFF_REASONS[0] : '');
    setTxSupplier('');
    setTxNotes('');
    setTxError(null);
  };

  const closeTxModal = () => {
    setTxItem(null);
    setTxType(null);
    setTxError(null);
  };

  const handleSubmitTx = () => {
    if (!txItem || !txType) return;
    setTxError(null);
    if (!txOutlet) {
      setTxError('Source outlet is required.');
      return;
    }
    if (txQty <= 0) {
      setTxError('Quantity must be greater than zero.');
      return;
    }
    if (txType === 'TRANSFER') {
      if (!txTargetOutlet) {
        setTxError('Target outlet is required for transfers.');
        return;
      }
      if (txTargetOutlet === txOutlet) {
        setTxError('Source and target outlets must differ.');
        return;
      }
    }
    if (txType === 'PURCHASE' && txCost <= 0) {
      setTxError('Unit cost must be greater than zero.');
      return;
    }
    if (txType !== 'PURCHASE') {
      const stockAtSrc = txItem.stocks.find((s) => s.outlet === txOutlet)?.quantity || 0;
      if (txQty > stockAtSrc) {
        setTxError(`Insufficient stock — only ${stockAtSrc} available at source outlet.`);
        return;
      }
    }
    const refPrefix =
      txType === 'PURCHASE' ? 'PO' :
      txType === 'BREAKAGE' ? 'BRK' :
      txType === 'WRITE_OFF' ? 'WO' :
      txType === 'TRANSFER' ? 'TRF' : 'ADJ';
    const ref = `${refPrefix}-${Date.now().toString().slice(-8)}`;
    const delta = txType === 'PURCHASE' ? txQty : -txQty;
    const value = txType === 'PURCHASE' ? txQty * txCost : txQty * Number(txItem.unit_cost);

    const payload: any = {
      ref,
      type: txType,
      item: txItem.id,
      outlet: txOutlet,
      quantity_delta: delta,
      value,
      notes: txNotes,
    };
    if (txType === 'PURCHASE' && txSupplier) payload.supplier = Number(txSupplier);
    if ((txType === 'BREAKAGE' || txType === 'WRITE_OFF') && txReason) payload.reason = txReason;
    if (txType === 'TRANSFER') payload.target_outlet = Number(txTargetOutlet);

    createTransaction.mutate(payload);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isMonthLocked && (
        <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] shrink-0">
          <LockIcon className="w-3 h-3" /> Books locked for this month — read-only mode
        </div>
      )}

      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Master Inventory</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">
            {filteredItems.length === items.length
              ? `${items.length} Items`
              : `${filteredItems.length} of ${items.length} Items`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isManager && (
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" /> Export Dataset
            </button>
          )}
          {(role === 'MANAGER' || role === 'SUPERVISOR') && (
            <button
              onClick={openCreateItem}
              className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add New Item
            </button>
          )}
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-6 scrollbar-hide">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search by SKU or name…"
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl font-sans text-sm focus:outline-none focus:ring-1 focus:ring-black placeholder:text-[#9CA3AF] transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#6B7280] uppercase tracking-wide outline-none cursor-pointer shadow-sm hover:border-black transition-colors"
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(e.target.value === 'All' ? 'All' : Number(e.target.value))
              }
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#6B7280] uppercase tracking-wide outline-none cursor-pointer shadow-sm hover:border-black transition-colors"
              value={selectedOutlet}
              onChange={(e) =>
                setSelectedOutlet(e.target.value === 'All' ? 'All' : Number(e.target.value))
              }
            >
              <option value="All">All Outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-1 flex gap-1 shadow-sm">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'p-2 transition-all rounded-lg',
                  view === 'grid' ? 'bg-black text-white shadow-sm' : 'text-[#6B7280] hover:bg-gray-50',
                )}
              >
                <Grid2X2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('table')}
                className={cn(
                  'p-2 transition-all rounded-lg',
                  view === 'table' ? 'bg-black text-white shadow-sm' : 'text-[#6B7280] hover:bg-gray-50',
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
            {filteredItems.map((item) => {
              const stockObj =
                selectedOutlet === 'All'
                  ? { quantity: item.stocks.reduce((a, b) => a + b.quantity, 0) }
                  : item.stocks.find((s) => s.outlet === selectedOutlet) || { quantity: 0 };
              const stockLevel = stockObj.quantity;
              const isLow = stockLevel < item.min_stock;

              return (
                <motion.div
                  layout
                  key={item.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden"
                >
                  <div className="h-44 bg-[#F9FAFB] border-b border-[#E5E7EB] relative overflow-hidden flex items-center justify-center p-6">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt={item.name}
                        className="w-full h-full object-contain mix-blend-multiply transition-transform group-hover:scale-105 duration-500"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-[#E5E7EB]" />
                    )}
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="text-[10px] font-bold bg-white text-black border border-[#E5E7EB] px-2 py-1 rounded-lg shadow-sm">
                        {item.sku}
                      </span>
                    </div>
                    {(role === 'MANAGER' || role === 'SUPERVISOR') && (
                      <button
                        onClick={() => openEditItem(item)}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 backdrop-blur border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-black hover:bg-white transition-colors"
                        title="Edit item"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1 space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-4">
                        <h3
                          className="text-sm font-bold text-[#1A1A1A] leading-tight line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-violet-600 transition-colors"
                          onClick={() => setDetailItem(item)}
                          title="View item lifecycle"
                        >
                          {item.name}
                        </h3>
                      </div>
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">
                        {item.category_name}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-end mb-1.5 px-0.5">
                          <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">Stock Level</span>
                          <span className="text-xs font-bold text-[#1A1A1A]">
                            {stockLevel} <span className="text-[#9CA3AF] font-medium">/ {item.par_level}</span>
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min((stockLevel / Math.max(item.par_level, 1)) * 100, 100)}%`,
                            }}
                            className={cn('h-full rounded-full', isLow ? 'bg-orange-500' : 'bg-emerald-500')}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#F3F4F6] space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-[#9CA3AF] uppercase block">WAC Value</span>
                            <span className="text-sm font-light tracking-tight text-[#1A1A1A]">
                              {formatKD(item.unit_cost)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              'flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide',
                              stockLevel <= 0
                                ? 'bg-red-50 text-red-600 border border-red-100'
                                : isLow
                                ? 'bg-orange-50 text-orange-600 border border-orange-100'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100',
                            )}
                          >
                            {stockLevel <= 0 ? 'OOS' : isLow ? 'LOW' : 'OK'}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          {role !== 'STAFF' && (
                            <button
                              onClick={() => setAdjItem(item)}
                              className="flex-1 p-2 border border-[#E5E7EB] rounded-lg hover:bg-violet-50 hover:border-violet-200 text-[#6B7280] hover:text-violet-600 transition-all text-center"
                              title="Opening balance"
                            >
                              <Scale className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          )}
                          {role !== 'STAFF' && (
                            <button
                              onClick={() => openTxModal(item, 'TRANSFER')}
                              className="flex-1 p-2 border border-[#E5E7EB] rounded-lg hover:bg-blue-50 hover:border-blue-200 text-[#6B7280] hover:text-blue-600 transition-all text-center"
                              title="Transfer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          )}
                          <button
                            onClick={() => openTxModal(item, 'BREAKAGE')}
                            className="flex-1 p-2 border border-[#E5E7EB] rounded-lg hover:bg-red-50 hover:border-red-200 text-[#6B7280] hover:text-red-600 transition-all text-center"
                            title="Log breakage"
                          >
                            <Hammer className="w-3.5 h-3.5 mx-auto" />
                          </button>
                          {isManager && (
                            <button
                              onClick={() => openTxModal(item, 'WRITE_OFF')}
                              className="flex-1 p-2 border border-[#E5E7EB] rounded-lg hover:bg-rose-50 hover:border-rose-200 text-[#6B7280] hover:text-rose-600 transition-all text-center"
                              title="Write-off"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden mb-8">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Total</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Min/Par</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">WAC</th>
                  <th className="px-5 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const total =
                    selectedOutlet === 'All'
                      ? item.stocks.reduce((a, b) => a + b.quantity, 0)
                      : item.stocks.find((s) => s.outlet === selectedOutlet)?.quantity || 0;
                  const isLow = total < item.min_stock;
                  return (
                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-[#374151]">{item.sku}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#F9FAFB] border border-[#E5E7EB] rounded overflow-hidden flex items-center justify-center">
                            {item.photo ? (
                              <img src={item.photo} alt="" className="w-full h-full object-contain" />
                            ) : (
                              <Package className="w-4 h-4 text-[#E5E7EB]" />
                            )}
                          </div>
                          <span
                            className="font-bold text-[#1A1A1A] cursor-pointer hover:text-violet-600 transition-colors"
                            onClick={() => setDetailItem(item)}
                            title="View item lifecycle"
                          >
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold uppercase text-[#9CA3AF]">{item.category_name}</td>
                      <td
                        className={cn(
                          'px-6 py-4 text-right font-bold',
                          isLow ? 'text-rose-600' : 'text-[#1A1A1A]',
                        )}
                      >
                        {total}
                      </td>
                      <td className="px-6 py-4 text-right text-[10px] font-bold text-[#6B7280]">
                        {item.min_stock} / {item.par_level}
                      </td>
                      <td className="px-6 py-4 text-right">{formatKD(item.unit_cost)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-0.5">
                          {(role === 'MANAGER' || role === 'SUPERVISOR') && (
                            <button
                              onClick={() => openEditItem(item)}
                              className="p-1.5 text-[#6B7280] hover:text-black transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {(role === 'MANAGER' || role === 'SUPERVISOR') && (
                            <button
                              onClick={() => setAdjItem(item)}
                              className="p-1.5 text-[#6B7280] hover:text-violet-600 transition-colors"
                              title="Opening balance"
                            >
                              <Scale className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setDetailItem(item)}
                            className="p-1.5 text-[#6B7280] hover:text-violet-600 transition-colors"
                            title="Item lifecycle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openTxModal(item, 'PURCHASE')}
                            className="p-1.5 text-[#6B7280] hover:text-emerald-600 transition-colors"
                            title="Record purchase"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openTxModal(item, 'BREAKAGE')}
                            className="p-1.5 text-[#6B7280] hover:text-rose-600 transition-colors"
                            title="Log breakage"
                          >
                            <Hammer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredItems.length === 0 && (
          <div className="text-center py-20 opacity-30">
            <Package className="w-16 h-16 mx-auto mb-3" />
            <p className="text-sm font-bold uppercase tracking-widest">No items found</p>
          </div>
        )}
      </div>

      {/* ---------- Item create/edit modal ---------- */}
      <AnimatePresence>
        {isItemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeItemModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                  <p className="text-sm text-[#6B7280]">
                    {editingItem ? `SKU ${editingItem.sku}` : 'Create a new master inventory record.'}
                  </p>
                </div>
                <button
                  onClick={closeItemModal}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

              {itemError && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4 text-xs font-medium text-rose-700">
                  {itemError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Category
                  </label>
                  <select
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  >
                    <option value="">Select category…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Min Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                    value={itemForm.min_stock}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, min_stock: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Par Level
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                    value={itemForm.par_level}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, par_level: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Unit Cost (KD) — WAC
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
                    value={itemForm.unit_cost}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, unit_cost: Number(e.target.value) || 0 })
                    }
                    disabled={!isManager && !!editingItem}
                  />
                  {!isManager && (
                    <p className="text-[10px] text-[#9CA3AF] mt-1">
                      Only managers can change WAC manually. It is otherwise auto-recalculated on purchase.
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Photo
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                      {itemForm.photoPreview ? (
                        <img
                          src={itemForm.photoPreview}
                          alt="Preview"
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      ) : itemForm.photoUrl && !itemForm.photoCleared ? (
                        <img
                          src={itemForm.photoUrl}
                          alt="Current"
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      ) : (
                        <Camera className="w-7 h-7 text-[#E5E7EB]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors cursor-pointer">
                        <Camera className="w-3.5 h-3.5" />
                        {itemForm.photoFile || (itemForm.photoUrl && !itemForm.photoCleared)
                          ? 'Replace image'
                          : 'Upload image'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handlePhotoSelected(e.target.files?.[0] || null)}
                        />
                      </label>
                      {(itemForm.photoFile || (itemForm.photoUrl && !itemForm.photoCleared)) && (
                        <button
                          type="button"
                          onClick={handlePhotoRemove}
                          className="block text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:underline"
                        >
                          Remove photo
                        </button>
                      )}
                      <p className="text-[10px] text-[#9CA3AF]">
                        PNG / JPG / WEBP, up to 5 MB. Optional — used in cards and reports.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={closeItemModal}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-xl text-xs font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                {editingItem && isManager && (
                  <button
                    onClick={() => {
                      if (confirm(`Permanently delete ${editingItem.sku}? This cannot be undone.`)) {
                        deleteItem.mutate(editingItem.id, {
                          onSuccess: () => closeItemModal(),
                        });
                      }
                    }}
                    className="flex-1 py-3 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-rose-50 transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={handleSaveItem}
                  disabled={createItem.isPending || updateItem.isPending}
                  className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {createItem.isPending || updateItem.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------- Transaction modal ---------- */}
      <AnimatePresence>
        {txItem && txType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeTxModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
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
                    {txType === 'PURCHASE' && (<><PackagePlus className="text-emerald-600 w-5 h-5" /> Record Purchase</>)}
                    {txType === 'BREAKAGE' && (<><Hammer className="text-amber-600 w-5 h-5" /> Log Breakage</>)}
                    {txType === 'WRITE_OFF' && (<><Trash2 className="text-rose-600 w-5 h-5" /> Write-off</>)}
                    {txType === 'TRANSFER' && (<><ArrowRightLeft className="text-blue-600 w-5 h-5" /> Stock Transfer</>)}
                  </h2>
                  <p className="text-sm text-[#6B7280]">
                    {txItem.sku} — {txItem.name}
                  </p>
                </div>
                <button
                  onClick={closeTxModal}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#6B7280]" />
                </button>
              </div>

              {txError && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-4 text-xs font-medium text-rose-700">
                  {txError}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      {txType === 'TRANSFER' ? 'Source Outlet' : 'Outlet'}
                    </label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={txOutlet}
                      onChange={(e) => setTxOutlet(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">Select…</option>
                      {outlets.map((o) => {
                        const stock = txItem.stocks.find((s) => s.outlet === o.id)?.quantity || 0;
                        return (
                          <option key={o.id} value={o.id}>
                            {o.name} ({stock} on hand)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={txQty}
                      onChange={(e) => setTxQty(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {txType === 'PURCHASE' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                          Unit Cost (KD)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                          value={txCost}
                          onChange={(e) => setTxCost(Number(e.target.value) || 0)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                          Supplier (optional)
                        </label>
                        <select
                          className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                          value={txSupplier}
                          onChange={(e) => setTxSupplier(e.target.value === '' ? '' : Number(e.target.value))}
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
                    <div className="text-[11px] font-medium text-[#6B7280]">
                      Total: <span className="font-bold text-[#1A1A1A]">{formatKD(txQty * txCost)}</span> — WAC will be
                      auto-recalculated.
                    </div>
                  </>
                )}

                {txType === 'TRANSFER' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      Target Outlet
                    </label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={txTargetOutlet}
                      onChange={(e) =>
                        setTxTargetOutlet(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    >
                      <option value="">Select…</option>
                      {outlets
                        .filter((o) => o.id !== txOutlet)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {(txType === 'BREAKAGE' || txType === 'WRITE_OFF') && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                      Reason
                    </label>
                    <select
                      className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm"
                      value={txReason}
                      onChange={(e) => setTxReason(e.target.value)}
                    >
                      {(txType === 'BREAKAGE' ? BREAKAGE_REASONS : WRITE_OFF_REASONS).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">
                    Notes
                  </label>
                  <textarea
                    className="w-full p-3 bg-gray-50 border border-[#E5E7EB] rounded-xl text-sm h-20 resize-none"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    placeholder="Optional context…"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={closeTxModal}
                  className="flex-1 py-3 border border-[#E5E7EB] rounded-xl text-xs font-bold uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitTx}
                  disabled={createTransaction.isPending}
                  className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {createTransaction.isPending ? 'Submitting…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------- Stock Adjustment modal ---------- */}
      {adjItem && (
        <StockAdjustmentModal
          item={adjItem}
          outlets={outlets}
          isOpen={!!adjItem}
          onClose={() => setAdjItem(null)}
        />
      )}

      {/* ---------- Item Detail modal ---------- */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          isOpen={!!detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
};

function extractErr(e: any): string {
  const data = e?.response?.data;
  if (!data) return 'Something went wrong.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return `${data.error}: ${data.detail || ''}`.trim();
  // Field errors
  const flat: string[] = [];
  Object.entries(data).forEach(([k, v]) => {
    flat.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  });
  return flat.join(' • ') || 'Validation error.';
}
