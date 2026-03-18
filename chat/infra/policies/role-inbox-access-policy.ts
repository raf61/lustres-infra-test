import { IInboxAccessPolicy, InboxAccessContext } from '../../domain/policies/inbox-access-policy';
import { InboxWithCount } from '../../domain/repositories/inbox-repository';

type InboxAccessSettings = {
  allowedRoles?: string[];
};

const PRIVILEGED_ROLES = new Set(['MASTER', 'ADMINISTRADOR']);

const normalizeRole = (role?: string | null) =>
  (role || '').toString().trim().toUpperCase();

export class RoleInboxAccessPolicy implements IInboxAccessPolicy {
  filter(inboxes: InboxWithCount[], context: InboxAccessContext): InboxWithCount[] {
    const role = normalizeRole(context.role);
    if (!role) return [];
    if (PRIVILEGED_ROLES.has(role)) return inboxes;

    return inboxes.filter((inbox) => {
      const settings = (inbox.settings || {}) as InboxAccessSettings;
      const allowedRoles = Array.isArray(settings.allowedRoles) ? settings.allowedRoles : [];
      if (allowedRoles.length === 0) return true;

      const normalizedAllowed = allowedRoles.map(normalizeRole);
      return normalizedAllowed.includes(role) || normalizedAllowed.includes('ALL') || normalizedAllowed.includes('*');
    });
  }
}

