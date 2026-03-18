import { ensureAiAgentWorker } from "./ai-agent.worker";
import { ensureFollowUpWorker } from "./follow-up.worker";

ensureAiAgentWorker();
ensureFollowUpWorker();
