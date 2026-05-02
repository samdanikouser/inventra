import React, { useState } from 'react';
import { 
  Trash2, 
  Search, 
  Calendar,
  AlertTriangle,
  ChevronRight,
  TrendingDown,
  Plus,
  X
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { formatKD, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { OutletId } from '../../types';

const WRITE_OFF_REASONS = ['Expired', 'Quality Issues', 'Discontinued', 'Health & Safety', 'Other'];

export const WriteOffLog = () => {
  const { state, dispatch } = useInventory();
  const [search, setSearch] = useState('');
  const [filterReason, setFilterReason] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showVerifySuccess, setShowVerifySuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    itemId: '',
    outletId: '' as OutletId | '',
    quantity: 1,
    reason: WRITE_OFF_REASONS[0],
    notes: ''
  });

  const handleWriteOff = () => {
    if (!formData.itemId || !formData.outletId || formData.quantity <= 0) return;

    const item = state.items.find(i => i.id === formData.itemId);
    if (!item) return;

    const ref = `WO-${new Date().getTime().toString().slice(-6)}`;
    
    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        id: Math.random().toString(36).substr(2, 9),
        ref,
        type: 'WRITE_OFF',
        itemId: formData.itemId,
        outletId: formData.outletId as OutletId,
        quantityDelta: -formData.quantity,
        value: formData.quantity * item.unitCost,
        date: new Date().toISOString(),
        staffId: state.currentUser.id,
        reason: formData.reason,
        notes: formData.notes
      }
    });

    setIsModalOpen(false);
    setFormData({
      itemId: '',
      outletId: '',
      quantity: 1,
      reason: WRITE_OFF_REASONS[0],
      notes: ''
    });
  };

  const writeOffTransactions = state.transactions.filter(t => t.type === 'WRITE_OFF');

  const filteredTransactions = writeOffTransactions.filter(tx => {
    const item = state.items.find(i => i.id === tx.itemId);
    const staff = state.users.find(u => u.id === tx.staffId);
    const searchStr = `${tx.ref} ${item?.name} ${staff?.name} ${tx.notes}`.toLowerCase();
    
    const matchSearch = searchStr.includes(search.toLowerCase());
    const matchReason = filterReason === 'All' || tx.reason === filterReason;
    
    return matchSearch && matchReason;
  });

  const totalValue = filteredTransactions.reduce((acc, t) => acc + Math.abs(t.value), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600">
            <Trash2 className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Write-Off Ledger</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Asset Decommissioning Log</span>
        </div>
        <div className="flex items-center gap-3">
          {showVerifySuccess && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase"
            >
              <Trash2 className="w-3.5 h-3.5" /> Log Verified
            </motion.div>
          )}
          <button 
            onClick={() => {
              setShowVerifySuccess(true);
              setTimeout(() => setShowVerifySuccess(false), 3000);
            }}
            className="px-4 py-2 border border-[#E5E7EB] text-[#1A1A1A] rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Verify Master Log
          </button>
          <div className="relative w-64 mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Search write-offs..." 
              className="w-full pl-9 pr-4 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-xs font-bold outline-none focus:border-black transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#6B7280] outline-none"
            value={filterReason}
            onChange={(e) => setFilterReason(e.target.value)}
          >
            <option value="All">All Reasons</option>
            {WRITE_OFF_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <Plus className="w-3.5 h-3.5" /> Record Write-off
          </button>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-6">
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
                className="relative w-full max-w-xl bg-white rounded-[32px] border border-[#E5E7EB] shadow-2xl p-10 overflow-hidden"
              >
                <div className="mb-8 flex justify-between items-start">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <Trash2 className="w-8 h-8 text-rose-600" />
                      Asset Write-Off Request
                    </h2>
                    <p className="text-sm text-[#6B7280]">Decommissioning stock items from the active ledger.</p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-[#6B7280]" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Select Item</label>
                     <select 
                       className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                       value={formData.itemId}
                       onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                     >
                        <option value="">Select Item from Inventory...</option>
                        {state.items.map(i => <option key={i.id} value={i.id}>{i.sku} - {i.name}</option>)}
                     </select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Quantity to Write-off</label>
                       <input 
                         type="number" 
                         className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all"
                         value={formData.quantity}
                         onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                         min={1}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Location</label>
                       <select 
                         className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                         value={formData.outletId}
                         onChange={(e) => setFormData({ ...formData, outletId: e.target.value as OutletId })}
                       >
                          <option value="">Select Outlet...</option>
                          {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                       </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Decommission Reason</label>
                     <select 
                       className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                       value={formData.reason}
                       onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                     >
                        {WRITE_OFF_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Audit Notes / Justification</label>
                    <textarea 
                      className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none h-24 resize-none focus:border-black transition-all"
                      placeholder="Explain why this stock is being written off..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button 
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                    >
                      Discard
                    </button>
                    <button 
                      onClick={handleWriteOff}
                      disabled={!formData.itemId || !formData.outletId || formData.quantity <= 0}
                      className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-200 disabled:opacity-30"
                    >
                      Confirm Write-off
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm space-y-1">
              <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Total Write-Off Value</p>
              <p className="text-2xl font-light tracking-tight text-rose-600">{formatKD(totalValue)}</p>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm space-y-1">
              <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Incident Count</p>
              <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{filteredTransactions.length}</p>
           </div>
           <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Audit Required</p>
                <p className="text-sm font-bold text-[#1A1A1A]">Level 3 Verification</p>
              </div>
           </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <table className="w-full text-left font-sans text-sm border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reference</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item Details</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Qty</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Loss (KD)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Staff</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reason / Notes</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => {
                const item = state.items.find(i => i.id === tx.itemId);
                const staff = state.users.find(u => u.id === tx.staffId);
                return (
                  <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-[#374151]">{tx.ref}</td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col">
                         <span className="font-bold text-[#1A1A1A]">{item?.name}</span>
                         <span className="text-[10px] text-[#9CA3AF] uppercase font-bold">{item?.sku}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-rose-600">{Math.abs(tx.quantityDelta)}</td>
                    <td className="px-6 py-4 text-right font-light text-[#1A1A1A]">{formatKD(Math.abs(tx.value))}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-black text-white text-[8px] flex items-center justify-center font-bold">
                             {staff?.name.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-[#1A1A1A]">{staff?.name}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 min-w-[200px]">
                       {tx.reason && (
                         <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-md text-[9px] font-black uppercase tracking-wider mb-1.5">
                           {tx.reason}
                         </span>
                       )}
                       <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-2">{tx.notes || 'No additional notes'}</p>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold text-[#9CA3AF]">{new Date(tx.date).toLocaleDateString()}</td>
                  </tr>
                );
              })}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center opacity-30 space-y-4">
                       <Trash2 className="w-12 h-12" />
                       <p className="text-[10px] font-bold uppercase tracking-widest">No write-off transactions found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
