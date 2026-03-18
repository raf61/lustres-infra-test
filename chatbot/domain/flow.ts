export type ChatbotFlowEngine = "FLOW" | "AI_AGENT";

export type ChatbotAIConfig = {
  model?: string;
  temperature?: number;
  maxHistoryMessages?: number;
  tools?: string[];
  customPromptSuffix?: string;
  /** Prompt completo do sistema para este fluxo (se não definido, usa default) */
  systemPrompt?: string;
  /** Objetivo específico do fluxo (ex: "Agendar visita técnica", "Cobrar débito") */
  objective?: string;
};

export type ChatbotFlowType = "INBOUND" | "OUTBOUND";

export type ChatbotInputType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "choice"
  | "buttons"
  | "regex";

export type ChatbotStepType =
  | "message"
  | "input"
  | "set_variable"
  | "send_message"
  | "webhook"
  | "handoff"
  | "wait"
  | "action"
  | "condition";

export type ChatbotStepOption = {
  pattern: string;
  nextStepId: string;
  target?: "content";
  value?: string;
};

export type ChatbotStep = {
  id: string;
  type: ChatbotStepType;
  prompt?: string;
  message?: string;
  items?: Array<{ title: string; value: string; description?: string }>;
  template?: {
    name: string;
    languageCode: string;
    components: any[];
  };
  attachments?: Array<{
    fileType: string;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }>;
  inputType?: ChatbotInputType;
  validationPattern?: string;
  onFailStepId?: string;
  handoffOnInvalid?: boolean;
  maxInvalidAttempts?: number;
  nextStepId?: string | null;
  options?: ChatbotStepOption[];
  saveTo?: string;
  action?: {
    type: "set_variable" | "send_message";
    key?: string;
    value?: string;
    message?: string;
    items?: Array<{ title: string; value: string; description?: string }>;
    template?: {
      name: string;
      languageCode: string;
      components: any[];
    };
    attachments?: Array<{
      fileType: string;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    }>;
  };
  condition?: {
    variable: string;
    operator: "equals" | "not_equals" | "contains" | "exists" | "not_exists";
    value?: any;
  };
};

export type ChatbotFlowDefinition = {
  startStepId?: string;
  sessionTimeoutMinutes?: number;
  maxStepsPerRun?: number;
  autoAssignWindowHours?: number;
  followUp?: {
    enabled: boolean;
    afterMinutes?: number;
    stepId?: string;
  };
  steps: ChatbotStep[];
};

export type ChatbotFlow = {
  id: string;
  name: string;
  engine: ChatbotFlowEngine;
  type: ChatbotFlowType;
  active: boolean;
  inboxId?: string | null;
  definition: ChatbotFlowDefinition;
  aiConfig?: ChatbotAIConfig | null;
  createdAt: Date;
  updatedAt: Date;
};
