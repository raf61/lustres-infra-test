import { SendMessageInput } from "../send-message.usecase";

export type BroadcastContactContext = {
  clientId?: number | null;
  contactId?: string | null;
  contactName?: string | null;
  phoneNumber?: string | null;
};

export type BroadcastMessageDraft = Omit<SendMessageInput, "conversationId" | "assigneeId"> & {
  assigneeId?: string | null;
};

export type BroadcastMessageBuildInput = {
  baseMessage: BroadcastMessageDraft;
  contact: BroadcastContactContext;
};

export interface BroadcastMessageBuilder {
  build(input: BroadcastMessageBuildInput): Promise<BroadcastMessageDraft>;
}

