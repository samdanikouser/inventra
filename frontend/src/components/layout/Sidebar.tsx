'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronRight,
  PackagePlus,
  Tags,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserRole } from '@/types/inventory';

type MenuItem = {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  href: string;
};

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'inventory', label: 'Inventory', icon: Package, href: '/inventory' },
  { id: 'purchases', label: 'Purchases', icon: PackagePlus, href: '/purchases' },
  { id: 'breakage', label: 'Breakage Log', icon: Hammer, href: '/breakage' },
  { id: 'write-offs', label: 'Write-offs', icon: Trash2, href: '/write-offs' },
  { id: 'outlets', label: 'Outlets', icon: Warehouse, href: '/outlets' },
  { id: 'suppliers', label: 'Suppliers', icon: Users, href: '/suppliers' },
  { id: 'categories', label: 'Categories', icon: Tags, href: '/categories' },
  { id: 'reports', label: 'Monthly Reports', icon: BarChart3, href: '/reports' },
  { id: 'reorder', label: 'Reorder List', icon: AlertCircle, href: '/reorder' },
  { id: 'barcodes', label: 'Barcode Manager', icon: QrCode, href: '/barcodes' },
  { id: 'stock-take', label: 'Stock Take', icon: ClipboardList, href: '/stock-take' },
  { id: 'transfers', label: 'Stock Transfer', icon: ArrowRightLeft, href: '/transfers' },
  { id: 'monthly-closing', label: 'Monthly Closing', icon: LockIcon, href: '/monthly-closing' },
  { id: 'audit', label: 'Audit Trail', icon: HistoryIcon, href: '/audit' },
];

export const filterMenuByRole = (role: UserRole): MenuItem[] =>
  menuItems.filter((item) => {
    if (role === 'MANAGER') return true;
    if (role === 'SUPERVISOR') {
      return !['write-offs', 'suppliers', 'reports', 'reorder', 'audit'].includes(item.id);
    }
    if (role === 'STAFF') {
      return ['dashboard', 'inventory', 'breakage', 'barcodes', 'transfers', 'purchases'].includes(item.id);
    }
    return false;
  });

export const Sidebar = () => {
  const pathname = usePathname();
  const { logout, user, role } = useAuth();

  const displayName = user?.full_name || user?.username || 'Inventra User';
  const initials = displayName
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const filteredMenuItems = filterMenuByRole(role);

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

        <nav className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-250px)] scrollbar-hide">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group',
                  isActive
                    ? 'bg-black text-white shadow-xl shadow-black/10 translate-x-1'
                    : 'text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#1A1A1A]'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'opacity-60')} />
                  <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3 h-3 text-white" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-[#F3F4F6]">
        <div className="bg-[#F9FAFB] rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-black text-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold font-mono">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-bold text-[#1A1A1A] truncate">{displayName}</p>
              <p className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-tighter">{role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
};
