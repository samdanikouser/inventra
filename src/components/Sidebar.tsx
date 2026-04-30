import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Hammer, 
  Trash2, 
  Warehouse, 
  Users, 
  BarChart3, 
  AlertCircle, 
  QrCode, 
  ClipboardList, 
  History as HistoryIcon,
  Lock as LockIcon,
  ArrowRightLeft,
  TrendingDown,
  ChevronRight,
  PackagePlus
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { cn } from '../utils';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'purchases', label: 'Purchases', icon: PackagePlus },
  { id: 'breakage', label: 'Breakage Log', icon: Hammer },
  { id: 'write-offs', label: 'Write-offs', icon: Trash2 },
  { id: 'outlets', label: 'Outlets', icon: Warehouse },
  { id: 'suppliers', label: 'Suppliers', icon: Users },
  { id: 'reports', label: 'Monthly Reports', icon: BarChart3 },
  { id: 'reorder', label: 'Reorder List', icon: AlertCircle },
  { id: 'barcodes', label: 'Barcode Manager', icon: QrCode },
  { id: 'stock-take', label: 'Stock Take', icon: ClipboardList },
  { id: 'transfers', label: 'Stock Transfer', icon: ArrowRightLeft },
  { id: 'monthly-closing', label: 'Monthly Closing', icon: LockIcon },
  { id: 'audit', label: 'Audit Trail', icon: HistoryIcon },
];

export const Sidebar = ({ currentPage, setCurrentPage }: SidebarProps) => {
  const { state, dispatch } = useInventory();
  const user = state.currentUser;

  const filteredMenuItems = menuItems.filter(item => {
    if (user.role === 'MANAGER') return true;
    if (user.role === 'SUPERVISOR') {
      return !['write-offs', 'suppliers', 'reports', 'reorder', 'audit'].includes(item.id);
    }
    if (user.role === 'STAFF') {
      return ['dashboard', 'inventory', 'breakage', 'barcodes', 'transfers', 'purchases'].includes(item.id);
    }
    return false;
  });

  return (
    <aside className="w-64 border-r border-[#E5E7EB] bg-white flex flex-col h-screen sticky top-0 overflow-y-auto z-20">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
            <Package className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1A1A1A]">Inventra</h1>
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Enterprise OS</p>
          </div>
        </div>

        <nav className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-250px)]">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group",
                  isActive 
                    ? "bg-black text-white shadow-xl shadow-black/10 translate-x-1" 
                    : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#1A1A1A]"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-4 h-4", isActive ? "text-white" : "opacity-60")} />
                  <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3 h-3 text-white" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-[#F3F4F6]">
        <div className="bg-[#F9FAFB] rounded-2xl p-4 flex flex-col gap-3">
           <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-black text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold font-mono">
                {user.name.split(' ').map(n => n.charAt(0)).join('')}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[11px] font-bold text-[#1A1A1A] truncate">{user.name}</p>
                <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-tighter">{user.role}</p>
              </div>
           </div>
           <select 
             className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2 py-1 text-[10px] font-bold text-[#1A1A1A] outline-none cursor-pointer hover:border-black transition-colors"
             value={user.id}
             onChange={(e) => dispatch({ type: 'SET_CURRENT_USER', payload: e.target.value })}
           >
             {state.users.map(u => (
               <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
             ))}
           </select>
        </div>
      </div>
    </aside>
  );
};
