import { describe, expect, it } from 'vitest';

import {
  approvalMessage,
  approvalRedirectPath,
  isAdmin,
  isApproved,
  type ApprovalProfile,
} from './approval';

const profile = (
  approval_status: ApprovalProfile['approval_status'],
  role: ApprovalProfile['role'] = 'user',
): ApprovalProfile => ({ approval_status, role });

describe('approval access rules', () => {
  it('blocks pending users from dashboard routes', () => {
    expect(approvalRedirectPath(profile('pending'))).toBe('/pending-approval');
  });

  it('allows approved users to access dashboard routes', () => {
    expect(isApproved(profile('approved'))).toBe(true);
    expect(approvalRedirectPath(profile('approved'))).toBeNull();
  });

  it('allows approved admins to access admin users', () => {
    expect(isAdmin(profile('approved', 'admin'))).toBe(true);
  });

  it('blocks normal users from admin users', () => {
    expect(isAdmin(profile('approved', 'user'))).toBe(false);
  });

  it('blocks rejected, suspended, and deleted users from dashboard routes', () => {
    expect(approvalRedirectPath(profile('rejected'))).toBe('/pending-approval');
    expect(approvalRedirectPath(profile('suspended'))).toBe('/pending-approval');
    expect(approvalRedirectPath(profile('deleted'))).toBe('/pending-approval');
    expect(approvalMessage('deleted')).toContain('removed');
  });
});
