import { Sidebar } from '@/components/layout/Sidebar';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { ReorderList } from '@/components/inventory/ReorderList';

export default function ReorderPage() {
  return (
    <RoleGuard page="reorder">
      <div className="flex bg-[#F8F9FA] min-h-screen text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-hidden flex flex-col">
          <ReorderList />
        </main>
      </div>
    </RoleGuard>
  );
}
