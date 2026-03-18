/**
 * Gravador de áudio em OGG/Opus usando opus-recorder (WASM).
 * Gera voice message (PTT) real no WhatsApp Cloud.
 */

import Recorder from "opus-recorder";

export interface AudioRecorderCallbacks {
  onProgress?: (durationMs: number) => void;
  onComplete?: (result: { blob: Blob; duration: number }) => void;
  onError?: (error: Error) => void;
}

export class AudioRecorderCore {
  private recorder: Recorder | null = null;
  private isRecording = false;
  private startTime = 0;
  private callbacks: AudioRecorderCallbacks = {};
  private progressInterval: NodeJS.Timeout | null = null;

  constructor(callbacks?: AudioRecorderCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.recorder = new Recorder({
        encoderPath: "/encoderWorker.min.js",
        numberOfChannels: 1,
        encoderApplication: 2048, // VOICE
        encoderSampleRate: 48000,
      });

      this.isRecording = true;
      this.startTime = Date.now();

      if (this.callbacks.onProgress) {
        this.progressInterval = setInterval(() => {
          if (this.isRecording && this.callbacks.onProgress) {
            this.callbacks.onProgress(Date.now() - this.startTime);
          }
        }, 100);
      }

      await this.recorder.start();
    } catch (error) {
      this.cleanup();
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  async stop(): Promise<{ blob: Blob; duration: number } | null> {
    if (!this.isRecording || !this.recorder) return null;

    this.isRecording = false;
    const duration = Math.floor((Date.now() - this.startTime) / 1000);

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    return new Promise((resolve) => {
      const recorder = this.recorder!;

      recorder.ondataavailable = (arrayBuffer: ArrayBuffer) => {
        const blob = new Blob([arrayBuffer], { type: "audio/ogg" });
        const result = { blob, duration };

        this.cleanup();

        if (this.callbacks.onComplete) {
          this.callbacks.onComplete(result);
        }

        resolve(result);
      };

      recorder.onstop = () => {
        // no-op; data arrives via ondataavailable
      };

      recorder.stop();
    });
  }

  cancel(): void {
    this.isRecording = false;
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.recorder) {
      this.recorder.close();
      this.recorder = null;
    }
  }
}
