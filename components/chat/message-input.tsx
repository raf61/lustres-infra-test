"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useChat, OutOfWindowError, ChatError, Message } from "@/lib/chat";
import { chatAPI, ChatAssigneeUser, TemplateComponent } from "@/lib/chat/api";
import { useChatbotStatus } from "@/lib/chatbot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send,
  Paperclip,
  Smile,
  Loader2,
  AlertCircle,
  X,
  FileText,
  Image as ImageIcon,
  Video,
  FileAudio,
  File,
  Mic,
  Reply,
  Bot,
  UserRound,
  DollarSign,
  Briefcase,
} from "lucide-react";
import { TemplateModal } from "./template-modal";
import { useAudioRecorder } from "@/lib/chat/use-audio-recorder";
import { QUICK_TEMPLATES } from "@/lib/chat/quick-templates";
import { useToast } from "@/hooks/use-toast";

// ════════════════════════════════════════════════════════════════════════════
// NEW DESIGN INPUT COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

export function MessageInput() {
  const {
    state,
    sendMessage,
    sendMessageWithAttachment,
    sendTemplate,
    activeConversation,
    activeMessages,
    replyToMessageId,
    clearReplyToMessage,
  } = useChat();
  const { isSendingMessage, activeConversationId } = state;
  const { status: chatbotStatus, ensureLoaded } = useChatbotStatus(activeConversationId);
  const { toast } = useToast();

  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [error, setError] = useState<any>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [quickTemplate, setQuickTemplate] = useState<any>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRecorder = useAudioRecorder({ maxDuration: 300 });

  const canReply = activeConversation?.canReply !== false;
  const isWhatsApp = activeConversation?.inbox?.provider === "whatsapp_cloud" ||
    activeConversation?.inbox?.channelType === "whatsapp_cloud";

  const handleSend = async () => {
    if (!content.trim() && attachments.length === 0) return;
    const msg = content.trim();
    setContent("");
    setAttachments([]);
    try {
      await sendMessage(activeConversationId!, msg, { inReplyTo: replyToMessageId || undefined });
      clearReplyToMessage();
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
      setContent(msg);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeConversation) return null;

  return (
    <div className="p-3 border-t border-border bg-card/50 backdrop-blur-md">
      <div className="max-w-6xl mx-auto space-y-3">

        {/* Quick Actions / Templates */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
          {isWhatsApp && QUICK_TEMPLATES.map((tmpl) => (
            <Button
              key={tmpl.templateName}
              variant="outline"
              size="sm"
              className="h-7 text-[9px] font-bold uppercase tracking-widest px-3 rounded-xl border-border bg-background/50 hover:bg-primary/10 hover:border-primary/30 transition-all whitespace-nowrap"
              onClick={() => {
                setQuickTemplate({ name: tmpl.templateName, language: tmpl.languageCode });
                setShowTemplateModal(true);
              }}
            >
              {tmpl.label}
            </Button>
          ))}
        </div>

        {/* Input area */}
        <div className="relative group">
          {replyToMessageId && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-3">
                <Reply className="h-4 w-4 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Respondendo a</p>
                  <p className="text-xs font-semibold text-foreground truncate max-w-md">Mensagem selecionada</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/20" onClick={clearReplyToMessage}>
                <X className="h-4 w-4 text-primary" />
              </Button>
            </div>
          )}

          <div className={cn(
            "bg-background/80 border border-border rounded-2xl p-2 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary shadow-2xl",
            isRecordingAudio ? "ring-2 ring-red-500/50 border-red-500/50" : ""
          )}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecordingAudio ? "Gravando áudio..." : "Digite sua mensagem aqui..."}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 resize-none py-3 px-4 min-h-[52px] max-h-32 scrollbar-thin"
              rows={1}
            />

            <div className="flex items-center justify-between px-2 pb-1">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all group">
                  <Paperclip className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all group" onClick={() => setShowTemplateModal(true)}>
                  <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all group">
                  <Smile className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {content.trim() ? (
                  <Button
                    onClick={handleSend}
                    className="h-10 px-6 rounded-xl bg-primary text-white font-bold text-[10px] uppercase tracking-widest kpi-glow hover:bg-primary/90 transition-all"
                  >
                    Enviar <Send className="h-3.5 w-3.5 ml-2" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10 rounded-xl transition-all",
                      isRecordingAudio ? "bg-red-500 text-white animate-pulse" : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                    )}
                    onMouseDown={() => setIsRecordingAudio(true)}
                    onMouseUp={() => setIsRecordingAudio(false)}
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Info badges */}
        <div className="flex items-center justify-center gap-4 py-2 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            <Bot className="h-3 w-3 text-primary" />
            IA Central Ativa
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            Conexão Segura
          </div>
        </div>

      </div>

      <TemplateModal
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        inboxId={activeConversation?.inboxId!}
        onSend={sendTemplate as any}
        lockedTemplateName={quickTemplate?.name}
        lockedTemplateLanguage={quickTemplate?.language}
        prefillValues={quickTemplate?.prefillValues}
      />
    </div>
  );
}

function ShieldCheck(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
