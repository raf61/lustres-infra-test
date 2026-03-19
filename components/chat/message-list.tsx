"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useChat, Message, Attachment, WhatsAppTemplate, chatAPI, getSignedAttachmentUrl } from "@/lib/chat";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Download,
  Loader2,
  Reply,
  User,
  Phone,
  MessageSquare,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function formatMessageTime(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "HH:mm", { locale: ptBR });
  } catch {
    return "";
  }
}

function formatDateSeparator(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd 'de' MMMM", { locale: ptBR });
  } catch {
    return "";
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONTACT ATTACHMENT
// ════════════════════════════════════════════════════════════════════════════

function ContactAttachment({
  contacts,
  onOpenConversation,
  onSaveContact,
}: {
  contacts: Array<{ phone?: string; name?: string }>;
  onOpenConversation?: (name: string, phone: string) => void;
  onSaveContact?: (name: string, phone: string) => void;
}) {
  if (!contacts || contacts.length === 0) return null;

  return (
    <div className="space-y-2 min-w-[200px]">
      {contacts.map((contact, index) => (
        <div
          key={index}
          className="bg-secondary/50 rounded-xl overflow-hidden border border-border transition-all hover:bg-secondary/70 group shadow-lg"
        >
          {/* Header com Ícone e Nome */}
          <div className="p-3 flex items-center gap-3 bg-card border-b border-border">
            <div className="h-10 w-10 bg-background rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs truncate text-foreground uppercase tracking-tight">{contact.name || "Contato"}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-tight">Cliente</p>
            </div>
          </div>

          {/* Corpo com Telefone */}
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-2.5 text-[11px] font-bold text-primary uppercase tracking-tight">
              <Phone className="h-4 w-4" />
              <span className="truncate">{contact.phone || "Sem número"}</span>
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] w-full justify-start gap-2 border-primary/20 bg-primary/5 hover:bg-primary text-primary hover:text-white transition-all font-bold uppercase tracking-widest rounded-lg shadow-sm"
                onClick={() => onOpenConversation?.(contact.name || "Contato", contact.phone || "")}
                disabled={!contact.phone}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Conversar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[10px] w-full justify-start gap-2 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500 text-emerald-500 hover:text-white transition-all font-bold uppercase tracking-widest rounded-lg shadow-sm"
                onClick={() => onSaveContact?.(contact.name || "Contato", contact.phone || "")}
                disabled={!contact.phone}
              >
                <Save className="h-3.5 w-3.5" />
                Salvar CRM
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ATTACHMENT COMPONENTS (com carregamento de URL assinada)
// ════════════════════════════════════════════════════════════════════════════

interface AttachmentLoaderProps {
  attachment: Attachment;
  children: (url: string | null, isLoading: boolean) => React.ReactNode;
}

function AttachmentLoader({ attachment, children }: AttachmentLoaderProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUrl() {
      // Só tenta carregar se download está completo ou não tem status (legacy)
      const canLoad = !attachment.downloadStatus || attachment.downloadStatus === 'completed';

      if (attachment.id && canLoad) {
        setIsLoading(true);
        const url = await getSignedAttachmentUrl(attachment.id);
        if (!cancelled) {
          setSignedUrl(url);
          setIsLoading(false);
        }
      } else if (attachment.downloadStatus === 'pending' || attachment.downloadStatus === 'downloading') {
        // Ainda baixando - mostra loading
        setIsLoading(true);
      } else {
        setIsLoading(false);
      }
    }

    loadUrl();

    return () => {
      cancelled = true;
    };
  }, [attachment.id, attachment.downloadStatus]);  // ← Recarrega quando downloadStatus muda!

  return <>{children(signedUrl, isLoading)}</>;
}

function ImageAttachment({ attachment, caption }: { attachment: Attachment; caption?: string | null }) {
  return (
    <AttachmentLoader attachment={attachment}>
      {(url, isLoading) => (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 bg-secondary rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <img
              src={url}
              alt="Imagem"
              className="rounded-lg max-w-xs max-h-64 object-cover cursor-pointer"
              onClick={() => window.open(url, "_blank")}
            />
          ) : (
            <div className="flex items-center gap-2 p-4 bg-secondary rounded-lg">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Imagem indisponível</span>
            </div>
          )}
          {caption && <p className="text-sm whitespace-pre-wrap">{caption}</p>}
        </div>
      )}
    </AttachmentLoader>
  );
}

function VideoAttachment({ attachment, caption }: { attachment: Attachment; caption?: string | null }) {
  return (
    <AttachmentLoader attachment={attachment}>
      {(url, isLoading) => (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 bg-secondary rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <video src={url} controls className="rounded-lg max-w-xs" />
          ) : (
            <div className="flex items-center gap-2 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <Video className="h-5 w-5" />
              <span>Vídeo indisponível</span>
            </div>
          )}
          {caption && <p className="text-sm whitespace-pre-wrap">{caption}</p>}
        </div>
      )}
    </AttachmentLoader>
  );
}

function AudioAttachment({ attachment }: { attachment: Attachment }) {
  return (
    <AttachmentLoader attachment={attachment}>
      {(url, isLoading) => (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-4 bg-secondary rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <audio src={url} controls className="max-w-xs" />
          ) : (
            <div className="flex items-center gap-2 p-4 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <Music className="h-5 w-5" />
              <span>Áudio indisponível</span>
            </div>
          )}
        </div>
      )}
    </AttachmentLoader>
  );
}

function DocumentAttachment({ attachment, caption }: { attachment: Attachment; caption?: string | null }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    try {
      const url = await getSignedAttachmentUrl(attachment.id);
      if (url) {
        window.open(url, "_blank");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-3 p-3 bg-secondary rounded-lg transition-colors w-full text-left",
          "hover:bg-secondary/80 cursor-pointer"
        )}
      >
        <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
          ) : (
            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {attachment.fileName || "Documento"}
          </p>
          <p className="text-xs text-slate-500">
            {isLoading ? "Abrindo..." : "Clique para baixar"}
          </p>
        </div>
        <Download className="h-4 w-4 text-slate-400" />
      </button>
      {caption && <p className="text-sm whitespace-pre-wrap">{caption}</p>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// REPLY PREVIEW (Modular - para replies)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Gera texto de preview para uma mensagem (para mostrar em replies)
 */
function getMessagePreviewText(
  message: Message | null,
  options?: { templateText?: string | null }
): string {
  if (!message) return "Mensagem não encontrada";

  if (options?.templateText) {
    return options.templateText.length > 100
      ? options.templateText.slice(0, 100) + "..."
      : options.templateText;
  }

  // Se tem conteúdo de texto, usa ele
  if (message.content) {
    return message.content.length > 100
      ? message.content.slice(0, 100) + "..."
      : message.content;
  }

  // Se é mídia, mostra o tipo
  const attachment = message.attachments?.[0];
  if (attachment) {
    const typeLabels: Record<string, string> = {
      image: "📷 Imagem",
      video: "🎬 Vídeo",
      audio: "🎵 Áudio",
      document: "📄 Documento",
      sticker: "🏷️ Sticker",
    };
    return typeLabels[attachment.fileType] || "📎 Anexo";
  }

  // Fallback por contentType
  const contentTypeLabels: Record<string, string> = {
    image: "📷 Imagem",
    video: "🎬 Vídeo",
    audio: "🎵 Áudio",
    document: "📄 Documento",
  };
  return contentTypeLabels[message.contentType] || "Mensagem";
}

interface ReplyPreviewProps {
  replyToMessage: Message | null;
  previewText: string;
  isMediaReply: boolean;
  isLoading?: boolean;
  onScrollToMessage?: (messageId: string) => void;
}

/**
 * Componente modular para exibir preview da mensagem respondida
 */
function ReplyPreview({ replyToMessage, previewText, isMediaReply, isLoading, onScrollToMessage }: ReplyPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md bg-slate-200/50 dark:bg-slate-700/50">
        <Reply className="h-3 w-3 text-slate-400 flex-shrink-0" />
        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!replyToMessage) return null;

  return (
    <button
      onClick={() => onScrollToMessage?.(replyToMessage.id)}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md text-left w-full",
        "bg-slate-200/50 dark:bg-slate-700/50",
        "hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors",
        "text-xs text-slate-600 dark:text-slate-300"
      )}
    >
      <Reply className="h-3 w-3 text-slate-400 flex-shrink-0" />
      <span className={cn("truncate", isMediaReply && "italic")}>
        {previewText}
      </span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ════════════════════════════════════════════════════════════════════════════

interface MessageBubbleProps {
  message: Message;
  allMessages?: Message[];  // Para buscar mensagem de reply localmente
  onScrollToMessage?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  templateText?: string | null;
  templateTextById?: Map<string, string>;
  onOpenConversation?: (name: string, phone: string) => void;
  onSaveContact?: (name: string, phone: string) => void;
}

function MessageBubble({
  message,
  allMessages,
  onScrollToMessage,
  onReply,
  templateText,
  templateTextById,
  onOpenConversation,
  onSaveContact,
}: MessageBubbleProps) {
  const isOutgoing = message.messageType === "outgoing" || message.messageType === "template";
  const isFailed = message.status === "failed";
  const time = formatMessageTime(message.createdAt);

  const inReplyToId = message.contentAttributes?.inReplyTo as string | undefined;
  const replyToMessage = useMemo(() => {
    if (!inReplyToId || !allMessages) return null;
    return allMessages.find((m) => m.id === inReplyToId) || null;
  }, [inReplyToId, allMessages]);

  const replyPreviewText = useMemo(() => {
    if (!replyToMessage) return "Mensagem não encontrada";
    const replyTemplateText =
      replyToMessage.messageType === "template"
        ? (templateTextById?.get(replyToMessage.id) ?? null)
        : null;
    return getMessagePreviewText(replyToMessage, { templateText: replyTemplateText });
  }, [replyToMessage, templateTextById]);

  const isMediaReply = useMemo(() => {
    if (!replyToMessage) return false;
    if (replyToMessage.attachments?.length) return true;
    return ["image", "video", "audio", "document"].includes(replyToMessage.contentType ?? "");
  }, [replyToMessage]);

  const renderContent = () => {
    const attachment = message.attachments?.[0];

    switch (message.contentType) {
      case "image":
        return attachment ? (
          <ImageAttachment attachment={attachment} caption={message.content} />
        ) : (
          <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg">
            <ImageIcon className="h-5 w-5" />
            <span>Imagem</span>
          </div>
        );

      case "video":
        return attachment ? (
          <VideoAttachment attachment={attachment} caption={message.content} />
        ) : (
          <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg">
            <Video className="h-5 w-5" />
            <span>Vídeo</span>
          </div>
        );

      case "audio":
        return attachment ? (
          <AudioAttachment attachment={attachment} />
        ) : (
          <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg">
            <Music className="h-5 w-5" />
            <span>Áudio</span>
          </div>
        );

      case "document":
        return attachment ? (
          <DocumentAttachment attachment={attachment} caption={message.content} />
        ) : (
          <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg">
            <FileText className="h-5 w-5" />
            <span>Documento</span>
          </div>
        );
      case "template":
        return (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-relaxed tracking-tight">
              {templateText || message.content || ""}
            </p>
          </div>
        );

      case "contacts":
        const contacts = message.contentAttributes?.contacts as any[] | undefined;
        return <ContactAttachment contacts={contacts || []} onOpenConversation={onOpenConversation} onSaveContact={onSaveContact} />;

      default:
        return (
          <p className="text-sm font-medium leading-relaxed tracking-tight whitespace-pre-wrap break-words">
            {message.content || ""}
          </p>
        );
    }
  };

  return (
    <div
      className={cn(
        "flex animate-in fade-in slide-in-from-bottom-2 duration-500",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] flex flex-col gap-1.5 group relative",
          isOutgoing ? "items-end" : "items-start"
        )}
      >
        {/* Removed AI Labels */}

        <div
          className={cn(
            "rounded-2xl px-5 py-3 relative transition-all duration-300 shadow-2xl overflow-hidden",
            isOutgoing
              ? "bg-primary/15 text-foreground border border-primary/30 rounded-tr-sm kpi-glow-subtle"
              : "bg-card text-foreground border border-border/50 rounded-tl-sm shadow-sm",
            isFailed && "ring-2 ring-red-500/50"
          )}
        >
          {onReply && (
            <button
              type="button"
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl bg-card border border-border shadow-xl items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white hover:border-primary z-10 flex",
                isOutgoing ? "-left-10" : "-right-10"
              )}
              onClick={() => onReply(message.id)}
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}

          {inReplyToId && (
            <ReplyPreview
              replyToMessage={replyToMessage}
              previewText={replyPreviewText}
              isMediaReply={isMediaReply}
              onScrollToMessage={onScrollToMessage}
            />
          )}

          {renderContent()}

          <div
            className={cn(
              "flex items-center justify-end gap-1.5 mt-2 transition-opacity",
              isOutgoing ? "text-primary/70" : "text-muted-foreground/60",
              "group-hover:opacity-100 opacity-60"
            )}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest">{time}</span>
            {isOutgoing && !isFailed && (
              <div className="flex items-center">
                {message.status === "read" ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              </div>
            )}
          </div>
        </div>

        {isFailed && isOutgoing && (
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-red-500 uppercase px-2">
            <span>Falha no envio</span>
            <AlertCircle className="h-3 w-3" />
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DATE SEPARATOR
// ════════════════════════════════════════════════════════════════════════════

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="bg-secondary/40 text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-border/30">
        {formatDateSeparator(date)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SKELETON
// ════════════════════════════════════════════════════════════════════════════

function MessageSkeleton({ isOutgoing }: { isOutgoing: boolean }) {
  return (
    <div className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
      <Skeleton
        className={cn(
          "rounded-2xl h-16",
          isOutgoing ? "w-48" : "w-56"
        )}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MESSAGE LIST
// ════════════════════════════════════════════════════════════════════════════

export function MessageList() {
  const {
    state,
    activeMessages,
    loadMoreMessages,
    activeConversation,
    setReplyToMessageId,
    openConversationById,
    associateClientToConversation,
  } = useChat();
  const { isLoadingMessages, messagesMeta, activeConversationId } = state;
  const { toast } = useToast();
  const pathname = usePathname();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveContactData, setSaveContactData] = useState<{ name: string; phone: string } | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesInboxId, setTemplatesInboxId] = useState<string | null>(null);
  useEffect(() => {
    const inboxId = activeConversation?.inboxId;
    if (!inboxId) {
      setTemplates([]);
      setTemplatesInboxId(null);
      return;
    }
    if (templatesInboxId === inboxId) return;

    let cancelled = false;
    chatAPI
      .listTemplates(inboxId)
      .then((result) => {
        if (!cancelled) {
          setTemplates(result.templates || []);
          setTemplatesInboxId(inboxId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplates([]);
          setTemplatesInboxId(inboxId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeConversation?.inboxId, templatesInboxId]);

  const templateTextById = useMemo(() => {
    const map = new Map<string, string>();
    if (!templates.length) return map;

    const findTemplate = (name?: string, lang?: string) => {
      if (!name) return undefined;
      // Busca exata (nome + idioma)
      let match = templates.find((t) => t.name === name && (t.language === lang || !lang));
      // Se não achou com idioma, tenta só pelo nome (idiomas costumam ser pt_BR ou en)
      if (!match) match = templates.find((t) => t.name === name);
      return match;
    };

    const replaceTemplateText = (
      templateText: string,
      params: Array<{ text?: string; parameter_name?: string }> = [],
      isNamed: boolean
    ) => {
      if (!templateText) return "";
      const namedMap: Record<string, string> = {};
      if (isNamed) {
        for (const param of params) {
          if (param.parameter_name) {
            namedMap[param.parameter_name] = param.text ?? "";
          }
        }
      }
      return templateText.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        if (isNamed) {
          return namedMap[key] ?? match;
        }
        const index = Number(key);
        if (!Number.isNaN(index)) {
          return params[index - 1]?.text ?? match;
        }
        return match;
      });
    };

    const describeMediaParam = (params: Array<{ type?: string; image?: { link?: string }; video?: { link?: string }; document?: { link?: string; filename?: string } }>) => {
      const mediaParam = params.find((param) => ["image", "video", "document"].includes(param.type || ""));
      if (!mediaParam) return null;
      if (mediaParam.type === "image") return "Imagem anexada";
      if (mediaParam.type === "video") return "Vídeo anexado";
      if (mediaParam.type === "document") {
        return mediaParam.document?.filename ? `Documento: ${mediaParam.document.filename}` : "Documento anexado";
      }
      return "Mídia anexada";
    };

    const buildTemplateText = (message: Message) => {
      const templateData = message.contentAttributes?.template as
        | {
          name?: string;
          languageCode?: string;
          language_code?: string;
          language?: string;
          components?: Array<{
            type: "header" | "body" | "button";
            parameters?: Array<{ type?: string; text?: string; parameter_name?: string }>;
          }>;
        }
        | undefined;

      const name = templateData?.name;
      const lang = templateData?.languageCode || templateData?.language_code || templateData?.language;

      if (!name) return null;

      const def = findTemplate(name, lang);
      if (!def) return null;

      const isNamed = (def.parameter_format || "").toUpperCase() === "NAMED";
      const getComponent = (type: string) => def.components.find((c) => c.type === type);

      const headerDef = getComponent("HEADER");
      const bodyDef = getComponent("BODY");
      const footerDef = getComponent("FOOTER");
      const buttonsDef = getComponent("BUTTONS");

      const headerParams = templateData.components?.find((c) => c.type === "header")?.parameters ?? [];
      const bodyParams = templateData.components?.find((c) => c.type === "body")?.parameters ?? [];

      const headerText = headerDef?.format === "TEXT" && headerDef.text
        ? replaceTemplateText(headerDef.text, headerParams, isNamed)
        : null;
      const headerMedia = headerDef?.format && headerDef.format !== "TEXT"
        ? describeMediaParam(headerParams)
        : describeMediaParam(headerParams);
      const bodyText = bodyDef?.text
        ? replaceTemplateText(bodyDef.text, bodyParams, isNamed)
        : null;
      const footerText = footerDef?.text || null;

      const lines = [headerText, headerMedia, bodyText, footerText].filter(Boolean) as string[];

      if (buttonsDef?.buttons?.length) {
        const buttonLabels = buttonsDef.buttons.map((btn) => btn.text).filter(Boolean);
        if (buttonLabels.length) {
          lines.push(`Botões: ${buttonLabels.join(", ")}`);
        }
      }

      return lines.join("\n");
    };

    for (const message of activeMessages) {
      if (message.contentType !== "template") continue;
      const text = buildTemplateText(message);
      if (text) map.set(message.id, text);
    }

    return map;
  }, [activeMessages, templates]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const oldestMessageIdRef = useRef<string | null>(null);
  const wasLoadingRef = useRef(false);

  // Agrupa mensagens por data
  const messagesWithDates = useMemo(() => {
    const result: Array<{ type: "date"; date: string } | { type: "message"; message: Message }> = [];
    let lastDate: string | null = null;

    for (const message of activeMessages) {
      const msgDate = message.createdAt;
      if (msgDate) {
        const dateKey = new Date(msgDate).toDateString();
        if (dateKey !== lastDate) {
          result.push({ type: "date", date: msgDate });
          lastDate = dateKey;
        }
      }
      result.push({ type: "message", message });
    }

    return result;
  }, [activeMessages]);

  const handleOpenConversation = useCallback(async (name: string, phone: string) => {
    if (!phone) return;
    let phoneNumber = phone.replace(/\D/g, "");
    if (!phoneNumber.startsWith("55")) phoneNumber = `55${phoneNumber}`;
    const inboxId = activeConversation?.inboxId;
    if (!inboxId) return;

    try {
      const result = await chatAPI.createConversationIfNotExists({ inboxId, phoneNumber, contactName: name });
      if (result.conversationId) {
        // ENSURE LINK: Vincular os mesmos clientes da conversa atual à nova conversa
        const currentClients = activeConversation?.contact?.clients ?? [];
        for (const client of currentClients) {
          await associateClientToConversation(result.conversationId, { clientId: client.id }).catch((err) =>
            console.error(`Falha ao vincular cliente ${client.id} à nova conversa:`, err),
          );
        }

        if (pathname === "/dashboard/chat") {
          await openConversationById(result.conversationId);
        } else {
          await openConversationById(result.conversationId);
          window.dispatchEvent(new CustomEvent("chat:open-popup", { detail: { conversationId: result.conversationId } }));
        }
        toast({ title: "Sucesso", description: "Conversa aberta." });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao abrir conversa.", variant: "destructive" });
    }
  }, [activeConversation, openConversationById, associateClientToConversation, pathname, toast]);

  const handleSaveContactClick = useCallback((name: string, phone: string) => {
    setSaveContactData({ name, phone });
    setSelectedClientId("");
    setSaveDialogOpen(true);
  }, []);

  const handleConfirmSaveAsSindico = async () => {
    if (!selectedClientId || !saveContactData) return;
    setIsSaving(true);
    try {
      // FORMAT: DDD + Number (no 55)
      let cleanPhone = saveContactData.phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("55") && cleanPhone.length > 10) {
        cleanPhone = cleanPhone.substring(2);
      }

      await chatAPI.saveContactAsSindico(parseInt(selectedClientId), {
        name: saveContactData.name,
        phone: cleanPhone,
      });
      toast({ title: "Sucesso", description: "Contato salvo como síndico." });
      setSaveDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha ao salvar contato.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const associatedClients = useMemo(() => activeConversation?.contact?.clients ?? [], [activeConversation]);

  // Quando termina de carregar mensagens antigas, scroll até a mensagem que era a mais antiga
  useEffect(() => {
    if (wasLoadingRef.current && !isLoadingMessages && oldestMessageIdRef.current) {
      // Carregamento terminou - scroll até a mensagem que era a mais antiga
      const msgId = oldestMessageIdRef.current;
      console.log("[MessageList] Loading finished, scrolling to:", msgId);

      // Pequeno delay para garantir que o DOM foi atualizado
      requestAnimationFrame(() => {
        const element = document.getElementById(`msg-${msgId}`);
        if (element) {
          console.log("[MessageList] Found element, scrolling...");
          element.scrollIntoView({ behavior: "instant", block: "end" });
        } else {
          console.log("[MessageList] Element not found:", `msg-${msgId}`);
        }
      });

      oldestMessageIdRef.current = null;
    }
    wasLoadingRef.current = isLoadingMessages;
  }, [isLoadingMessages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!activeConversationId) return;

    const target = e.target as HTMLDivElement;

    // Cross-browser scroll detection for flex-col-reverse
    // We use Math.abs to handle both negative (legacy/Firefox) and positive (Chromium) values
    const maxScroll = target.scrollHeight - target.clientHeight;
    const isAtTop = Math.abs(target.scrollTop) >= maxScroll - 100;

    if (isAtTop && messagesMeta[activeConversationId]?.hasMore && !isLoadingMessages) {
      const oldestMessage = activeMessages[0];
      if (oldestMessage) {
        oldestMessageIdRef.current = oldestMessage.id;
      }
      loadMoreMessages(activeConversationId);
    }
  };

  // NÃO invertemos - usamos flex-col-reverse diretamente no container das mensagens
  // IMPORTANTE: Todos os hooks devem estar antes de qualquer early return para respeitar Rules of Hooks
  const displayMessages = messagesWithDates;

  // Callback para scroll até uma mensagem (para replies)
  const scrollToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight temporário
      element.classList.add("bg-yellow-100", "dark:bg-yellow-900/30");
      setTimeout(() => {
        element.classList.remove("bg-yellow-100", "dark:bg-yellow-900/30");
      }, 1500);
    }
  }, []);

  if (!activeConversation && activeConversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Carregando conversa...</p>
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
        <div className="h-20 w-20 bg-card rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-border/50 group hover:scale-110 transition-all duration-500">
          <MessageSquare className="h-10 w-10 text-primary/60 group-hover:text-primary transition-colors" />
        </div>
        <h3 className="font-display text-lg font-bold text-foreground uppercase tracking-widest mb-2">
          Selecione uma conversa
        </h3>
        <p className="text-muted-foreground text-xs font-medium max-w-xs leading-relaxed">
          Escolha uma conversa na lista ao lado para começar a conversar com seus clientes
        </p>
      </div>
    );
  }

  if (isLoadingMessages && activeMessages.length === 0) {
    return (
      <div className="flex-1 p-4 space-y-4 bg-background">
        {[...Array(6)].map((_, i) => (
          <MessageSkeleton key={i} isOutgoing={i % 2 === 0} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div
        className="h-full overflow-y-auto overscroll-contain flex flex-col-reverse bg-background p-4"
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* flex-col-reverse + gap: scroll começa de baixo, mensagens na ordem certa */}
        <div className="flex flex-col gap-3">
          {/* Loading indicator for older messages (aparece no topo visualmente) */}
          {isLoadingMessages && (
            <div className="py-4 flex flex-col gap-3">
              <MessageSkeleton isOutgoing={false} />
              <MessageSkeleton isOutgoing={true} />
            </div>
          )}

          {/* Messages em ordem cronológica (antigas em cima, recentes embaixo) */}
          {displayMessages.map((item, index) => {
            if (item.type === "date") {
              return <DateSeparator key={`date-${index}`} date={item.date} />;
            }
            return (
              <div
                key={item.message.id}
                id={`msg-${item.message.id}`}
                className="transition-colors duration-500"
              >
                <MessageBubble
                  message={item.message}
                  allMessages={activeMessages}
                  onScrollToMessage={scrollToMessage}
                  onReply={setReplyToMessageId}
                  templateText={templateTextById.get(item.message.id) ?? null}
                  templateTextById={templateTextById}
                  onOpenConversation={handleOpenConversation}
                  onSaveContact={handleSaveContactClick}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Contato</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecionar Cliente</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {associatedClients.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      Nenhum cliente vinculado a esta conversa.
                    </div>
                  ) : (
                    associatedClients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.razaoSocial}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {saveContactData && (
              <div className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                  Contato a ser salvo
                </p>
                <p className="text-sm font-medium">{saveContactData.name}</p>
                <p className="text-xs text-slate-500">{saveContactData.phone}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSaveAsSindico}
              disabled={!selectedClientId || isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar como Síndico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

