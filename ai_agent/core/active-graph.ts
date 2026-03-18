// ──────────────────────────────────────────────────────────────
// SELETOR DINÂMICO DE GRAFOS
// ──────────────────────────────────────────────────────────────
import { multiAgentGraph } from "./multi-agent/graph";
import { graph as legacyGraph } from "./graph";
import { recuperadorGraph } from "../recuperador_info/graph";

/**
 * [GAMBIARRA TEMPORÁRIA] Seletor de Grafos por FlowID
 * 
 * Atualmente o sistema está sendo preparado para ser multi-estratégia.
 * Por enquanto, mapeamos os IDs fixos no código.
 */
export const getActiveGraph = (flowId: string) => {
    console.log(`[ActiveGraph] Selecionando grafo para o fluxo: ${flowId}`);

    // Fluxo Original de Vendas (O que já funciona hoje)
    if (flowId === "ai-agent-v1-flow") {
        return multiAgentGraph;
    }

    // [NOVO FLUXO] Fluxo de Pesquisa / Recuperador de Info
    if (flowId === "cmms9okxa0001jl04p2ls4ap7") {
        return recuperadorGraph;
    }

    // Fallback padrão(deixar nulo mesmo)
    return null;
};

// Re-exporta para compatibilidade se necessário
export { multiAgentGraph, legacyGraph };
