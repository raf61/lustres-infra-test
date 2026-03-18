// ════════════════════════════════════════════════════════════════════════════
// LIST TEMPLATES USE CASE
// Retorna os templates armazenados no banco (igual ao Chatwoot)
// Templates são sincronizados via SyncTemplatesUseCase
// ════════════════════════════════════════════════════════════════════════════

import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { WhatsAppTemplate } from '../infra/provider/whatsapp-templates.provider';

export interface ListTemplatesResult {
  templates: WhatsAppTemplate[];
  lastUpdatedAt?: Date | null;
}

export class ListTemplatesUseCase {
  constructor(private readonly inboxRepository: IInboxRepository) {}

  async execute(inboxId: string): Promise<ListTemplatesResult> {
    // 1. Busca a inbox
    const inbox = await this.inboxRepository.findById(inboxId);
    if (!inbox) {
      throw new Error('Inbox not found');
    }

    // 2. Valida que é WhatsApp Cloud
    if (inbox.provider !== 'whatsapp_cloud') {
      return { templates: [] }; // Outras inboxes não têm templates
    }

    // 3. Retorna templates do banco (igual ao Chatwoot getWhatsAppTemplates)
    const allTemplates = (inbox.messageTemplates || []) as WhatsAppTemplate[];

    // 4. Filtra templates (igual ao Chatwoot getFilteredWhatsAppTemplates)
    const filteredTemplates = allTemplates.filter(template => {
      // Ensure template has required properties
      if (!template || !template.status || !template.components) {
        return false;
      }

      // Only show approved templates
      if (template.status.toUpperCase() !== 'APPROVED') {
        return false;
      }

      // Filter out authentication templates
      if (template.category === 'AUTHENTICATION') {
        return false;
      }

      // Filter out unsupported components (igual ao Chatwoot)
      const hasUnsupportedComponents = template.components.some(
        (component: any) =>
          ['LIST', 'PRODUCT', 'CATALOG', 'CALL_PERMISSION_REQUEST'].includes(component.type) ||
          (component.type === 'HEADER' && component.format === 'LOCATION')
      );

      if (hasUnsupportedComponents) {
        return false;
      }

      return true;
    });

    return {
      templates: filteredTemplates,
      lastUpdatedAt: inbox.messageTemplatesLastUpdated,
    };
  }
}

