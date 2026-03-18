export type Inbox = {
  id: string;
  name: string;
  provider: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  settings: Record<string, any>;
  messageTemplates?: any[];  // Templates do WhatsApp (igual Chatwoot)
  messageTemplatesLastUpdated?: Date | null;  // Última sync dos templates
  createdAt?: Date;
  updatedAt?: Date;
};

