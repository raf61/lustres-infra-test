import { Contact } from '../contact';

export type ContactInbox = {
  id: string;
  contactId: string;
  inboxId: string;
  sourceId: string;
  contact?: Contact;
};

export interface IContactInboxRepository {
  /**
   * Busca vínculo por sourceId + inboxId (igual Chatwoot)
   */
  findBySourceIdAndInbox(sourceId: string, inboxId: string): Promise<ContactInbox | null>;

  /**
   * Cria vínculo entre contato e inbox
   */
  create(data: { contactId: string; inboxId: string; sourceId: string }): Promise<ContactInbox>;

  /**
   * Garante que existe um vínculo (idempotente)
   */
  ensureContactInbox(contactId: string, inboxId: string, sourceId: string): Promise<ContactInbox>;
}

