import { IInboxAccessPolicy, InboxAccessContext } from '../../domain/policies/inbox-access-policy';
import { InboxWithCount } from '../../domain/repositories/inbox-repository';

export class AllowAllInboxAccessPolicy implements IInboxAccessPolicy {
  filter(inboxes: InboxWithCount[], _context: InboxAccessContext): InboxWithCount[] {
    return inboxes;
  }
}

