'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserRole } from '@/types/inventory';

interface RoleGuardProps {
  page: string;
  children: React.ReactNode;
}

const accessByRole: Record<UserRole, (page: string) => boolean> = {
  MANAGER: () => true,
  SUPERVISOR: (page) => !['write-offs', 'suppliers', 'reports', 'reorder', 'audit'].includes(page),
  STAFF: (page) =>
    ['dashboard', 'inventory', 'breakage', 'barcodes', 'transfers', 'purchases'].includes(page),
};

/**
 * Redirects to "/" if the current user does not have access to `page`.
 * Wrap any role-restricted page in this component.
 */
export const RoleGuard = ({ page, children }: RoleGuardProps) => {
  const router = useRouter();
  const { role, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const ok = accessByRole[role](page);
    if (!ok) router.replace('/');
  }, [role, page, router, isLoading, isAuthenticated]);

  if (isLoading) return null;
  if (!accessByRole[role](page)) return null;
  return <>{children}</>;
};
