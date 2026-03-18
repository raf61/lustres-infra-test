/**
 * Tipos para o servidor de real-time
 */

// Dados anexados ao socket após autenticação
export interface SocketData {
  userId: string;
  userRole: string;
  inboxIds: string[];
}

// Eventos que o servidor EMITE para o cliente
export interface ServerToClientEvents {
  'message.created': (data: any) => void;
  'message.updated': (data: any) => void;
  'conversation.created': (data: any) => void;
  'conversation.updated': (data: any) => void;
  'chatbot.session.active': (data: any) => void;
  'chatbot.session.inactive': (data: any) => void;
  'presence.update': (data: any) => void;
}

// Eventos que o cliente ENVIA para o servidor
export interface ClientToServerEvents {
  'ping': () => void;
}

// Payload do JWT
export interface JWTPayload {
  sub: string;        // userId
  role: string;       // role do usuário
  iat?: number;
  exp?: number;
}

