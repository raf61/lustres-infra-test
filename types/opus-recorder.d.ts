declare module 'opus-recorder' {
  export interface RecorderConfig {
    encoderPath?: string;
    bufferLength?: number;
    mediaTrackConstraints?: MediaTrackConstraints | boolean;
    monitorGain?: number;
    numberOfChannels?: 1 | 2;
    recordingGain?: number;
    encoderApplication?: number;
    encoderBitRate?: number;
    encoderComplexity?: number;
    encoderFrameSize?: number;
    encoderSampleRate?: 8000 | 12000 | 16000 | 24000 | 48000;
    maxFramesPerPage?: number;
    originalSampleRateOverride?: number;
    resampleQuality?: number;
    streamPages?: boolean;
    sourceNode?: MediaStreamAudioSourceNode;
  }

  export default class Recorder {
    constructor(config?: RecorderConfig);

    ondataavailable?: (arrayBuffer: ArrayBuffer) => void;
    onstart?: () => void;
    onstop?: () => void;
    onpause?: () => void;
    onresume?: () => void;

    start(): Promise<void>;
    stop(): void;
    pause(flush?: boolean): Promise<void> | void;
    resume(): void;
    close(): void;

    static isRecordingSupported(): boolean;
    static version: string;
  }
}

