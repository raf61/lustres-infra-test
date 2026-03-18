import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const AUTH_SECRET = process.env.AUTH_SECRET;

/**
 * GET /api/chat/realtime/token
 * 
 * Retorna um JWT simples para autenticação no Socket.io.
 * O frontend já autenticado usa esse endpoint para obter um token
 * que será enviado na conexão WebSocket.
 * 
 * O token é simples (não criptografado com JWE como o Next-Auth),
 * permitindo que o servidor Socket.io o valide diretamente.
 */
export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!AUTH_SECRET) {
      console.error('[realtime/token] AUTH_SECRET não configurado');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const user = session.user as { id: string; role?: string };

    // Gerar JWT simples (não criptografado) para Socket.io
    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
      },
      AUTH_SECRET,
      {
        expiresIn: '24h', // Token válido por 24h
      }
    );

    return NextResponse.json({ token });

  } catch (error: any) {
    console.error('[GET /api/chat/realtime/token] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

