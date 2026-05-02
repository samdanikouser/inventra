import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Grid2X2, 
  List, 
  Plus, 
  MoreHorizontal, 
  AlertTriangle,
  History as HistoryIcon,
  ArrowRightLeft,
  Trash2,
  PackagePlus,
  Hammer,
  X,
  Clock,
  Download,
  User,
  MapPin,
  TrendingUp,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../../context/InventoryContext';
import { Category, OutletId, Item, TransactionType } from '../../types';
import { formatKD, getProgressBarColor, getColorForStatus, cn } from '../../utils';

const WRITE_OFF_REASONS = ['Damaged', 'Expired', 'Theft', 'Obsolete', 'Sold'];
const BREAKAGE_REASONS = ['Accidental Drop', 'Expired', 'Damaged during transport', 'Defective', 'Worn out'];

export const InventoryList = () => {
  const { state, dispatch } = useInventory();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const isMonthLocked = state.snapshots.some(s => s.month === currentMonth);
  
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [selectedOutlet, setSelectedOutlet] = useState<OutletId | 'All'>('All');
  
  // Transaction Modal State
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<number>(new Date().getFullYear());
  
  // Item Management Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemFormData, setItemFormData] = useState({
    sku: '',
    name: '',
    category: state.categories[0] || '',
    unit: 'pcs',
    minStock: 10,
    parLevel: 50,
    unitCost: 0,
    photo: ''
  });

  const resetItemForm = () => {
    setItemFormData({
      sku: '',
      name: '',
      category: state.categories[0] || '',
      unit: 'pcs',
      minStock: 10,
      parLevel: 50,
      unitCost: 0,
      photo: ''
    });
    setEditingItem(null);
  };

  const handleExportCSV = () => {
    const headers = ['SKU', 'Name', 'Category', 'Unit', 'WAC Cost', 'Min Stock', 'Par Level', ...state.outlets.map(o => o.name)];
    const rows = filteredItems.map(item => [
      item.sku,
      item.name,
      item.category,
      item.unit,
      item.unitCost,
      item.minStock,
      item.parLevel,
      ...state.outlets.map(o => item.stocks[o.id] || 0)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setItemFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveItem = () => {
    if (editingItem) {
      dispatch({ 
        type: 'UPDATE_ITEM', 
        payload: { ...itemFormData, id: editingItem.id } 
      });
    } else {
      const newItem: Item = {
        ...itemFormData,
        id: Math.random().toString(36).substr(2, 9),
        stocks: state.outlets.reduce((acc, o) => ({ ...acc, [o.id]: 0 }), {} as Record<OutletId, number>)
      };
      dispatch({ type: 'ADD_ITEM', payload: newItem });
    }
    setIsItemModalOpen(false);
    resetItemForm();
  };
  const [txQty, setTxQty] = useState(0);
  const [txNotes, setTxNotes] = useState('');
  const [txTargetOutlet, setTxTargetOutlet] = useState<OutletId | ''>('');
  const [txSourceOutlet, setTxSourceOutlet] = useState<OutletId | ''>('');
  const [txCost, setTxCost] = useState(0); // for purchases
  const [txSupplierId, setTxSupplierId] = useState<string>('');
  const [txReason, setTxReason] = useState<string>('');
  const [txPhoto, setTxPhoto] = useState<string>('');

  const filteredItems = useMemo(() => {
    return state.items.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchOutlet = selectedOutlet === 'All' || item.stocks[selectedOutlet as OutletId] !== undefined;
      return matchSearch && matchCategory && matchOutlet;
    });
  }, [state.items, search, selectedCategory, selectedOutlet]);

  const handleTransaction = () => {
    if (!selectedItem || !transactionType) return;
    
    // Validation for non-purchase transactions
    const sourceOutlet = selectedOutlet === 'All' ? txSourceOutlet as OutletId : selectedOutlet as OutletId;
    if (!sourceOutlet) {
      alert('Source outlet must be selected');
      return;
    }

    const availableStock = selectedItem.stocks[sourceOutlet] || 0;
    
    if (transactionType !== 'PURCHASE' && txQty > availableStock) {
      alert(`Insufficient stock at ${state.outlets.find(o => o.id === sourceOutlet)?.name}. Available: ${availableStock}`);
      return;
    }
    
    if (transactionType === 'TRANSFER' && !txTargetOutlet) {
      alert('Destination outlet required for transfer');
      return;
    }

    const delta = transactionType === 'PURCHASE' ? txQty : -txQty;
    const refPrefix = transactionType === 'PURCHASE' ? 'PO' : 
                      transactionType === 'BREAKAGE' ? 'BRK' :
                      transactionType === 'WRITE_OFF' ? 'WO' : 'TRF';
    
    const ref = `${refPrefix}-${new Date().getTime().toString().slice(-6)}`;

    // Add transaction logic here
    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        id: Math.random().toString(36).substr(2, 9),
        ref,
        type: transactionType,
        itemId: selectedItem.id,
        outletId: sourceOutlet,
        targetOutletId: transactionType === 'TRANSFER' ? txTargetOutlet as OutletId : undefined,
        quantityDelta: delta,
        value: transactionType === 'PURCHASE' ? txQty * txCost : txQty * selectedItem.unitCost,
        date: new Date().toISOString(),
        staffId: state.currentUser.id,
        notes: txNotes,
        reason: (transactionType === 'WRITE_OFF' || transactionType === 'BREAKAGE') ? txReason : undefined,
        photo: transactionType === 'BREAKAGE' ? txPhoto : undefined,
        unitCost: transactionType === 'PURCHASE' ? txCost : undefined,
        supplierId: transactionType === 'PURCHASE' ? txSupplierId : undefined
      }
    });

    setSelectedItem(null);
    setTransactionType(null);
    setTxQty(0);
    setTxNotes('');
    setTxSourceOutlet('');
    setTxTargetOutlet('');
    setTxSupplierId('');
    setTxReason('');
    setTxPhoto('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
       {isMonthLocked && (
         <div className="bg-[#1A1A1A] text-white py-1.5 px-8 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] animate-in fade-in slide-in-from-top duration-500 shrink-0">
           <Lock className="w-3 h-3" />
           Audit Lock Active: Market valuation sealed for {new Date().toLocaleString('default', { month: 'long' })}
         </div>
       )}
       <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Master Inventory</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">{filteredItems.length} SKUs Listed</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> Export Dataset
          </button>
          <button 
            onClick={() => { resetItemForm(); setIsItemModalOpen(true); }}
            disabled={isMonthLocked}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> {isMonthLocked ? 'Audit Lock' : 'Add New Item'}
          </button>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-6">
        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Search by SKU, name or category..." 
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl font-sans text-sm focus:outline-none focus:ring-1 focus:ring-black placeholder:text-[#9CA3AF] transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <select 
                className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl font-sans text-xs font-bold text-[#6B7280] uppercase tracking-wide outline-none cursor-pointer shadow-sm hover:border-black transition-colors"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
              >
                <option value="All">All Categories</option>
                {state.categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              <select 
                className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl font-sans text-xs font-bold text-[#6B7280] uppercase tracking-wide outline-none cursor-pointer shadow-sm hover:border-black transition-colors"
                value={selectedOutlet}
                onChange={(e) => setSelectedOutlet(e.target.value as any)}
              >
                <option value="All">All Outlets</option>
                {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-1 flex gap-1 shadow-sm">
              <button 
                onClick={() => setView('grid')}
                className={cn("p-2 transition-all rounded-lg", view === 'grid' ? "bg-black text-white shadow-sm" : "text-[#6B7280] hover:bg-gray-50")}
              >
                <Grid2X2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setView('table')}
                className={cn("p-2 transition-all rounded-lg", view === 'table' ? "bg-black text-white shadow-sm" : "text-[#6B7280] hover:bg-gray-50")}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Main View */}
        {view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
            {filteredItems.map(item => {
              const currentOutletId = selectedOutlet === 'All' ? 'OUT-001' : selectedOutlet as OutletId;
              const stockAtOutlet = item.stocks[currentOutletId] || 0;
              const isLow = stockAtOutlet < item.minStock;
              const isOut = stockAtOutlet <= 0;
              
              return (
                <motion.div 
                  layout
                  key={item.id} 
                  className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all group flex flex-col overflow-hidden"
                >
                  <div 
                    onClick={() => setHistoryItem(item)}
                    className="h-44 bg-[#F9FAFB] border-b border-[#E5E7EB] relative overflow-hidden flex items-center justify-center p-6 cursor-pointer"
                  >
                    {item.photo ? (
                      <img src={item.photo} alt={item.name} className="w-full h-full object-contain mix-blend-multiply transition-transform group-hover:scale-105 duration-500" />
                    ) : (
                      <div className="flex flex-col items-center text-[#E5E7EB]">
                         <PackagePlus className="w-16 h-16" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span className="text-[10px] font-bold bg-white text-black border border-[#E5E7EB] px-2 py-1 rounded-lg shadow-sm">{item.sku}</span>
                      {state.currentUser.role === 'MANAGER' && (
                        <button 
                          onClick={(e) => {
                            if (isMonthLocked) return;
                            e.stopPropagation();
                            setEditingItem(item);
                            setItemFormData({
                              sku: item.sku,
                              name: item.name,
                              category: item.category,
                              unit: item.unit,
                              minStock: item.minStock,
                              parLevel: item.parLevel,
                              unitCost: item.unitCost,
                              photo: item.photo || ''
                            });
                            setIsItemModalOpen(true);
                          }}
                          disabled={isMonthLocked}
                          className="text-[10px] font-bold bg-white text-black border border-[#E5E7EB] px-2 py-1 rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {isMonthLocked ? 'LOCKED' : 'EDIT'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1 space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-4">
                        <h3 
                          onClick={() => setHistoryItem(item)}
                          className="text-sm font-bold text-[#1A1A1A] leading-tight line-clamp-2 min-h-[2.5rem] cursor-pointer hover:text-black transition-colors"
                        >
                          {item.name}
                        </h3>
                        <div className={cn(
                          "flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide",
                          isOut ? "bg-red-50 text-red-600 border border-red-100" : 
                          isLow ? "bg-orange-50 text-orange-600 border border-orange-100" : 
                          "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        )}>
                          {isOut ? 'OOS' : isLow ? 'LOW' : 'OK'}
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">{item.category}</p>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-end mb-1.5 px-0.5">
                           <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">Stock Level</span>
                           <span className="text-xs font-bold text-[#1A1A1A]">{stockAtOutlet} <span className="text-[#9CA3AF] font-medium">/ {item.parLevel}</span></span>
                        </div>
                        <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((stockAtOutlet / item.parLevel) * 100, 100)}%` }}
                            className={cn("h-full rounded-full", isOut ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-emerald-500")}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6]">
                         <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">WAC Value</span>
                            <span className="text-sm font-light tracking-tight text-[#1A1A1A]">{formatKD(item.unitCost)}</span>
                         </div>
                          <div className="flex gap-2">
                             {(state.currentUser.role === 'STAFF' || state.currentUser.role === 'SUPERVISOR' || state.currentUser.role === 'MANAGER') && (
                               <button 
                                 title="Log Breakage"
                                 disabled={isMonthLocked}
                                 onClick={() => { setSelectedItem(item); setTransactionType('BREAKAGE'); }}
                                 className="p-2 border border-[#E5E7EB] rounded-lg hover:bg-red-50 hover:border-red-200 text-[#6B7280] hover:text-red-600 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                               >
                                 <Hammer className="w-3.5 h-3.5" />
                               </button>
                             )}
                             {(state.currentUser.role === 'SUPERVISOR' || state.currentUser.role === 'MANAGER') && (
                               <button 
                                 title="Transfer"
                                 disabled={isMonthLocked}
                                 onClick={() => { setSelectedItem(item); setTransactionType('TRANSFER'); }}
                                 className="p-2 border border-[#E5E7EB] rounded-lg hover:bg-blue-50 hover:border-blue-200 text-[#6B7280] hover:text-blue-600 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                               >
                                 <ArrowRightLeft className="w-3.5 h-3.5" />
                               </button>
                             )}
                             {(state.currentUser.role === 'SUPERVISOR' || state.currentUser.role === 'MANAGER') && (
                               <button 
                                 title="Purchase"
                                 disabled={isMonthLocked}
                                 onClick={() => { setSelectedItem(item); setTransactionType('PURCHASE'); }}
                                 className="p-2 bg-black text-white rounded-lg hover:opacity-80 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                               >
                                 <Plus className="w-3.5 h-3.5" />
                               </button>
                             )}
                              {state.currentUser.role === 'MANAGER' && (
                                <button 
                                  title="Write-off"
                                  disabled={isMonthLocked}
                                  onClick={() => { setSelectedItem(item); setTransactionType('WRITE_OFF'); }}
                                  className="p-2 border border-[#E5E7EB] rounded-lg hover:bg-rose-50 hover:border-rose-200 text-[#6B7280] hover:text-rose-600 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Units</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Capacity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Value (WAC)</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const currentOutletId = selectedOutlet === 'All' ? 'OUT-001' : selectedOutlet as OutletId;
                  const stock = item.stocks[currentOutletId] || 0;
                  const isLow = stock < item.minStock;
                  return (
                    <tr key={item.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-[#374151]">{item.sku}</td>
                      <td className="px-6 py-4">
                         <div 
                          onClick={() => setHistoryItem(item)}
                          className="flex items-center gap-3 cursor-pointer group/row"
                         >
                            <div className="w-8 h-8 bg-[#F9FAFB] border border-[#E5E7EB] rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                               {item.photo ? (
                                 <img src={item.photo} alt={item.name} className="w-full h-full object-contain mix-blend-multiply transition-transform group-hover/row:scale-110" />
                               ) : (
                                 <PackagePlus className="w-4 h-4 text-[#E5E7EB]" />
                               )}
                            </div>
                            <div className="flex flex-col">
                               <span className="font-bold text-[#1A1A1A] group-hover/row:text-black transition-colors">{item.name}</span>
                               <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-tight">{item.category}</span>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right font-light text-base text-[#1A1A1A]">{stock} <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">{item.unit}</span></td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex flex-col items-end">
                            <span className="text-[11px] font-bold text-[#374151]">{item.minStock} min / {item.parLevel} par</span>
                            <div className="w-20 h-1 bg-[#F3F4F6] rounded-full mt-1.5 overflow-hidden">
                               <div className={cn("h-full", isLow ? "bg-orange-500" : "bg-emerald-500")} style={{ width: `${Math.min((stock/item.parLevel)*100, 100)}%` }} />
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right font-light text-[#1A1A1A]">{formatKD(item.unitCost)}</td>
                      <td className="px-6 py-4">
                         <span className={cn(
                           "px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest",
                           isLow ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                         )}>
                           {isLow ? 'Alert' : 'Stable'}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            title="History"
                            onClick={() => setHistoryItem(item)}
                            className="p-1.5 text-[#6B7280] hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <HistoryIcon className="w-4 h-4" />
                          </button>
                          
                          {(state.currentUser.role === 'STAFF' || state.currentUser.role === 'SUPERVISOR' || state.currentUser.role === 'MANAGER') && (
                            <button 
                              title="Breakage"
                              onClick={() => { setSelectedItem(item); setTransactionType('BREAKAGE'); }}
                              className="p-1.5 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Hammer className="w-4 h-4" />
                            </button>
                          )}

                          {(state.currentUser.role === 'SUPERVISOR' || state.currentUser.role === 'MANAGER') && (
                            <button 
                              title="Transfer"
                              onClick={() => { setSelectedItem(item); setTransactionType('TRANSFER'); }}
                              className="p-1.5 text-[#6B7280] hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                          )}

                          {(state.currentUser.role === 'SUPERVISOR' || state.currentUser.role === 'MANAGER') && (
                            <button 
                              title="Purchase"
                              onClick={() => { setSelectedItem(item); setTransactionType('PURCHASE'); }}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </button>
                          )}

                          <button 
                            title="More"
                            className="p-1.5 text-[#6B7280] hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
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

        {/* Transaction Modal (Overlay) */}
        <AnimatePresence>
          {selectedItem && transactionType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setSelectedItem(null); setTransactionType(null); }}
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative w-full max-w-lg bg-white rounded-3xl border border-[#E5E7EB] shadow-2xl p-8 overflow-hidden"
              >
                <div className="mb-8 space-y-1">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    {transactionType === 'PURCHASE' ? <PackagePlus className="w-6 h-6 text-emerald-600" /> : 
                     transactionType === 'BREAKAGE' ? <Hammer className="w-6 h-6 text-red-600" /> :
                     transactionType === 'WRITE_OFF' ? <Trash2 className="w-6 h-6 text-red-600" /> : <ArrowRightLeft className="w-6 h-6 text-blue-600" />}
                    {transactionType === 'PURCHASE' ? 'New Purchase' : 
                     transactionType === 'BREAKAGE' ? 'Log Breakage' :
                     transactionType === 'WRITE_OFF' ? 'Record Write-off' : 'Transfer Stock'}
                  </h2>
                  <p className="text-sm text-[#6B7280] font-medium px-0.5">{selectedItem.sku} • {selectedItem.name}</p>
                </div>

                <div className="space-y-6">
                  {selectedOutlet === 'All' && (
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                         {transactionType === 'TRANSFER' ? 'Transfer From' : 'Source Outlet'}
                       </label>
                       <select 
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                          value={txSourceOutlet}
                          onChange={(e) => setTxSourceOutlet(e.target.value as OutletId)}
                       >
                          <option value="">Select Outlet...</option>
                          {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                       </select>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Quantity ({selectedItem.unit})</label>
                       <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                          value={txQty}
                          onChange={(e) => setTxQty(Number(e.target.value))}
                          min={1}
                       />
                    </div>

                    {transactionType === 'PURCHASE' && (
                      <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Vendor / Supplier</label>
                          <select 
                            className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                            value={txSupplierId}
                            onChange={(e) => setTxSupplierId(e.target.value)}
                          >
                            <option value="">Select Vendor...</option>
                            {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Value (per unit)</label>
                          <input 
                              type="number" 
                              step="0.001"
                              className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                              value={txCost}
                              onChange={(e) => setTxCost(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    )}

                    {transactionType === 'TRANSFER' && (
                      <div className="space-y-2 col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Destination Outlet</label>
                        <select 
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                          value={txTargetOutlet}
                          onChange={(e) => setTxTargetOutlet(e.target.value as OutletId)}
                        >
                          <option value="">Select Target...</option>
                          {state.outlets.filter(o => o.id !== (selectedOutlet === 'All' ? txSourceOutlet : selectedOutlet)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Reason / Internal Memo</label>
                     {(transactionType === 'WRITE_OFF' || transactionType === 'BREAKAGE') && (
                       <select 
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none mb-3"
                          value={txReason}
                          onChange={(e) => setTxReason(e.target.value)}
                       >
                          <option value="">Select Reason...</option>
                          {transactionType === 'WRITE_OFF' ? WRITE_OFF_REASONS.map(r => <option key={r} value={r}>{r}</option>) : BREAKAGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                       </select>
                     )}
                     
                     {transactionType === 'BREAKAGE' && (
                       <div className="mb-4">
                         <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Evidence Photo (Optional)</label>
                         <div className="flex items-center gap-4">
                           <label className="flex-1 cursor-pointer">
                             <div className="h-24 bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-black transition-colors">
                               {txPhoto ? (
                                 <img src={txPhoto} alt="Preview" className="h-full w-full object-contain p-2" />
                               ) : (
                                 <>
                                   <Hammer className="w-6 h-6 text-[#9CA3AF]" />
                                   <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Click to upload photo</span>
                                 </>
                               )}
                             </div>
                             <input 
                               type="file" 
                               accept="image/*" 
                               className="hidden" 
                               onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) {
                                   const reader = new FileReader();
                                   reader.onloadend = () => setTxPhoto(reader.result as string);
                                   reader.readAsDataURL(file);
                                 }
                               }}
                             />
                           </label>
                           {txPhoto && (
                             <button 
                               onClick={() => setTxPhoto('')}
                               className="p-2 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100 transition-colors"
                             >
                               <X className="w-4 h-4" />
                             </button>
                           )}
                         </div>
                       </div>
                     )}

                     <textarea 
                        className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none h-24 resize-none focus:border-black transition-all"
                        placeholder="Provide details for auditor review..."
                        value={txNotes}
                        onChange={(e) => setTxNotes(e.target.value)}
                     />
                  </div>

                  <div className="pt-6 border-t border-[#F3F4F6] space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wide">Projected Impact</span>
                      <span className={cn(
                        "text-lg font-bold tracking-tight",
                        transactionType === 'PURCHASE' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        Stock {transactionType === 'PURCHASE' ? '+' : '-'}{txQty} units
                      </span>
                    </div>
                    
                    <div className="flex gap-4">
                      <button 
                        onClick={() => { setSelectedItem(null); setTransactionType(null); }}
                        className="flex-1 py-3 border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={handleTransaction}
                        disabled={txQty <= 0 || (selectedOutlet === 'All' && !txSourceOutlet) || (transactionType === 'TRANSFER' && !txTargetOutlet)}
                        className="flex-1 py-3 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-all shadow-lg shadow-black/10 disabled:opacity-30"
                      >
                        Confirm Transaction
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Item Management Modal */}
        <AnimatePresence>
          {historyItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-end">
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 onClick={() => setHistoryItem(null)}
                 className="absolute inset-0 bg-black/30 backdrop-blur-sm"
               />
               <motion.div 
                 initial={{ x: '100%' }}
                 animate={{ x: 0 }}
                 exit={{ x: '100%' }}
                 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                 className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col"
               >
                  <div className="p-8 border-b border-[#E5E7EB] flex items-center justify-between bg-white shrink-0">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl flex items-center justify-center p-2">
                           {historyItem.photo ? (
                             <img src={historyItem.photo} alt={historyItem.name} className="w-full h-full object-contain mix-blend-multiply" />
                           ) : (
                             <PackagePlus className="w-6 h-6 text-[#E5E7EB]" />
                           )}
                        </div>
                        <div>
                           <h2 className="text-xl font-bold tracking-tight">{historyItem.name}</h2>
                           <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{historyItem.sku} • {historyItem.category}</p>
                        </div>
                     </div>
                     <button 
                        onClick={() => setHistoryItem(null)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                     >
                        <X className="w-6 h-6 text-[#6B7280]" />
                     </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8">
                     {/* YTD Performance */}
                     {(() => {
                        const targetYear = selectedHistoryYear;
                        const itemTransactions = state.transactions.filter(t => t.itemId === historyItem.id && (targetYear === 0 || new Date(t.date).getFullYear() === targetYear));
                        const ytdPurchase = itemTransactions.filter(t => t.type === 'PURCHASE').reduce((sum, t) => sum + t.quantityDelta, 0);
                        const ytdBreakage = Math.abs(itemTransactions.filter(t => t.type === 'BREAKAGE').reduce((sum, t) => sum + t.quantityDelta, 0));
                        const currentStock = (Object.values(historyItem.stocks) as number[]).reduce((a, b) => a + b, 0);
                        
                        return (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                               <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">
                                 {targetYear === 0 ? 'Overall Performance' : `Year Performance (${targetYear})`}
                               </h3>
                               <select 
                                 value={selectedHistoryYear}
                                 onChange={(e) => setSelectedHistoryYear(Number(e.target.value))}
                                 className="text-[10px] font-bold border border-[#E5E7EB] rounded px-2 py-1 outline-none bg-white cursor-pointer hover:border-black transition-colors"
                               >
                                  <option value="0">Overall (Till Date)</option>
                                  <option value={new Date().getFullYear()}>{new Date().getFullYear()} (Current)</option>
                                  <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                                  <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
                               </select>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-1">
                                <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Purchases</p>
                                <p className="text-lg font-bold tracking-tight text-emerald-700">{ytdPurchase}</p>
                              </div>
                              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-1">
                                <p className="text-[9px] text-rose-600 font-bold uppercase tracking-wider">Breakage</p>
                                <p className="text-lg font-bold tracking-tight text-rose-700">{ytdBreakage}</p>
                              </div>
                              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-1">
                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">In Stock</p>
                                <p className="text-lg font-bold tracking-tight text-gray-900">{currentStock}</p>
                              </div>
                            </div>
                          </div>
                        );
                     })()}

                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB] space-y-1">
                           <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">Current Par Level</p>
                           <p className="text-xl font-light tracking-tight">{historyItem.parLevel} {historyItem.unit}</p>
                        </div>
                        <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB] space-y-1">
                           <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">Min. Stock</p>
                           <p className="text-xl font-light tracking-tight text-orange-600">{historyItem.minStock} {historyItem.unit}</p>
                        </div>
                        <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB] space-y-1">
                           <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">Unit Cost (WAC)</p>
                           <p className="text-xl font-light tracking-tight">{formatKD(historyItem.unitCost)}</p>
                        </div>
                        <div className="bg-[#F9FAFB] p-5 rounded-2xl border border-[#E5E7EB] space-y-1">
                           <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">Total Stock Value</p>
                           <p className="text-xl font-light tracking-tight text-emerald-600">
                             {formatKD((Object.values(historyItem.stocks) as number[]).reduce((a: number, b: number) => a + b, 0) * historyItem.unitCost)}
                           </p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">Ledger Timeline</h3>
                        <div className="space-y-3">
                           {state.transactions
                             .filter(t => t.itemId === historyItem.id)
                             .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                             .map((tx, idx) => {
                               const staff = state.users.find(u => u.id === tx.staffId);
                               const isPositive = tx.quantityDelta > 0;
                               return (
                                 <motion.div 
                                   initial={{ opacity: 0, y: 10 }}
                                   animate={{ opacity: 1, y: 0 }}
                                   transition={{ delay: idx * 0.05 }}
                                   key={tx.id} 
                                   className="group bg-white p-5 rounded-2xl border border-[#E5E7EB] hover:border-black transition-all shadow-sm"
                                 >
                                    <div className="flex items-start justify-between mb-4">
                                       <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "w-10 h-10 rounded-xl flex items-center justify-center",
                                            tx.type === 'PURCHASE' ? "bg-emerald-50 text-emerald-600" :
                                            tx.type === 'BREAKAGE' || tx.type === 'WRITE_OFF' ? "bg-rose-50 text-rose-600" :
                                            "bg-blue-50 text-blue-600"
                                          )}>
                                             {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                          </div>
                                          <div>
                                             <p className="text-sm font-bold tracking-tight">{tx.type.replace('_', ' ')}</p>
                                             <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{tx.ref}</p>
                                          </div>
                                       </div>
                                       <span className={cn(
                                         "text-lg font-bold tracking-tighter",
                                         isPositive ? "text-emerald-600" : "text-rose-600"
                                       )}>
                                         {isPositive ? '+' : ''}{tx.quantityDelta}
                                       </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#F3F4F6] text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">
                                       <div className="flex items-center gap-2">
                                          <Clock className="w-3 h-3" />
                                          {new Date(tx.date).toLocaleDateString()}
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <User className="w-3 h-3" />
                                          {staff?.name}
                                       </div>
                                       <div className="flex items-center gap-2 col-span-2">
                                          <MapPin className="w-3 h-3" />
                                          {state.outlets.find(o => o.id === tx.outletId)?.name}
                                          {tx.targetOutletId && (
                                            <>
                                              <ChevronRight className="w-2.5 h-2.5 mx-1" />
                                              {state.outlets.find(o => o.id === tx.targetOutletId)?.name}
                                            </>
                                          )}
                                       </div>
                                    </div>
                                    {tx.notes && (
                                      <p className="mt-4 text-xs text-[#6B7280] italic leading-relaxed">
                                        "{tx.notes}"
                                      </p>
                                    )}
                                 </motion.div>
                               );
                             })}
                           {state.transactions.filter(t => t.itemId === historyItem.id).length === 0 && (
                             <div className="py-20 flex flex-col items-center justify-center opacity-30 space-y-4">
                                <HistoryIcon className="w-12 h-12" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">No transaction history available</p>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>

                  <div className="p-8 border-t border-[#E5E7EB] bg-gray-50 flex items-center justify-between">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Audit Integrity</span>
                        <span className="text-xs font-bold text-[#1A1A1A]">RECONCILED BY AI ENGINE</span>
                     </div>
                     <button 
                        onClick={() => setHistoryItem(null)}
                        className="px-6 py-3 bg-black text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
                     >
                        Close History
                     </button>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Item Management Modal */}
        <AnimatePresence>
          {isItemModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setIsItemModalOpen(false); resetItemForm(); }}
                className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative w-full max-w-2xl bg-white rounded-3xl border border-[#E5E7EB] shadow-2xl p-8 overflow-hidden"
              >
                <div className="mb-8 flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold">{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                    <p className="text-sm text-[#6B7280]">Define master properties for inventory tracking.</p>
                  </div>
                  <button 
                    onClick={() => { setIsItemModalOpen(false); resetItemForm(); }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Plus className="w-5 h-5 rotate-45 text-[#6B7280]" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">SKU Reference</label>
                       <input 
                          type="text" 
                          placeholder="e.g. CRO-001"
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                          value={itemFormData.sku}
                          onChange={(e) => setItemFormData({...itemFormData, sku: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Item Name</label>
                       <input 
                          type="text" 
                          placeholder="e.g. Dinner Plate 12 inch"
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                          value={itemFormData.name}
                          onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})}
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Category</label>
                        <select 
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                          value={itemFormData.category}
                          onChange={(e) => setItemFormData({...itemFormData, category: e.target.value})}
                        >
                          {state.categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Unit</label>
                        <input 
                          type="text" 
                          placeholder="pcs"
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                          value={itemFormData.unit}
                          onChange={(e) => setItemFormData({...itemFormData, unit: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Item Photo</label>
                      <div className="flex flex-col gap-4">
                        <div className="w-full h-32 bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-2xl flex items-center justify-center relative overflow-hidden group">
                          {itemFormData.photo ? (
                            <>
                              <img src={itemFormData.photo} alt="Preview" className="w-full h-full object-contain p-2" />
                              <button 
                                onClick={() => setItemFormData({...itemFormData, photo: ''})}
                                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-[#9CA3AF]">
                              <PackagePlus className="w-8 h-8" />
                              <span className="text-[10px] font-bold">No photo added</span>
                            </div>
                          )}
                        </div>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="item-photo-upload"
                        />
                        <label 
                          htmlFor="item-photo-upload"
                          className="w-full py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-[10px] font-bold uppercase tracking-widest text-center cursor-pointer hover:border-black transition-colors"
                        >
                          Upload Image
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Min. Stock</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                          value={itemFormData.minStock}
                          onChange={(e) => setItemFormData({...itemFormData, minStock: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Par Level</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                          value={itemFormData.parLevel}
                          onChange={(e) => setItemFormData({...itemFormData, parLevel: Number(e.target.value)})}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-[#F3F4F6] flex gap-4">
                  <button 
                    onClick={() => { setIsItemModalOpen(false); resetItemForm(); }}
                    className="flex-1 py-3 border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveItem}
                    disabled={!itemFormData.sku || !itemFormData.name}
                    className="flex-1 py-3 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-all shadow-lg shadow-black/10 disabled:opacity-30"
                  >
                    {editingItem ? 'Save Changes' : 'Create Item'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
