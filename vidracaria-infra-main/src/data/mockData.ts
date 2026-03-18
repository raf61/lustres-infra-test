// ===== TYPES =====
export type Unit = { id: string; name: string; address: string };
export type LeadStage = 'novo' | 'contato_ia' | 'qualificado' | 'orcamento' | 'negociacao' | 'fechado' | 'perdido';
export const STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo Lead', contato_ia: 'Contato IA', qualificado: 'Qualificado',
  orcamento: 'Orçamento', negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido'
};
export const STAGE_COLORS: Record<LeadStage, string> = {
  novo: 'bg-blue-500', contato_ia: 'bg-warning', qualificado: 'bg-cyan-500',
  orcamento: 'bg-purple-500', negociacao: 'bg-yellow-500', fechado: 'bg-success', perdido: 'bg-destructive'
};
export const STAGE_ORDER: LeadStage[] = ['novo', 'contato_ia', 'qualificado', 'orcamento', 'negociacao', 'fechado', 'perdido'];

export type Seller = {
  id: string; name: string; unitId: string; avatar: string; role: string;
  metrics: {
    leadsReceived: number; leadsClosed: number; conversionRate: number;
    avgResponseTime: number; totalSales: number; followUps: number;
    followUpConversion: number; monthlySales: Record<string, number>;
  };
};

export type Purchase = { id: string; product: string; value: number; date: string; invoice: string };
export type Client = {
  id: string; name: string; phone: string; email: string; cpf: string;
  sellerId: string | null; unitId: string; stage: LeadStage; source: string;
  lastPurchase: string | null; purchaseHistory: Purchase[];
  erpCode: string; address: string; city: string; notes: string;
  createdAt: string; lastContact: string; hasBudget: boolean; budgetDate: string | null;
};

export type Message = {
  id: string; sender: 'ai' | 'client' | 'seller'; senderName?: string;
  content: string; timestamp: string; isHandoff?: boolean; handoffTo?: string;
};
export type Conversation = {
  id: string; clientId: string; clientName: string; clientPhone: string;
  sellerId: string | null; sellerName?: string; isAIActive: boolean;
  wasHandedOff: boolean; handoffSellerId?: string; messages: Message[];
  stage: LeadStage; unitId: string; lastMessageAt: string; unread: boolean;
  inbox: string;
};

export type Product = {
  id: string; name: string; category: string; avgPrice: number;
  salesCount: number; revenue: number; erpCode: string;
};

export type Campaign = {
  id: string; name: string; status: 'active' | 'scheduled' | 'completed';
  targetCount: number; sentCount: number; responseRate: number;
  conversionRate: number; product: string; createdAt: string; segment: string;
};

export type MessageTemplate = {
  id: string; name: string; content: string; category: 'reativacao' | 'promocao' | 'followup' | 'boas_vindas';
};

// ===== MESSAGE TEMPLATES =====
export const messageTemplates: MessageTemplate[] = [
  { id: 'tpl-1', name: 'Reativação - Saudade', category: 'reativacao', content: 'Oi {nome}! 😊 Faz tempo que não nos falamos. Aqui é da Casa Mansur. Temos novidades incríveis em envidraçamento. Quer saber mais?' },
  { id: 'tpl-2', name: 'Reativação - Desconto', category: 'reativacao', content: 'Olá {nome}! Temos uma condição especial esse mês: até 15% OFF em envidraçamento de sacada. Válido por tempo limitado! Posso te contar mais?' },
  { id: 'tpl-3', name: 'Promoção Box', category: 'promocao', content: '{nome}, promoção relâmpago! 🚿 Box de banheiro a partir de R$ 1.800 (de R$ 2.400). Só essa semana! Quer aproveitar?' },
  { id: 'tpl-4', name: 'Follow-up - Orçamento', category: 'followup', content: 'Oi {nome}, tudo bem? Passei pra saber se teve alguma dúvida sobre o orçamento que enviei. Estou à disposição! 😊' },
  { id: 'tpl-5', name: 'Follow-up - Visita', category: 'followup', content: 'Olá {nome}! Vi que agendamos uma visita técnica. Confirmo para {data}? Se precisar remarcar, é só avisar!' },
  { id: 'tpl-6', name: 'Boas-vindas', category: 'boas_vindas', content: 'Bem-vindo(a) à Casa Mansur, {nome}! 🏗️ Somos especialistas em envidraçamento. Como posso ajudar hoje?' },
  { id: 'tpl-7', name: 'Promoção Cobertura', category: 'promocao', content: '{nome}, quer transformar sua área gourmet? Coberturas de vidro com condição especial! A partir de R$ 12.000 em 12x sem juros. Posso te mostrar?' },
  { id: 'tpl-8', name: 'Reativação - Complemento', category: 'reativacao', content: 'Oi {nome}! Vi que você fez um projeto conosco recentemente. Que tal complementar com espelhos decorativos ou guarda-corpo? Temos condições especiais pra quem já é cliente! 💙' },
];

// ===== DATA =====
export const units: Unit[] = [
  { id: 'unit-1', name: 'Unidade 1 - Centro', address: 'Rua das Vidraças, 1200 - Centro' },
  { id: 'unit-2', name: 'Unidade 2 - Zona Sul', address: 'Av. Cristal, 450 - Zona Sul' },
];

export const inboxes = [
  { id: 'inbox-1', label: '(11) 3000-1000 — Centro', unitId: 'unit-1' },
  { id: 'inbox-2', label: '(11) 3000-2000 — Zona Sul', unitId: 'unit-2' },
  { id: 'inbox-3', label: '(11) 99000-0001 — WhatsApp Business', unitId: 'all' },
];

export const sellers: Seller[] = [
  {
    id: 's1', name: 'Carlos Mendes', unitId: 'unit-1', avatar: 'CM', role: 'Vendedor Sênior',
    metrics: { leadsReceived: 215, leadsClosed: 78, conversionRate: 36.3, avgResponseTime: 2.8, totalSales: 156000, followUps: 142, followUpConversion: 31.0,
      monthlySales: { '2025-10': 52000, '2025-11': 68000, '2025-12': 82000, '2026-01': 95000, '2026-02': 112000, '2026-03': 58000 } }
  },
  {
    id: 's2', name: 'Ana Beatriz Costa', unitId: 'unit-1', avatar: 'AB', role: 'Vendedora',
    metrics: { leadsReceived: 189, leadsClosed: 62, conversionRate: 32.8, avgResponseTime: 3.5, totalSales: 128000, followUps: 118, followUpConversion: 27.1,
      monthlySales: { '2025-10': 42000, '2025-11': 56000, '2025-12': 65000, '2026-01': 78000, '2026-02': 88000, '2026-03': 45000 } }
  },
  {
    id: 's3', name: 'Roberto Alves', unitId: 'unit-1', avatar: 'RA', role: 'Vendedor',
    metrics: { leadsReceived: 142, leadsClosed: 38, conversionRate: 26.8, avgResponseTime: 5.2, totalSales: 89000, followUps: 76, followUpConversion: 19.7,
      monthlySales: { '2025-10': 28000, '2025-11': 38000, '2025-12': 48000, '2026-01': 55000, '2026-02': 62000, '2026-03': 32000 } }
  },
  {
    id: 's4', name: 'Juliana Santos', unitId: 'unit-1', avatar: 'JS', role: 'Vendedora',
    metrics: { leadsReceived: 168, leadsClosed: 58, conversionRate: 34.5, avgResponseTime: 3.1, totalSales: 135000, followUps: 105, followUpConversion: 30.5,
      monthlySales: { '2025-10': 38000, '2025-11': 52000, '2025-12': 62000, '2026-01': 72000, '2026-02': 82000, '2026-03': 42000 } }
  },
  {
    id: 's5', name: 'Marcos Oliveira', unitId: 'unit-2', avatar: 'MO', role: 'Vendedor Sênior',
    metrics: { leadsReceived: 228, leadsClosed: 85, conversionRate: 37.3, avgResponseTime: 2.5, totalSales: 172000, followUps: 158, followUpConversion: 33.5,
      monthlySales: { '2025-10': 58000, '2025-11': 72000, '2025-12': 88000, '2026-01': 102000, '2026-02': 118000, '2026-03': 62000 } }
  },
  {
    id: 's6', name: 'Fernanda Lima', unitId: 'unit-2', avatar: 'FL', role: 'Vendedora',
    metrics: { leadsReceived: 175, leadsClosed: 65, conversionRate: 37.1, avgResponseTime: 3.2, totalSales: 142000, followUps: 128, followUpConversion: 31.3,
      monthlySales: { '2025-10': 45000, '2025-11': 60000, '2025-12': 68000, '2026-01': 82000, '2026-02': 95000, '2026-03': 48000 } }
  },
  {
    id: 's7', name: 'Thiago Rezende', unitId: 'unit-2', avatar: 'TR', role: 'Vendedor',
    metrics: { leadsReceived: 118, leadsClosed: 32, conversionRate: 27.1, avgResponseTime: 5.8, totalSales: 72000, followUps: 62, followUpConversion: 19.4,
      monthlySales: { '2025-10': 22000, '2025-11': 32000, '2025-12': 42000, '2026-01': 48000, '2026-02': 55000, '2026-03': 28000 } }
  },
  {
    id: 's8', name: 'Patrícia Duarte', unitId: 'unit-2', avatar: 'PD', role: 'Vendedora',
    metrics: { leadsReceived: 152, leadsClosed: 52, conversionRate: 34.2, avgResponseTime: 3.6, totalSales: 112000, followUps: 98, followUpConversion: 28.6,
      monthlySales: { '2025-10': 32000, '2025-11': 48000, '2025-12': 55000, '2026-01': 65000, '2026-02': 75000, '2026-03': 38000 } }
  },
];

const firstNames = [
  'Maria', 'João', 'Luciana', 'Ricardo', 'Camila', 'Fernando', 'Adriana', 'Paulo',
  'Beatriz', 'Gustavo', 'Renata', 'André', 'Simone', 'Diego', 'Tatiana', 'Marcelo',
  'Cristina', 'Leandro', 'Vanessa', 'Eduardo', 'Sandra', 'Rafael', 'Isabela', 'Vinicius',
  'Elaine', 'Bruno', 'Daniela', 'Alexandre', 'Rosana', 'Guilherme', 'Márcia', 'Felipe',
  'Aline', 'Rodrigo', 'Priscila', 'Henrique', 'Cláudia', 'Lucas', 'Natália', 'Pedro',
  'Viviane', 'Caio', 'Patrícia', 'Otávio', 'Débora', 'Fábio', 'Letícia', 'Sérgio',
  'Mariana', 'Thiago', 'Carla', 'Anderson', 'Juliana', 'Gabriel', 'Mônica', 'Carlos',
  'Fernanda', 'Roberto', 'Ana', 'Leonardo', 'Jorge', 'Cristiane', 'Marcos', 'Renato',
  'Sônia', 'Wagner', 'Teresa', 'Márcio', 'Denise', 'Rogério', 'Lúcia', 'Nilton',
  'Vera', 'Antônio', 'Regina', 'Cássio', 'Marta', 'Edson', 'Clara', 'Nelson',
];
const lastNames = [
  'Silva', 'Ferreira', 'Barbosa', 'Teixeira', 'Rodrigues', 'Nascimento', 'Moreira', 'Souza',
  'Carvalho', 'Pereira', 'Campos', 'Martins', 'Almeida', 'Machado', 'Ribeiro', 'Gomes',
  'Araújo', 'Pinto', 'Correia', 'Santana', 'Monteiro', 'Duarte', 'Nogueira', 'Costa',
  'Fonseca', 'Lopes', 'Vieira', 'Cardoso', 'Miranda', 'Azevedo', 'Cunha', 'Rocha',
  'Batista', 'Dias', 'Melo', 'Castro', 'Freitas', 'Andrade', 'Ramos', 'Lima',
  'Nunes', 'Mendonça', 'Braga', 'Reis', 'Tavares', 'Moura', 'Borges', 'Alencar',
  'Barros', 'Santos', 'Oliveira', 'Mendes', 'Alves', 'Rezende', 'Prado', 'Bastos',
];

const productNames = ['Envidraçamento de Sacada', 'Cortina de Vidro', 'Guarda-Corpo de Vidro', 'Box de Banheiro', 'Espelho Decorativo', 'Porta de Vidro Temperado', 'Janela de Vidro Temperado', 'Cobertura de Vidro'];
const sources = ['WhatsApp', 'Instagram', 'Site', 'Indicação', 'Google Ads', 'Reativação IA'];
const stages: LeadStage[] = ['novo', 'contato_ia', 'qualificado', 'orcamento', 'negociacao', 'fechado', 'perdido'];
const cities = ['São Paulo', 'Guarulhos', 'Osasco', 'Santo André', 'São Bernardo', 'Campinas', 'Sorocaba', 'Jundiaí', 'Barueri', 'Mauá', 'Diadema', 'Cotia'];

function randomDate(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().split('T')[0];
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateClients(): Client[] {
  const totalClients = 920;
  const result: Client[] = [];
  const streetNames = ['das Flores', 'dos Vidros', 'São Paulo', 'Cristal', 'das Palmeiras', 'do Comércio', 'Nova', 'Central', 'da Liberdade', 'Bela Vista', 'Augusta', 'Paulista', 'Brasil', 'do Sol', 'das Acácias', 'São Jorge', 'Ipiranga', 'Consolação'];
  const notesList = ['Cliente interessado em sacada grande', 'Pediu orçamento por telefone', 'Retornar em 3 dias', 'Aguardando medição', 'Cliente recorrente', 'Indicado por vizinho', 'Viu anúncio no Instagram', 'Quer fechar até fim do mês', 'Precisa de financiamento', 'Reforma completa do apto', 'Condomínio comercial', 'Projeto de arquiteto', 'Lead via Google Ads', 'Reativado pela IA', 'Orçamento pendente', 'Visitou showroom', 'Indicação de construtora'];

  // Funnel-realistic weights: ~900 leads/mês
  // novo: 18%, contato_ia: 22%, qualificado: 16%, orcamento: 14%, negociacao: 10%, fechado: 12%, perdido: 8%
  const stageWeights = [0.18, 0.22, 0.16, 0.14, 0.10, 0.12, 0.08];

  for (let i = 0; i < totalClients; i++) {
    const seed = i + 42;
    const r = seededRandom(seed);
    const unitId = i < 480 ? 'unit-1' : 'unit-2';
    const unitSellers = sellers.filter(s => s.unitId === unitId);
    const seller = seededRandom(seed + 1) > 0.1 ? unitSellers[Math.floor(seededRandom(seed + 2) * unitSellers.length)] : null;

    let stage: LeadStage = 'novo';
    let cumulative = 0;
    for (let j = 0; j < stageWeights.length; j++) {
      cumulative += stageWeights[j];
      if (r <= cumulative) { stage = stages[j]; break; }
    }

    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[Math.floor(seededRandom(seed + 3) * lastNames.length)];
    const middleName = seededRandom(seed + 4) > 0.5 ? ' ' + lastNames[Math.floor(seededRandom(seed + 5) * lastNames.length)] : '';
    const name = `${firstName}${middleName} ${lastName}`;

    const hasPurchase = stage === 'fechado' || seededRandom(seed + 6) > 0.45;
    const purchaseHistory: Purchase[] = hasPurchase ? Array.from({ length: Math.ceil(seededRandom(seed + 7) * 4) }, (_, j) => ({
      id: `p-${i}-${j}`,
      product: productNames[Math.floor(seededRandom(seed + 8 + j) * productNames.length)],
      value: Math.floor(2000 + seededRandom(seed + 9 + j) * 28000),
      date: randomDate('2024-01-01', '2026-03-15'),
      invoice: `NF-${10000 + i * 10 + j}`,
    })) : [];
    const hasBudget = stage === 'orcamento' || stage === 'negociacao' || (seededRandom(seed + 10) > 0.55);

    result.push({
      id: `c-${i + 1}`,
      name,
      phone: `(11) 9${Math.floor(1000 + seededRandom(seed + 11) * 9000)}-${Math.floor(1000 + seededRandom(seed + 12) * 9000)}`,
      email: name.toLowerCase().replace(/\s+/g, '.').replace(/[áàãâ]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íì]/g, 'i').replace(/[óòõô]/g, 'o').replace(/[úù]/g, 'u').replace(/[ç]/g, 'c') + '@email.com',
      cpf: `${Math.floor(100 + seededRandom(seed + 13) * 900)}.${Math.floor(100 + seededRandom(seed + 14) * 900)}.${Math.floor(100 + seededRandom(seed + 15) * 900)}-${Math.floor(10 + seededRandom(seed + 16) * 90)}`,
      sellerId: seller?.id || null,
      unitId,
      stage,
      source: sources[Math.floor(seededRandom(seed + 17) * sources.length)],
      lastPurchase: purchaseHistory.length > 0 ? purchaseHistory[purchaseHistory.length - 1].date : null,
      purchaseHistory,
      erpCode: `ERP-${5000 + i}`,
      address: `Rua ${streetNames[i % streetNames.length]}, ${100 + Math.floor(seededRandom(seed + 18) * 2000)}`,
      city: cities[i % cities.length],
      notes: notesList[i % notesList.length],
      createdAt: randomDate('2025-06-01', '2026-03-15'),
      lastContact: randomDate('2026-01-01', '2026-03-16'),
      hasBudget,
      budgetDate: hasBudget ? randomDate('2026-01-15', '2026-03-16') : null,
    });
  }
  return result;
}

export const clients: Client[] = generateClients();

// ===== CONVERSATIONS =====
// Many AI-active conversations to show volume
export const conversations: Conversation[] = [
  // === AI ACTIVE conversations (28 active right now) ===
  {
    id: 'conv-1', clientId: 'c-1', clientName: 'Maria Aparecida Silva', clientPhone: '(11) 98432-1567',
    sellerId: null, isAIActive: true, wasHandedOff: false, stage: 'contato_ia', unitId: 'unit-1',
    lastMessageAt: '2026-03-16T10:35:00', unread: true, inbox: '(11) 3000-1000',
    messages: [
      { id: 'm1', sender: 'ai', content: 'Oi Maria! Tudo bem? 😊\nAqui é da Casa Mansur', timestamp: '2026-03-16T10:20:00' },
      { id: 'm1b', sender: 'ai', content: 'Vi que você se interessou pelo envidraçamento de sacada\nPosso te ajudar com isso!', timestamp: '2026-03-16T10:20:05' },
      { id: 'm2', sender: 'client', content: 'Oi! Quero saber sobre envidraçamento de sacada. Moro no 12º andar e a sacada tem uns 5 metros.', timestamp: '2026-03-16T10:22:00' },
      { id: 'm3', sender: 'ai', content: 'Que legal! 5 metros é um bom tamanho\nPra andar alto a gente usa vidro temperado de 10mm, fica super seguro', timestamp: '2026-03-16T10:24:00' },
      { id: 'm3b', sender: 'ai', content: 'Me conta:\nA sacada é reta ou em L?\nTem grade ou parapeito?', timestamp: '2026-03-16T10:24:05' },
      { id: 'm4', sender: 'client', content: 'É reta, sem curva. Tem grade de ferro. Quanto fica mais ou menos?', timestamp: '2026-03-16T10:28:00' },
      { id: 'm5', sender: 'ai', content: 'Pra sacada reta de 5m com vidro 10mm\nFica entre R$ 8.500 e R$ 12.000 👀', timestamp: '2026-03-16T10:30:00' },
      { id: 'm5b', sender: 'ai', content: 'Pra valor certinho a gente faz visita técnica gratuita\nQuer que eu agende? 📋', timestamp: '2026-03-16T10:30:05' },
      { id: 'm6', sender: 'client', content: 'Sim, pode agendar! Qual dia vocês podem vir?', timestamp: '2026-03-16T10:35:00' },
    ]
  },
  {
    id: 'conv-4', clientId: 'c-8', clientName: 'Paulo Henrique Souza', clientPhone: '(11) 95432-7890',
    sellerId: null, isAIActive: true, wasHandedOff: false, stage: 'contato_ia', unitId: 'unit-1',
    lastMessageAt: '2026-03-16T09:15:00', unread: true, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm50', sender: 'ai', content: 'Oi Paulo! Tudo bem? 😊\nAqui é da Casa Mansur\nVocê nos visitou há 6 meses, lembra?', timestamp: '2026-03-16T08:30:00' },
      { id: 'm50b', sender: 'ai', content: 'Queria saber como tá o projeto de envidraçamento\nPosso ajudar com algo?', timestamp: '2026-03-16T08:30:05' },
      { id: 'm51', sender: 'client', content: 'Opa, lembro sim! Na época não deu pra fechar por causa do orçamento. Agora tô com grana e quero retomar.', timestamp: '2026-03-16T09:00:00' },
      { id: 'm52', sender: 'ai', content: 'Que boa notícia! 🎉\nAgora temos 12x sem juros!\nSua sacada era 3.5m no 6º, certo?', timestamp: '2026-03-16T09:05:00' },
      { id: 'm53', sender: 'client', content: 'Isso mesmo! Boa memória 😄 Pode atualizar o orçamento.', timestamp: '2026-03-16T09:15:00' },
    ]
  },
  {
    id: 'conv-7', clientId: 'c-33', clientName: 'Aline Batista', clientPhone: '(11) 92345-6789',
    sellerId: null, isAIActive: true, wasHandedOff: false, stage: 'novo', unitId: 'unit-2',
    lastMessageAt: '2026-03-16T11:00:00', unread: true, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm90', sender: 'client', content: 'Oi, boa tarde! Vocês fazem cobertura de vidro pra área gourmet?', timestamp: '2026-03-16T10:55:00' },
      { id: 'm91', sender: 'ai', content: 'Oi! Boa tarde! 😊\nSimm, fazemos sim! Fica incrível', timestamp: '2026-03-16T10:57:00' },
      { id: 'm91b', sender: 'ai', content: 'Me conta:\nQual o tamanho da área?\nÉ casa ou comércio?', timestamp: '2026-03-16T11:00:00' },
    ]
  },
  {
    id: 'conv-11', clientId: 'c-15', clientName: 'Tatiana Ribeiro', clientPhone: '(11) 96789-0123',
    sellerId: null, isAIActive: true, wasHandedOff: false, stage: 'contato_ia', unitId: 'unit-1',
    lastMessageAt: '2026-03-16T11:30:00', unread: true, inbox: '(11) 3000-1000',
    messages: [
      { id: 'm130', sender: 'client', content: 'Boa tarde, quero info sobre envidraçamento pra dois aptos no mesmo prédio', timestamp: '2026-03-16T11:20:00' },
      { id: 'm131', sender: 'ai', content: 'Oi Tatiana!\nDois aptos é ótimo, temos desconto especial pra projetos múltiplos! 🏢', timestamp: '2026-03-16T11:22:00' },
      { id: 'm131b', sender: 'ai', content: 'Me conta:\nQual o tamanho das sacadas?\nQuais andares?', timestamp: '2026-03-16T11:22:05' },
      { id: 'm132', sender: 'client', content: 'Mesmo prédio. 4o e 7o andar. Sacadas iguais, 3.5m cada. Quero preço com desconto.', timestamp: '2026-03-16T11:30:00' },
    ]
  },
  {
    id: 'conv-13', clientId: 'c-49', clientName: 'Mariana Costa', clientPhone: '(11) 94567-8901',
    sellerId: null, isAIActive: true, wasHandedOff: false, stage: 'novo', unitId: 'unit-1',
    lastMessageAt: '2026-03-16T12:00:00', unread: true, inbox: '(11) 3000-1000',
    messages: [
      { id: 'm200', sender: 'client', content: 'Olá! Vi o anúncio de vocês no Google. Fazem espelho sob medida?', timestamp: '2026-03-16T11:50:00' },
      { id: 'm201', sender: 'ai', content: 'Oi Mariana! 😊\nSimm, fazemos espelhos sob medida!\nQual o tamanho que precisa?', timestamp: '2026-03-16T11:52:00' },
      { id: 'm202', sender: 'client', content: 'Preciso pra sala, parede inteira de 3m x 2.5m', timestamp: '2026-03-16T12:00:00' },
    ]
  },
  {
    id: 'conv-16', clientId: 'c-60', clientName: 'Rodrigo Castro', clientPhone: '(11) 91234-0000',
    sellerId: null, isAIActive: true, wasHandedOff: false, stage: 'contato_ia', unitId: 'unit-2',
    lastMessageAt: '2026-03-16T13:00:00', unread: true, inbox: '(11) 3000-2000',
    messages: [
      { id: 'm230', sender: 'client', content: 'Boa tarde! Vi que vocês fazem envidraçamento. Tenho um prédio comercial com 8 sacadas pra fazer', timestamp: '2026-03-16T12:45:00' },
      { id: 'm231', sender: 'ai', content: 'Oi Rodrigo! 🏢\n8 sacadas é um projeto grande!\nPra esse volume temos condição especial', timestamp: '2026-03-16T12:47:00' },
      { id: 'm231b', sender: 'ai', content: 'Me conta mais:\nQual o tamanho de cada sacada?\nÉ tudo no mesmo prédio?', timestamp: '2026-03-16T12:47:05' },
      { id: 'm232', sender: 'client', content: 'Sim, mesmo prédio. Sacadas de 3m cada. Quero preço pra todas.', timestamp: '2026-03-16T13:00:00' },
    ]
  },
  // More AI active conversations
  ...[
    { name: 'Vera Antônio', phone: '(11) 98111-2233', unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-100', lastMsg: '2026-03-16T13:10:00',
      msgs: [
        { s: 'client', c: 'Oi! Vocês fazem janela blindex?', t: '2026-03-16T13:00:00' },
        { s: 'ai', c: 'Oii! Fazemos sim! 😊\nJanela de vidro temperado, super resistente', t: '2026-03-16T13:02:00' },
        { s: 'ai', c: 'Qual o tamanho que precisa?\nÉ pra trocar ou instalar do zero?', t: '2026-03-16T13:02:05' },
        { s: 'client', c: 'Trocar 3 janelas, cada uma 1.20x1.50', t: '2026-03-16T13:10:00' },
      ]},
    { name: 'Nelson Bastos', phone: '(11) 97222-3344', unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-105', lastMsg: '2026-03-16T12:45:00',
      msgs: [
        { s: 'ai', c: 'E aí Nelson!\nAqui é da Casa Mansur\nVi que vc pediu orçamento no site 💪', t: '2026-03-16T12:30:00' },
        { s: 'client', c: 'Sim! Quero box pra 2 banheiros. Um de 1.20 e outro de 0.90.', t: '2026-03-16T12:35:00' },
        { s: 'ai', c: 'Show! 2 box!\nPra 2 tem desconto especial 🚿', t: '2026-03-16T12:37:00' },
        { s: 'ai', c: 'Box 1.20 fica ~R$ 2.100\nBox 0.90 fica ~R$ 1.700\nOs dois juntos sai R$ 3.500!', t: '2026-03-16T12:37:05' },
        { s: 'client', c: 'Bom preço! Aceita cartão?', t: '2026-03-16T12:45:00' },
      ]},
    { name: 'Marta Prado', phone: '(11) 96333-4455', unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-110', lastMsg: '2026-03-16T14:00:00',
      msgs: [
        { s: 'client', c: 'Boa tarde! Preciso de guarda corpo pro terraço. 12 metros.', t: '2026-03-16T13:45:00' },
        { s: 'ai', c: 'Oi Marta! 12 metros é projeto grande!\nGuarda-corpo de vidro ou com inox?', t: '2026-03-16T13:47:00' },
        { s: 'client', c: 'Vidro com inox. Quanto fica?', t: '2026-03-16T14:00:00' },
      ]},
    { name: 'Edson Miranda', phone: '(11) 95444-5566', unit: 'unit-2', inbox: '(11) 99000-0001', cid: 'c-115', lastMsg: '2026-03-16T11:20:00',
      msgs: [
        { s: 'ai', c: 'Oi Edson! Tudo certo?\nAqui é da Casa Mansur\nLembrou de fechar o envidraçamento?', t: '2026-03-16T10:00:00' },
        { s: 'client', c: 'Opa lembrei! Minha esposa quer vidro fumê agora. Muda muito o preço?', t: '2026-03-16T11:00:00' },
        { s: 'ai', c: 'Fumê é lindo! 😎\nAumenta uns 10-15% do incolor\nPra sua sacada de 4m fica ~R$ 9.500', t: '2026-03-16T11:15:00' },
        { s: 'client', c: 'Hmm vou pensar e volto', t: '2026-03-16T11:20:00' },
      ]},
    { name: 'Clara Reis', phone: '(11) 94555-6677', unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-120', lastMsg: '2026-03-16T10:05:00',
      msgs: [
        { s: 'client', c: 'Bom dia! Quero orçamento de porta de vidro pra loja', t: '2026-03-16T09:50:00' },
        { s: 'ai', c: 'Bom dia Clara! 😊\nPorta pra loja, show!\nÉ porta de correr ou de abrir?', t: '2026-03-16T09:52:00' },
        { s: 'client', c: 'De correr, com 2 folhas. Vão de 2m.', t: '2026-03-16T10:00:00' },
        { s: 'ai', c: 'Porta de correr 2 folhas 2m\nFica entre R$ 3.200 e R$ 4.500 dependendo do vidro\nQuer que eu agende visita?', t: '2026-03-16T10:05:00' },
      ]},
    { name: 'Rogério Cunha', phone: '(11) 93666-7788', unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-125', lastMsg: '2026-03-16T14:30:00',
      msgs: [
        { s: 'ai', c: 'Fala Rogério!\nVi que vc pesquisou cobertura de vidro\nPosso te ajudar! 🏠', t: '2026-03-16T14:15:00' },
        { s: 'client', c: 'Sim! Quero cobertura pra churrasqueira, 5x4 metros', t: '2026-03-16T14:20:00' },
        { s: 'ai', c: 'Churrasqueira com cobertura de vidro é top! 🔥\n5x4 = 20m²\nFica entre R$ 18k e R$ 25k', t: '2026-03-16T14:25:00' },
        { s: 'client', c: 'Caramba, tá caro. Tem como parcelar?', t: '2026-03-16T14:30:00' },
      ]},
    { name: 'Lúcia Borges', phone: '(11) 92777-8899', unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-130', lastMsg: '2026-03-16T09:45:00',
      msgs: [
        { s: 'client', c: 'Olá! Quero espelhos pra academia do condomínio. 15m² de parede.', t: '2026-03-16T09:30:00' },
        { s: 'ai', c: 'Oi Lúcia!\nEspelho pra academia, projeto grande! 💪\n15m² fica incrível', t: '2026-03-16T09:32:00' },
        { s: 'ai', c: 'Preço por m² de espelho cristal é R$ 380-520\n15m² fica entre R$ 5.700 e R$ 7.800\nQuer visita técnica?', t: '2026-03-16T09:32:05' },
        { s: 'client', c: 'Sim! Mas preciso de aprovação do síndico. Semana que vem confirmo.', t: '2026-03-16T09:45:00' },
      ]},
    { name: 'Wagner Souza', phone: '(11) 91888-9900', unit: 'unit-2', inbox: '(11) 99000-0001', cid: 'c-135', lastMsg: '2026-03-16T13:30:00',
      msgs: [
        { s: 'ai', c: 'E aí Wagner!\nAqui é da Casa Mansur\nTemos promoção de sacada esse mês! 🎉', t: '2026-03-16T13:10:00' },
        { s: 'client', c: 'Opa! Promoção? Quanto tá pra sacada de 3m?', t: '2026-03-16T13:15:00' },
        { s: 'ai', c: 'Sacada 3m tá saindo por R$ 5.800 (era R$ 7.200!)\nSó esse mês! 🔥', t: '2026-03-16T13:20:00' },
        { s: 'client', content: 'Boa! Manda mais detalhes.', t: '2026-03-16T13:30:00' },
      ].map((m, i) => ({ id: `mw-${i}`, sender: m.s as 'ai' | 'client', content: m.c || (m as any).content, timestamp: m.t }))
    },
    { name: 'Denise Tavares', phone: '(11) 98999-0011', unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-140', lastMsg: '2026-03-16T08:30:00',
      msgs: [
        { s: 'client', c: 'Bom dia! Meu vizinho fez sacada com vcs. Quero igual!', t: '2026-03-16T08:10:00' },
        { s: 'ai', c: 'Bom dia Denise! 😊\nIndicação é o melhor elogio!\nQual apto e andar?', t: '2026-03-16T08:12:00' },
        { s: 'client', c: 'Apto 82, 8o andar. Sacada de 4m.', t: '2026-03-16T08:20:00' },
        { s: 'ai', c: '4m no 8o andar, projeto top!\nFica entre R$ 7.500 e R$ 10.500\nPosso agendar visita? 🏗️', t: '2026-03-16T08:25:00' },
        { s: 'client', c: 'Pode agendar sim!', t: '2026-03-16T08:30:00' },
      ]},
    { name: 'Sônia Freitas', phone: '(11) 97100-1122', unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-145', lastMsg: '2026-03-16T15:00:00',
      msgs: [
        { s: 'ai', c: 'Oi Sônia! Tudo bem?\nAqui é da Casa Mansur\nFaz 4 meses do seu orçamento...', t: '2026-03-16T14:40:00' },
        { s: 'ai', c: 'Queria saber se ainda tem interesse\nTemos condições novas! 💙', t: '2026-03-16T14:40:05' },
        { s: 'client', c: 'Oi! Sim, ainda quero. Quanto tá agora?', t: '2026-03-16T14:50:00' },
        { s: 'client', c: 'Minha sacada é aquela de 5.5m, lembra?', t: '2026-03-16T15:00:00' },
      ]},
    { name: 'Cássio Monteiro', phone: '(11) 96200-2233', unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-150', lastMsg: '2026-03-16T12:15:00',
      msgs: [
        { s: 'client', c: 'Vocês fazem envidraçamento em prédio comercial?', t: '2026-03-16T12:00:00' },
        { s: 'ai', c: 'Oi! Fazemos sim!\nTemos vários projetos comerciais 🏢\nQual o porte do prédio?', t: '2026-03-16T12:02:00' },
        { s: 'client', c: 'Prédio de 6 andares, 4 sacadas por andar. 24 sacadas total.', t: '2026-03-16T12:10:00' },
        { s: 'ai', c: '24 sacadas! Projeto corporativo!\nPra esse volume temos condição muito especial\nVou te passar pro nosso consultor sênior! 🚀', t: '2026-03-16T12:15:00' },
      ]},
    { name: 'Teresa Ramos', phone: '(11) 95300-3344', unit: 'unit-2', inbox: '(11) 99000-0001', cid: 'c-155', lastMsg: '2026-03-16T11:45:00',
      msgs: [
        { s: 'ai', c: 'Oi Teresa! 😊\nAqui é da Casa Mansur\nVi seu interesse em cortina de vidro!', t: '2026-03-16T11:30:00' },
        { s: 'client', c: 'Sim! Quero cortina de vidro pro varanda. 5m.', t: '2026-03-16T11:35:00' },
        { s: 'ai', c: 'Cortina de vidro é elegante demais! ✨\n5m fica entre R$ 10k e R$ 14k\nQuer saber mais?', t: '2026-03-16T11:40:00' },
        { s: 'client', c: 'Quero! Vocês vão na minha casa medir?', t: '2026-03-16T11:45:00' },
      ]},
    { name: 'Márcio Alves', phone: '(11) 94400-4455', unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-160', lastMsg: '2026-03-16T10:45:00',
      msgs: [
        { s: 'client', c: 'Oi bom dia, preciso de divisória de vidro pro escritório', t: '2026-03-16T10:30:00' },
        { s: 'ai', c: 'Bom dia Márcio!\nDivisória de vidro pro escritório fica profissional! 💼', t: '2026-03-16T10:32:00' },
        { s: 'ai', c: 'Quanto de divisória precisa?\nCom ou sem porta?', t: '2026-03-16T10:32:05' },
        { s: 'client', c: '8 metros lineares, com 2 portas. Vidro fosco.', t: '2026-03-16T10:40:00' },
        { s: 'ai', c: '8m com 2 portas em vidro jateado\nFica entre R$ 14k e R$ 19k\nProjeto comercial tem condição especial! 🏢', t: '2026-03-16T10:45:00' },
      ]},
    { name: 'Regina Cardoso', phone: '(11) 93500-5566', unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-165', lastMsg: '2026-03-16T09:20:00',
      msgs: [
        { s: 'client', c: 'Vi vocês no Instagram. Fazem espelho com LED?', t: '2026-03-16T09:05:00' },
        { s: 'ai', c: 'Oi Regina! 😊\nFazemos sim! Espelho com LED fica maravilhoso\nPra banheiro ou sala?', t: '2026-03-16T09:07:00' },
        { s: 'client', c: 'Banheiro! 0.80 x 1.20. Com sensor touch.', t: '2026-03-16T09:15:00' },
        { s: 'ai', c: 'Espelho LED touch 0.80x1.20\nFica R$ 1.200 a R$ 1.800 dependendo do modelo\nTemos vários estilos! 🪞', t: '2026-03-16T09:20:00' },
      ]},
    { name: 'Antônio Barbosa', phone: '(11) 92600-6677', unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-170', lastMsg: '2026-03-16T14:50:00',
      msgs: [
        { s: 'ai', c: 'Fala Antônio!\nAqui é da Casa Mansur\nVi que vc visitou a loja na semana passada', t: '2026-03-16T14:30:00' },
        { s: 'ai', c: 'Queria saber se decidiu sobre o box!\nTemos promoção esse mês 🚿', t: '2026-03-16T14:30:05' },
        { s: 'client', c: 'Oi! Sim, quero fechar o box de 1.50m que vi lá. Quanto ficou mesmo?', t: '2026-03-16T14:40:00' },
        { s: 'ai', c: 'Box 1.50m vidro 8mm por R$ 2.800\nPromoção: R$ 2.400! 🔥\nInstala em 5 dias úteis', t: '2026-03-16T14:45:00' },
        { s: 'client', c: 'Fecha! Me manda o pix', t: '2026-03-16T14:50:00' },
      ]},
    { name: 'Nilton Moura', phone: '(11) 91700-7788', unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-175', lastMsg: '2026-03-16T13:55:00',
      msgs: [
        { s: 'client', c: 'Boa tarde, preciso de orçamento urgente. Sacada quebrou com a chuva.', t: '2026-03-16T13:40:00' },
        { s: 'ai', c: 'Oi Nilton!\nEntendo a urgência! 😟\nMe conta o tamanho da sacada e o que aconteceu', t: '2026-03-16T13:42:00' },
        { s: 'client', c: '3.5m de sacada, vidro de 6mm rachou. Preciso trocar tudo.', t: '2026-03-16T13:48:00' },
        { s: 'ai', c: 'Entendi! Vou te ajudar rápido\nReposição de vidro a gente faz em 3-5 dias\nVou te passar pra um consultor agora! 🚀', t: '2026-03-16T13:55:00' },
      ]},
    { name: 'Renato Lima', phone: '(11) 98800-8899', unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-180', lastMsg: '2026-03-16T15:15:00',
      msgs: [
        { s: 'client', c: 'Oi, tudo bem? Quero colocar vidro na varanda. Moro em condomínio, tem alguma restrição?', t: '2026-03-16T15:00:00' },
        { s: 'ai', c: 'Oi Renato! 😊\nGeralmente condominios permitem sim!\nA gente cuida de toda documentação', t: '2026-03-16T15:02:00' },
        { s: 'ai', c: 'Nossos projetos seguem NBR 16259\nA maioria dos condomínios aprova sem problema\nQual o seu prédio?', t: '2026-03-16T15:02:05' },
        { s: 'client', c: 'Edifício Solar das Acácias, Moema. 10o andar, sacada de 4.5m.', t: '2026-03-16T15:10:00' },
        { s: 'ai', c: 'Moema! Já fizemos vários nessa região 🎯\nPra 4.5m no 10o fica entre R$ 8k e R$ 11k\nQuer agendar visita?', t: '2026-03-16T15:15:00' },
      ]},
    { name: 'Isabela Nogueira', phone: '(11) 97900-9900', unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-185', lastMsg: '2026-03-16T10:15:00',
      msgs: [
        { s: 'ai', c: 'Oi Isabela!\nAqui é da Casa Mansur\nVi que vc tem interesse em cortina de vidro!', t: '2026-03-16T10:00:00' },
        { s: 'client', c: 'Tenho sim! Minha sacada tem 6.5m. Quero algo que abra totalmente.', t: '2026-03-16T10:05:00' },
        { s: 'ai', c: 'Cortina retrátil! Abre totalmente 🤩\n6.5m fica entre R$ 13k e R$ 18k\nÉ o modelo mais procurado!', t: '2026-03-16T10:10:00' },
        { s: 'client', c: 'Aceita cartão de crédito?', t: '2026-03-16T10:15:00' },
      ]},
    { name: 'Gustavo Pereira', phone: '(11) 96001-0011', unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-190', lastMsg: '2026-03-16T14:10:00',
      msgs: [
        { s: 'client', c: 'Olá! Preciso de um orçamento pra fechar a sacada do meu apto. 7o andar, sacada de 3m.', t: '2026-03-16T14:00:00' },
        { s: 'ai', c: 'Oi Gustavo!\n3m no 7o andar, fica lindo! 🏢\nVidro temperado 8mm ou 10mm?', t: '2026-03-16T14:02:00' },
        { s: 'client', c: 'Qual a diferença? Qual vc recomenda?', t: '2026-03-16T14:08:00' },
        { s: 'ai', c: '10mm é mais robusto e isolamento melhor\nPro 7o andar eu recomendo 10mm\nDiferença é uns R$ 800-1.200', t: '2026-03-16T14:10:00' },
      ]},
    { name: 'Viviane Nunes', phone: '(11) 95102-1122', unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-195', lastMsg: '2026-03-16T12:30:00',
      msgs: [
        { s: 'client', c: 'Oi! Quero fechar a sacada, vi vcs no Google. Atendem Guarulhos?', t: '2026-03-16T12:15:00' },
        { s: 'ai', c: 'Oi Viviane! 😊\nAtendemos Guarulhos sim!\nJá fizemos vários projetos lá', t: '2026-03-16T12:17:00' },
        { s: 'ai', c: 'Me conta:\nQual o tamanho da sacada?\nQual andar?', t: '2026-03-16T12:17:05' },
        { s: 'client', c: '4m, 5o andar. Quero vidro incolor.', t: '2026-03-16T12:25:00' },
        { s: 'ai', c: '4m incolor no 5o andar\nFica entre R$ 6.800 e R$ 9.200\nPosso agendar visita na região! 🚗', t: '2026-03-16T12:30:00' },
      ]},
    { name: 'Caio Mendonça', phone: '(11) 94203-2233', unit: 'unit-2', inbox: '(11) 99000-0001', cid: 'c-200', lastMsg: '2026-03-16T11:10:00',
      msgs: [
        { s: 'ai', c: 'Fala Caio!\nAqui é da Casa Mansur\nLembrei que vc tem interesse em box! 🚿', t: '2026-03-16T10:50:00' },
        { s: 'client', c: 'Oi! Sim, box pro banheiro da suíte. 1.10m de canto.', t: '2026-03-16T11:00:00' },
        { s: 'ai', c: 'Box canto 1.10m fica R$ 1.900 a R$ 2.600\nInstalação em 5 dias! ⚡', t: '2026-03-16T11:05:00' },
        { s: 'client', c: 'Tem como instalar essa semana?', t: '2026-03-16T11:10:00' },
      ]},
    { name: 'Fábio Moura', phone: '(11) 93304-3344', unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-205', lastMsg: '2026-03-16T15:30:00',
      msgs: [
        { s: 'client', c: 'Preciso de guarda-corpo de vidro pra piscina. 20 metros.', t: '2026-03-16T15:10:00' },
        { s: 'ai', c: 'Oi Fábio!\n20m de guarda-corpo pra piscina 🏊\nProjeto grande! Fica incrível', t: '2026-03-16T15:12:00' },
        { s: 'ai', c: 'Pra piscina usamos vidro laminado 10mm\n20m fica entre R$ 28k e R$ 38k\nÉ casa ou condomínio?', t: '2026-03-16T15:12:05' },
        { s: 'client', c: 'Casa própria. Tá fazendo a piscina agora.', t: '2026-03-16T15:20:00' },
        { s: 'ai', c: 'Perfeito timing! 💪\nA gente instala junto com a obra\nQuer agendar visita técnica?', t: '2026-03-16T15:25:00' },
        { s: 'client', c: 'Quero! Pode ser essa semana?', t: '2026-03-16T15:30:00' },
      ]},
  ].map((c, i) => ({
    id: `conv-ai-${i + 1}`,
    clientId: c.cid,
    clientName: c.name,
    clientPhone: c.phone,
    sellerId: null,
    isAIActive: true,
    wasHandedOff: false,
    stage: 'contato_ia' as LeadStage,
    unitId: c.unit,
    lastMessageAt: c.lastMsg,
    unread: true,
    inbox: c.inbox,
    messages: c.msgs.map((m, j) => ({
      id: `m-ai${i}-${j}`,
      sender: m.s as 'ai' | 'client',
      content: m.c,
      timestamp: m.t,
    })),
  })),

  // === HANDOFF conversations (sold, negotiating, lost, etc.) ===
  {
    id: 'conv-2', clientId: 'c-2', clientName: 'João Pedro Ferreira', clientPhone: '(11) 97654-3210',
    sellerId: 's1', sellerName: 'Carlos Mendes', isAIActive: false, wasHandedOff: true, handoffSellerId: 's1',
    stage: 'orcamento', unitId: 'unit-1', lastMessageAt: '2026-03-15T16:45:00', unread: false, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm10', sender: 'ai', content: 'E aí João! Beleza?\nAqui é da Casa Mansur 🏗️', timestamp: '2026-03-15T09:00:00' },
      { id: 'm11', sender: 'client', content: 'Bom dia! Preciso de um orçamento urgente pra envidraçar a sacada. Tô reformando e preciso resolver isso essa semana.', timestamp: '2026-03-15T09:02:00' },
      { id: 'm12', sender: 'ai', content: 'Entendi a urgência! Vou te ajudar rápido\nMe passa o tamanho da sacada e o andar?', timestamp: '2026-03-15T09:03:00' },
      { id: 'm13', sender: 'client', content: '3 metros de largura, pé direito normal. 8o andar. Rua Augusta, 2500.', timestamp: '2026-03-15T09:05:00' },
      { id: 'm14', sender: 'ai', content: 'Beleza! Vou te passar pro Carlos, nosso especialista\nEle já agenda a visita técnica rapidinho! 🚀', timestamp: '2026-03-15T09:06:00' },
      { id: 'm15', sender: 'ai', content: '🔄 Handoff para vendedor: Carlos Mendes\nMotivo: Orçamento urgente — cliente em reforma\nPotencial: Alto', timestamp: '2026-03-15T09:06:30', isHandoff: true, handoffTo: 'Carlos Mendes' },
      { id: 'm16', sender: 'seller', senderName: 'Carlos Mendes', content: 'Fala João! Carlos aqui 👊\nVi que é urgente. Consigo ir aí amanhã 9h30, pode ser?\n\nPra sacada de 3m no 8º andar, fica entre R$ 5.200 e R$ 7.800. Confirmo na medição.', timestamp: '2026-03-15T09:10:00' },
      { id: 'm17', sender: 'client', content: 'Perfeito! Amanhã de manhã tá ótimo, depois das 9h.', timestamp: '2026-03-15T09:15:00' },
      { id: 'm18', sender: 'seller', senderName: 'Carlos Mendes', content: 'Combinado! 9h30 aí. Levo as amostras de vidro 👊', timestamp: '2026-03-15T09:18:00' },
      { id: 'm19', sender: 'seller', senderName: 'Carlos Mendes', content: 'João, fiz a medição! Segue orçamento:\n\n📋 Sacada 3.2m — Vidro 10mm incolor\n💰 R$ 6.450 em até 10x sem juros\n⏰ 12 dias úteis\n\nFechamos?', timestamp: '2026-03-15T16:30:00' },
      { id: 'm20', sender: 'client', content: 'Tá bom o preço. Vou conversar com minha esposa e te dou retorno até amanhã.', timestamp: '2026-03-15T16:45:00' },
    ]
  },
  {
    id: 'conv-3', clientId: 'c-5', clientName: 'Camila Rodrigues', clientPhone: '(11) 96543-8765',
    sellerId: 's2', sellerName: 'Ana Beatriz Costa', isAIActive: false, wasHandedOff: true, handoffSellerId: 's2',
    stage: 'fechado', unitId: 'unit-1', lastMessageAt: '2026-03-14T11:20:00', unread: false, inbox: '(11) 3000-1000',
    messages: [
      { id: 'm30', sender: 'ai', content: 'Oi Camila! 😊\nVi que vc curtiu nosso trabalho no Insta\nPosso te ajudar?', timestamp: '2026-03-10T14:00:00' },
      { id: 'm31', sender: 'client', content: 'Oi sim! Vi os stories com aquela sacada linda. Quero fazer na minha!', timestamp: '2026-03-10T14:05:00' },
      { id: 'm32', sender: 'ai', content: 'Ficou demais né! 🤩\nMe conta o tamanho da sacada e o andar?', timestamp: '2026-03-10T14:06:00' },
      { id: 'm33', sender: 'client', content: '4 metros, 5o andar, moro em Santo André', timestamp: '2026-03-10T14:10:00' },
      { id: 'm34', sender: 'ai', content: 'Atendemos Santo André sim!\nVou te passar pra Ana Beatriz, ela é fera nisso 💪', timestamp: '2026-03-10T14:11:00' },
      { id: 'm35', sender: 'ai', content: '🔄 Handoff para vendedora: Ana Beatriz Costa\nMotivo: Lead qualificado — Instagram\nPotencial: Alto', timestamp: '2026-03-10T14:11:30', isHandoff: true, handoffTo: 'Ana Beatriz Costa' },
      { id: 'm36', sender: 'seller', senderName: 'Ana Beatriz Costa', content: 'Oi Camila! Sou a Ana 😊\nSacada de vidro fica um sonho! Posso agendar visita pra essa semana?', timestamp: '2026-03-10T14:15:00' },
      { id: 'm37', sender: 'client', content: 'Pode sim! Quinta de tarde?', timestamp: '2026-03-10T14:20:00' },
      { id: 'm38', sender: 'seller', senderName: 'Ana Beatriz Costa', content: 'Quinta 14h! Levo o catálogo com acabamentos 📚', timestamp: '2026-03-10T14:22:00' },
      { id: 'm39', sender: 'seller', senderName: 'Ana Beatriz Costa', content: 'Camila, orçamento pronto! 🎉\n\n📋 Sacada 4.1m — Vidro 8mm fumê retrátil\n💰 R$ 8.900 — 10x de R$ 890\n⏰ 15 dias úteis', timestamp: '2026-03-12T10:00:00' },
      { id: 'm40', sender: 'client', content: 'Fechado!! Pode mandar o contrato! 🎉', timestamp: '2026-03-12T10:30:00' },
      { id: 'm41', sender: 'seller', senderName: 'Ana Beatriz Costa', content: '🎉🎉 Parabéns! Vai ficar lindo!\nMando o contrato hoje. Bem-vinda à família Casa Mansur! 💙', timestamp: '2026-03-12T10:35:00' },
    ]
  },
  {
    id: 'conv-5', clientId: 'c-25', clientName: 'Elaine Fonseca', clientPhone: '(11) 94321-6543',
    sellerId: 's5', sellerName: 'Marcos Oliveira', isAIActive: false, wasHandedOff: true, handoffSellerId: 's5',
    stage: 'negociacao', unitId: 'unit-2', lastMessageAt: '2026-03-15T18:30:00', unread: false, inbox: '(11) 3000-2000',
    messages: [
      { id: 'm60', sender: 'ai', content: 'Oi Elaine!\nAqui é da Casa Mansur — Zona Sul\nComo posso te ajudar? 😊', timestamp: '2026-03-14T10:00:00' },
      { id: 'm61', sender: 'client', content: 'Boa tarde! Preciso de guarda-corpo de vidro pra escada caracol.', timestamp: '2026-03-14T10:05:00' },
      { id: 'm62', sender: 'ai', content: 'Escada caracol! Projeto lindo 🌀\nA gente usa vidro laminado pra segurança total', timestamp: '2026-03-14T10:07:00' },
      { id: 'm62b', sender: 'ai', content: 'Quantos metros de escada?\nQuer com corrimão de inox?', timestamp: '2026-03-14T10:07:05' },
      { id: 'm63', sender: 'client', content: 'Uns 6 metros, com corrimão de inox. Quanto fica?', timestamp: '2026-03-14T10:12:00' },
      { id: 'm64', sender: 'ai', content: 'Pra 6m com inox fica entre R$ 12k e R$ 18k\nVou te passar pro Marcos, nosso especialista! 🔧', timestamp: '2026-03-14T10:14:00' },
      { id: 'm65', sender: 'ai', content: '🔄 Handoff para vendedor: Marcos Oliveira\nMotivo: Guarda-corpo especial — projeto complexo\nPotencial: Alto ticket', timestamp: '2026-03-14T10:14:30', isHandoff: true, handoffTo: 'Marcos Oliveira' },
      { id: 'm66', sender: 'seller', senderName: 'Marcos Oliveira', content: 'E aí Elaine! Marcos aqui\nEscada caracol com vidro fica espetacular! Preciso ver o formato. Quando posso ir aí?', timestamp: '2026-03-14T10:20:00' },
      { id: 'm67', sender: 'client', content: 'Pode ser sexta?', timestamp: '2026-03-14T10:25:00' },
      { id: 'm68', sender: 'seller', senderName: 'Marcos Oliveira', content: 'Sexta fechado! Mando orçamento na segunda 👊', timestamp: '2026-03-14T10:28:00' },
      { id: 'm69', sender: 'seller', senderName: 'Marcos Oliveira', content: 'Elaine, orçamento pronto:\n\n📋 Guarda-corpo 6.3m — Vidro laminado 10mm + Inox 304\n💰 R$ 15.800 em 12x de R$ 1.316\n⏰ 20 dias úteis\n\nProjeto premium!', timestamp: '2026-03-15T14:00:00' },
      { id: 'm70', sender: 'client', content: 'Tá um pouco acima. Consegue R$ 14.000?', timestamp: '2026-03-15T18:30:00' },
    ]
  },
  {
    id: 'conv-6', clientId: 'c-30', clientName: 'Guilherme Azevedo', clientPhone: '(11) 93210-9876',
    sellerId: 's6', sellerName: 'Fernanda Lima', isAIActive: false, wasHandedOff: true, handoffSellerId: 's6',
    stage: 'fechado', unitId: 'unit-2', lastMessageAt: '2026-03-13T15:00:00', unread: false, inbox: '(11) 3000-2000',
    messages: [
      { id: 'm80', sender: 'ai', content: 'Fala Guilherme! 😊\nAqui é da Casa Mansur\nTemos promoção de box esse mês! Vc tinha interesse, lembra?', timestamp: '2026-03-11T09:00:00' },
      { id: 'm81', sender: 'client', content: 'Opa! Promoção? Quanto tá?', timestamp: '2026-03-11T09:30:00' },
      { id: 'm82', sender: 'ai', content: 'Box de vidro 8mm a partir de R$ 1.800 (era R$ 2.400!)\nQual o tamanho do seu banheiro? 🚿', timestamp: '2026-03-11T09:32:00' },
      { id: 'm83', sender: 'client', content: 'Box de 1.20m. Quanto fica?', timestamp: '2026-03-11T09:40:00' },
      { id: 'm84', sender: 'ai', content: 'Box 1.20m por R$ 2.100 (era R$ 2.800!)\nPromoção até fim do mês 🔥\nVou te passar pra Fernanda fechar!', timestamp: '2026-03-11T09:42:00' },
      { id: 'm85', sender: 'ai', content: '🔄 Handoff para vendedora: Fernanda Lima\nMotivo: Lead quente — promoção box\nPotencial: Fechamento rápido', timestamp: '2026-03-11T09:42:30', isHandoff: true, handoffTo: 'Fernanda Lima' },
      { id: 'm86', sender: 'seller', senderName: 'Fernanda Lima', content: 'Guilherme! Fernanda aqui 😊\nBox 1.20m por R$ 2.100 com instalação em 5 dias. Fechamos?', timestamp: '2026-03-11T09:50:00' },
      { id: 'm87', sender: 'client', content: 'Fecha! Manda o pix 😂', timestamp: '2026-03-11T10:00:00' },
      { id: 'm88', sender: 'seller', senderName: 'Fernanda Lima', content: 'Hahaha adorei! 🤣 Mandando os dados! Instalação na terça! Parabéns! 💙', timestamp: '2026-03-11T10:05:00' },
    ]
  },
  {
    id: 'conv-8', clientId: 'c-12', clientName: 'André Luiz Martins', clientPhone: '(11) 91234-5678',
    sellerId: 's3', sellerName: 'Roberto Alves', isAIActive: false, wasHandedOff: true, handoffSellerId: 's3',
    stage: 'perdido', unitId: 'unit-1', lastMessageAt: '2026-03-08T14:00:00', unread: false, inbox: '(11) 3000-1000',
    messages: [
      { id: 'm100', sender: 'ai', content: 'Oi André! Tudo bem?\nAqui é da Casa Mansur\nVi que você pesquisou cortina de vidro 😊', timestamp: '2026-03-05T10:00:00' },
      { id: 'm101', sender: 'client', content: 'Oi, tô pesquisando preço. Quanto é cortina de vidro pra varanda de 6 metros?', timestamp: '2026-03-05T10:10:00' },
      { id: 'm102', sender: 'ai', content: 'Cortina de vidro pra 6m fica entre R$ 11k e R$ 16k\nVou te passar pro Roberto pra orçamento certinho!', timestamp: '2026-03-05T10:12:00' },
      { id: 'm103', sender: 'ai', content: '🔄 Handoff para vendedor: Roberto Alves\nMotivo: Orçamento cortina de vidro\nPotencial: Pesquisa de preço', timestamp: '2026-03-05T10:12:30', isHandoff: true, handoffTo: 'Roberto Alves' },
      { id: 'm104', sender: 'seller', senderName: 'Roberto Alves', content: 'André, boa! Roberto aqui. Pra cortina de 6m preciso visitar. Posso ir terça?', timestamp: '2026-03-05T11:00:00' },
      { id: 'm105', sender: 'client', content: 'Pode ser', timestamp: '2026-03-05T11:30:00' },
      { id: 'm106', sender: 'seller', senderName: 'Roberto Alves', content: 'André, orçamento: R$ 13.500 pra cortina 6.2m\n10x de R$ 1.350', timestamp: '2026-03-07T10:00:00' },
      { id: 'm107', sender: 'client', content: 'Achei caro. Vou ver com outra empresa. Obrigado.', timestamp: '2026-03-08T14:00:00' },
    ]
  },
  {
    id: 'conv-9', clientId: 'c-40', clientName: 'Pedro Henrique Lima', clientPhone: '(11) 98765-1234',
    sellerId: 's7', sellerName: 'Thiago Rezende', isAIActive: false, wasHandedOff: true, handoffSellerId: 's7',
    stage: 'qualificado', unitId: 'unit-2', lastMessageAt: '2026-03-16T08:00:00', unread: true, inbox: '(11) 3000-2000',
    messages: [
      { id: 'm110', sender: 'ai', content: 'Bom dia Pedro!\nAqui é da Casa Mansur 🏢\nComo posso te ajudar?', timestamp: '2026-03-15T16:00:00' },
      { id: 'm111', sender: 'client', content: 'Boa tarde! Preciso de porta de vidro temperado pra entrada do escritório. Algo profissional.', timestamp: '2026-03-15T16:05:00' },
      { id: 'm112', sender: 'ai', content: 'Porta de vidro pro escritório é top! 💼\nQual a medida do vão?', timestamp: '2026-03-15T16:07:00' },
      { id: 'm113', sender: 'client', content: 'Porta dupla, vão de 1.80m x 2.40m', timestamp: '2026-03-15T16:15:00' },
      { id: 'm114', sender: 'ai', content: 'Porta dupla! Projeto elegante 🔥\nVou te passar pro Thiago, especialista em projetos comerciais!', timestamp: '2026-03-15T16:16:00' },
      { id: 'm115', sender: 'ai', content: '🔄 Handoff para vendedor: Thiago Rezende\nMotivo: Projeto comercial — porta dupla\nPotencial: Corporativo', timestamp: '2026-03-15T16:16:30', isHandoff: true, handoffTo: 'Thiago Rezende' },
      { id: 'm116', sender: 'seller', senderName: 'Thiago Rezende', content: 'Pedro! Thiago aqui. Porta dupla de vidro fica show. Vou preparar proposta com opções. Mando amanhã!', timestamp: '2026-03-15T17:00:00' },
      { id: 'm117', sender: 'client', content: 'Pode sim! Aguardo.', timestamp: '2026-03-16T08:00:00' },
    ]
  },
  {
    id: 'conv-10', clientId: 'c-42', clientName: 'Caio Mendonça', clientPhone: '(11) 97890-4321',
    sellerId: 's8', sellerName: 'Patrícia Duarte', isAIActive: false, wasHandedOff: true, handoffSellerId: 's8',
    stage: 'fechado', unitId: 'unit-2', lastMessageAt: '2026-03-14T09:00:00', unread: false, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm120', sender: 'ai', content: 'Caio! Tudo certinho com o envidraçamento? 😊\nFez 4 meses já!\nTemos promoção de espelhos que combinam demais', timestamp: '2026-03-12T10:00:00' },
      { id: 'm121', sender: 'client', content: 'Tá perfeito! Vi uns espelhos lindos no insta de vcs. Quanto tá?', timestamp: '2026-03-12T10:30:00' },
      { id: 'm122', sender: 'ai', content: 'Espelhos a partir de R$ 450/m²!\nTem bisotado, chanfrado e com LED 🪞\nVou te passar pra Patrícia!', timestamp: '2026-03-12T10:32:00' },
      { id: 'm123', sender: 'ai', content: '🔄 Handoff para vendedora: Patrícia Duarte\nMotivo: Cross-sell — espelhos pra cliente recorrente\nPotencial: Venda adicional', timestamp: '2026-03-12T10:32:30', isHandoff: true, handoffTo: 'Patrícia Duarte' },
      { id: 'm124', sender: 'seller', senderName: 'Patrícia Duarte', content: 'Caio! Pat aqui 😊\nTenho um bisotado 1.5m x 0.8m por R$ 680. Quer ver fotos?', timestamp: '2026-03-12T11:00:00' },
      { id: 'm125', sender: 'client', content: 'Manda!', timestamp: '2026-03-12T11:10:00' },
      { id: 'm126', sender: 'seller', senderName: 'Patrícia Duarte', content: '[Fotos enviadas]\nPor ser cliente, faço R$ 620 com instalação! 💙', timestamp: '2026-03-12T11:15:00' },
      { id: 'm127', sender: 'client', content: 'Tá ótimo! Pode fechar!', timestamp: '2026-03-12T11:30:00' },
    ]
  },
  {
    id: 'conv-12', clientId: 'c-20', clientName: 'Eduardo Santana', clientPhone: '(11) 95678-9012',
    sellerId: 's4', sellerName: 'Juliana Santos', isAIActive: false, wasHandedOff: true, handoffSellerId: 's4',
    stage: 'orcamento', unitId: 'unit-1', lastMessageAt: '2026-03-16T07:00:00', unread: false, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm140', sender: 'ai', content: 'Eduardo, bom dia!\nVi que vc preencheu o formulário no site\nPrecisa de janelas de vidro temperado né?', timestamp: '2026-03-14T08:00:00' },
      { id: 'm141', sender: 'client', content: 'Bom dia! Sim, 4 janelas de 1.20m x 1.50m pra trocar.', timestamp: '2026-03-14T08:10:00' },
      { id: 'm142', sender: 'ai', content: '4 janelas! Projeto bacana 👌\nVou te passar pra Juliana que manda super bem nisso!', timestamp: '2026-03-14T08:12:00' },
      { id: 'm143', sender: 'ai', content: '🔄 Handoff para vendedora: Juliana Santos\nMotivo: Orçamento 4 janelas\nPotencial: Projeto residencial múltiplo', timestamp: '2026-03-14T08:12:30', isHandoff: true, handoffTo: 'Juliana Santos' },
      { id: 'm144', sender: 'seller', senderName: 'Juliana Santos', content: 'Eduardo! Juliana aqui 😊\n4 janelas tem condição especial! Posso visitar quarta de manhã?', timestamp: '2026-03-14T09:00:00' },
      { id: 'm145', sender: 'client', content: 'Quarta de manhã pode ser!', timestamp: '2026-03-14T09:15:00' },
      { id: 'm146', sender: 'seller', senderName: 'Juliana Santos', content: 'Eduardo, orçamento pronto!\n\n📋 4x Janela 1.22x1.52 — Vidro 8mm maxim-ar\n💰 R$ 4.800 total — 10x de R$ 480\n\nPreço especial por serem 4! 🎯', timestamp: '2026-03-15T16:00:00' },
      { id: 'm147', sender: 'client', content: 'Boa! Vou pensar e te respondo.', timestamp: '2026-03-16T07:00:00' },
    ]
  },
  {
    id: 'conv-14', clientId: 'c-51', clientName: 'Carla Souza', clientPhone: '(11) 93456-7890',
    sellerId: 's2', sellerName: 'Ana Beatriz Costa', isAIActive: false, wasHandedOff: true, handoffSellerId: 's2',
    stage: 'negociacao', unitId: 'unit-1', lastMessageAt: '2026-03-16T10:00:00', unread: true, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm210', sender: 'ai', content: 'Oi Carla!\nTudo bem? Aqui é da Casa Mansur\nVi seu interesse em cobertura de vidro!', timestamp: '2026-03-13T09:00:00' },
      { id: 'm211', sender: 'client', content: 'Oi! Quero cobertura pra garagem, 4m x 3m', timestamp: '2026-03-13T09:10:00' },
      { id: 'm212', sender: 'ai', content: 'Cobertura pra garagem é super útil! 🚗\nVou te passar pra Ana, nossa consultora!', timestamp: '2026-03-13T09:12:00' },
      { id: 'm213', sender: 'ai', content: '🔄 Handoff para vendedora: Ana Beatriz Costa\nMotivo: Cobertura de vidro — garagem\nPotencial: Médio-alto', timestamp: '2026-03-13T09:12:30', isHandoff: true, handoffTo: 'Ana Beatriz Costa' },
      { id: 'm214', sender: 'seller', senderName: 'Ana Beatriz Costa', content: 'Carla! Ana aqui\nCobertura 4x3 fica linda! Visita na sexta?', timestamp: '2026-03-13T09:30:00' },
      { id: 'm215', sender: 'client', content: 'Pode ser!', timestamp: '2026-03-13T09:35:00' },
      { id: 'm216', sender: 'seller', senderName: 'Ana Beatriz Costa', content: 'Carla, orçamento:\n\n📋 Cobertura 4x3m — Vidro laminado\n💰 R$ 14.200 — 12x de R$ 1.183\n\nInclui estrutura de alumínio!', timestamp: '2026-03-15T10:00:00' },
      { id: 'm217', sender: 'client', content: 'Tá um pouco puxado... consegue desconto?', timestamp: '2026-03-16T10:00:00' },
    ]
  },
  {
    id: 'conv-15', clientId: 'c-55', clientName: 'Mônica Oliveira', clientPhone: '(11) 92345-1234',
    sellerId: 's5', sellerName: 'Marcos Oliveira', isAIActive: false, wasHandedOff: true, handoffSellerId: 's5',
    stage: 'fechado', unitId: 'unit-2', lastMessageAt: '2026-03-15T12:00:00', unread: false, inbox: '(11) 3000-2000',
    messages: [
      { id: 'm220', sender: 'ai', content: 'Oi Mônica!\nAqui é da Casa Mansur\nTemos condição especial em envidraçamento esse mês! 🎉', timestamp: '2026-03-12T08:00:00' },
      { id: 'm221', sender: 'client', content: 'Oi! Me interessa sim! Sacada de 4.5m no 3o andar', timestamp: '2026-03-12T08:15:00' },
      { id: 'm222', sender: 'ai', content: 'Ótimo! Vou te passar pro Marcos rapidinho!', timestamp: '2026-03-12T08:17:00' },
      { id: 'm223', sender: 'ai', content: '🔄 Handoff para vendedor: Marcos Oliveira\nMotivo: Lead quente — promoção\nPotencial: Fechamento rápido', timestamp: '2026-03-12T08:17:30', isHandoff: true, handoffTo: 'Marcos Oliveira' },
      { id: 'm224', sender: 'seller', senderName: 'Marcos Oliveira', content: 'Mônica! Marcos aqui 👊\n4.5m no 3o, consigo um preço especial!\nR$ 9.200 em 10x. Visita amanhã?', timestamp: '2026-03-12T08:30:00' },
      { id: 'm225', sender: 'client', content: 'Pode ser amanhã sim!', timestamp: '2026-03-12T08:45:00' },
      { id: 'm226', sender: 'seller', senderName: 'Marcos Oliveira', content: 'Fechamos em R$ 9.200! Contrato enviado 🎉', timestamp: '2026-03-15T12:00:00' },
    ]
  },
  {
    id: 'conv-17', clientId: 'c-65', clientName: 'Leonardo Dias', clientPhone: '(11) 98888-1111',
    sellerId: 's4', sellerName: 'Juliana Santos', isAIActive: false, wasHandedOff: true, handoffSellerId: 's4',
    stage: 'fechado', unitId: 'unit-1', lastMessageAt: '2026-03-13T16:00:00', unread: false, inbox: '(11) 3000-1000',
    messages: [
      { id: 'm240', sender: 'ai', content: 'Oi Leonardo!\nAqui é da Casa Mansur\nTem interesse em box de banheiro? Vi sua pesquisa no Google!', timestamp: '2026-03-10T10:00:00' },
      { id: 'm241', sender: 'client', content: 'Sim! Box de canto, 0.90 x 0.90. Quanto tá?', timestamp: '2026-03-10T10:10:00' },
      { id: 'm242', sender: 'ai', content: 'Box de canto 0.90 fica em torno de R$ 1.600 a R$ 2.200\nVou te passar pra Juliana! 🚿', timestamp: '2026-03-10T10:12:00' },
      { id: 'm243', sender: 'ai', content: '🔄 Handoff para vendedora: Juliana Santos\nMotivo: Box de canto\nPotencial: Venda rápida', timestamp: '2026-03-10T10:12:30', isHandoff: true, handoffTo: 'Juliana Santos' },
      { id: 'm244', sender: 'seller', senderName: 'Juliana Santos', content: 'Leonardo! Juliana aqui\nBox canto 0.90 por R$ 1.850 com instalação em 5 dias! Fechamos?', timestamp: '2026-03-10T10:30:00' },
      { id: 'm245', sender: 'client', content: 'Fechado!', timestamp: '2026-03-10T11:00:00' },
    ]
  },
  {
    id: 'conv-18', clientId: 'c-70', clientName: 'Jorge Andrade', clientPhone: '(11) 97777-2222',
    sellerId: 's3', sellerName: 'Roberto Alves', isAIActive: false, wasHandedOff: true, handoffSellerId: 's3',
    stage: 'perdido', unitId: 'unit-1', lastMessageAt: '2026-03-10T09:00:00', unread: false, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm250', sender: 'ai', content: 'Jorge, tudo certo?\nLembra do orçamento de envidraçamento?\nTemos novas condições de pagamento! 💰', timestamp: '2026-03-08T10:00:00' },
      { id: 'm251', sender: 'client', content: 'Olha, já fechei com outra empresa. Desculpa.', timestamp: '2026-03-10T09:00:00' },
    ]
  },
  {
    id: 'conv-19', clientId: 'c-75', clientName: 'Renata Lopes', clientPhone: '(11) 96666-3333',
    sellerId: 's6', sellerName: 'Fernanda Lima', isAIActive: false, wasHandedOff: true, handoffSellerId: 's6',
    stage: 'negociacao', unitId: 'unit-2', lastMessageAt: '2026-03-16T09:30:00', unread: true, inbox: '(11) 3000-2000',
    messages: [
      { id: 'm260', sender: 'ai', content: 'Oi Renata! 😊\nSou da Casa Mansur\nIndicaram a gente pra você né?', timestamp: '2026-03-14T14:00:00' },
      { id: 'm261', sender: 'client', content: 'Sim! Minha vizinha fez sacada com vcs e ficou perfeita. Quero igual!', timestamp: '2026-03-14T14:10:00' },
      { id: 'm262', sender: 'ai', content: 'Que bom! Indicação é o melhor elogio 💙\nVou te passar pra Fernanda!', timestamp: '2026-03-14T14:12:00' },
      { id: 'm263', sender: 'ai', content: '🔄 Handoff para vendedora: Fernanda Lima\nMotivo: Indicação — alto potencial\nPotencial: Fechamento provável', timestamp: '2026-03-14T14:12:30', isHandoff: true, handoffTo: 'Fernanda Lima' },
      { id: 'm264', sender: 'seller', senderName: 'Fernanda Lima', content: 'Renata! Fernanda aqui 😊\nAdoro indicação! Qual o tamanho da sacada e o andar?', timestamp: '2026-03-14T14:20:00' },
      { id: 'm265', sender: 'client', content: '3.8m, 6o andar. Vidro fumê igual da vizinha!', timestamp: '2026-03-14T14:30:00' },
      { id: 'm266', sender: 'seller', senderName: 'Fernanda Lima', content: 'Renata, orçamento:\n\n📋 Sacada 3.8m — Vidro fumê 8mm\n💰 R$ 7.800 — 10x de R$ 780\n\nPor ser indicação, ganhei autorização pra dar 5% OFF! 🎁', timestamp: '2026-03-15T16:00:00' },
      { id: 'm267', sender: 'client', content: 'Adorei o desconto! Vou confirmar com meu marido hoje', timestamp: '2026-03-16T09:30:00' },
    ]
  },
  {
    id: 'conv-20', clientId: 'c-80', clientName: 'Sandra Machado', clientPhone: '(11) 95555-4444',
    sellerId: 's8', sellerName: 'Patrícia Duarte', isAIActive: false, wasHandedOff: true, handoffSellerId: 's8',
    stage: 'qualificado', unitId: 'unit-2', lastMessageAt: '2026-03-16T11:45:00', unread: true, inbox: '(11) 99000-0001',
    messages: [
      { id: 'm270', sender: 'ai', content: 'Oi Sandra!\nAqui é da Casa Mansur\nVi que vc pesquisou guarda-corpo no nosso site', timestamp: '2026-03-15T14:00:00' },
      { id: 'm271', sender: 'client', content: 'Oi! Sim, preciso de guarda-corpo pra a varanda do meu apto novo', timestamp: '2026-03-15T14:15:00' },
      { id: 'm272', sender: 'ai', content: 'Parabéns pelo apto novo! 🏠\nVou te passar pra Patrícia!', timestamp: '2026-03-15T14:17:00' },
      { id: 'm273', sender: 'ai', content: '🔄 Handoff para vendedora: Patrícia Duarte\nMotivo: Guarda-corpo — apto novo\nPotencial: Médio', timestamp: '2026-03-15T14:17:30', isHandoff: true, handoffTo: 'Patrícia Duarte' },
      { id: 'm274', sender: 'seller', senderName: 'Patrícia Duarte', content: 'Sandra! Pat aqui\nGuarda-corpo é essencial no apto novo! Qual o tamanho da varanda?', timestamp: '2026-03-15T14:30:00' },
      { id: 'm275', sender: 'client', content: '5 metros. Andar alto, 15o. Precisa ser bem seguro!', timestamp: '2026-03-16T11:45:00' },
    ]
  },
  // Additional handoff conversations for more volume
  ...[
    { id: 'conv-h1', name: 'Fernanda Alves', phone: '(11) 98100-1001', sid: 's1', sn: 'Carlos Mendes', stg: 'fechado' as LeadStage, unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-210' },
    { id: 'conv-h2', name: 'Carlos Eduardo Silva', phone: '(11) 97200-2002', sid: 's1', sn: 'Carlos Mendes', stg: 'orcamento' as LeadStage, unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-215' },
    { id: 'conv-h3', name: 'Ana Paula Ribeiro', phone: '(11) 96300-3003', sid: 's2', sn: 'Ana Beatriz Costa', stg: 'fechado' as LeadStage, unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-220' },
    { id: 'conv-h4', name: 'Rodrigo Castro', phone: '(11) 95400-4004', sid: 's3', sn: 'Roberto Alves', stg: 'negociacao' as LeadStage, unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-225' },
    { id: 'conv-h5', name: 'Daniela Fonseca', phone: '(11) 94500-5005', sid: 's4', sn: 'Juliana Santos', stg: 'orcamento' as LeadStage, unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-230' },
    { id: 'conv-h6', name: 'Marcos Pereira', phone: '(11) 93600-6006', sid: 's5', sn: 'Marcos Oliveira', stg: 'fechado' as LeadStage, unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-235' },
    { id: 'conv-h7', name: 'Tatiane Rocha', phone: '(11) 92700-7007', sid: 's6', sn: 'Fernanda Lima', stg: 'negociacao' as LeadStage, unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-240' },
    { id: 'conv-h8', name: 'Ricardo Nunes', phone: '(11) 91800-8008', sid: 's7', sn: 'Thiago Rezende', stg: 'perdido' as LeadStage, unit: 'unit-2', inbox: '(11) 99000-0001', cid: 'c-245' },
    { id: 'conv-h9', name: 'Patricia Lima', phone: '(11) 98900-9009', sid: 's8', sn: 'Patrícia Duarte', stg: 'fechado' as LeadStage, unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-250' },
    { id: 'conv-h10', name: 'Vanessa Santos', phone: '(11) 97010-0110', sid: 's1', sn: 'Carlos Mendes', stg: 'negociacao' as LeadStage, unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-255' },
    { id: 'conv-h11', name: 'Claudia Martins', phone: '(11) 96120-1210', sid: 's2', sn: 'Ana Beatriz Costa', stg: 'qualificado' as LeadStage, unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-260' },
    { id: 'conv-h12', name: 'Felipe Araújo', phone: '(11) 95230-2310', sid: 's5', sn: 'Marcos Oliveira', stg: 'orcamento' as LeadStage, unit: 'unit-2', inbox: '(11) 3000-2000', cid: 'c-265' },
    { id: 'conv-h13', name: 'Luciana Gomes', phone: '(11) 94340-3410', sid: 's6', sn: 'Fernanda Lima', stg: 'fechado' as LeadStage, unit: 'unit-2', inbox: '(11) 99000-0001', cid: 'c-270' },
    { id: 'conv-h14', name: 'Eduardo Pinto', phone: '(11) 93450-4510', sid: 's3', sn: 'Roberto Alves', stg: 'perdido' as LeadStage, unit: 'unit-1', inbox: '(11) 3000-1000', cid: 'c-275' },
    { id: 'conv-h15', name: 'Cristiane Monteiro', phone: '(11) 92560-5610', sid: 's4', sn: 'Juliana Santos', stg: 'fechado' as LeadStage, unit: 'unit-1', inbox: '(11) 99000-0001', cid: 'c-280' },
  ].map(c => ({
    id: c.id, clientId: c.cid, clientName: c.name, clientPhone: c.phone,
    sellerId: c.sid, sellerName: c.sn, isAIActive: false, wasHandedOff: true, handoffSellerId: c.sid,
    stage: c.stg, unitId: c.unit, lastMessageAt: '2026-03-' + (10 + Math.floor(Math.random() * 6)) + 'T' + (8 + Math.floor(Math.random() * 10)) + ':00:00',
    unread: Math.random() > 0.5, inbox: c.inbox,
    messages: [
      { id: `${c.id}-m1`, sender: 'ai' as const, content: `Oi ${c.name.split(' ')[0]}! Tudo bem?\nAqui é da Casa Mansur 😊`, timestamp: '2026-03-10T09:00:00' },
      { id: `${c.id}-m2`, sender: 'client' as const, content: 'Oi! Preciso de orçamento.', timestamp: '2026-03-10T09:10:00' },
      { id: `${c.id}-m3`, sender: 'ai' as const, content: `Vou te passar pro(a) ${c.sn}! 🚀`, timestamp: '2026-03-10T09:12:00' },
      { id: `${c.id}-m4`, sender: 'ai' as const, content: `🔄 Handoff para vendedor(a): ${c.sn}\nMotivo: Orçamento solicitado\nPotencial: Alto`, timestamp: '2026-03-10T09:12:30', isHandoff: true, handoffTo: c.sn },
      { id: `${c.id}-m5`, sender: 'seller' as const, senderName: c.sn, content: `${c.name.split(' ')[0]}! ${c.sn.split(' ')[0]} aqui 👊\nVou preparar tudo pra você!`, timestamp: '2026-03-10T09:30:00' },
      { id: `${c.id}-m6`, sender: 'client' as const, content: 'Perfeito, aguardo!', timestamp: '2026-03-10T09:35:00' },
    ],
  })),
];

// ===== PRODUCTS =====
export const products: Product[] = [
  { id: 'prod-1', name: 'Envidraçamento de Sacada', category: 'Sacadas', avgPrice: 9500, salesCount: 245, revenue: 2327500, erpCode: 'PRD-001' },
  { id: 'prod-2', name: 'Cortina de Vidro', category: 'Sacadas', avgPrice: 12000, salesCount: 128, revenue: 1536000, erpCode: 'PRD-002' },
  { id: 'prod-3', name: 'Guarda-Corpo de Vidro', category: 'Segurança', avgPrice: 8500, salesCount: 176, revenue: 1496000, erpCode: 'PRD-003' },
  { id: 'prod-4', name: 'Box de Banheiro', category: 'Banheiro', avgPrice: 2200, salesCount: 342, revenue: 752400, erpCode: 'PRD-004' },
  { id: 'prod-5', name: 'Espelho Decorativo', category: 'Decoração', avgPrice: 680, salesCount: 289, revenue: 196520, erpCode: 'PRD-005' },
  { id: 'prod-6', name: 'Porta de Vidro Temperado', category: 'Portas', avgPrice: 3800, salesCount: 134, revenue: 509200, erpCode: 'PRD-006' },
  { id: 'prod-7', name: 'Janela de Vidro Temperado', category: 'Janelas', avgPrice: 1400, salesCount: 412, revenue: 576800, erpCode: 'PRD-007' },
  { id: 'prod-8', name: 'Cobertura de Vidro', category: 'Coberturas', avgPrice: 15000, salesCount: 62, revenue: 930000, erpCode: 'PRD-008' },
];

// ===== CAMPAIGNS =====
export const campaigns: Campaign[] = [
  { id: 'camp-1', name: 'Reativação - Sem compra 90+ dias', status: 'active', targetCount: 234, sentCount: 234, responseRate: 34.6, conversionRate: 12.2, product: 'Todos', createdAt: '2026-03-01', segment: 'Sem compra > 90 dias' },
  { id: 'camp-2', name: 'Promoção Box Março', status: 'active', targetCount: 156, sentCount: 156, responseRate: 42.7, conversionRate: 18.0, product: 'Box de Banheiro', createdAt: '2026-03-05', segment: 'Interesse em box' },
  { id: 'camp-3', name: 'Cross-sell Espelhos', status: 'completed', targetCount: 98, sentCount: 98, responseRate: 28.4, conversionRate: 9.0, product: 'Espelho Decorativo', createdAt: '2026-02-15', segment: 'Comprou sacada últimos 6m' },
  { id: 'camp-4', name: 'Reativação - Orçamentos não fechados', status: 'active', targetCount: 87, sentCount: 72, responseRate: 39.5, conversionRate: 15.8, product: 'Todos', createdAt: '2026-03-10', segment: 'Orçamento > 30 dias sem retorno' },
  { id: 'camp-5', name: 'Lançamento Cobertura Premium', status: 'scheduled', targetCount: 180, sentCount: 0, responseRate: 0, conversionRate: 0, product: 'Cobertura de Vidro', createdAt: '2026-03-20', segment: 'Alto ticket + casa própria' },
  { id: 'camp-6', name: 'Promoção Dia do Consumidor', status: 'completed', targetCount: 312, sentCount: 312, responseRate: 38.1, conversionRate: 14.4, product: 'Todos', createdAt: '2026-03-15', segment: 'Base completa ativa' },
];

// ===== HELPER FUNCTIONS =====
export function getClientsByUnit(unitId: string) {
  return unitId === 'all' ? clients : clients.filter(c => c.unitId === unitId);
}
export function getSellersByUnit(unitId: string) {
  return unitId === 'all' ? sellers : sellers.filter(s => s.unitId === unitId);
}
export function getConversationsByUnit(unitId: string) {
  return unitId === 'all' ? conversations : conversations.filter(c => c.unitId === unitId);
}
export function getClientsBySeller(sellerId: string) {
  return clients.filter(c => c.sellerId === sellerId);
}
export function getConversationsBySeller(sellerId: string) {
  return conversations.filter(c => c.sellerId === sellerId || c.handoffSellerId === sellerId);
}
export function getStageCount(unitId: string, stage: LeadStage) {
  return getClientsByUnit(unitId).filter(c => c.stage === stage).length;
}
export function getFunnelData(unitId: string) {
  const c = getClientsByUnit(unitId);
  return STAGE_ORDER.map(s => ({ stage: s, label: STAGE_LABELS[s], count: c.filter(cl => cl.stage === s).length }));
}
export function getUnitMetrics(unitId: string) {
  const unitClients = getClientsByUnit(unitId);
  const unitSellers = getSellersByUnit(unitId);
  const unitConvs = getConversationsByUnit(unitId);
  const totalLeads = unitClients.length;
  const closed = unitClients.filter(c => c.stage === 'fechado').length;
  const aiActive = unitConvs.filter(c => c.isAIActive).length;
  const handoffs = unitConvs.filter(c => c.wasHandedOff).length;
  const totalSales = unitSellers.reduce((sum, s) => sum + s.metrics.totalSales, 0);
  const avgResponseTime = unitSellers.length > 0 ? unitSellers.reduce((sum, s) => sum + s.metrics.avgResponseTime, 0) / unitSellers.length : 0;
  const followUpConversion = unitSellers.length > 0 ? unitSellers.reduce((sum, s) => sum + s.metrics.followUpConversion, 0) / unitSellers.length : 0;
  return { totalLeads, closed, conversionRate: totalLeads > 0 ? (closed / totalLeads * 100) : 0, aiActive, handoffs, totalSales, avgResponseTime, followUpConversion, sellersCount: unitSellers.length };
}
