import { Inbox } from '../inbox';

export type InboxWithCount = Inbox & {
  openConversationsCount: number;
};

export interface IInboxRepository {
  findByPhoneNumberId(phoneNumberId: string): Promise<Inbox | null>;
  findById(id: string): Promise<Inbox | null>;
  create(inbox: Omit<Inbox, 'id'>): Promise<Inbox>;
  findAllWithOpenCount(): Promise<InboxWithCount[]>;
  
  // Templates (igual ao Chatwoot)
  updateTemplates(id: string, templates: any[], updatedAt: Date): Promise<void>;
  updateSettings(id: string, settings: Record<string, any>): Promise<void>;
}

