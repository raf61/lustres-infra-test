import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authMiddleware } from './auth';
import { ensureBroadcastsWorker, BroadcastJob } from '../infra/queue/broadcasts.queue';
import { ServerToClientEvents, ClientToServerEvents, SocketData } from './types';

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ════════════════════════════════════════════════════════════════════════════

const PORT = Number(process.env.REALTIME_PORT ?? 3011);

const httpServer = createServer();

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE DE AUTENTICAÇÃO
// ════════════════════════════════════════════════════════════════════════════

io.use(authMiddleware);

// ════════════════════════════════════════════════════════════════════════════
// CONEXÃO DE CLIENTES
// ════════════════════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  const { userId, userRole, inboxIds } = socket.data;

  console.log(`[Socket] Connected: ${userId} (${userRole})`);

  // Entrar nas rooms
  socket.join(`user:${userId}`);
  inboxIds.forEach((inboxId) => {
    socket.join(`inbox:${inboxId}`);
  });

  console.log(`[Socket] User ${userId} joined rooms: user:${userId}, inbox:[${inboxIds.join(', ')}]`);

  // Heartbeat (opcional)
  socket.on('ping', () => {
    socket.emit('presence.update', { status: 'online', userId });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${userId} (${reason})`);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WORKER: CONSUME FILA DE BROADCASTS
// ════════════════════════════════════════════════════════════════════════════

ensureBroadcastsWorker(async (job: BroadcastJob) => {
  const { type, payload } = job;

  // Determinar para qual room enviar
  const inboxId = payload.inboxId || payload.conversation?.inboxId;
  const conversationId = payload.conversationId || payload.id;

  // Broadcast baseado no tipo de evento
  switch (type) {
    case 'message.created':
    case 'message.updated':
      if (inboxId) {
        io.to(`inbox:${inboxId}`).emit(type as keyof ServerToClientEvents, payload);
        console.log(`[Broadcast] ${type} → inbox:${inboxId}`);
      }
      break;

    case 'conversation.created':
    case 'conversation.updated':
      if (inboxId) {
        io.to(`inbox:${inboxId}`).emit(type as keyof ServerToClientEvents, payload);
        console.log(`[Broadcast] ${type} → inbox:${inboxId}`);
      }
      break;

    case 'chatbot.session.active':
    case 'chatbot.session.inactive':
      if (inboxId) {
        io.to(`inbox:${inboxId}`).emit(type as keyof ServerToClientEvents, payload);
        console.log(`[Broadcast] ${type} → inbox:${inboxId}`);
      }
      break;

    default:
      console.warn(`[Broadcast] Unknown event type: ${type}`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ════════════════════════════════════════════════════════════════════════════

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🚀 Real-time Server                                       ║
║                                                            ║
║  Socket.io:  ws://localhost:${PORT}                        ║
║  Consuming:  chat-broadcasts queue                         ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  io.close();
  httpServer.close();
  process.exit(0);
});

