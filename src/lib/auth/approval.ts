export type UserRole = 'admin' | 'user';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface ApprovalProfile {
  role: string | null;
  approval_status: string | null;
}

export function isApproved(profile: ApprovalProfile | null | undefined) {
  return profile?.approval_status === 'approved';
}

export function isAdmin(profile: ApprovalProfile | null | undefined) {
  return isApproved(profile) && profile?.role === 'admin';
}

export function approvalRedirectPath(
  profile: ApprovalProfile | null | undefined,
) {
  if (isApproved(profile)) return null;
  return '/pending-approval';
}

export function approvalMessage(status: string | null | undefined) {
  switch (status) {
    case 'approved':
      return 'Your account is approved.';
    case 'rejected':
      return 'Your account request was rejected. Contact the administrator if you believe this is a mistake.';
    case 'suspended':
      return 'Your account is suspended. Contact the administrator to restore access.';
    case 'pending':
    default:
      return 'Your account has been created and is pending admin approval.';
  }
}
