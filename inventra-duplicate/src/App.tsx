import React, { useState } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { InventoryList } from './components/Inventory/InventoryList';
import { StockTakeManager } from './components/StockTake/StockTakeManager';
import { BreakageLog } from './components/Breakage/BreakageLog';
import { AuditTrail } from './components/AuditTrail';
import { WriteOffLog } from './components/Transactions/WriteOffLog';
import { OutletManager } from './components/Management/OutletManager';
import { SupplierManager } from './components/Management/SupplierManager';
import { CategoryManager } from './components/Management/CategoryManager';
import { ClosingManager } from './components/Management/ClosingManager';
import { MonthlyReports } from './components/Reports/MonthlyReports';
import { TransferManager } from './components/Transactions/TransferManager';
import { PurchaseManager } from './components/Transactions/PurchaseManager';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { motion, AnimatePresence } from 'motion/react';

// Placeholder components for other pages
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center px-8 flex-shrink-0">
      <h2 className="text-lg font-semibold text-[#1A1A1A] capitalize">{title.replace('-', ' ')}</h2>
    </header>
    <div className="p-8 flex flex-col items-center justify-center h-full max-w-md mx-auto text-center space-y-6 opacity-40">
      <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-black">
        <HistoryIcon className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-[#1A1A1A] uppercase tracking-tight italic">{title.replace('-', ' ')}</h3>
        <p className="text-sm font-medium text-[#6B7280]">This module is currently undergoing system optimization. Check back soon for full integration.</p>
      </div>
    </div>
  </div>
);

const AppContent = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { state } = useInventory();
  const user = state.currentUser;

  // Role-based protection: Redirect to dashboard if user doesn't have access to current page
  React.useEffect(() => {
    const hasAccess = () => {
      if (user.role === 'MANAGER') return true;
      if (user.role === 'SUPERVISOR') {
        return !['write-offs', 'suppliers', 'reports', 'reorder', 'audit'].includes(currentPage);
      }
      if (user.role === 'STAFF') {
        return ['dashboard', 'inventory', 'breakage', 'transfers', 'purchases'].includes(currentPage);
      }
      return false;
    };

    if (!hasAccess()) {
      setCurrentPage('dashboard');
    }
  }, [user.role, currentPage]);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'inventory':
        return <InventoryList />;
      case 'purchases':
        return <PurchaseManager />;
      case 'breakage':
        return <BreakageLog />;
      case 'stock-take':
        return <StockTakeManager />;
      case 'write-offs':
        return <WriteOffLog />;
      case 'outlets':
        return <OutletManager />;
      case 'suppliers':
        return <SupplierManager />;
      case 'categories':
        return <CategoryManager />;
      case 'reports':
        return <MonthlyReports />;
      case 'transfers':
        return <TransferManager />;
      case 'monthly-closing':
        return <ClosingManager />;
      case 'audit':
        return <AuditTrail />;
      default:
        return <PlaceholderPage title={currentPage.replace('-', ' ')} />;
    }
  };

  return (
    <div className="flex bg-[#F8F9FA] min-h-screen text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="flex-1 min-h-screen overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <InventoryProvider>
      <AppContent />
    </InventoryProvider>
  );
}
