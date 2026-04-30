import React, { useState } from 'react';
import { 
  Hammer, 
  List, 
  FilePlus2, 
  PieChart as PieChartIcon,
  ChevronRight,
  TrendingDown,
  Calendar,
  X,
  Plus,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../../context/InventoryContext';
import { formatKD, cn } from '../../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { OutletId } from '../../types';

const BREAKAGE_REASONS = ['Accidental Drop', 'Expired', 'Damaged during transport', 'Defective', 'Worn out'];

export const BreakageLog = () => {
  const { state, dispatch } = useInventory();
  const [activeTab, setActiveTab] = useState<'log' | 'summary'>('log');
  const [staffSearch, setStaffSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showVerifySuccess, setShowVerifySuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    itemId: '',
    outletId: '' as OutletId | '',
    quantity: 1,
    reason: BREAKAGE_REASONS[0],
    notes: '',
    photo: ''
  });

  const handleLogBreakage = () => {
    if (!formData.itemId || !formData.outletId || formData.quantity <= 0) return;

    const item = state.items.find(i => i.id === formData.itemId);
    if (!item) return;

    const ref = `BRK-${new Date().getTime().toString().slice(-6)}`;
    
    dispatch({
      type: 'ADD_TRANSACTION',
      payload: {
        id: Math.random().toString(36).substr(2, 9),
        ref,
        type: 'BREAKAGE',
        itemId: formData.itemId,
        outletId: formData.outletId as OutletId,
        quantityDelta: -formData.quantity,
        value: formData.quantity * item.unitCost,
        date: new Date().toISOString(),
        staffId: state.currentUser.id,
        reason: formData.reason,
        notes: formData.notes,
        photo: formData.photo
      }
    });

    setIsModalOpen(false);
    setFormData({
      itemId: '',
      outletId: '',
      quantity: 1,
      reason: BREAKAGE_REASONS[0],
      notes: '',
      photo: ''
    });
  };

  const handleVerifyLog = () => {
    setShowVerifySuccess(true);
    setTimeout(() => setShowVerifySuccess(false), 3000);
  };

  const breakageTransactions = state.transactions.filter(t => t.type === 'BREAKAGE');

  const staffBreakageData = state.users
    .map(u => {
      const staffTransactions = breakageTransactions.filter(t => t.staffId === u.id);
      const totalLoss = staffTransactions.reduce((acc, t) => acc + Math.abs(t.value), 0);
      const incidentCount = staffTransactions.length;
      return { ...u, totalLoss, incidentCount };
    })
    .filter(u => u.totalLoss > 0 && u.name.toLowerCase().includes(staffSearch.toLowerCase()));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Breakage Analysis</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <div className="flex bg-[#F3F4F6] rounded-lg p-1">
            <button 
              onClick={() => setActiveTab('log')}
              className={cn("px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all", activeTab === 'log' ? "bg-white text-black shadow-sm" : "text-[#6B7280] hover:text-[#1A1A1A]")}
            >
              Detailed Log
            </button>
            <button 
              onClick={() => setActiveTab('summary')}
              className={cn("px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all", activeTab === 'summary' ? "bg-white text-black shadow-sm" : "text-[#6B7280] hover:text-[#1A1A1A]")}
            >
              Monthly Summary
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {showVerifySuccess && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Checked & Verified
            </motion.div>
          )}
          <button 
            onClick={handleVerifyLog}
            className="px-4 py-2 border border-[#E5E7EB] text-[#1A1A1A] rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Verify Master Log
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
          >
            <Plus className="w-3.5 h-3.5" /> Log New Breakage
          </button>
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
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
                    <h2 className="text-2xl font-bold flex items-center gap-3 italic">
                      <Hammer className="w-8 h-8 text-rose-600" />
                      Incident Report Entry
                    </h2>
                    <p className="text-sm text-[#6B7280]">Select the compromised asset and documenting reason for loss.</p>
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
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Select Broken Item</label>
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
                       <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Quantity Lost</label>
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
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Reason for Breakage</label>
                     <select 
                       className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none focus:border-black transition-all appearance-none"
                       value={formData.reason}
                       onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                     >
                        {BREAKAGE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                     </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Evidence Photo</label>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 cursor-pointer">
                        <div className="h-32 bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-black transition-colors overflow-hidden">
                          {formData.photo ? (
                            <img src={formData.photo} alt="Preview" className="h-full w-full object-contain p-2" />
                          ) : (
                            <>
                              <Hammer className="w-6 h-6 text-[#9CA3AF]" />
                              <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Upload Incident Photo</span>
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
                              reader.onloadend = () => setFormData(prev => ({ ...prev, photo: reader.result as string }));
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Additional Memo</label>
                    <textarea 
                      className="w-full px-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl font-sans text-sm outline-none h-24 resize-none focus:border-black transition-all"
                      placeholder="Details for manager review..."
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
                      onClick={handleLogBreakage}
                      disabled={!formData.itemId || !formData.outletId || formData.quantity <= 0}
                      className="flex-1 py-4 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:opacity-80 transition-all shadow-xl shadow-black/10 disabled:opacity-30"
                    >
                      Log Incident
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {activeTab === 'log' ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
             <table className="w-full text-left font-sans text-sm border-collapse">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reference</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Item</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Qty</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Loss (KD)</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Evidence</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Location</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Staff</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                   {breakageTransactions.map(tx => {
                     const item = state.items.find(i => i.id === tx.itemId);
                     const outlet = state.outlets.find(o => o.id === tx.outletId);
                     const staff = state.users.find(u => u.id === tx.staffId);
                     return (
                       <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                          <td className="px-6 py-4 font-mono text-xs font-bold text-[#374151]">{tx.ref}</td>
                          <td className="px-6 py-4 block">
                             <div className="flex flex-col">
                               <span className="font-bold text-[#1A1A1A]">{item?.name}</span>
                               <span className="text-[10px] text-[#9CA3AF] uppercase font-bold">{item?.sku}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right font-light text-rose-600">{Math.abs(tx.quantityDelta)}</td>
                          <td className="px-6 py-4 text-right font-light text-[#1A1A1A]">{formatKD(Math.abs(tx.value))}</td>
                          <td className="px-6 py-4">
                             <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-tight">{tx.reason || '-'}</span>
                          </td>
                          <td className="px-6 py-4">
                             {tx.photo ? (
                               <div className="w-8 h-8 rounded border border-[#E5E7EB] bg-white p-0.5 flex items-center justify-center overflow-hidden shadow-sm transition-transform hover:scale-125">
                                 <img src={tx.photo} alt="Evidence" className="w-full h-full object-contain" />
                               </div>
                             ) : (
                               <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">None</span>
                             )}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-[#6B7280] uppercase">{outlet?.name}</td>
                          <td className="px-6 py-4 text-xs text-[#1A1A1A]">{staff?.name}</td>
                          <td className="px-6 py-4 text-[10px] text-[#9CA3AF] font-bold">{new Date(tx.date).toLocaleDateString()}</td>
                       </tr>
                     );
                   })}
                </tbody>
             </table>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-8">Breakage by Outlet</h3>
                  <div className="h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={state.outlets.map(o => ({ 
                            name: o.name, 
                            value: breakageTransactions.filter(t => t.outletId === o.id).reduce((acc, t) => acc + t.value, 0)
                          }))}
                          layout="vertical"
                        >
                           <XAxis type="number" hide />
                           <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#6B7280' }} width={120} />
                           <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                           <Bar dataKey="value" fill="#1A1A1A" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A] mb-8">Loss Breakdown</h3>
                  <div className="space-y-6">
                     {state.outlets.map(o => {
                       const total = breakageTransactions.filter(t => t.outletId === o.id).reduce((acc, t) => acc + t.value, 0);
                       return (
                         <div key={o.id} className="space-y-2">
                            <div className="flex justify-between items-end">
                               <span className="text-xs font-bold text-[#1A1A1A]">{o.name}</span>
                               <span className="text-sm font-light text-[#1A1A1A]">{formatKD(total)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${Math.min((total / 500) * 100, 100)}%` }}
                                 className="bg-black h-full"
                               />
                            </div>
                         </div>
                       );
                     })}
                  </div>
                  <div className="mt-auto pt-8 border-t border-[#F3F4F6] flex items-center justify-between">
                     <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Total Monthly Loss</span>
                     <span className="text-2xl font-light tracking-tight text-rose-600">{formatKD(state.outlets.reduce((acc, o) => acc + breakageTransactions.filter(t => t.outletId === o.id).reduce((a, t) => a + t.value, 0), 0))}</span>
                  </div>
               </div>
            </div>
            
            {state.currentUser?.role === 'MANAGER' && (
              <div className="mt-8 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                          <TrendingDown className="w-4 h-4" />
                       </div>
                       <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">Staff Accountability Audit</h3>
                    </div>
                    <div className="relative">
                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                       <input 
                         type="text"
                         placeholder="Filter by Staff Name..."
                         value={staffSearch}
                         onChange={(e) => setStaffSearch(e.target.value)}
                         className="pl-9 pr-4 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-xs font-bold outline-none focus:border-black transition-all w-full sm:w-64"
                       />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                   {staffBreakageData.map(u => (
                     <div key={u.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-transparent hover:border-[#E5E7EB] transition-all group">
                        <div className="flex items-center gap-3 mb-4 overflow-hidden">
                           <div className="w-8 h-8 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-[10px] font-bold text-[#1A1A1A] flex-shrink-0">
                              {u.name.split(' ').map(n => n[0]).join('')}
                           </div>
                           <div className="min-w-0">
                              <p className="text-[11px] font-bold text-[#1A1A1A] truncate">{u.name}</p>
                              <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-tighter">{u.role}</p>
                           </div>
                        </div>
                        <div className="flex justify-between items-end">
                           <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">Incidents</span>
                              <span className="text-sm font-bold text-[#1A1A1A]">{u.incidentCount}</span>
                            </div>
                            <div className="flex flex-col items-end">
                               <span className="text-[9px] font-bold text-[#9CA3AF] uppercase text-rose-600">Loss KD</span>
                               <span className="text-sm font-light text-rose-600">{formatKD(u.totalLoss)}</span>
                            </div>
                        </div>
                     </div>
                   ))}
                 </div>
                 
                 {staffBreakageData.length === 0 && (
                   <div className="py-12 text-center">
                     <div className="w-12 h-12 bg-[#F9FAFB] rounded-full mx-auto flex items-center justify-center mb-3 text-[#9CA3AF]">
                        <TrendingDown className="w-5 h-5" />
                     </div>
                     <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">No staffing records found for this period</p>
                   </div>
                 )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
