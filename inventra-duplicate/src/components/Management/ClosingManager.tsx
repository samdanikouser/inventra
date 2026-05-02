import React, { useState } from 'react';
import { 
  Lock as LockIcon, 
  History as HistoryIcon, 
  Calendar, 
  ChevronRight, 
  FileText, 
  Download,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Warehouse,
  Printer
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { formatKD, cn } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { InventorySnapshot } from '../../types';

export const ClosingManager = () => {
  const { state, dispatch } = useInventory();
  const [view, setView] = useState<'LIST' | 'DETAIL'>('LIST');
  const [selectedSnapshot, setSelectedSnapshot] = useState<InventorySnapshot | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const isMonthAlreadyClosed = state.snapshots.some(s => s.month === currentMonth);

  const initiateClosing = () => {
    if (isMonthAlreadyClosed || state.currentUser.role !== 'MANAGER') return;
    setIsClosing(true);
  };

  const finalizeClosing = () => {
    const totalValuation = state.items.reduce((acc: number, item) => {
      const totalStock = (Object.values(item.stocks) as number[]).reduce((a: number, b: number) => a + b, 0);
      return acc + (totalStock * item.unitCost);
    }, 0);

    const outletBreakdown: Record<string, number> = {};
    state.outlets.forEach(o => {
      outletBreakdown[o.id] = state.items.reduce((acc: number, item) => {
        return acc + ((item.stocks[o.id] || 0) * item.unitCost);
      }, 0);
    });

    const snapshot: InventorySnapshot = {
      id: `SNP-${Math.random().toString(36).substr(2, 9)}`,
      month: currentMonth,
      closedAt: new Date().toISOString(),
      closedBy: state.currentUser.name,
      totalValuation,
      outletBreakdown,
      items: state.items.map(item => ({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        unitCost: item.unitCost,
        totalStock: (Object.values(item.stocks) as number[]).reduce((a: number, b: number) => (a as number) + (b as number), 0),
        valuation: (Object.values(item.stocks) as number[]).reduce((a: number, b: number) => (a as number) + (b as number), 0) * item.unitCost,
        stocks: { ...item.stocks }
      }))
    };

    dispatch({ type: 'CLOSE_MONTH', payload: snapshot });
    setIsClosing(false);
    setSelectedSnapshot(snapshot);
    setView('DETAIL');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
            <LockIcon className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Monthly Closing</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Financial Snapshots & Legal Audits</span>
        </div>
        <div className="flex items-center gap-3">
          {view === 'DETAIL' && (
             <button 
              onClick={() => setView('LIST')}
              className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors"
             >
                Back to Archive
             </button>
          )}
          {state.currentUser.role === 'MANAGER' && !isMonthAlreadyClosed && view === 'LIST' && (
            <button 
              onClick={initiateClosing}
              className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2 shadow-lg shadow-black/10"
            >
              <LockIcon className="w-3.5 h-3.5" /> Initialize {new Date().toLocaleString('default', { month: 'long' })} Closing
            </button>
          )}
        </div>
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        {view === 'LIST' ? (
          <div className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-[#1A1A1A] text-white p-8 rounded-3xl space-y-6 relative overflow-hidden">
                   <div className="relative z-10 space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">System Status</div>
                      <h3 className="text-3xl font-light tracking-tight italic leading-snug">
                        {isMonthAlreadyClosed ? 
                          `${new Date().toLocaleString('default', { month: 'long' })} books are securely locked.` : 
                          `${new Date().toLocaleString('default', { month: 'long' })} period is still active.`}
                      </h3>
                      <p className="text-sm text-white/50 leading-relaxed max-w-sm">
                        Monthly closing creates an immutable digital record of your inventory valuation. Once closed, valuations for this period cannot be altered by future transactions.
                      </p>
                   </div>
                   <HistoryIcon className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 opacity-50" />
                </div>

                <div className="bg-white border border-[#E5E7EB] rounded-3xl p-8 shadow-sm flex flex-col justify-between">
                   <div className="flex justify-between items-start">
                      <div className="space-y-1">
                         <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Active Period Snapshot</p>
                         <h3 className="text-xl font-bold">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                         <TrendingUp className="w-5 h-5" />
                      </div>
                   </div>
                   <div className="flex items-center justify-between border-t border-[#F3F4F6] pt-6 mt-6">
                      <div className="space-y-1">
                         <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Live Appraisal</span>
                         <p className="text-2xl font-light tracking-tight">
                            {formatKD(state.items.reduce((acc, item) => {
                               const totalStock = (Object.values(item.stocks) as number[]).reduce((a: number, b: number) => a + b, 0);
                               return acc + (totalStock * item.unitCost);
                            }, 0))}
                         </p>
                      </div>
                      {!isMonthAlreadyClosed && state.currentUser.role === 'MANAGER' && (
                        <button 
                          onClick={initiateClosing}
                          className="px-6 py-2.5 bg-[#F9FAFB] hover:bg-black hover:text-white border border-[#E5E7EB] hover:border-black rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                          Perform Closing
                        </button>
                      )}
                   </div>
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A] ml-2">Snapshot Archive</h3>
                <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                   {state.snapshots.length === 0 ? (
                     <div className="p-20 text-center space-y-4 opacity-30">
                        <Calendar className="w-12 h-12 mx-auto" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No historical snapshots found</p>
                     </div>
                   ) : (
                     <table className="w-full text-left font-sans text-sm border-collapse">
                        <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                           <tr>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Month / Period</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Final Valuation</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Closed At</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Auditor</th>
                              <th className="px-8 py-5 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody>
                           {state.snapshots.map(snp => (
                             <tr key={snp.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                                <td className="px-8 py-6">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-[#F3F4F6] rounded-xl flex items-center justify-center text-black group-hover:bg-white transition-colors">
                                         <Calendar className="w-5 h-5 transition-transform group-hover:scale-110" />
                                      </div>
                                      <span className="font-bold text-base tracking-tight">{new Date(snp.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                                   </div>
                                </td>
                                <td className="px-8 py-6 font-light text-base text-[#1A1A1A]">{formatKD(snp.totalValuation)}</td>
                                <td className="px-8 py-6 text-xs font-medium text-[#6B7280]">{new Date(snp.closedAt).toLocaleDateString()} at {new Date(snp.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="px-8 py-6 text-xs text-[#1A1A1A] font-bold">{snp.closedBy}</td>
                                <td className="px-8 py-6 text-right">
                                   <button 
                                    onClick={() => { setSelectedSnapshot(snp); setView('DETAIL'); }}
                                    className="p-2 hover:bg-black hover:text-white border border-transparent hover:border-black rounded-lg transition-all"
                                   >
                                      <ChevronRight className="w-4 h-4" />
                                   </button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                   )}
                </div>
             </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between">
                <div className="space-y-1">
                   <h3 className="text-2xl font-light tracking-tight italic">
                      Inventory Audit: {new Date(selectedSnapshot?.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                   </h3>
                   <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Snapshot ID: {selectedSnapshot?.id} • Sealed Record</p>
                </div>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shadow-xl shadow-black/10">
                   <Download className="w-3.5 h-3.5" /> Export Certified Ledger (PDF)
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
                   <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Total Valuation</p>
                   <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{formatKD(selectedSnapshot?.totalValuation || 0)}</p>
                </div>
                <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
                   <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Unique SKUs</p>
                   <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">{selectedSnapshot?.items.length}</p>
                </div>
                <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
                   <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Inventory Load</p>
                   <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">
                      {selectedSnapshot?.items.reduce((acc, i) => acc + i.totalStock, 0)} units
                   </p>
                </div>
                <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm space-y-1">
                   <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">Avg. Item Value</p>
                   <p className="text-2xl font-light tracking-tight text-[#1A1A1A]">
                      {formatKD((selectedSnapshot?.totalValuation || 0) / (selectedSnapshot?.items.length || 1))}
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                   <div className="p-6 border-b border-[#F3F4F6] flex justify-between items-center">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">Certified Item List</h4>
                      <div className="flex items-center gap-2 text-[9px] text-[#9CA3AF] font-bold">
                         <AlertCircle className="w-3 h-3 text-emerald-500" /> SYSTEM SEALED
                      </div>
                   </div>
                   <div className="max-h-[500px] overflow-y-auto">
                      <table className="w-full text-left font-sans text-xs border-collapse">
                         <thead className="bg-[#F9FAFB] sticky top-0 z-10 border-b border-[#E5E7EB]">
                            <tr>
                               <th className="px-6 py-4 font-bold text-[#6B7280] uppercase tracking-wider">Item / SKU</th>
                               <th className="px-6 py-4 font-bold text-[#6B7280] uppercase tracking-wider text-right">Closed Qty</th>
                               <th className="px-6 py-4 font-bold text-[#6B7280] uppercase tracking-wider text-right">Locked WAC</th>
                               <th className="px-6 py-4 font-bold text-[#6B7280] uppercase tracking-wider text-right">Certified Val</th>
                            </tr>
                         </thead>
                         <tbody>
                            {selectedSnapshot?.items.map(item => (
                              <tr key={item.itemId} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                                 <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                       <span className="font-bold text-[#1A1A1A]">{item.name}</span>
                                       <span className="text-[9px] text-[#9CA3AF] font-bold uppercase">{item.sku}</span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-right font-medium">{item.totalStock}</td>
                                 <td className="px-6 py-4 text-right">{formatKD(item.unitCost)}</td>
                                 <td className="px-6 py-4 text-right font-bold">{formatKD(item.valuation)}</td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-8 space-y-6">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">Location Breakdown</h4>
                      <div className="space-y-6">
                         {state.outlets.map(o => {
                           const value = selectedSnapshot?.outletBreakdown[o.id] || 0;
                           const percentage = ((value / (selectedSnapshot?.totalValuation || 1)) * 100).toFixed(1);
                           return (
                             <div key={o.id} className="space-y-2">
                                <div className="flex justify-between items-baseline">
                                   <span className="text-xs font-bold text-[#1A1A1A]">{o.name}</span>
                                   <span className="text-sm font-light">{formatKD(value)}</span>
                                </div>
                                <div className="w-full h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                                   <div className="h-full bg-black rounded-full" style={{ width: `${percentage}%` }} />
                                </div>
                                <p className="text-[9px] font-bold text-[#9CA3AF] text-right uppercase tracking-tighter">{percentage}% of Portfolio</p>
                             </div>
                           );
                         })}
                      </div>
                   </div>

                   <div className="bg-[#F8FAFC] border border-blue-100 rounded-3xl p-8 space-y-4">
                      <div className="flex items-center gap-2 text-blue-600">
                         <CheckCircle2 className="w-4 h-4" />
                         <span className="text-[10px] font-bold uppercase tracking-widest">Audit Compliance</span>
                      </div>
                      <p className="text-xs text-[#1E293B] leading-relaxed font-medium">
                         This record is digitally signed. No modifications are permitted within the closing period. All stock transactions processed after {new Date(selectedSnapshot?.closedAt || '').toLocaleString()} will be indexed in the subsequent fiscal period.
                      </p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isClosing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-[40px] p-12 max-w-lg w-full text-center space-y-8 shadow-2xl"
            >
              <div className="w-20 h-20 bg-rose-600 text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3">
                 <LockIcon className="w-10 h-10" />
              </div>
              <div className="space-y-3">
                 <h2 className="text-3xl font-bold tracking-tight">Seal {new Date().toLocaleString('default', { month: 'long' })} Books?</h2>
                 <p className="text-sm text-[#6B7280] leading-relaxed">
                   This action is **permanent**. It will lock the inventory valuation for this month. You will not be able to change or overwrite this period's audit Trail.
                 </p>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-4">
                <button 
                  onClick={finalizeClosing}
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[#333] transition-all shadow-xl shadow-black/10"
                >
                  Confirm & Certify Period
                </button>
                <button 
                  onClick={() => setIsClosing(false)}
                  className="w-full py-4 bg-[#F9FAFB] text-[#6B7280] border border-[#E5E7EB] rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-gray-100 transition-all font-sans"
                >
                  Cancel & Return
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
