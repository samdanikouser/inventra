import { Sidebar } from '@/components/layout/Sidebar';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { OutletManager } from '@/components/management/OutletManager';

export default function OutletsPage() {
  return (
    <RoleGuard page="outlets">
      <div className="flex bg-[#F8F9FA] min-h-screen text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-hidden flex flex-col">
          <OutletManager />
        </main>
      </div>
    </RoleGuard>
  );
}
