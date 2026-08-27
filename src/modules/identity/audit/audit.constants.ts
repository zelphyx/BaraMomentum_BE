export const AUDIT_ACTIONS = {
  USER_LOGIN: 'user.login',
  USER_LOGIN_FAILED: 'user.login.failed',
  USER_LOGOUT: 'user.logout',
  USER_REFRESH: 'user.refresh',
  USER_REFRESH_REUSE: 'user.refresh.reuse',
  USER_PASSWORD_CHANGE: 'user.password.change',
  USER_PASSWORD_RESET_REQUEST: 'user.password.reset.request',
  USER_PASSWORD_RESET: 'user.password.reset',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_REVOKE_SESSIONS: 'user.revoke_sessions',
  INVITATION_CREATED: 'invitation.created',
  INVITATION_ACCEPTED: 'invitation.accepted',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
