// ════════════════════════════════════════════════════════════════════════════
// SYNC TEMPLATES USE CASE
// Sincroniza templates do WhatsApp Business Manager e armazena no banco
// Igual ao Chatwoot: whatsapp_cloud_service.rb#sync_templates
// ════════════════════════════════════════════════════════════════════════════

import { IInboxRepository } from '../domain/repositories/inbox-repository';
import { listTemplates, WhatsAppTemplate } from '../infra/provider/whatsapp-templates.provider';

export interface SyncTemplatesResult {
  success: boolean;
  templatesCount: number;
  updatedAt: Date;
}

export class SyncTemplatesUseCase {
  constructor(private readonly inboxRepository: IInboxRepository) {}

  async execute(inboxId: string): Promise<SyncTemplatesResult> {
    // 1. Busca a inbox
    const inbox = await this.inboxRepository.findById(inboxId);
    if (!inbox) {
      throw new Error('Inbox not found');
    }

    // 2. Valida que é WhatsApp Cloud
    if (inbox.provider !== 'whatsapp_cloud') {
        return { success: false, templatesCount: 0, updatedAt: new Date() };
    }

    // 3. Extrai configurações (igual ao Chatwoot)
    const settings = inbox.settings as Record<string, any> || {};
    const wabaId = settings.whatsapp_cloud?.wabaId || process.env.WA_CLOUD_WABA_ID;
    const token = settings.whatsapp_cloud?.token || process.env.WA_CLOUD_TOKEN;
    const apiVersion = settings.whatsapp_cloud?.apiVersion || process.env.WA_CLOUD_API_VERSION || 'v18.0';
    
    if (!wabaId || !token) {
      console.warn('[SyncTemplates] Missing WABA ID or token for inbox:', inboxId);
      return { success: false, templatesCount: 0, updatedAt: new Date() };
    }

    // 4. Busca templates da API da Meta
    try {
      console.log('wabaId', wabaId);
      console.log('token', token);
      console.log('apiVersion', apiVersion);
      const result = await listTemplates(wabaId, token, apiVersion);
      const now = new Date();
      
      // 5. Salva no banco (igual ao Chatwoot)
      await this.inboxRepository.updateTemplates(inboxId, result.templates, now);
      
      console.log(`[SyncTemplates] Synced ${result.templates.length} templates for inbox ${inboxId}`);
      
      return {
        success: true,
        templatesCount: result.templates.length,
        updatedAt: now,
      };
    } catch (error) {
      console.error('[SyncTemplates] Error syncing templates:', error);
      throw error;
    }
  }
}

