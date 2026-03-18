// Configuração da régua de cobrança (edite conforme necessidade).
// Exemplo de regra:
// {
//   key: "vence_amanha",
//   label: "Vence amanhã",
//   offsetStartDays: 1,
//   offsetEndDays: 1,
//   inboxId: "ID_DA_INBOX",
//   templateName: "TEMPLATE_NAME",
//   parameters: {
//     headerDocument: {
//       linkToken: "{{debito.linkBoleto}}",
//       filenameToken: "Boleto-{{debito.id}}.pdf",
//     },
//     bodyTextTokens: ["{{client.razaoSocial}}", "{{debito.vencimento}}"],
//     headerTextTokens: [],
//     buttonTextTokens: [],
//   },
// }

export const COBRANCA_REGUA_RULES = [
  {
    key: "venceu_ontem",
    label: "Cobrança: venceu ontem",
    offsetStartDays: -1,
    offsetEndDays: -1,
    inboxId: "cmlv70gpm0000jy04rehmgjph",
    templateName: "lembranca_boleto_x_dias",
    parameters: {
      headerDocument: {
        linkToken: "{{debito.linkBoleto}}",
        filenameToken: "Boleto-{{debito.id}}.pdf",
      },
      // BODY (ordem dos parâmetros do template):
      // {{nome_contato}}, {{razao_social}}, {{nome_empresa}}, {{expressao_dia}}, {{nome_cobrador}}
      bodyTextParamNames: [
        "nome_contato",
        "razao_social",
        "nome_empresa",
        "expressao_dia",
        "nome_cobrador",
      ],
      bodyTextTokens: [
        "{{nome_contato}}",
        "{{razao_social}}",
        "{{nome_empresa}}",
        "venceu ontem",
        "{{nome_cobrador}}",
      ],
      headerTextTokens: [],
      buttonTextTokens: [],
    },
  },
]


