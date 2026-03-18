export type FollowUpStep = {
    delayMinutes: number;
    type: 'FIXED' | 'IA_JUDGE' | 'IA_TEXT';
    content?: string; // Para tipo FIXED
    templateName?: string; // Se precisar forçar um template específico
    templateComponents?: any[]; // Componentes do template com tokens {{...}}
    kanbanCode?: number; // Código do estado do Kanban para mover o cliente (opcional)
};

/**
 * Configuração de Cadência de Follow-up (Minutos Úteis)
 * Janela Comercial: Seg-Sex, 08:00 - 18:00 (10 horas por dia / 600 min por dia)
 */
export const FOLLOW_UP_CADENCE: FollowUpStep[] = [
    {
        delayMinutes: 240, // 4 horas úteis
        type: 'FIXED',
        content: "Conseguiu ver minha mensagem?",
        templateName: "conseguiu_ver_minha_mensagem",
        kanbanCode: 2 // Move para Follow-up 1
    },
    {
        delayMinutes: 240, // +4 horas úteis
        type: 'FIXED',
        content: "Olá! Esse ainda é o número do síndico do condomínio?",
        templateName: "esse_ainda_e_o_numero",
        templateComponents: [
            {
                type: "body",
                parameters: [
                    { type: "text", parameter_name: "nome", text: "{{contact.name}}" },
                    { type: "text", parameter_name: "nome_condominio", text: "{{client.razaoSocial}}" }
                ]
            }
        ],
        kanbanCode: 3 // Move para Follow-up 2
    },
    {
        delayMinutes: 240, // +4 horas úteis
        type: 'IA_JUDGE'
    }
];

export const FOLLOW_UP_LIMIT = FOLLOW_UP_CADENCE.length;
