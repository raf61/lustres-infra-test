// Chat Library Exports

export * from "./api";
export * from "./socket";
export { 
  ChatProvider,
  ChatProviderAuto,
  useChat,
  useChatOptional,
  type ChatFilters,
  // Erros customizados
  ChatError,
  OutOfWindowError,
} from "./context";

export { useVendorChatRealtime, type VendorChatSummary } from "./vendor-realtime";

// Audio recording (OGG/Opus)
export { useAudioRecorder, type AudioRecorderResult, type RecordingState } from "./use-audio-recorder";
