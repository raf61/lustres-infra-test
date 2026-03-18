import { PrismaClient } from "@prisma/client";
import { IChatbotActionProvider } from "../../application/ports/action-provider";
import { extractDigits, formatCnpjDigits } from "../../../lib/cnpj";
import { GeneratePropostaPdfUseCase } from "../../../domain/orcamento/generate-proposta-pdf-usecase";
import { storage } from "../../../lib/storage";

export class SystemChatbotActionProvider implements IChatbotActionProvider {
    constructor(private readonly prisma: PrismaClient) { }

    async execute(
        actionName: string,
        variables: Record<string, unknown>,
        context: { conversationId: string }
    ): Promise<{
        variableUpdates?: Record<string, unknown>;
        nextStepId?: string | null;
    }> {
        console.log(`[ChatbotAction] Executing ${actionName}`, { conversationId: context.conversationId });

        if (actionName === "verify_cnpj") {
            return this.verifyCnpj(variables);
        }

        if (actionName === "generate_proposal") {
            return this.generateProposal(variables, context);
        }

        return {};
    }

    private async verifyCnpj(variables: Record<string, unknown>) {
        const cnpjInput = String(variables.cnpj || "").trim();
        // Se vazio, indica que faltam dados
        if (!cnpjInput) return { variableUpdates: { exists: false, missing_data: true } };

        const cnpjDigits = extractDigits(cnpjInput);
        const formattedCnpj = formatCnpjDigits(cnpjDigits);

        const [cliente, ficha] = await Promise.all([
            this.prisma.client.findFirst({
                where: {
                    OR: [
                        { cnpj: cnpjDigits },
                        { cnpj: formattedCnpj ?? undefined },
                    ],
                },
                select: {
                    id: true,
                    razaoSocial: true,
                    nomeSindico: true,
                    logradouro: true,
                    numero: true,
                    complemento: true,
                    bairro: true,
                    cidade: true,
                    estado: true,
                    cep: true,
                },
            }),
            this.prisma.ficha.findFirst({
                where: {
                    OR: [
                        { cnpj: cnpjDigits },
                        { cnpj: formattedCnpj ?? undefined },
                    ],
                },
                select: {
                    id: true,
                    razaoSocial: true,
                    nomeSindico: true, // Ficha tem nomeSindico? Assumindo que sim ou null
                    logradouro: true,
                    numero: true,
                    complemento: true,
                    bairro: true,
                    cidade: true,
                    estado: true,
                    cep: true,
                },
            }),
        ]);

        const data = cliente || ficha;

        if (!data) {
            return { variableUpdates: { exists: false, missing_data: true } };
        }

        let formattedAddress = "";
        if (data.logradouro) {
            formattedAddress = `${data.logradouro}, ${data.numero || "S/N"}`;
            if (data.complemento) formattedAddress += ` - ${data.complemento}`;
            if (data.bairro) formattedAddress += `, ${data.bairro}`;
            if (data.cidade) formattedAddress += ` - ${data.cidade}/${data.estado || ""}`;
            if (data.cep) formattedAddress += ` (CEP: ${data.cep})`;
        }

        const clienteAtivo = cliente !== null;
        const fichaAtiva = ficha !== null;

        return {
            // Decoupled: Não retorna mais nextStepId. O fluxo decide com base em 'exists' ou 'missing_data'
            variableUpdates: {
                exists: true,
                missing_data: false,
                is_client: clienteAtivo,
                is_ficha: fichaAtiva,
                client_id: cliente?.id || ficha?.id || null,
                razao_social: data.razaoSocial || null,
                nome_condominio: data.razaoSocial || null,
                nome_sindico: data.nomeSindico || null,
                endereco: formattedAddress || null,
            },
        };
    }

    private async generateProposal(variables: Record<string, unknown>, context: { conversationId: string }) {
        console.log("[SystemAction] Generating proposal for conversation:", context.conversationId);
        console.log("[SystemAction] Proposal Variables:", JSON.stringify(variables, null, 2));

        // Calcula a próxima data de vencimento (dia 5, 10 ou 15)
        const calcularProximoVencimento = () => {
            const hoje = new Date();
            const diaAtual = hoje.getDate();
            let diaVencimento: number;
            let mesVencimento = hoje.getMonth();
            let anoVencimento = hoje.getFullYear();

            if (diaAtual < 5) {
                diaVencimento = 5;
            } else if (diaAtual < 10) {
                diaVencimento = 10;
            } else if (diaAtual < 15) {
                diaVencimento = 15;
            } else {
                // Próximo ciclo: dia 5 do mês seguinte
                diaVencimento = 5;
                mesVencimento += 1;
                if (mesVencimento > 11) {
                    mesVencimento = 0;
                    anoVencimento += 1;
                }
            }

            const dataVencimento = new Date(anoVencimento, mesVencimento, diaVencimento);
            const mes = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(dataVencimento);
            return `${diaVencimento} de ${mes} de ${anoVencimento}`;
        };

        const valorUnitario = variables.valor_unitario_torre ? Number(variables.valor_unitario_torre) : 510;
        const numParcelas = variables.numero_parcelas ? Number(variables.numero_parcelas) : 5;

        // Variáveis padrão inspiradas no PropostaPdfDialog
        const proposalInput = {
            empresa: "EBR",
            razaoSocial: String(variables.razao_social || variables.confirm_razao_social || "Consumidor Final"),
            vocativo: `Prezado(a) ${variables.nome_sindico || "Síndico(a)"},`,
            produto: "Manutenção em SPDA",
            valorPorEquipamento: 1,
            valorUnitario: valorUnitario,
            subtotal: valorUnitario,
            numeroParcelas: numParcelas,
            primeiraParcela: calcularProximoVencimento(),
            garantiaMeses: 12,
            consultorNome: String(variables.nome_vendedor || "Atendimento Digital Empresa Brasileira de Raios"),
            consultorCelular: String(variables.telefone_vendedor || "0800 123 0133"),
            consultorEmail: String(variables.email_vendedor || "contato@empresabrasileiraderaios.com.br"),
        };

        try {
            const useCase = new GeneratePropostaPdfUseCase();
            const result = await useCase.execute(proposalInput);
            console.log("[SystemAction] PDF Generated. Size:", result.buffer.length, "FileName:", result.fileName);

            const key = `chat/propostas/${context.conversationId}/${Date.now()}-${result.fileName}`;
            console.log("[SystemAction] Uploading to Key:", key);

            const uploadUrl = await storage.uploadPublicObject({
                key,
                contentType: "application/pdf",
                body: result.buffer,
            });

            console.log("[SystemAction] Upload Success. URL:", uploadUrl);

            return {
                variableUpdates: {
                    proposal_url: uploadUrl,
                    proposal_filename: result.fileName,
                },
            };
        } catch (error) {
            console.error("[SystemAction] Error generating/uploading proposal:", error);
            // Retorna vazio ou erro para não quebrar silenciosamente, mas o fluxo atual ignora erro
            return { variableUpdates: {} };
        }
    }
}
