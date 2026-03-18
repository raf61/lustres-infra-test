import { InboxWithCount } from '../repositories/inbox-repository';

export type InboxAccessContext = {
  userId: string;
  role?: string | null;
};

export interface IInboxAccessPolicy {
  filter(
    inboxes: InboxWithCount[],
    context: InboxAccessContext
  ): Promise<InboxWithCount[]> | InboxWithCount[];
}

