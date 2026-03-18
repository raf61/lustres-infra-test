// Tipos de dados do sistema - usados para tipagem de componentes frontend
// Todos os dados vêm de APIs reais.

export interface Cliente {
  id: string
  cnpj: string
  razaoSocial: string
  nomeCondominio: string
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  telefoneCondominio?: string
  celularCondominio?: string
  endereco: string
  sindico: {
    nome: string
    telefone: string
    whatsapp: string
    email: string
    aniversario: string
    dataInicioMandato?: string
    dataFimMandato: string
  }
  porteiro?: {
    nome: string
    telefone: string
  }
  administradora: {
    id?: string
    nome: string
    email?: string
    telefone?: string
    gerentes: {
      nome: string
      email: string
      telefone: string
      whatsapp: string
    }[]
  }
  administradoraStringAntigo?: string
  qtdSPDA?: number
  qtdAndares?: number
  especificacaoCondominio?: "COMERCIAL" | "RESIDENCIAL" | "MISTO" | null
  categoria: "explorado" | "ativo" | "agendado"
  responsavel: string
  tipoResponsavel: "vendedor" | "chatbot"
  dataAgendamento?: string
  motivoAgendamento?: string
  historicoContatos?: {
    data: string
    responsavel: string
    observacao: string
    proximoContato?: string
  }[]
  vendedor?: string
  ultimaManutencao?: string
  ultimoPedido?: string
  nomeSindico?: string | null
  observacao?: string
  proximaManutencao?: string
  isInResearch?: boolean
  status: "ativo" | "pendente" | "vencido"
  kanbanCode?: number
  visivelDashVendedor?: boolean
  vendedorId?: string
  isContratoVigente?: boolean
}

export interface Servico {
  id: string
  clienteId: string
  clienteNome: string
  tecnico: string
  dataAgendada: string
  status: "agendado" | "em_andamento" | "aguardando_pecas" | "concluido"
  checklistInicial?: boolean
  aprovacaoCliente?: boolean
  valor?: number
}

export interface Produto {
  id: string
  nome: string
  codigo: string
  estoque: number
  estoqueMinimo: number
  precoVenda: number
  precoCusto: number
  fornecedor: string
  foto?: string
}

export interface Administradora {
  id: string
  nome: string
  cnpj?: string
  email?: string
  telefone?: string
  endereco?: string
  gerentes: {
    id: string
    nome: string
    email: string
    telefone: string
    whatsapp: string
  }[]
}
