import { InboundMessage } from '../../domain/message';
import { MessageRepository } from '../../domain/repositories/message-repository';
import { InboundStatus } from '../../domain/status';

export class MockMessageRepository implements MessageRepository {
  private messages: InboundMessage[] = [];
  private statuses: InboundStatus[] = [];

  async saveMessages(messages: InboundMessage[]): Promise<void> {
    this.messages.push(...messages);
    console.log('[mock-repo] saved messages count:', messages.length);
  }

  async saveStatuses(statuses: InboundStatus[]): Promise<void> {
    this.statuses.push(...statuses);
    console.log('[mock-repo] saved statuses count:', statuses.length);
  }

  // Helpers for future use/tests
  getMessages() {
    return this.messages;
  }

  getStatuses() {
    return this.statuses;
  }
}

