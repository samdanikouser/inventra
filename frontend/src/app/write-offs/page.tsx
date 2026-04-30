import { Sidebar } from '@/components/layout/Sidebar';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { WriteOffLog } from '@/components/transactions/WriteOffLog';

export default function WriteOffsPage() {
  return (
    <RoleGuard page="write-offs">
      <div className="flex bg-[#F8F9FA] min-h-screen text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-hidden flex flex-col">
          <WriteOffLog />
        </main>
      </div>
    </RoleGuard>
  );
}
