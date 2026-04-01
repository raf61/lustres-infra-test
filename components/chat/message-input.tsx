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
    <div className="px-4 py-3 border-t border-border bg-white">
      <div className="max-w-6xl mx-auto space-y-2">

        {/* Quick Actions / Templates */}
        {isWhatsApp && QUICK_TEMPLATES.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {QUICK_TEMPLATES.map((tmpl) => (
              <Button
                key={tmpl.templateName}
                variant="outline"
                size="sm"
                className="h-6 text-[10px] font-medium px-2.5 rounded-lg border-border/60 bg-muted/40 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all whitespace-nowrap shrink-0"
                onClick={() => {
                  setQuickTemplate({ name: tmpl.templateName, language: tmpl.languageCode });
                  setShowTemplateModal(true);
                }}
              >
                {tmpl.label}
              </Button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="relative group">
          {replyToMessageId && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 px-3 py-2 bg-blue-50 border border-primary/20 rounded-xl flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2">
                <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-primary">Respondendo a mensagem</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg hover:bg-primary/10" onClick={clearReplyToMessage}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}

          <div className={cn(
            "bg-white border border-border/70 rounded-2xl p-2 transition-all duration-200 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary shadow-sm",
            isRecordingAudio ? "ring-2 ring-red-500/50 border-red-500/50" : ""
          )}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecordingAudio ? "Gravando áudio..." : "Escreva uma mensagem..."}
              className="w-full bg-transparent border-none focus:ring-0 text-[14px] text-foreground placeholder:text-muted-foreground/60 resize-none pt-2.5 pb-1 px-3 min-h-[44px] max-h-32"
              rows={1}
            />

            <div className="flex items-center justify-between px-1.5 pb-1.5">
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors" onClick={() => setShowTemplateModal(true)}>
                  <FileText className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors">
                  <Smile className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {content.trim() ? (
                  <Button
                    onClick={handleSend}
                    className="h-8 px-4 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    Enviar <Send className="h-3 w-3 ml-1.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all",
                      isRecordingAudio ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground hover:text-primary hover:bg-primary/8"
                    )}
                    onMouseDown={() => setIsRecordingAudio(true)}
                    onMouseUp={() => setIsRecordingAudio(false)}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
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
