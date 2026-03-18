import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { DocxEngine } from "@/lib/documents/docx-engine";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency, formatCurrencyExtenso, formatNumberExtenso, formatCNPJ, formatCEP } from "@/lib/formatters";

export class GenerateContratoDocxUseCase {
    async execute(contratoId: number, customData: any = null) {
        const contrato = await prisma.contratoManutencao.findUnique({
            where: { id: contratoId },
            include: {
                cliente: true,
                vendedor: true,
            },
        }) as any;

        if (!contrato) {
            throw new Error("Contrato não encontrado.");
        }

        // Tenta carregar o template padrão em lib/documents
        const templatePath = path.join(process.cwd(), "lib", "documents", "contrato_manutencao.docx");

        if (!fs.existsSync(templatePath)) {
            throw new Error("Template de contrato não encontrado em lib/documents/contrato_manutencao.docx");
        }

        const templateBuffer = fs.readFileSync(templatePath);

        // Mapeamento de variáveis para o DOCX - Baseado no texto passado pelo usuário
        const valorPrimeiroAno = contrato.valorTotal / 2;
        const valorSegundoAno = valorPrimeiroAno * 0.9; // 10% desconto padrão
        const numParcelas = contrato.parcelas || 24;
        const valorParcela = contrato.valorTotal / numParcelas;

        const data = customData || {
            cnpj_empresa: "51.621.017/0001-05",
            endereco_empresa: "Rua Maria Calmon, 34",
            bairro_empresa: "Méier",
            cidade_empresa: "Rio de Janeiro",
            uf_empresa: "RJ",
            razao_social_cliente: contrato.cliente.razaoSocial,
            cnpj_cliente: formatCNPJ(contrato.cliente.cnpj),
            endereco_cliente: `${contrato.cliente.logradouro || ""}, ${contrato.cliente.numero || ""}${contrato.cliente.complemento ? " - " + contrato.cliente.complemento : ""}`,
            bairo_cliente: contrato.cliente.bairro || "",
            cidade_cliente: contrato.cliente.cidade || "",
            estado_cliente: contrato.cliente.estado || "",
            cep_cliente: formatCEP(contrato.cliente.cep) || "",
            nome_sindico: contrato.cliente.nomeSindico || "[NOME DO SÍNDICO]",
            cpf_sindico: "[CPF]",
            valor_cobrado_formatado_em_reais: formatCurrency(valorPrimeiroAno),
            valor_cobrado_extenso: formatCurrencyExtenso(valorPrimeiroAno),
            porcentagem_desconto_segundo_ano: "10%",
            valor_segundo_ano_formatado: formatCurrency(valorSegundoAno),
            valor_segundo_ano_extenso: formatCurrencyExtenso(valorSegundoAno),
            numero_parcelas: numParcelas.toString(),
            numero_parcelas_extenso: formatNumberExtenso(numParcelas),
            valor_parcelas: formatCurrency(valorParcela),
            valor_parcelas_extenso: formatCurrencyExtenso(valorParcela),
            dia_vencimento_padrao: "10",
            cidade_foro: contrato.cliente.cidade || "Rio de Janeiro",
            uf_foro: contrato.cliente.estado || "RJ",
            nome_cidade_assinatura_contrato: "Rio de Janeiro",
            dia_assinatura_contrato: format(new Date(), "dd"),
            mes_assinatura_contrato_extenso: format(new Date(), "MMMM", { locale: ptBR }),
            ano_assinatura_contrato: format(new Date(), "yyyy"),
            id_contrato: contrato.id.toString(),
            ano_contrato: format(new Date(contrato.dataInicio), "yyyy"),
            valor_total_formatado: formatCurrency(valorPrimeiroAno + valorSegundoAno),
            valor_total_extenso: formatCurrencyExtenso(valorPrimeiroAno + valorSegundoAno),
            observacoes: contrato.observacoes || "",
        };

        return DocxEngine.render(templateBuffer, data);
    }
}
