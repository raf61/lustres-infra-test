import { 
  IConversationRepository, 
  StatusCounts 
} from '../domain/repositories/conversation-repository';

// ============================================================================
// TIPOS DE ENTRADA/SAÍDA
// ============================================================================

export type GetStatusCountsInput = {
  inboxId: string;           // ID da inbox (obrigatório)
  userId: string;            // ID do usuário logado
  assignee: 'me' | 'all';    // Filtro de assignee
  assigneeId?: string;       // Filtro por assignee específico (opcional)
};

export type GetStatusCountsOutput = StatusCounts;

// ============================================================================
// USE CASE
// ============================================================================

/**
 * Retorna contagens de conversas por status para uma inbox.
 * 
 * Responsabilidades:
 * - Validar input
 * - Traduzir assignee para assigneeId (se 'me')
 * - Delegar ao repositório
 * 
 * Não conhece: HTTP, Prisma, detalhes de infraestrutura
 */
export class GetStatusCountsUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository
  ) {}

  async execute(input: GetStatusCountsInput): Promise<GetStatusCountsOutput> {
    const { inboxId, userId, assignee, assigneeId } = input;

    if (!inboxId) {
      throw new Error('INBOX_REQUIRED');
    }

    // Traduzir assignee para assigneeId
    const resolvedAssigneeId =
      assignee === 'all' ? assigneeId ?? undefined : userId;

    // Delegar ao repositório
    return this.conversationRepository.countByStatus(inboxId, resolvedAssigneeId);
  }
}

