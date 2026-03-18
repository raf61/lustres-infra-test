export interface IChatbotInboxDefaultRepository {
  findDefaultByInbox(
    inboxId: string
  ): Promise<{ flowId: string; active: boolean } | null>;
}
