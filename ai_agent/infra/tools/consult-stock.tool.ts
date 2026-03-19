import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";

export const consultStockTool = tool(
  async () => {
    try {
      const items = await prisma.item.findMany({
        select: {
          id: true,
          nome: true,
          valor: true,
          categoria: true,
        },
      });

      if (items.length === 0) {
        return "Não há itens cadastrados no estoque no momento.";
      }

      const formattedItems = items.map((item) => 
        `- ${item.nome} (${item.categoria || "Sem categoria"}): ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor)} - Disponibilidade: 500 unidades (estoque alto)`
      ).join("\n");

      return `Estoque de Lustres - Casarão Lustres:\n\n${formattedItems}\n\n*Nota: Todos os itens listados possuem estoque disponível (aproximadamente 500 unidades cada).*`;
    } catch (error) {
      console.error("[consultStockTool] Erro ao consultar estoque:", error);
      return "Erro ao consultar o estoque. Por favor, tente novamente mais tarde.";
    }
  },
  {
    name: "consult_stock",
    description: "Consulta o estoque de itens (lustres, lâmpadas, serviços) da loja Casarão Lustres. Use esta ferramenta quando o cliente perguntar sobre disponibilidade de produtos, preços ou o que a loja vende.",
    schema: z.object({}),
  }
);
