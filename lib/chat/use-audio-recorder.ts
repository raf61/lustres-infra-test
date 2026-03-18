"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AudioRecorderCore } from "./audio-recorder-core";

export type RecordingState = "idle" | "recording" | "stopped";

export interface AudioRecorderResult {
  file: File;
  url: string;
  duration: number;
}

export interface UseAudioRecorderOptions {
  maxDuration?: number; // segundos (default: 300 = 5min)
}

/**
 * Hook para gravação de áudio usando Web Audio API
 * Captura PCM direto e converte para MP3
 * Baseado no fluxo do Chatwoot, mas sem WaveSurfer
 */
export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const { maxDuration = 300 } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorderCore | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Limpar recursos
  const cleanup = useCallback(() => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.cancel();
      recorderRef.current = null;
    }
  }, []);

  // Iniciar gravação
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      cleanup();

      const recorder = new AudioRecorderCore({
        onProgress: (ms) => {
          setDuration(Math.floor(ms / 1000));
        },
        onError: (err) => {
          setError(err.message);
          setState("idle");
        },
      });

      recorderRef.current = recorder;
      await recorder.start();

      setState("recording");
      setDuration(0);

      // Auto-parar se atingir duração máxima
      maxDurationTimerRef.current = setTimeout(() => {
        if (recorderRef.current) {
          stopRecording();
        }
      }, maxDuration * 1000);
    } catch (err) {
      console.error("[AudioRecorder] Error starting:", err);
      setError(err instanceof Error ? err.message : "Erro ao acessar microfone");
      setState("idle");
    }
  }, [cleanup, maxDuration]);

  // Parar gravação
  const stopRecording = useCallback(async (): Promise<AudioRecorderResult | null> => {
    if (!recorderRef.current || state !== "recording") {
      return null;
    }

    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }

    try {
      const result = await recorderRef.current.stop();
      recorderRef.current = null;

      if (!result) {
        setState("idle");
        return null;
      }

      const fileName = `audio-${Date.now()}.ogg`;
      const file = new File([result.blob], fileName, { type: "audio/ogg" });
      const url = URL.createObjectURL(result.blob);

      setState("stopped");
      return { file, url, duration: result.duration };
    } catch (err) {
      console.error("[AudioRecorder] Error stopping:", err);
      setError("Erro ao processar áudio");
      setState("idle");
      return null;
    }
  }, [state]);

  // Cancelar gravação
  const cancelRecording = useCallback(() => {
    cleanup();
    setState("idle");
    setDuration(0);
  }, [cleanup]);

  // Resetar
  const reset = useCallback(() => {
    cleanup();
    setState("idle");
    setDuration(0);
    setError(null);
  }, [cleanup]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Formatar duração
  const formattedDuration = `${Math.floor(duration / 60)
    .toString()
    .padStart(2, "0")}:${(duration % 60).toString().padStart(2, "0")}`;

  return {
    state,
    duration,
    formattedDuration,
    error,
    isRecording: state === "recording",
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
