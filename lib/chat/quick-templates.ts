import { Contact } from "./api";

/**
 * Configuração centralizada para botões de template rápido no chat.
 * Caso o template não possua variáveis (texto ou mídia), ele será enviado diretamente.
 */
export interface QuickTemplateConfig {
    label: string;
    templateName: string;
    languageCode?: string;
    /**
     * Função para preencher variáveis do template dinamicamente com base no contexto do contato.
     */
    getPrefillValues?: (context: { contact?: Contact }) => Record<string, string>;
}

export const QUICK_TEMPLATES: QuickTemplateConfig[] = [

    {
        label: "Boa tarde!",
        templateName: "boa_tarde_marketing",
    },
    {
        label: "Vendas #1",
        templateName: "vendas_1",
        getPrefillValues: ({ contact }) => {
            const client = contact?.clients?.[0]; // Pega o primeiro cliente vinculado ao contato
            const nomePessoa = contact?.name || client?.nomeSindico || "";
            const nomeCondominio = client?.razaoSocial || "";

            const valorTorre = 500;
            const parcelas = 5;
            const valorParcela = valorTorre / parcelas;

            return {
                nome_pessoa: nomePessoa,
                nome_condominio: nomeCondominio,
                valor_unitario_torre: valorTorre.toString(),
                numero_parcelas: parcelas.toString(),
                valor_parcela: valorParcela.toFixed(2),
            };
        },
    },

];
