import { Sidebar } from '@/components/layout/Sidebar';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Dashboard } from '@/components/dashboard/Dashboard';

export default function Home() {
  return (
    <RoleGuard page="dashboard">
      <div className="flex bg-[#F8F9FA] min-h-screen text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-hidden flex flex-col">
          <Dashboard />
        </main>
      </div>
    </RoleGuard>
  );
}
