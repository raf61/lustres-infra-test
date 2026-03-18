// @ts-ignore - tipos não instalados
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import { JWTPayload, SocketData } from './types';
import { prisma } from '../../lib/prisma';
import { PrismaInboxRepository } from '../infra/repositories/prisma-inbox-repository';
import { RoleInboxAccessPolicy } from '../infra/policies/role-inbox-access-policy';

const AUTH_SECRET = process.env.AUTH_SECRET;

// Roles que têm acesso ao chat
const CHAT_ROLES = ['MASTER', 'ADMINISTRADOR', 'SUPERVISOR', 'VENDEDOR', 'SAC'];

/**
 * Middleware de autenticação para Socket.io
 * Valida JWT e anexa dados do usuário ao socket
 */
export async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Token não fornecido'));
    }

    // Verificar JWT
    const decoded = jwt.verify(token, AUTH_SECRET) as JWTPayload;

    if (!decoded.sub) {
      return next(new Error('Token inválido'));
    }

    // Verificar se usuário existe e está ativo
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, active: true },
    });

    if (!user || !user.active) {
      return next(new Error('Usuário não encontrado ou inativo'));
    }

    // Verificar se tem acesso ao chat
    if (!CHAT_ROLES.includes(user.role)) {
      return next(new Error('Usuário não tem acesso ao chat'));
    }

    const inboxRepository = new PrismaInboxRepository();
    const inboxAccessPolicy = new RoleInboxAccessPolicy();
    const inboxes = await inboxRepository.findAllWithOpenCount();
    const allowedInboxes = await inboxAccessPolicy.filter(inboxes, {
      userId: user.id,
      role: user.role,
    });

    // Anexar dados ao socket
    const socketData: SocketData = {
      userId: user.id,
      userRole: user.role,
      inboxIds: allowedInboxes.map((inbox) => inbox.id),
    };

    socket.data = socketData;

    console.log(`[Auth] User ${user.id} (${user.role}) authenticated`);
    next();
  } catch (error: any) {
    console.error('[Auth] Error:', error.message);
    next(new Error('Falha na autenticação'));
  }
}

