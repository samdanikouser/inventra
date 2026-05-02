import React, { useState } from 'react';
import { 
  Plus, 
  Printer, 
  ClipboardCheck, 
  ChevronRight, 
  Search, 
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  TrendingDown,
  TrendingUp,
  FileText,
  DollarSign,
  Package,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useInventory } from '../../context/InventoryContext';
import { StockTakeSession, StockTakeItem, Category, OutletId, StockTakeReport } from '../../types';
import { formatKD, cn } from '../../utils';

export const StockTakeManager = () => {
  const { state, dispatch } = useInventory();
  const [step, setStep] = useState<'LIST' | 'CREATE' | 'COUNT' | 'REPORT'>('LIST');
  const [activeSession, setActiveSession] = useState<StockTakeSession | null>(null);
  const [reportSession, setReportSession] = useState<StockTakeSession | null>(null);
  
  // Count Step Controls
  const [countSearch, setCountSearch] = useState('');
  const [countSort, setCountSort] = useState<'name' | 'variance' | 'qty'>('name');
  const [countFilter, setCountFilter] = useState<'all' | 'variance' | 'no-variance'>('all');
  
  // Create Session Selection
  const [newOutlet, setNewOutlet] = useState<OutletId | ''>('');
  const [newCategories, setNewCategories] = useState<Category[]>([]);

  const handleCreateSession = () => {
    if (!newOutlet || newCategories.length === 0) return;

    const sessionItems: StockTakeItem[] = state.items
      .filter(item => newCategories.includes(item.category) && item.stocks[newOutlet] !== undefined)
      .map(item => ({
        itemId: item.id,
        systemQty: item.stocks[newOutlet] || 0
      }));

    const session: StockTakeSession = {
      id: Math.random().toString(36).substr(2, 9),
      ref: `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${state.stockTakeSessions.length + 1}`,
      date: new Date().toISOString(),
      outletId: newOutlet as OutletId,
      categories: newCategories,
      status: 'OPEN',
      items: sessionItems,
      staffId: state.currentUser.id
    };

    dispatch({ type: 'CREATE_STOCK_TAKE', payload: session });
    setActiveSession(session);
    setStep('COUNT');
  };

  const handleUpdateItemField = (itemId: string, updates: Partial<StockTakeItem>) => {
    if (!activeSession) return;
    const updatedItems = activeSession.items.map(item => {
      if (item.itemId === itemId) {
        const newItem = { ...item, ...updates };
        if (updates.physicalQty !== undefined) {
          newItem.variance = updates.physicalQty - item.systemQty;
          // If the count is corrected to matching system qty, clear existing decision/reason
          if (newItem.variance === 0) {
            newItem.decision = undefined;
            newItem.reason = undefined;
          }
        }
        return newItem;
      }
      return item;
    });
    const updatedSession = { ...activeSession, items: updatedItems };
    setActiveSession(updatedSession);
    dispatch({ type: 'UPDATE_STOCK_TAKE', payload: updatedSession });
  };

  const handleApprove = () => {
    if (!activeSession || state.currentUser.role !== 'MANAGER') return;

    // Calculate Report Metrics
    const itemIds = activeSession.items.map(i => i.itemId);
    
    // Find previous closed session for this outlet/category to define "the period"
    const prevSession = state.stockTakeSessions
      .filter(s => s.id !== activeSession.id && s.status === 'CLOSED' && s.outletId === activeSession.outletId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    const startDate = prevSession ? prevSession.date : new Date(0).toISOString();

    const periodTransactions = state.transactions.filter(t => 
      t.date > startDate && 
      t.date <= activeSession.date && 
      t.outletId === activeSession.outletId && 
      itemIds.includes(t.itemId)
    );

    const breakages = periodTransactions.filter(t => t.type === 'BREAKAGE');
    const writeOffs = periodTransactions.filter(t => t.type === 'WRITE_OFF');
    
    const breakagesValue = Math.abs(breakages.reduce((acc, t) => acc + t.value, 0));
    const writeOffsValue = Math.abs(writeOffs.reduce((acc, t) => acc + t.value, 0));

    let openingValue = prevSession?.report?.closingValue || 0;
    
    // If no prev session, calculate opening based on system qty - period delta
    if (!prevSession) {
      openingValue = activeSession.items.reduce((sum, item) => {
        const masterItem = state.items.find(i => i.id === item.itemId);
        return sum + (item.systemQty * (masterItem?.unitCost || 0));
      }, 0);
    }

    let closingValue = 0;
    let varianceValue = 0;
    let theoreticalValue = 0;

    activeSession.items.forEach(item => {
      const masterItem = state.items.find(i => i.id === item.itemId);
      if (!masterItem) return;

      const variance = item.variance || 0;
      theoreticalValue += item.systemQty * masterItem.unitCost;
      closingValue += (item.physicalQty || 0) * masterItem.unitCost;
      varianceValue += variance * masterItem.unitCost;

      // Only sync adjustments for APPROVED variances
      if (variance !== 0 && item.decision === 'APPROVE') {
        dispatch({
          type: 'ADD_TRANSACTION',
          payload: {
            id: Math.random().toString(36).substr(2, 9),
            ref: `ADJ-${activeSession.ref.split('-').slice(1).join('-')}`,
            type: 'ADJUSTMENT',
            itemId: item.itemId,
            outletId: activeSession.outletId,
            quantityDelta: variance,
            value: variance * masterItem.unitCost,
            date: new Date().toISOString(),
            staffId: state.currentUser.id,
            notes: `Stock take adjustment (${item.reason || 'No reason provided'}) via ${activeSession.ref}`
          }
        });
      }
    });

    const report: StockTakeReport = {
      openingValue,
      closingValue,
      varianceValue,
      breakagesValue,
      writeOffsValue,
      netImpact: varianceValue - breakagesValue - writeOffsValue
    };

    const closedSession: StockTakeSession = { 
      ...activeSession, 
      status: 'CLOSED' as const, 
      managerId: state.currentUser.id,
      report
    };
    
    dispatch({ type: 'UPDATE_STOCK_TAKE', payload: closedSession });
    setReportSession(closedSession);
    setActiveSession(null);
    setStep('REPORT');
  };

  const calculateProgress = (session: StockTakeSession) => {
    const counted = session.items.filter(i => i.physicalQty !== undefined).length;
    return (counted / session.items.length) * 100;
  };

  const displayedCountItems = React.useMemo(() => {
    if (!activeSession) return [];
    
    let items = [...activeSession.items];

    // Filter
    if (countFilter === 'variance') {
      items = items.filter(i => (i.variance || 0) !== 0);
    } else if (countFilter === 'no-variance') {
      items = items.filter(i => (i.variance || 0) === 0 && i.physicalQty !== undefined);
    }

    // Search
    if (countSearch) {
      items = items.filter(i => {
        const masterItem = state.items.find(m => m.id === i.itemId);
        return masterItem?.name.toLowerCase().includes(countSearch.toLowerCase()) || 
               masterItem?.sku.toLowerCase().includes(countSearch.toLowerCase());
      });
    }

    // Sort
    items.sort((a, b) => {
      const masterA = state.items.find(m => m.id === a.itemId);
      const masterB = state.items.find(m => m.id === b.itemId);
      
      if (countSort === 'name') {
        return (masterA?.name || '').localeCompare(masterB?.name || '');
      } else if (countSort === 'variance') {
        return Math.abs(b.variance || 0) - Math.abs(a.variance || 0);
      } else if (countSort === 'qty') {
        return (b.physicalQty || 0) - (a.physicalQty || 0);
      }
      return 0;
    });

    return items;
  }, [activeSession, countSearch, countSort, countFilter, state.items]);

  const getProgressColor = (p: number) => {
    if (p === 100) return "bg-emerald-500";
    if (p >= 75) return "bg-amber-500";
    if (p >= 50) return "bg-black";
    return "bg-rose-500";
  };

  const getProgressTextColor = (p: number) => {
    if (p === 100) return "text-emerald-500";
    if (p >= 75) return "text-amber-500";
    if (p >= 50) return "text-black";
    return "text-rose-500";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Stock Taking</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Digital Ledger System</span>
        </div>
        {step === 'LIST' && (
          <button 
            onClick={() => setStep('CREATE')}
            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Initialize New Count
          </button>
        )}
        {step === 'COUNT' && (
           <div className="flex items-center gap-3">
             <button className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors flex items-center gap-2">
                <Printer className="w-3.5 h-3.5" /> Export Sheet
             </button>
             {activeSession?.status === 'OPEN' ? (
               <button 
                onClick={() => {
                  const updated = { ...activeSession, status: 'SUBMITTED' as const };
                  dispatch({ type: 'UPDATE_STOCK_TAKE', payload: updated });
                  setStep('LIST');
                }}
                className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
               >
                  <ClipboardCheck className="w-4 h-4" /> Finalize & Submit
               </button>
             ) : activeSession?.status === 'SUBMITTED' && state.currentUser.role === 'MANAGER' ? (
               <button 
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:opacity-80 transition-opacity flex items-center gap-2"
               >
                  <CheckCircle2 className="w-4 h-4" /> Approve & Sync Adjustments
               </button>
             ) : (
               <button 
                onClick={() => setStep('LIST')}
                className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#374151] hover:bg-gray-50 transition-colors"
               >
                  Close Review
               </button>
             )}
           </div>
        )}
      </header>

      <div className="p-8 flex-1 overflow-y-auto">
        {step === 'LIST' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'PENDING REVIEW', value: state.stockTakeSessions.filter(s => s.status === 'SUBMITTED').length, color: 'text-[#1A1A1A]' },
                { label: 'OPEN SESSIONS', value: state.stockTakeSessions.filter(s => s.status === 'OPEN').length, color: 'text-[#1A1A1A]' },
                { label: 'MONTHLY ACCURACY', value: '98.4%', color: 'text-emerald-600' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm space-y-1">
                  <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-wider">{stat.label}</p>
                  <p className={cn("text-2xl font-light tracking-tight", stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
               {state.stockTakeSessions.length === 0 ? (
                 <div className="p-12 text-center text-[#9CA3AF] text-sm font-bold uppercase tracking-widest">No active or archived sessions</div>
               ) : (
                 <table className="w-full text-left font-sans text-sm border-collapse">
                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reference</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Outlet</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">SKUs</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Progress</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.stockTakeSessions.map(session => {
                        const progress = calculateProgress(session);
                        return (
                          <tr key={session.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                            <td className="px-6 py-4 font-mono text-xs font-bold text-[#374151]">{session.ref}</td>
                            <td className="px-6 py-4 font-bold text-[#1A1A1A]">{state.outlets.find(o => o.id === session.outletId)?.name}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wide",
                                session.status === 'OPEN' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                session.status === 'SUBMITTED' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                              )}>
                                {session.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[#9CA3AF] font-bold text-[10px]">{new Date(session.date).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-right font-light text-[#1A1A1A]">{session.items.length}</td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col gap-1 w-24 mx-auto">
                                  <div className="flex justify-between text-[8px] font-bold">
                                     <span className={getProgressTextColor(progress)}>{Math.round(progress)}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                                     <div 
                                      className={cn("h-full transition-all duration-500", getProgressColor(progress))} 
                                      style={{ width: `${progress}%` }} 
                                     />
                                  </div>
                               </div>
                            </td>
                             <td className="px-6 py-4 text-center">
                               <button 
                                 onClick={() => { 
                                   if (session.status === 'CLOSED' && session.report) {
                                     setReportSession(session);
                                     setStep('REPORT');
                                   } else {
                                     setActiveSession(session); 
                                     setStep('COUNT'); 
                                   }
                                 }}
                                 className="p-2 border border-[#E5E7EB] rounded-lg hover:bg-black hover:text-white transition-all shadow-sm flex items-center gap-2 group mx-auto"
                               >
                                 <span className="text-[10px] font-bold uppercase hidden group-hover:block transition-all whitespace-nowrap">
                                   {session.status === 'CLOSED' ? 'View Report' : 'Resume'}
                                 </span>
                                 <ChevronRight className="w-4 h-4" />
                               </button>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
               )}
            </div>
          </div>
        )}

        {step === 'CREATE' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
               <div className="w-16 h-16 bg-[#F3F4F6] rounded-3xl flex items-center justify-center text-black shadow-sm">
                  <ClipboardCheck className="w-8 h-8" />
               </div>
               <h2 className="text-2xl font-bold text-[#1A1A1A]">Initialize Session</h2>
               <p className="text-sm text-[#6B7280]">Targeted counting protocols for precise inventory auditing.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Select Outlet</label>
                  <div className="grid grid-cols-1 gap-3">
                    {state.outlets.map(o => (
                      <button 
                        key={o.id}
                        onClick={() => setNewOutlet(o.id)}
                        className={cn(
                          "px-5 py-4 border rounded-2xl text-sm font-bold text-left transition-all flex items-center justify-between",
                          newOutlet === o.id ? "border-black bg-black text-white shadow-lg" : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-black"
                        )}
                      >
                        {o.name}
                        {newOutlet === o.id && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Scope: Categories</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {state.categories.map(c => (
                      <button 
                        key={c}
                        onClick={() => {
                          setNewCategories(prev => prev.includes(c) ? prev.filter(item => item !== c) : [...prev, c]);
                        }}
                        className={cn(
                          "px-5 py-3 border rounded-xl text-[11px] font-bold text-left transition-all flex items-center justify-between",
                          newCategories.includes(c) ? "border-black bg-black text-white" : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-black"
                        )}
                      >
                        {c.toUpperCase()}
                        {newCategories.includes(c) && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            <div className="pt-8 border-t border-[#F3F4F6] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1">
                  {newOutlet && newCategories.length > 0 ? (
                    <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-[#F3F4F6]">
                       <p className="text-xs font-medium text-[#6B7280]">
                         Analyzing <span className="font-bold text-[#1A1A1A]">{state.items.filter(i => newCategories.includes(i.category) && i.stocks[newOutlet] !== undefined).length}</span> items across 
                         <span className="font-bold text-[#1A1A1A]"> {newCategories.length}</span> categories.
                       </p>
                    </div>
                  ) : (
                    <p className="text-xs text-[#9CA3AF] italic">Please select an outlet and at least one category to proceed.</p>
                  )}
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                   <button 
                    onClick={() => setStep('LIST')}
                    className="flex-1 md:w-32 py-3 border border-[#E5E7EB] rounded-2xl font-bold text-[11px] uppercase tracking-widest text-[#6B7280] hover:bg-gray-50 transition-all"
                   >
                     Discard
                   </button>
                   <button 
                    disabled={!newOutlet || newCategories.length === 0}
                    onClick={handleCreateSession}
                    className="flex-1 md:w-48 py-3 bg-black text-white rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:opacity-80 transition-all shadow-xl shadow-black/10 disabled:opacity-30 disabled:cursor-not-allowed"
                   >
                     Initialize Session
                   </button>
                </div>
            </div>
          </div>
        )}

        {step === 'COUNT' && activeSession && (
          <div className="space-y-6">
            {/* Action Bar for Count */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-sm">
               <div className="flex flex-col gap-1 flex-1 max-w-md">
                  <div className="flex justify-between items-end mb-1">
                     <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Audit Completion</span>
                     <span className={cn("text-xs font-bold", getProgressTextColor(calculateProgress(activeSession)))}>
                        {activeSession.items.filter(i => i.physicalQty !== undefined).length} / {activeSession.items.length} SKUs counted
                     </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${calculateProgress(activeSession)}%` }}
                        className={cn("h-full rounded-full transition-all duration-500", getProgressColor(calculateProgress(activeSession)))}
                     />
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                    <input 
                      type="text"
                      placeholder="Search items..."
                      className="pl-9 pr-4 py-2 border border-[#E5E7EB] rounded-xl text-xs outline-none focus:border-black transition-all w-48"
                      value={countSearch}
                      onChange={(e) => setCountSearch(e.target.value)}
                    />
                  </div>
                  
                  <select 
                    className="px-3 py-2 border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#6B7280] uppercase outline-none cursor-pointer hover:border-black transition-colors"
                    value={countFilter}
                    onChange={(e) => setCountFilter(e.target.value as any)}
                  >
                    <option value="all">All Items</option>
                    <option value="variance">With Variance</option>
                    <option value="no-variance">Precise Matches</option>
                  </select>

                  <select 
                    className="px-3 py-2 border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#6B7280] uppercase outline-none cursor-pointer hover:border-black transition-colors"
                    value={countSort}
                    onChange={(e) => setCountSort(e.target.value as any)}
                  >
                    <option value="name">Sort by Name</option>
                    <option value="variance">Sort by Variance</option>
                    <option value="qty">Sort by Quantity</option>
                  </select>
               </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-12 lg:col-span-9 space-y-6">
                 <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                    <table className="w-full text-left font-sans text-sm border-collapse">
                       <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <tr>
                             <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">SKU / Item Name</th>
                             <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right w-24">System</th>
                             <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center w-28">Physical</th>
                             <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right w-20">Variance</th>
                             <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider w-40">Reason for Variance</th>
                             <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-center w-28">Approval</th>
                             <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider w-8"></th>
                          </tr>
                       </thead>
                       <tbody>
                          {displayedCountItems.map(item => {
                            const masterItem = state.items.find(i => i.id === item.itemId);
                            const variance = item.variance || 0;
                            const hasVariance = item.physicalQty !== undefined && variance !== 0;
                            
                            return (
                              <tr key={item.itemId} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[#1A1A1A]">{masterItem?.name}</span>
                                    <span className="text-[10px] text-[#9CA3AF] uppercase font-bold">{masterItem?.sku}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <span className="text-sm font-light text-[#1A1A1A]">{item.systemQty}</span>
                                </td>
                                <td className="px-6 py-4">
                                   <div className="flex justify-center">
                                      <input 
                                        type="number"
                                        disabled={activeSession.status !== 'OPEN'}
                                        className="w-20 text-center px-1.5 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl font-bold text-[#1A1A1A] outline-none focus:border-black transition-all disabled:opacity-50"
                                        placeholder="-"
                                        value={item.physicalQty ?? ''}
                                        onChange={(e) => handleUpdateItemField(item.itemId, { physicalQty: Number(e.target.value) })}
                                       />
                                   </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   {item.physicalQty === undefined ? (
                                     <span className="text-[#9CA3AF] text-xs font-medium">-</span>
                                   ) : (
                                     <span className={cn(
                                       "px-2.5 py-1 rounded-lg text-xs font-bold",
                                       variance === 0 
                                         ? "bg-[#F3F4F6] text-[#6B7280]" 
                                         : variance < 0 
                                           ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                           : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                     )}>
                                       {variance > 0 ? `+${variance}` : variance}
                                     </span>
                                   )}
                                </td>
                                <td className="px-6 py-4">
                                  {hasVariance ? (
                                    <select
                                      disabled={activeSession.status !== 'OPEN'}
                                      value={item.reason || ''}
                                      onChange={(e) => handleUpdateItemField(item.itemId, { reason: e.target.value })}
                                      className="w-full px-2 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-[10px] font-bold text-[#1A1A1A] outline-none focus:border-black disabled:opacity-50"
                                    >
                                      <option value="">Reason Required...</option>
                                      <option value="Damage">Damage / Spoilage</option>
                                      <option value="Expiry">Expired Items</option>
                                      <option value="Theft">Loss / Theft</option>
                                      <option value="Miscount">Prior Miscount</option>
                                      <option value="Unrecorded">Unrecorded Sale/Usage</option>
                                      <option value="Correction">Data Entry Correction</option>
                                      <option value="Other">Other</option>
                                    </select>
                                  ) : (
                                    <span className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-tight">No discrepancy</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {hasVariance ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        disabled={activeSession.status !== 'OPEN'}
                                        onClick={() => handleUpdateItemField(item.itemId, { decision: 'APPROVE' })}
                                        className={cn(
                                          "px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all",
                                          item.decision === 'APPROVE' 
                                            ? "bg-emerald-600 text-white" 
                                            : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-emerald-600 hover:text-emerald-600"
                                        )}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        disabled={activeSession.status !== 'OPEN'}
                                        onClick={() => handleUpdateItemField(item.itemId, { decision: 'KEEP' })}
                                        className={cn(
                                          "px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all",
                                          item.decision === 'KEEP' 
                                            ? "bg-rose-600 text-white" 
                                            : "bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-rose-600 hover:text-rose-600"
                                        )}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : item.physicalQty !== undefined ? (
                                    <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest">Verified</span>
                                  ) : (
                                    <span className="text-[9px] font-extrabold text-[#9CA3AF] uppercase tracking-widest italic">Pending</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {item.physicalQty !== undefined && variance === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                  {hasVariance && item.decision === 'APPROVE' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                  {hasVariance && item.decision === 'KEEP' && <X className="w-4 h-4 text-rose-500" />}
                                  {hasVariance && !item.decision && <AlertCircle className="w-4 h-4 text-orange-500" />}
                                </td>
                              </tr>
                            );
                          })}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="col-span-12 lg:col-span-3 space-y-6">
                 <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 space-y-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">Session Metrics</h3>
                    <div className="space-y-4">
                       <div>
                          <div className="flex justify-between items-end mb-2">
                             <span className="text-[10px] font-bold text-[#9CA3AF] uppercase">Audit Progress</span>
                             <span className={cn("text-sm font-bold", getProgressTextColor(calculateProgress(activeSession)))}>
                               {Math.round(calculateProgress(activeSession))}%
                             </span>
                          </div>
                          <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${calculateProgress(activeSession)}%` }}
                               className={cn("h-full rounded-full transition-colors duration-500", getProgressColor(calculateProgress(activeSession)))}
                             />
                          </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F3F4F6]">
                          <div className="flex flex-col">
                             <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">Counted</span>
                             <span className="text-base font-light text-[#1A1A1A]">{activeSession.items.filter(i => i.physicalQty !== undefined).length}</span>
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">Remaining</span>
                             <span className="text-base font-light text-[#1A1A1A]">{activeSession.items.filter(i => i.physicalQty === undefined).length}</span>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                       <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">Compliance Check</h3>
                    </div>
                    <p className="text-[11px] font-medium text-emerald-800 leading-relaxed opacity-80 italic">
                      "Standard Variance tolerance is ±2% for Crockery. Any variance exceeding KD 10.000 value will flag automatically for investigation."
                    </p>
                 </div>
              </div>
            </div>
          </div>
        )}

        {step === 'REPORT' && reportSession && reportSession.report && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
             <div className="flex items-center justify-between">
                <button 
                  onClick={() => setStep('LIST')}
                  className="flex items-center gap-2 text-xs font-bold text-[#6B7280] hover:text-black transition-colors"
                >
                   <ChevronLeft className="w-4 h-4" /> Back to History
                </button>
                <div className="flex gap-3">
                   <button className="px-4 py-2 border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#374151] hover:bg-gray-50 flex items-center gap-2">
                      <Printer className="w-3.5 h-3.5" /> Print Audit
                   </button>
                   <button className="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:opacity-80 flex items-center gap-2 shadow-xl shadow-black/10">
                      <FileText className="w-3.5 h-3.5" /> Export PDF Report
                   </button>
                </div>
             </div>

             <div className="bg-[#1A1A1A] text-white p-10 rounded-[40px] relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                         <ClipboardCheck className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                         <h3 className="text-2xl font-light tracking-tight italic">Audit Reconciliation Report</h3>
                         <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{reportSession.ref} • {state.outlets.find(o => o.id === reportSession.outletId)?.name}</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-6">
                      <div className="space-y-1">
                         <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Opening Value</p>
                         <p className="text-2xl font-light tracking-tight">{formatKD(reportSession.report.openingValue)}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Closing Value</p>
                         <p className="text-2xl font-light tracking-tight">{formatKD(reportSession.report.closingValue)}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Net Variance</p>
                         <p className={cn(
                           "text-2xl font-bold tracking-tight",
                           reportSession.report.varianceValue >= 0 ? "text-emerald-400" : "text-rose-400"
                         )}>
                            {reportSession.report.varianceValue >= 0 ? '+' : ''}{formatKD(reportSession.report.varianceValue)}
                         </p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Period Accuracy</p>
                         <p className="text-2xl font-light tracking-tight">
                           {Math.max(0, (1 - (Math.abs(reportSession.report.varianceValue) / Math.max(1, reportSession.report.openingValue))) * 100).toFixed(1)}%
                         </p>
                      </div>
                   </div>
                </div>
                <CheckCircle2 className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5" />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-[#E5E7EB] p-8 rounded-3xl space-y-4">
                   <div className="flex items-center gap-2 text-orange-500">
                      <TrendingDown className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Wastage & Breakage</span>
                   </div>
                   <div className="space-y-1">
                      <p className="text-3xl font-light tracking-tight text-rose-600">-{formatKD(reportSession.report.breakagesValue)}</p>
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Impact since last audit</p>
                   </div>
                   {(() => {
                      const startDate = state.stockTakeSessions
                         .filter(s => s.status === 'CLOSED' && s.outletId === reportSession.outletId && s.date < reportSession.date)
                         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || new Date(0).toISOString();
                      
                      const breakages = state.transactions.filter(t => 
                         t.type === 'BREAKAGE' && 
                         t.outletId === reportSession.outletId && 
                         t.date > startDate && 
                         t.date <= reportSession.date &&
                         reportSession.items.some(i => i.itemId === t.itemId)
                      );

                      if (breakages.length === 0) return null;

                      return (
                         <div className="pt-4 border-t border-[#F3F4F6] space-y-2">
                            {breakages.slice(0, 3).map(b => {
                               const item = state.items.find(i => i.id === b.itemId);
                               return (
                                  <div key={b.id} className="flex justify-between text-[9px] font-bold">
                                     <span className="text-[#6B7280] truncate max-w-[100px]">{item?.name}</span>
                                     <span className="text-rose-600">-{formatKD(b.value)}</span>
                                  </div>
                               );
                            })}
                            {breakages.length > 3 && <p className="text-[8px] text-[#9CA3AF] italic tracking-wider">+ {breakages.length - 3} more incidents</p>}
                         </div>
                      );
                   })()}
                </div>

                <div className="bg-white border border-[#E5E7EB] p-8 rounded-3xl space-y-4">
                   <div className="flex items-center gap-2 text-rose-500">
                      <TrendingDown className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Period Write-offs</span>
                   </div>
                   <div className="space-y-1">
                      <p className="text-3xl font-light tracking-tight text-rose-600">-{formatKD(reportSession.report.writeOffsValue)}</p>
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase">Liquidated assets</p>
                   </div>
                   {(() => {
                      const startDate = state.stockTakeSessions
                         .filter(s => s.status === 'CLOSED' && s.outletId === reportSession.outletId && s.date < reportSession.date)
                         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || new Date(0).toISOString();
                      
                      const writeOffs = state.transactions.filter(t => 
                         t.type === 'WRITE_OFF' && 
                         t.outletId === reportSession.outletId && 
                         t.date > startDate && 
                         t.date <= reportSession.date &&
                         reportSession.items.some(i => i.itemId === t.itemId)
                      );

                      if (writeOffs.length === 0) return null;

                      return (
                         <div className="pt-4 border-t border-[#F3F4F6] space-y-2">
                            {writeOffs.slice(0, 3).map(w => {
                               const item = state.items.find(i => i.id === w.itemId);
                               return (
                                  <div key={w.id} className="flex justify-between text-[9px] font-bold">
                                     <span className="text-[#6B7280] truncate max-w-[100px]">{item?.name}</span>
                                     <span className="text-rose-600">-{formatKD(w.value)}</span>
                                  </div>
                               );
                            })}
                            {writeOffs.length > 3 && <p className="text-[8px] text-[#9CA3AF] italic tracking-wider">+ {writeOffs.length - 3} more records</p>}
                         </div>
                      );
                   })()}
                </div>

                <div className="bg-white border border-[#E5E7EB] p-8 rounded-3xl space-y-4 shadow-xl shadow-black/5">
                   <div className="flex items-center gap-2 text-[#1A1A1A]">
                      <Package className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Combined Stock Loss</span>
                   </div>
                   <div className="space-y-1">
                      <p className="text-3xl font-light tracking-tight text-[#1A1A1A]">
                        {formatKD(Math.abs(reportSession.report.breakagesValue + reportSession.report.writeOffsValue + (reportSession.report.varianceValue < 0 ? reportSession.report.varianceValue : 0)))}
                      </p>
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase text-right">Total Depletion Cost</p>
                   </div>
                   <div className="pt-4 border-t border-[#F3F4F6]">
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">Net Cash Impact</span>
                         <span className={cn(
                           "text-[10px] font-extrabold transition-all",
                           reportSession.report.netImpact >= 0 ? "text-emerald-600" : "text-rose-600"
                         )}>
                           {formatKD(reportSession.report.netImpact)}
                         </span>
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-[32px] border border-[#E5E7EB] shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#F3F4F6] bg-[#F9FAFB]">
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]">Itemized Variance Ledger</h4>
                </div>
                <table className="w-full text-left font-sans text-xs border-collapse">
                   <thead className="border-b border-[#F3F4F6]">
                      <tr>
                         <th className="px-6 py-4 text-[#6B7280] font-bold uppercase">SKU / Item</th>
                         <th className="px-6 py-4 text-[#6B7280] font-bold uppercase text-right">System</th>
                         <th className="px-6 py-4 text-[#6B7280] font-bold uppercase text-right">Physical</th>
                         <th className="px-6 py-4 text-[#6B7280] font-bold uppercase text-right">Variance</th>
                         <th className="px-6 py-4 text-[#6B7280] font-bold uppercase text-right">Cost Impact</th>
                      </tr>
                   </thead>
                   <tbody>
                      {reportSession.items.map(item => {
                         const masterItem = state.items.find(i => i.id === item.itemId);
                         const impact = (item.variance || 0) * (masterItem?.unitCost || 0);
                         return (
                            <tr key={item.itemId} className="border-b border-[#F9FAFB] hover:bg-gray-50 transition-colors">
                               <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                     <span className="font-bold text-[#1A1A1A]">{masterItem?.name}</span>
                                     <span className="text-[9px] text-[#9CA3AF] uppercase font-bold">{masterItem?.sku}</span>
                                  </div>
                               </td>
                               <td className="px-6 py-4 text-right font-light">{item.systemQty}</td>
                               <td className="px-6 py-4 text-right font-light">{item.physicalQty}</td>
                               <td className="px-6 py-4 text-right">
                                  <span className={cn(
                                    "font-bold",
                                    (item.variance || 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                                  )}>
                                     {(item.variance || 0) > 0 ? '+' : ''}{item.variance}
                                  </span>
                               </td>
                               <td className="px-6 py-4 text-right font-bold transition-colors">
                                  <span className={impact >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                     {impact > 0 ? '+' : ''}{formatKD(impact)}
                                  </span>
                               </td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
