// ════════════════════════════════════════════════════════════════════════════
// WHATSAPP TEMPLATES PROVIDER
// Busca templates do WhatsApp Business Manager via API da Meta
// ════════════════════════════════════════════════════════════════════════════

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: TemplateButton[];
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
}

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "DISABLED" | "IN_APPEAL" | "PENDING_DELETION";
  category: string;
  language: string;
  parameter_format?: "POSITIONAL" | "NAMED";
  components: TemplateComponent[];
}

export interface ListTemplatesResult {
  templates: WhatsAppTemplate[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

/**
 * Busca templates aprovados do WhatsApp Business Account (WABA)
 * Igual ao Chatwoot: whatsapp/providers/whatsapp_cloud_service.rb#sync_templates
 */
export async function listTemplates(
  wabaId: string,
  token: string,
  apiVersion: string = "v18.0"
): Promise<ListTemplatesResult> {
  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?fields=name,status,category,language,components,parameter_format&limit=100`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      console.error('[WhatsAppTemplates] Error fetching templates:', data);
      throw new Error(data.error?.message || 'Failed to fetch templates');
    }

    // Filtra apenas templates aprovados (igual ao Chatwoot)
    const approvedTemplates = (data.data || []).filter(
      (t: WhatsAppTemplate) => t.status === "APPROVED"
    );

    return {
      templates: approvedTemplates,
      paging: data.paging,
    };
  } catch (error: any) {
    console.error('[WhatsAppTemplates] Error:', error);
    throw new Error(`Failed to fetch WhatsApp templates: ${error.message}`);
  }
}

