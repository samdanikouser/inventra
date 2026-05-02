import React, { useState } from 'react';
import { 
  ArrowRightLeft, 
  Search, 
  Plus, 
  ArrowRight, 
  Warehouse, 
  Package,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { OutletId, Item } from '../../types';
import { formatKD, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';

export const TransferManager = () => {
  const { state, dispatch } = useInventory();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    itemId: '',
    sourceOutletId: '' as OutletId | '',
    targetOutletId: '' as OutletId | '',
    quantity: 0,
    notes: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [filterSourceOutlet, setFilterSourceOutlet] = useState<string>('All');
  const [filterTargetOutlet, setFilterTargetOutlet] = useState<string>('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const selectedItem = state.items.find(i => i.id === formData.itemId);
  const sourceOutlet = state.outlets.find(o => o.id === formData.sourceOutletId);
  const targetOutlet = state.outlets.find(o => o.id === formData.targetOutletId);

  const availableStock = selectedItem && formData.sourceOutletId 
    ? selectedItem.stocks[formData.sourceOutletId as OutletId] || 0 
    : 0;

  const filteredItems = state.items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTransfer = () => {
    if (!formData.itemId || !formData.sourceOutletId || !formData.targetOutletId || formData.quantity <= 0) {
      alert('All fields are required and quantity must be positive');
      return;
    }

    if (formData.quantity > availableStock) {
      alert(`Insufficient stock at ${sourceOutlet?.name}. Available: ${availableStock}`);
      return;
    }

    const ref = `TRF-${new Date().getTime().toString().slice(-6)}`;
    
    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        id: Math.random().toString(36).substr(2, 9),
        ref,
        type: 'TRANSFER',
        itemId: formData.itemId,
        outletId: formData.sourceOutletId as OutletId,
        targetOutletId: formData.targetOutletId as OutletId,
        quantityDelta: -formData.quantity, // Source decrements
        value: formData.quantity * (selectedItem?.unitCost || 0),
        date: new Date().toISOString(),
        staffId: state.currentUser.id,
        notes: formData.notes
      }
    });

    setIsModalOpen(false);
    setFormData({
      itemId: '',
      sourceOutletId: '',
      targetOutletId: '',
      quantity: 0,
      notes: ''
    });
  };

  const transfers = state.transactions
    .filter(t => t.type === 'TRANSFER')
    .filter(t => {
      const item = state.items.find(i => i.id === t.itemId);
      const source = state.outlets.find(o => o.id === t.outletId);
      const target = state.outlets.find(o => o.id === t.targetOutletId);
      
      const matchSearch = (
        t.ref.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        item?.name.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
        item?.sku.toLowerCase().includes(historySearchQuery.toLowerCase())
      );
      
      const matchSource = filterSourceOutlet === 'All' || t.outletId === filterSourceOutlet;
      const matchTarget = filterTargetOutlet === 'All' || t.targetOutletId === filterTargetOutlet;
      
      let matchDate = true;
      if (dateRange.start) {
        matchDate = matchDate && new Date(t.date) >= new Date(dateRange.start);
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        matchDate = matchDate && new Date(t.date) <= endDate;
      }

      return matchSearch && matchSource && matchTarget && matchDate;
    });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Stock Transfers</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Inter-outlet Logistics</span>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
        >
          <Plus className="w-3.5 h-3.5" /> Initialize New Transfer
        </button>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
             <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Active Transfers</p>
             <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{transfers.length}</p>
          </div>
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
             <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Volume Moved (Monthly)</p>
             <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">
               {transfers.reduce((acc, t) => acc + Math.abs(t.quantityDelta), 0)} units
             </p>
          </div>
          <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
             <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Transit Valuation</p>
             <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">
               {formatKD(transfers.reduce((acc, t) => acc + t.value, 0))}
             </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">Recent Transfer Ledger</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">From</span>
                <input 
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-2 py-1 bg-white border border-[#E5E7EB] rounded-lg text-[10px] outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">To</span>
                <input 
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-2 py-1 bg-white border border-[#E5E7EB] rounded-lg text-[10px] outline-none"
                />
              </div>
              <select 
                className="text-[10px] font-bold bg-white border border-[#E5E7EB] rounded px-2 py-1.5 outline-none"
                value={filterSourceOutlet}
                onChange={(e) => setFilterSourceOutlet(e.target.value)}
              >
                <option value="All">All Origins</option>
                {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <select 
                className="text-[10px] font-bold bg-white border border-[#E5E7EB] rounded px-2 py-1.5 outline-none"
                value={filterTargetOutlet}
                onChange={(e) => setFilterTargetOutlet(e.target.value)}
              >
                <option value="All">All Destinations</option>
                {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input 
                  type="text"
                  placeholder="Filter history..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-[#E5E7EB] rounded-lg text-xs outline-none focus:border-black transition-all w-48"
                />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <table className="w-full text-left font-sans text-sm border-collapse">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ref ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Route</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Quantity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center opacity-30">
                      <ArrowRightLeft className="w-10 h-10 mx-auto mb-4" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No transfer records found</p>
                    </td>
                  </tr>
                ) : (
                  transfers.map(tx => {
                    const item = state.items.find(i => i.id === tx.itemId);
                    const source = state.outlets.find(o => o.id === tx.outletId);
                    const target = state.outlets.find(o => o.id === tx.targetOutletId);
                    return (
                      <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-[#1A1A1A]">{tx.ref}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-[#1A1A1A]">{item?.name}</span>
                            <span className="text-[10px] text-[#9CA3AF] font-bold uppercase">{item?.sku}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 rounded-md text-[#6B7280]">{source?.name}</span>
                             <ArrowRight className="w-3 h-3 text-[#9CA3AF]" />
                             <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 rounded-md text-blue-600">{target?.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-[#1A1A1A]">{Math.abs(tx.quantityDelta)} units</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-[#9CA3AF]">
                           {new Date(tx.date).toLocaleDateString()} at {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-1.5 text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Completed</span>
                           </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] border border-[#E5E7EB] shadow-2xl p-10 overflow-hidden"
            >
              <div className="mb-8 flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold flex items-center gap-3">
                    <ArrowRightLeft className="w-8 h-8 text-blue-600" />
                    Internal Stock Transfer
                  </h2>
                  <p className="text-sm text-[#6B7280]">Relocate inventory assets between physical outlets.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-[#6B7280]" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Departure Point (Source)</label>
                      <div className="relative">
                        <Warehouse className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                        <select 
                          className="w-full pl-11 pr-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                          value={formData.sourceOutletId}
                          onChange={(e) => setFormData({ ...formData, sourceOutletId: e.target.value as OutletId, itemId: '', quantity: 0 })}
                        >
                           <option value="">Select Origin...</option>
                           {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Arrival Point (Target)</label>
                      <div className="relative">
                        <Warehouse className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                        <select 
                          className="w-full pl-11 pr-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                          value={formData.targetOutletId}
                          onChange={(e) => setFormData({ ...formData, targetOutletId: e.target.value as OutletId })}
                          disabled={!formData.sourceOutletId}
                        >
                           <option value="">Select Destination...</option>
                           {state.outlets.filter(o => o.id !== formData.sourceOutletId).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Select Inventory Item</label>
                   <div className="relative">
                     <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                     <select 
                       className="w-full pl-11 pr-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none disabled:opacity-50"
                       value={formData.itemId}
                       onChange={(e) => setFormData({ ...formData, itemId: e.target.value, quantity: 0 })}
                       disabled={!formData.sourceOutletId}
                     >
                        <option value="">Choose item to relocate...</option>
                        {state.items
                          .filter(i => (i.stocks[formData.sourceOutletId as OutletId] || 0) > 0)
                          .map(i => <option key={i.id} value={i.id}>{i.sku} - {i.name} ({i.stocks[formData.sourceOutletId as OutletId]} in stock)</option>)
                        }
                     </select>
                   </div>
                </div>

                {selectedItem && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 bg-blue-50 border border-blue-100 rounded-3xl grid grid-cols-2 gap-8"
                   >
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Available at {sourceOutlet?.name}</p>
                          <p className="text-3xl font-light tracking-tight text-blue-900">{availableStock} <span className="text-sm font-bold uppercase">{selectedItem.unit}</span></p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Relocate Quantity</p>
                          <input 
                            type="number" 
                            max={availableStock}
                            min={1}
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: Math.min(Number(e.target.value), availableStock) })}
                            className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl font-bold text-xl text-blue-900 outline-none focus:border-blue-500 transition-all shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Transfer Valuation</p>
                          <p className="text-3xl font-light tracking-tight text-blue-900">{formatKD(formData.quantity * selectedItem.unitCost)}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Internal Memo / Notes</p>
                           <textarea 
                             value={formData.notes}
                             onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                             className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm font-medium h-[4.5rem] resize-none outline-none focus:border-blue-500 transition-all shadow-sm"
                             placeholder="Reason for transfer..."
                           />
                        </div>
                      </div>
                   </motion.div>
                )}

                <div className="pt-6 flex gap-4">
                   <button 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                   >
                     Discard Request
                   </button>
                   <button 
                    onClick={handleTransfer}
                    disabled={!formData.itemId || !formData.sourceOutletId || !formData.targetOutletId || formData.quantity <= 0}
                    className="flex-1 py-4 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-all shadow-2xl shadow-black/20 disabled:opacity-30"
                   >
                     Certify & Execute Transfer
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
