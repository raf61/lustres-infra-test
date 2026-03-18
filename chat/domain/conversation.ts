export type Conversation = {
  id: string;
  inboxId: string;
  contactId: string;
  status: string;
  assigneeId?: string | null;
  waitingSince?: Date | null;
  lastActivityAt?: Date;
  agentLastSeenAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};
