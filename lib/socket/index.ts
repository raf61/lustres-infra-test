"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

// ════════════════════════════════════════════════════════════════════════════
// TIPOS GENÉRICOS
// ════════════════════════════════════════════════════════════════════════════

export interface UseSocketOptions<TEvents = Record<string, unknown>> {
  /** URL do servidor Socket.io */
  url?: string;
  /** Habilitar conexão */
  enabled?: boolean;
  /** Função para obter token de autenticação */
  getToken?: () => Promise<string>;
  /** Handlers para eventos */
  events?: Partial<{ [K in keyof TEvents]: (data: TEvents[K]) => void }>;
  /** Callbacks de conexão */
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

export interface UseSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnect: () => void;
  socket: Socket | null;
}

// ════════════════════════════════════════════════════════════════════════════
// SOCKET MANAGER (Singleton por URL)
// ════════════════════════════════════════════════════════════════════════════

const socketInstances = new Map<string, Socket>();
const connectionPromises = new Map<string, Promise<void>>();

function getSocket(url: string): Socket {
  if (!socketInstances.has(url)) {
    const socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketInstances.set(url, socket);
  }
  return socketInstances.get(url)!;
}

function removeSocket(url: string): void {
  const socket = socketInstances.get(url);
  if (socket) {
    socket.disconnect();
    socketInstances.delete(url);
    connectionPromises.delete(url);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HOOK GENÉRICO
// ════════════════════════════════════════════════════════════════════════════

export function useSocket<TEvents = Record<string, unknown>>(
  options: UseSocketOptions<TEvents> = {}
): UseSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
    enabled = true,
    getToken,
    events,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Refs para callbacks (evita re-registrar listeners)
  const callbacksRef = useRef({ events, onConnect, onDisconnect, onError });

  useEffect(() => {
    callbacksRef.current = { events, onConnect, onDisconnect, onError };
  });

  const connect = useCallback(async () => {
    if (!enabled) return;

    const socketInstance = getSocket(url);
    setSocket(socketInstance);

    // Já conectado
    if (socketInstance.connected) {
      setIsConnected(true);
      callbacksRef.current.onConnect?.();
      return;
    }

    // Já conectando
    if (connectionPromises.has(url)) {
      try {
        await connectionPromises.get(url);
        setIsConnected(socketInstance.connected);
      } catch (err) {
        setError(err as Error);
      }
      return;
    }

    setIsConnecting(true);
    setError(null);

    const promise = (async () => {
      try {
        if (getToken) {
          const token = await getToken();
          socketInstance.auth = { token };
        }
        socketInstance.connect();
      } finally {
        connectionPromises.delete(url);
      }
    })();

    connectionPromises.set(url, promise);

    try {
      await promise;
    } catch (err) {
      setError(err as Error);
      setIsConnecting(false);
      callbacksRef.current.onError?.(err as Error);
    }
  }, [enabled, url, getToken]);

  const reconnect = useCallback(() => {
    removeSocket(url);
    setIsConnected(false);
    setError(null);
    connect();
  }, [connect, url]);

  // Setup listeners
  useEffect(() => {
    if (!enabled) return;

    const socketInstance = getSocket(url);

    // Verificação imediata de conexão ao montar
    if (socketInstance.connected) {
      setIsConnected(true);
      // Agenda callback para o próximo tick para evitar update durante render se necessário, 
      // mas dentro do useEffect é seguro.
      callbacksRef.current.onConnect?.();
    }

    // Connection events
    const handleConnect = () => {
      console.log("[Socket] Connected to", url);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      callbacksRef.current.onConnect?.();
    };

    const handleDisconnect = (reason: string) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
      callbacksRef.current.onDisconnect?.(reason);
    };

    const handleConnectError = (err: Error) => {
      console.error("[Socket] Connection error:", err);
      setError(err);
      setIsConnecting(false);
      callbacksRef.current.onError?.(err);
    };

    // Register connection listeners
    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);
    socketInstance.on("connect_error", handleConnectError);

    // Register custom event listeners
    const eventHandlers = new Map<string, (data: unknown) => void>();

    if (callbacksRef.current.events) {
      for (const [eventName, handler] of Object.entries(callbacksRef.current.events)) {
        if (handler) {
          const wrappedHandler = (data: unknown) => {
            console.log(`[Socket] ${eventName}:`, data);
            (callbacksRef.current.events as Record<string, (data: unknown) => void>)?.[eventName]?.(data);
          };
          eventHandlers.set(eventName, wrappedHandler);
          socketInstance.on(eventName, wrappedHandler);
        }
      }
    }

    // Connect
    connect();

    // Cleanup
    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.off("connect_error", handleConnectError);

      for (const [eventName, handler] of eventHandlers) {
        socketInstance.off(eventName, handler);
      }
    };
  }, [enabled, url, connect]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnect,
    socket,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════

export type { Socket } from "socket.io-client";

