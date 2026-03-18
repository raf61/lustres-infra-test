export interface IChatbotActionProvider {
    execute(
        actionName: string,
        variables: Record<string, unknown>,
        context: { conversationId: string }
    ): Promise<{
        variableUpdates?: Record<string, unknown>;
        nextStepId?: string | null;
    }>;
}
