# Guia de Criação de Fluxos de Chatbot (Sistema EBR)

Este documento é um guia técnico detalhado para engenheiros e **LLMs** criarem fluxos de chatbot compatíveis com o interpretador do Sistema EBR.

## 📂 Referências de Código (Source of Truth)

Para entender a implementação exata e as capacidades do sistema, consulte os seguintes arquivos no repositório:

1.  **Definição de Tipos e Estruturas**:
    *   Arquivo: `chatbot/domain/flow.ts`
    *   O que contém: Definições TypeScript de `ChatbotStep`, `ChatbotStepType`, e `ChatbotFlowDefinition`. É a "bíblia" da estrutura do JSON.

2.  **Lógica de Execução de Passos**:
    *   Arquivo: `chatbot/application/step-handlers.ts`
    *   O que contém: A função `executeStep` que interpreta cada tipo de passo. Consulte para entender como `inputs` são processados, como mensagens são enviadas e como `actions` são chamadas.

3.  **Catálogo de Ações do Sistema**:
    *   Arquivo: `chatbot/infra/actions/system-actions-adapter.ts`
    *   O que contém: A implementação real das System Actions (funções de backend). Consulte para saber quais actions estão disponíveis (`verify_cnpj`, `generate_proposal`, etc.) e quais variáveis elas esperam/retornam.

---

## 🛠️ Tipos de Steps Suportados

Abaixo, a lista completa de tipos de steps suportados e sua estrutura JSON correta.

### 1. Mensagem (`message`)
Envia texto ou anexos.
```json
{
  "id": "welcome",
  "type": "message",
  "message": "Olá {{user_name}}! Bem-vindo.",
  "nextStepId": "next_step"
}
```

### 2. Input (`input`)
Aguarda resposta do usuário. Pode ser escolha (botões) ou texto livre.

**Texto Livre:**
```json
{
  "id": "ask_name",
  "type": "input",
  "prompt": "Qual seu nome?",
  "inputType": "text", // text, email, phone, number
  "saveTo": "user_name",
  "nextStepId": "next_step"
}
```

**Opções (Choice):**
```json
{
  "id": "menu",
  "type": "input",
  "prompt": "Selecione:",
  "inputType": "choice",
  "items": [
    { "title": "Opção 1", "value": "opt1" }, // value é o ID interno
    { "title": "Opção 2", "value": "opt2" }
  ],
  "options": [
    { "pattern": "opt1", "nextStepId": "step_1" }, // Roteamento
    { "pattern": "opt2", "nextStepId": "step_2" }
  ],
  "handoffOnInvalid": true // Transfere para humano se errar X vezes
}
```

### 3. System Action (`action`) ⚠️ ATENÇÃO
Executa lógica no backend. **Essencial usar a estrutura aninhada `action: { value: ... }`.**

```json
{
  "id": "do_logic",
  "type": "action",
  "action": {
    "value": "nome_da_action" // Deve existir em system-actions-adapter.ts
  },
  "nextStepId": "pos_action"
}
```

#### Actions Disponíveis (Atualmente):
*   `verify_cnpj`: Verifica CNPJ no banco. Usa var `cnpj`. Retorna `exists`, `razao_social`, `endereco`.
*   `calculate_pricing`: Calcula preços. (Atualmente seta defaults/placeholders).
*   `generate_proposal`: Gera PDF de proposta. Usa dados do cliente/ficha e preços. Retorna `proposal_url`.

### 4. Condição (`condition`)
Branching lógico.

```json
{
  "id": "check_status",
  "type": "condition",
  "condition": {
    "variable": "cliente_existe",
    "operator": "equals", // equals, not_equals, contains, exists, not_exists
    "value": true
  },
  "nextStepId": "caminho_sim",
  "options": [
    { "pattern": "else", "nextStepId": "caminho_nao" }
  ]
}
```

### 5. Definir Variável (`set_variable`)
Define uma variável explicitamente sem input do usuário.

```json
{
  "id": "set_type",
  "type": "set_variable",
  "action": {
    "key": "flow_type",
    "value": "inbound"
  },
  "nextStepId": "next"
}
```

### 6. Handoff (`handoff`)
Transfere para humano.

```json
{
  "id": "fim",
  "type": "handoff"
}
```

---

## 🧩 Exemplos Avançados

### Exemplo 1: Validação de Documento com Loop
Fluxo que pede documento, valida no backend e pede novamente se falhar.

```json
[
  {
    "id": "ask_doc",
    "type": "input",
    "prompt": "Envie seu documento:",
    "saveTo": "doc_input",
    "nextStepId": "validate_doc"
  },
  {
    "id": "validate_doc",
    "type": "action",
    "action": { "value": "check_document_validity" }, // Retorna var 'is_valid'
    "nextStepId": "condition_doc"
  },
  {
    "id": "condition_doc",
    "type": "condition",
    "condition": { "variable": "is_valid", "operator": "equals", "value": true },
    "nextStepId": "success",
    "options": [
      { "pattern": "else", "nextStepId": "invalid_msg" }
    ]
  },
  {
    "id": "invalid_msg",
    "type": "message",
    "message": "Documento inválido. Tente novamente.",
    "nextStepId": "ask_doc" // Loop
  },
  {
    "id": "success",
    "type": "message",
    "message": "Documento aceito!",
    "nextStepId": null
  }
]
```

### Exemplo 2: Menu Dinâmico com Variáveis
Usando variáveis dentro do texto do menu.

```json
{
  "id": "dynamic_menu",
  "type": "input",
  "prompt": "Olá {{user_name}}, o status do seu pedido {{order_id}} é: {{status}}.\nO que deseja fazer?",
  "inputType": "choice",
  "items": [
    { "title": "Ver Detalhes", "value": "details" },
    { "title": "Sair", "value": "exit" }
  ],
  "options": [
    ...
  ]
}
```
