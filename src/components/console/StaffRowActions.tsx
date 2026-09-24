'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { TableActionMenu, type ActionMenuItem } from '@/components/ui/TableActionMenu';
import { WashBoyReviewsModal } from './WashBoyReviewsModal';
import type { Staff } from '@/lib/data/types';

interface StaffRowActionsProps {
  member: Staff;
  base: string;
}

export function StaffRowActions({ member, base }: StaffRowActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const showConfirm = useConfirm();
  const [showReviews, setShowReviews] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleToggleActive = async () => {
    const actionText = member.active ? 'Deactivate' : 'Reactivate';
    const confirmed = await showConfirm({
      title: `${actionText} ${member.name}`,
      message: member.active
        ? `Deactivate ${member.name}? Their upcoming cars will become unassigned and their staff login will stop working.`
        : `Reactivate ${member.name}? They will be able to log in and accept assigned car washes again.`,
      confirmText: actionText,
      tone: member.active ? 'danger' : 'primary',
    });

    if (!confirmed) return;

    setIsPending(true);
    try {
      const res = await fetch('/api/ops/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setActive',
          staffId: member.id,
          active: !member.active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${actionText.toLowerCase()} staff member`);
      }

      toast.success(data.message || `${member.name} ${member.active ? 'deactivated' : 'reactivated'}.`, {
        title: `Staff ${member.active ? 'Deactivated' : 'Reactivated'}`,
      });

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed', {
        title: 'Error',
      });
    } finally {
      setIsPending(false);
    }
  };

  const menuItems: ActionMenuItem[] = [
    {
      id: 'complaints',
      label: 'View Complaints',
      icon: '🚨',
      href: `${base}/complaints?staffId=${member.id}`,
      variant: 'warning',
    },
    {
      id: 'reviews',
      label: 'Reviews & Ratings',
      icon: '⭐',
      onClick: () => setShowReviews(true),
      variant: 'primary',
    },
    {
      id: 'toggle-active',
      label: member.active ? 'Deactivate Staff' : 'Reactivate Staff',
      icon: member.active ? '🔒' : '🔓',
      onClick: handleToggleActive,
      variant: member.active ? 'danger' : 'primary',
      dividerBefore: true,
      disabled: isPending,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-end">
        <TableActionMenu items={menuItems} label={`Actions for ${member.name}`} />
      </div>

      {showReviews && (
        <WashBoyReviewsModal
          staffId={member.id}
          staffName={member.name}
          onClose={() => setShowReviews(false)}
        />
      )}
    </>
  );
}
