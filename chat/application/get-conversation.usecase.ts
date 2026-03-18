import {
  IConversationRepository,
  ConversationWithDetails,
  ConversationWithRelations,
} from '../domain/repositories/conversation-repository';

// ============================================================================
// TIPOS DE ENTRADA/SAÍDA
// ============================================================================

export type GetConversationInput = {
  conversationId: string;
};

export type GetConversationOutput = ConversationWithDetails | null;

// ============================================================================
// CONSTANTES DE NEGÓCIO
// ============================================================================

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ============================================================================
// USE CASE
// ============================================================================

/**
 * Busca detalhes de uma conversa específica.
 * Aplica regras de negócio sobre os dados brutos do repositório.
 */
export class GetConversationUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository
  ) { }

  async execute(input: GetConversationInput): Promise<GetConversationOutput> {
    const { conversationId } = input;

    // Buscar dados brutos do repositório
    const rawData = await this.conversationRepository.findByIdWithRelations(conversationId);

    if (!rawData) {
      return null;
    }

    // Aplicar regras de negócio
    return await this.applyBusinessRules(rawData);
  }

  /**
   * Aplica regras de negócio sobre os dados brutos.
   * Calcula unreadCount dinamicamente igual ao Chatwoot.
   */
  private async applyBusinessRules(conv: ConversationWithRelations): Promise<ConversationWithDetails> {
    const now = new Date();

    // REGRA: canReply = última incoming foi há menos de 24h
    const canReply = this.calculateCanReply(conv.lastIncomingAt, now);

    // REGRA: unreadCount = mensagens incoming após agentLastSeenAt (Chatwoot style)
    const unreadCount = await this.conversationRepository.countUnreadMessages(
      conv.id,
      conv.agentLastSeenAt || null
    );

    return {
      ...conv,
      canReply,
      unreadCount,
      chatbotStatus: conv.chatbotStatus ?? null,
    };
  }

  /**
   * Verifica se a conversa está dentro da janela de 24h.
   */
  private calculateCanReply(lastIncomingAt: Date | null | undefined, now: Date): boolean {
    if (!lastIncomingAt) return false;

    const timeSinceLastIncoming = now.getTime() - lastIncomingAt.getTime();
    return timeSinceLastIncoming < TWENTY_FOUR_HOURS_MS;
  }
}

