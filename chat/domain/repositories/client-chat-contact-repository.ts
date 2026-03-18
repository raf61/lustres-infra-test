export interface IClientChatContactRepository {
  ensureLink(contactId: string, clientId: number): Promise<void>;
  removeLink(contactId: string, clientId: number): Promise<number>;
  findContactIdsByClientId(clientId: number): Promise<string[]>;
  findContactIdsByClientIds(clientIds: number[]): Promise<Record<number, string[]>>;
  findClientIdsByContactId(contactId: string): Promise<number[]>;
}

