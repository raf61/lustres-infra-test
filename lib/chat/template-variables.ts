export type TemplateVariableToken = {
  label: string;
  token: string;
};

export const broadcastTemplateVariableTokens: TemplateVariableToken[] = [
  { label: "Cliente - Razão social", token: "{{client.razaoSocial}}" },
  { label: "Cliente - CNPJ", token: "{{client.cnpj}}" },
  { label: "Cliente - Telefone condomínio", token: "{{client.telefoneCondominio}}" },
  { label: "Cliente - Celular condomínio", token: "{{client.celularCondominio}}" },
  { label: "Cliente - Síndico", token: "{{client.nomeSindico}}" },
  { label: "Cliente - Telefone síndico", token: "{{client.telefoneSindico}}" },
  { label: "Cliente - Logradouro", token: "{{client.logradouro}}" },
  { label: "Cliente - Número", token: "{{client.numero}}" },
  { label: "Cliente - Complemento", token: "{{client.complemento}}" },
  { label: "Cliente - Bairro", token: "{{client.bairro}}" },
  { label: "Cliente - Cidade", token: "{{client.cidade}}" },
  { label: "Cliente - Estado", token: "{{client.estado}}" },
  { label: "Cliente - CEP", token: "{{client.cep}}" },
  { label: "Contato - Nome", token: "{{contact.name}}" },
  { label: "Contato - WhatsApp", token: "{{contact.waId}}" },
  { label: "Telefone destino", token: "{{phone}}" },
];

