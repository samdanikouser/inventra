import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ArrowDownCircle, 
  ArrowUpCircle,
  ArrowRightLeft,
  Hammer,
  Trash2
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { formatKD, cn } from '../utils';

export const AuditTrail = () => {
  const { state } = useInventory();
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterType, setFilterType] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterOutlet, setFilterOutlet] = useState<string>('All');
  const [filterStaff, setFilterStaff] = useState<string>('All');

  const filteredTransactions = useMemo(() => {
    return state.transactions.filter(tx => {
      const item = state.items.find(i => i.id === tx.itemId);
      const staff = state.users.find(u => u.id === tx.staffId);
      
      const matchSearch = `${tx.ref} ${item?.name} ${staff?.name} ${tx.type}`.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'All' || tx.type === filterType;
      const matchCategory = filterCategory === 'All' || item?.category === filterCategory;
      const matchOutlet = filterOutlet === 'All' || tx.outletId === filterOutlet;
      const matchStaff = filterStaff === 'All' || tx.staffId === filterStaff;
      
      let matchDate = true;
      if (dateRange.start) {
        matchDate = matchDate && new Date(tx.date) >= new Date(dateRange.start);
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        matchDate = matchDate && new Date(tx.date) <= endDate;
      }

      return matchSearch && matchType && matchCategory && matchOutlet && matchStaff && matchDate;
    });
  }, [state.transactions, state.items, state.outlets, state.users, search, filterType, filterCategory, filterOutlet, filterStaff, dateRange]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'PURCHASE': return <ArrowDownCircle className="w-4 h-4 text-emerald-500" />;
      case 'BREAKAGE': return <Hammer className="w-4 h-4 text-red-500" />;
      case 'WRITE_OFF': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'TRANSFER': return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      case 'ADJUSTMENT': return <ArrowUpDown className="w-4 h-4 text-amber-500" />;
      default: return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-8 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-[#1A1A1A]">Audit Ledger</h2>
          <span className="text-sm text-[#9CA3AF]">|</span>
          <span className="text-sm text-[#6B7280]">Real-time Transaction Stream</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-1.5 gap-2">
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">From</span>
              <input 
                type="date" 
                className="bg-transparent text-[10px] font-bold outline-none"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="flex items-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-1.5 gap-2">
              <span className="text-[9px] font-bold text-[#9CA3AF] uppercase">To</span>
              <input 
                type="date" 
                className="bg-transparent text-[10px] font-bold outline-none"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>

          <div className="h-8 w-px bg-[#E5E7EB] mx-1" />

          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input 
              type="text" 
              placeholder="Ref, SKU, or user..." 
              className="w-full pl-10 pr-4 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg font-sans text-[10px] font-bold text-[#1A1A1A] outline-none focus:border-black transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button 
            className="p-2 border border-[#E5E7EB] rounded-lg hover:bg-gray-50 transition-colors"
            title="Advanced Filters"
          >
            <Filter className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="px-8 py-3 bg-white border-b border-[#E5E7EB] flex items-center gap-4">
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Type:</span>
           <select 
             className="text-[10px] font-bold bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2 py-1 outline-none"
             value={filterType}
             onChange={(e) => setFilterType(e.target.value)}
           >
             <option value="All">All Types</option>
             <option value="PURCHASE">Purchase</option>
             <option value="BREAKAGE">Breakage</option>
             <option value="TRANSFER">Transfer</option>
             <option value="WRITE_OFF">Write-off</option>
             <option value="ADJUSTMENT">Adjustment</option>
           </select>
        </div>

        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Category:</span>
           <select 
             className="text-[10px] font-bold bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2 py-1 outline-none"
             value={filterCategory}
             onChange={(e) => setFilterCategory(e.target.value)}
           >
             <option value="All">All Categories</option>
             {['Crockery', 'Glassware', 'Buffetware', 'Kitchen Smallware', 'Operating Equipment', 'Barware', 'Tableware'].map(c => (
               <option key={c} value={c}>{c}</option>
             ))}
           </select>
        </div>

        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Location:</span>
           <select 
             className="text-[10px] font-bold bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2 py-1 outline-none"
             value={filterOutlet}
             onChange={(e) => setFilterOutlet(e.target.value)}
           >
             <option value="All">All Locations</option>
             {state.outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
           </select>
        </div>

        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Staff:</span>
           <select 
             className="text-[10px] font-bold bg-[#F9FAFB] border border-[#E5E7EB] rounded px-2 py-1 outline-none"
             value={filterStaff}
             onChange={(e) => setFilterStaff(e.target.value)}
           >
              <option value="All">All Staff</option>
              {state.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
           </select>
        </div>

        <div className="ml-auto flex gap-2">
           <button 
             onClick={() => {
               setSearch('');
               setDateRange({ start: '', end: '' });
               setFilterType('All');
               setFilterCategory('All');
               setFilterOutlet('All');
               setFilterStaff('All');
             }}
             className="text-[10px] font-bold text-rose-600 hover:underline uppercase tracking-widest"
           >
             Reset Filters
           </button>
        </div>
      </div>

      <div className="p-8 flex-1 overflow-y-auto">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <table className="w-full text-left font-sans text-sm border-collapse">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Event</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Ref ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Entity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Delta</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider text-right">Valuation</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Initiator</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(tx => {
                const item = state.items.find(i => i.id === tx.itemId);
                const outlet = state.outlets.find(o => o.id === tx.outletId);
                const targetOutlet = tx.targetOutletId ? state.outlets.find(o => o.id === tx.targetOutletId) : null;
                const staff = state.users.find(u => u.id === tx.staffId);
                
                return (
                  <tr key={tx.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center group-hover:bg-white transition-colors">
                        {getIcon(tx.type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-[#1A1A1A] underline decoration-[#E5E7EB] underline-offset-4">{tx.ref}</td>
                    <td className="px-6 py-4">
                       <p className="text-[10px] font-bold text-[#1A1A1A] uppercase">{new Date(tx.date).toLocaleDateString()}</p>
                       <p className="text-[9px] text-[#9CA3AF] font-bold">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#1A1A1A]">{item?.name}</span>
                        <span className="text-[10px] text-[#9CA3AF] font-bold uppercase">{item?.sku}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {tx.type === 'TRANSFER' ? (
                        <div className="flex items-center gap-1.5 font-bold text-[#6B7280] text-[10px] uppercase tracking-tight">
                          <span>{outlet?.name}</span>
                          <ArrowRightLeft className="w-2.5 h-2.5 text-[#9CA3AF]" />
                          <span className="text-blue-600">{targetOutlet?.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-[#6B7280] uppercase tracking-tight">{outlet?.name}</span>
                      )}
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-light text-sm",
                      tx.quantityDelta > 0 ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {tx.quantityDelta > 0 ? '+' : ''}{tx.quantityDelta}
                    </td>
                    <td className="px-6 py-4 text-right font-light text-[#1A1A1A] text-sm">{formatKD(tx.value)}</td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-bold">
                             {staff?.name.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-[#1A1A1A]">{staff?.name}</span>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>

  );
};
