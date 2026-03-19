import { updateMaintenanceDateTool } from "../../infra/tools/update-maintenance-date.tool";
import { updateSyndicDataTool } from "../../infra/tools/update-syndic-data.tool";
import { scheduleFollowupTool } from "../../infra/tools/schedule-followup.tool";
import { triggerNewOutboundTool } from "../../infra/tools/trigger-new-outbound.tool";
import { handoffTool } from "../../infra/tools/handoff.tool";
import { resolveConversationTool } from "../../infra/tools/resolve-conversation.tool";
import { returnToResearchTool } from "../../infra/tools/return-to-research.tool";
import { markAsLossTool } from "../../infra/tools/mark-as-loss.tool";
import { consultStockTool } from "../../infra/tools/consult-stock.tool";
import { updateKanbanTool } from "../../infra/tools/update-kanban.tool";

export const tools = [
    updateMaintenanceDateTool,
    updateSyndicDataTool,
    scheduleFollowupTool,
    triggerNewOutboundTool,
    handoffTool,
    resolveConversationTool,
    returnToResearchTool,
    markAsLossTool,
    consultStockTool,
    updateKanbanTool,
];


