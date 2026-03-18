import { Contact } from '../contact';

export interface IContactRepository {
  findByWaId(waId: string): Promise<Contact | null>;
  create(contact: Omit<Contact, 'id'>): Promise<Contact>;
  update(id: string, contact: Partial<Contact>): Promise<Contact>;
  ensureContact(waId: string, name?: string): Promise<Contact>;
}

