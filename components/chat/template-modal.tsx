"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Search,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  Loader2,
  ArrowLeft,
  Send,
  RefreshCw,
  AlertCircle,
  Upload,
  X,
  Check,
} from "lucide-react";
import {
  chatAPI,
  WhatsAppTemplate,
  WhatsAppTemplateComponent,
  TemplateComponent,
  TemplateParameter,
} from "@/lib/chat/api";

// ════════════════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════════════════

interface TemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inboxId: string;
  variableTokens?: Array<{ label: string; token: string }>;
  allowMediaLink?: boolean;
  lockedTemplateName?: string;
  lockedTemplateLanguage?: string;
  autoSendIfNoVariables?: boolean;
  onSend: (templatePayload: {
    name: string;
    languageCode: string;
    components: TemplateComponent[];
  }) => Promise<void>;
  prefillValues?: Record<string, string>;
}

type ModalStep = "list" | "preview";

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Encontra um componente por tipo
 */
function findComponent(
  template: WhatsAppTemplate,
  type: WhatsAppTemplateComponent["type"]
): WhatsAppTemplateComponent | undefined {
  return template.components.find((c) => c.type === type);
}

/**
 * Extrai variáveis de um texto (ex: {{1}}, {{2}}, {{contato_nome}})
 */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map((match) => match.replace(/{{|}}/g, ""));
}

function replaceTemplateVariables(
  templateText: string,
  values: Record<string, string>
): string {
  return templateText.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const key = String(variable);
    return values[key] || match;
  });
}

/**
 * Conta total de variáveis em um template
 */
function countVariables(template: WhatsAppTemplate): number {
  let count = 0;
  for (const component of template.components) {
    if (component.text) {
      count += extractVariables(component.text).length;
    }
  }
  return count;
}

/**
 * Verifica se o header requer mídia
 */
function requiresMedia(template: WhatsAppTemplate): "IMAGE" | "VIDEO" | "DOCUMENT" | null {
  const header = findComponent(template, "HEADER");
  if (!header) return null;
  if (header.format && ["IMAGE", "VIDEO", "DOCUMENT"].includes(header.format)) {
    return header.format as "IMAGE" | "VIDEO" | "DOCUMENT";
  }
  return null;
}

/**
 * Ícone para o tipo de mídia
 */
function MediaIcon({ format }: { format: string }) {
  switch (format) {
    case "IMAGE":
      return <ImageIcon className="h-4 w-4" />;
    case "VIDEO":
      return <Video className="h-4 w-4" />;
    case "DOCUMENT":
      return <File className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

/**
 * Verifica se um template não possui nenhuma variável (texto, mídia ou botões)
 */
function hasNoVariables(template: WhatsAppTemplate): boolean {
  const variableCount = countVariables(template);
  const mediaType = requiresMedia(template);
  const buttonsWithVars = extractButtonsWithVariables(template);

  // Header fixo (TEXT) pode ter variáveis. requiresMedia só checa mídia.
  const header = findComponent(template, "HEADER");
  const headerHasVars = header?.format === "TEXT" && header.text ? extractVariables(header.text).length > 0 : false;

  return variableCount === 0 && !mediaType && buttonsWithVars.length === 0 && !headerHasVars;
}


// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE: LISTA DE TEMPLATES
// ════════════════════════════════════════════════════════════════════════════

function TemplateList({
  templates,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelect,
  onRefresh,
}: {
  templates: WhatsAppTemplate[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelect: (template: WhatsAppTemplate) => void;
  onRefresh: () => void;
}) {
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barra de busca */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar template..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          title="Atualizar templates"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Lista */}
      <ScrollArea className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? "Nenhum template encontrado"
                : "Nenhum template disponível"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onClick={() => onSelect(template)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE: CARD DE TEMPLATE
// ════════════════════════════════════════════════════════════════════════════

function TemplateCard({
  template,
  onClick,
}: {
  template: WhatsAppTemplate;
  onClick: () => void;
}) {
  const body = findComponent(template, "BODY");
  const header = findComponent(template, "HEADER");
  const footer = findComponent(template, "FOOTER");
  const mediaType = requiresMedia(template);
  const variableCount = countVariables(template);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-lg border",
        "hover:bg-accent hover:border-accent-foreground/20",
        "transition-colors duration-150"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{template.name}</span>
          {mediaType && (
            <Badge variant="secondary" className="text-xs">
              <MediaIcon format={mediaType} />
              <span className="ml-1">{mediaType}</span>
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {template.language}
        </Badge>
      </div>

      {/* Header text se houver */}
      {header?.format === "TEXT" && header.text && (
        <div className="mb-2">
          <span className="text-xs font-medium text-muted-foreground">HEADER</span>
          <p className="text-sm text-muted-foreground line-clamp-1">{header.text}</p>
        </div>
      )}

      {/* Body */}
      {body?.text && (
        <div className="mb-2">
          <span className="text-xs font-medium text-muted-foreground">BODY</span>
          <p className="text-sm text-muted-foreground line-clamp-2 font-mono">
            {body.text}
          </p>
        </div>
      )}

      {/* Footer */}
      {footer?.text && (
        <div className="mb-2">
          <span className="text-xs font-medium text-muted-foreground">FOOTER</span>
          <p className="text-xs text-muted-foreground line-clamp-1">{footer.text}</p>
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-2 mt-2">
        <Badge variant="secondary" className="text-xs">
          {template.category}
        </Badge>
        {variableCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {variableCount} variáve{variableCount > 1 ? "is" : "l"}
          </span>
        )}
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE: PREVIEW E PREENCHIMENTO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extrai botões que precisam de parâmetros (URL dinâmicas e COPY_CODE)
 * Igual ao Chatwoot: templateHelper.js#buildTemplateParameters
 */
function extractButtonsWithVariables(
  template: WhatsAppTemplate
): Array<{ index: number; type: "url" | "copy_code"; url?: string; variableName?: string }> {
  const buttonsComponent = findComponent(template, "BUTTONS");
  if (!buttonsComponent?.buttons) return [];

  const result: Array<{ index: number; type: "url" | "copy_code"; url?: string; variableName?: string }> = [];

  buttonsComponent.buttons.forEach((button, index) => {
    // URL dinâmica com variáveis
    if (button.type === "URL" && button.url?.includes("{{")) {
      const variableName = extractVariables(button.url)[0];
      result.push({ index, type: "url", url: button.url, variableName });
    }
    // COPY_CODE (cupom)
    if (button.type === "COPY_CODE") {
      result.push({ index, type: "copy_code" });
    }
  });

  return result;
}

function TemplatePreview({
  template,
  onBack,
  onSend,
  isSending,
  variableTokens,
  allowMediaLink,
  prefillValues,
}: {
  template: WhatsAppTemplate;
  onBack: () => void;
  onSend: (components: TemplateComponent[]) => void;
  isSending: boolean;
  variableTokens?: Array<{ label: string; token: string }>;
  allowMediaLink?: boolean;
  prefillValues?: Record<string, string>;
}) {
  const body = findComponent(template, "BODY");
  const header = findComponent(template, "HEADER");
  const footer = findComponent(template, "FOOTER");
  const buttons = findComponent(template, "BUTTONS");
  const mediaType = requiresMedia(template);
  const isNamedTemplate = template.parameter_format?.toUpperCase() === "NAMED";

  // Extrair variáveis do body
  const bodyVariables = useMemo(() => (body?.text ? extractVariables(body.text) : []), [body?.text]);
  // Extrair variáveis do header (se for TEXT)
  const headerVariables = useMemo(() => (header?.format === "TEXT" && header?.text ? extractVariables(header.text) : []), [header?.format, header?.text]);
  // Extrair botões que precisam de parâmetros
  const buttonsWithVariables = useMemo(() => extractButtonsWithVariables(template), [template]);

  // Estado para os valores das variáveis
  const [bodyValues, setBodyValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaName, setMediaName] = useState(""); // Para documentos (filename)
  const [buttonValues, setButtonValues] = useState<Record<number, string>>({}); // Para botões
  const [mediaMode, setMediaMode] = useState<"upload" | "link">("upload");

  // Estado para upload de arquivo
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Ref para input de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tipos de arquivo aceitos por tipo de mídia
  const acceptedFileTypes = useMemo(() => {
    switch (mediaType) {
      case "IMAGE":
        return "image/jpeg,image/png,image/webp";
      case "VIDEO":
        return "video/mp4,video/3gpp";
      case "DOCUMENT":
        return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
      default:
        return "*";
    }
  }, [mediaType]);

  // Handler para seleção de arquivo
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMediaFile(file);
    setUploadError(null);
    setIsUploading(true);

    try {
      const response = await chatAPI.uploadFile(file);
      setMediaUrl(response.attachment.url);

      // Preencher nome automaticamente para documentos
      if (mediaType === "DOCUMENT") {
        setMediaName(file.name);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Falha no upload");
      setMediaFile(null);
      setMediaUrl("");
      setMediaName("");
    } finally {
      setIsUploading(false);
    }
  }, [mediaType]);

  // Remover arquivo selecionado
  const handleRemoveFile = useCallback(() => {
    setMediaFile(null);
    setMediaUrl("");
    setMediaName("");
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    if (!allowMediaLink || mediaType !== "DOCUMENT") {
      setMediaMode("upload");
    }
  }, [allowMediaLink, mediaType]);

  // Aplicar preenchimento automático (prefillValues) apenas uma vez ou quando mudar
  useEffect(() => {
    if (!prefillValues) return;

    if (headerVariables.length > 0) {
      setHeaderValues((prev) => {
        let changed = false;
        const next = { ...prev };
        headerVariables.forEach((v) => {
          if (prefillValues[v] !== undefined && prev[v] !== prefillValues[v]) {
            next[v] = prefillValues[v];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    if (bodyVariables.length > 0) {
      setBodyValues((prev) => {
        let changed = false;
        const next = { ...prev };
        bodyVariables.forEach((v) => {
          if (prefillValues[v] !== undefined && prev[v] !== prefillValues[v]) {
            next[v] = prefillValues[v];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    if (buttonsWithVariables.length > 0) {
      setButtonValues((prev) => {
        let changed = false;
        const next = { ...prev };
        buttonsWithVariables.forEach((btn) => {
          const varName = btn.variableName;
          if (varName && prefillValues[varName] !== undefined && prev[btn.index] !== prefillValues[varName]) {
            next[btn.index] = prefillValues[varName];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [prefillValues, headerVariables, bodyVariables, buttonsWithVariables]);

  // Texto com variáveis preenchidas (preview)
  const previewBodyText = useMemo(() => {
    if (!body?.text) return "";
    return replaceTemplateVariables(body.text, bodyValues);
  }, [body?.text, bodyValues]);

  const previewHeaderText = useMemo(() => {
    if (!header?.text) return "";
    return replaceTemplateVariables(header.text, headerValues);
  }, [header?.text, headerValues]);

  // Validação (igual ao Chatwoot: isFormInvalid)
  const isValid = useMemo(() => {
    // Verificar se todas as variáveis do body estão preenchidas
    const bodyFilled = bodyVariables.every((v) => bodyValues[v]?.trim());
    // Verificar se todas as variáveis do header estão preenchidas
    const headerFilled = headerVariables.every((v) => headerValues[v]?.trim());
    // Verificar se a mídia está preenchida (se necessário)
    const mediaFilled = !mediaType || mediaUrl.trim();
    // Verificar se todos os botões com variáveis estão preenchidos
    const buttonsFilled = buttonsWithVariables.every((btn) => buttonValues[btn.index]?.trim());

    return bodyFilled && headerFilled && mediaFilled && buttonsFilled;
  }, [bodyVariables, bodyValues, headerVariables, headerValues, mediaType, mediaUrl, buttonsWithVariables, buttonValues]);

  const appendToken = useCallback((value: string, token: string) => {
    if (!token) return value;
    if (!value) return token;
    return value.endsWith(" ") ? `${value}${token}` : `${value} ${token}`;
  }, []);

  const handleSend = () => {
    // Montar payload de componentes (igual ao Chatwoot: TemplateProcessorService)
    const components: TemplateComponent[] = [];

    // ═══════════════════════════════════════════════════════════════════════════
    // HEADER (mídia ou texto com variáveis)
    // ═══════════════════════════════════════════════════════════════════════════
    if (header) {
      if (mediaType && mediaUrl) {
        // Igual ao Chatwoot: PopulateTemplateParametersService#build_media_type_parameter
        const mediaTypeKey = mediaType.toLowerCase() as "image" | "video" | "document";
        const mediaParam: TemplateParameter = {
          type: mediaTypeKey,
          [mediaTypeKey]: { link: mediaUrl },
        };

        // Para documentos, incluir filename (igual ao Chatwoot)
        if (mediaTypeKey === "document" && mediaName.trim()) {
          (mediaParam.document as any).filename = mediaName.trim();
        }

        components.push({
          type: "header",
          parameters: [mediaParam],
        });
      } else if (headerVariables.length > 0) {
        components.push({
          type: "header",
          parameters: headerVariables.map((v) => ({
            type: "text" as const,
            text: headerValues[v] || "",
            ...(isNamedTemplate ? { parameter_name: v } : {}),
          })),
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BODY (variáveis de texto)
    // ═══════════════════════════════════════════════════════════════════════════
    if (bodyVariables.length > 0) {
      components.push({
        type: "body",
        parameters: bodyVariables.map((v) => ({
          type: "text" as const,
          text: bodyValues[v] || "",
          ...(isNamedTemplate ? { parameter_name: v } : {}),
        })),
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BUTTONS (URL dinâmicas e COPY_CODE)
    // Igual ao Chatwoot: TemplateProcessorService#process_button_components
    // ═══════════════════════════════════════════════════════════════════════════
    buttonsWithVariables.forEach((btn) => {
      const value = buttonValues[btn.index] || "";

      if (btn.type === "copy_code") {
        // Coupon code (igual ao Chatwoot: PopulateTemplateParametersService#build_button_parameter)
        components.push({
          type: "button",
          sub_type: "copy_code",
          index: btn.index,
          parameters: [
            {
              type: "coupon_code" as any,
              coupon_code: value,
            },
          ],
        });
      } else {
        // URL button (igual ao Chatwoot)
        components.push({
          type: "button",
          sub_type: "url",
          index: btn.index,
          parameters: [
            {
              type: "text" as const,
              text: value,
            },
          ],
        });
      }
    });

    onSend(components);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="font-medium">{template.name}</h3>
          <p className="text-xs text-muted-foreground">
            {template.language} • {template.category}
          </p>
        </div>
      </div>

      <Tabs defaultValue="edit" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Editar</TabsTrigger>
          <TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="flex-1 mt-4">
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-4 pr-4">
              {/* Mídia - Upload de arquivo */}
              {mediaType && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <MediaIcon format={mediaType} />
                    {mediaType === "IMAGE" && "Imagem"}
                    {mediaType === "VIDEO" && "Vídeo"}
                    {mediaType === "DOCUMENT" && "Documento"}
                  </Label>

                  {allowMediaLink && mediaType === "DOCUMENT" ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={mediaMode === "upload" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setMediaMode("upload");
                          setMediaUrl("");
                          setMediaName("");
                          setUploadError(null);
                        }}
                      >
                        Arquivo
                      </Button>
                      <Button
                        type="button"
                        variant={mediaMode === "link" ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setMediaMode("link");
                          setMediaFile(null);
                          setUploadError(null);
                        }}
                      >
                        Link
                      </Button>
                    </div>
                  ) : null}

                  {allowMediaLink && mediaType === "DOCUMENT" && mediaMode === "link" ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Link do documento</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="https://..."
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                          />
                          {variableTokens && variableTokens.length > 0 ? (
                            <select
                              className="h-9 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
                              defaultValue=""
                              onChange={(e) => {
                                const token = e.target.value;
                                if (!token) return;
                                setMediaUrl((prev) => appendToken(prev || "", token));
                                e.currentTarget.value = "";
                              }}
                            >
                              <option value="">Inserir variável</option>
                              {variableTokens.map((item) => (
                                <option key={item.token} value={item.token}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </div>
                      {/* Nome do arquivo para modo link */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nome do arquivo (como aparecerá no WhatsApp)</Label>
                        <Input
                          placeholder="boleto.pdf"
                          value={mediaName}
                          onChange={(e) => setMediaName(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Input de arquivo oculto */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={acceptedFileTypes}
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isUploading}
                      />

                      {/* Estado: Nenhum arquivo selecionado */}
                      {!mediaFile && !mediaUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full h-20 border-dashed"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Clique para selecionar {mediaType === "IMAGE" ? "uma imagem" : mediaType === "VIDEO" ? "um vídeo" : "um documento"}
                            </span>
                          </div>
                        </Button>
                      )}

                      {/* Estado: Fazendo upload */}
                      {isUploading && (
                        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{mediaFile?.name}</p>
                            <p className="text-xs text-muted-foreground">Enviando...</p>
                          </div>
                        </div>
                      )}

                      {/* Estado: Upload concluído */}
                      {mediaFile && mediaUrl && !isUploading && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <Check className="h-5 w-5 text-green-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{mediaFile.name}</p>
                            <p className="text-xs text-muted-foreground">Upload concluído</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={handleRemoveFile}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Erro de upload */}
                      {uploadError && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-red-600 text-sm">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          {uploadError}
                        </div>
                      )}

                      {/* Filename editável para documentos */}
                      {mediaType === "DOCUMENT" && mediaUrl && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nome do arquivo (como aparecerá no WhatsApp)</Label>
                          <Input
                            placeholder="documento.pdf"
                            value={mediaName}
                            onChange={(e) => setMediaName(e.target.value)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Variáveis do Header */}
              {headerVariables.length > 0 && (
                <div className="space-y-2">
                  <Label>Variáveis do Header</Label>
                  {headerVariables.map((variable, index) => (
                    <div key={variable} className="flex items-center gap-2">
                      <Input
                        placeholder={variable || `Variável ${index + 1}`}
                        value={headerValues[variable] || ""}
                        onChange={(e) =>
                          setHeaderValues((prev) => ({
                            ...prev,
                            [variable]: e.target.value,
                          }))
                        }
                      />
                      {variableTokens && variableTokens.length > 0 ? (
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
                          defaultValue=""
                          onChange={(e) => {
                            const token = e.target.value;
                            if (!token) return;
                            setHeaderValues((prev) => ({
                              ...prev,
                              [variable]: appendToken(prev[variable] || "", token),
                            }));
                            e.currentTarget.value = "";
                          }}
                        >
                          <option value="">Inserir variável</option>
                          {variableTokens.map((item) => (
                            <option key={item.token} value={item.token}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* Variáveis do Body */}
              {bodyVariables.length > 0 && (
                <div className="space-y-2">
                  <Label>Variáveis do Body</Label>
                  {bodyVariables.map((variable, index) => (
                    <div key={variable} className="flex items-center gap-2">
                      <Input
                        placeholder={variable || `Variável ${index + 1}`}
                        value={bodyValues[variable] || ""}
                        onChange={(e) =>
                          setBodyValues((prev) => ({
                            ...prev,
                            [variable]: e.target.value,
                          }))
                        }
                      />
                      {variableTokens && variableTokens.length > 0 ? (
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
                          defaultValue=""
                          onChange={(e) => {
                            const token = e.target.value;
                            if (!token) return;
                            setBodyValues((prev) => ({
                              ...prev,
                              [variable]: appendToken(prev[variable] || "", token),
                            }));
                            e.currentTarget.value = "";
                          }}
                        >
                          <option value="">Inserir variável</option>
                          {variableTokens.map((item) => (
                            <option key={item.token} value={item.token}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {/* Variáveis de Botões (igual ao Chatwoot: WhatsAppTemplateParser.vue) */}
              {buttonsWithVariables.length > 0 && (
                <div className="space-y-2">
                  <Label>Parâmetros de Botões</Label>
                  {buttonsWithVariables.map((btn) => (
                    <div key={btn.index} className="flex items-center gap-2">
                      <Input
                        placeholder={
                          btn.type === "copy_code"
                            ? "Código do cupom (máx 15 caracteres)"
                            : "Parâmetro da URL dinâmica"
                        }
                        value={buttonValues[btn.index] || ""}
                        onChange={(e) =>
                          setButtonValues((prev) => ({
                            ...prev,
                            [btn.index]: e.target.value,
                          }))
                        }
                        maxLength={btn.type === "copy_code" ? 15 : undefined}
                      />
                      {variableTokens && variableTokens.length > 0 ? (
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground"
                          defaultValue=""
                          onChange={(e) => {
                            const token = e.target.value;
                            if (!token) return;
                            setButtonValues((prev) => ({
                              ...prev,
                              [btn.index]: appendToken(prev[btn.index] || "", token),
                            }));
                            e.currentTarget.value = "";
                          }}
                        >
                          <option value="">Inserir variável</option>
                          {variableTokens.map((item) => (
                            <option key={item.token} value={item.token}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <Badge variant="outline" className="shrink-0">
                        {btn.type === "copy_code" ? "Cupom" : "URL"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Sem variáveis */}
              {!mediaType && headerVariables.length === 0 && bodyVariables.length === 0 && buttonsWithVariables.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <AlertCircle className="h-4 w-4" />
                  Este template não requer preenchimento de variáveis.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="preview" className="flex-1 mt-4">
          <ScrollArea className="max-h-[300px]">
            <div className="bg-muted rounded-lg p-4 space-y-3">
              {/* Preview Header */}
              {header?.format === "TEXT" && previewHeaderText && (
                <div className="font-medium">{previewHeaderText}</div>
              )}
              {mediaType && mediaUrl && (
                <div className="flex items-center gap-2 p-3 bg-background rounded border">
                  <MediaIcon format={mediaType} />
                  <span className="text-sm text-muted-foreground truncate">
                    {mediaFile?.name || mediaName || "Arquivo selecionado"}
                  </span>
                </div>
              )}

              {/* Preview Body */}
              {body?.text && (
                <div className="text-sm whitespace-pre-wrap">{previewBodyText}</div>
              )}

              {/* Preview Footer */}
              {footer?.text && (
                <div className="text-xs text-muted-foreground">{footer.text}</div>
              )}

              {/* Preview Buttons */}
              {buttons?.buttons && buttons.buttons.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {buttons.buttons.map((btn, index) => (
                    <Badge key={index} variant="outline">
                      {btn.text}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer com botão de enviar */}
      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <Button variant="outline" onClick={onBack} disabled={isSending}>
          Voltar
        </Button>
        <Button onClick={handleSend} disabled={!isValid || isSending}>
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar Template
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export function TemplateModal({
  open,
  onOpenChange,
  inboxId,
  variableTokens,
  allowMediaLink,
  lockedTemplateName,
  lockedTemplateLanguage,
  autoSendIfNoVariables,
  onSend,
  prefillValues,
}: TemplateModalProps) {
  const [step, setStep] = useState<ModalStep>("list");
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(
    null
  );
  const sendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar templates do banco (igual ao Chatwoot)
  const loadTemplates = useCallback(async () => {
    if (!inboxId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await chatAPI.listTemplates(inboxId);
      setTemplates(response.templates);
      setLastUpdatedAt(response.lastUpdatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar templates");
    } finally {
      setIsLoading(false);
    }
  }, [inboxId]);

  // Sincronizar templates com a Meta (igual ao Chatwoot syncTemplates)
  const syncTemplates = useCallback(async () => {
    if (!inboxId) return;
    setIsSyncing(true);
    setError(null);
    try {
      const response = await chatAPI.syncTemplates(inboxId);
      if (response.success) {
        // Recarrega os templates após sincronização
        await loadTemplates();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar templates");
    } finally {
      setIsSyncing(false);
    }
  }, [inboxId, loadTemplates]);

  // Carregar ao abrir
  useEffect(() => {
    if (open && inboxId) {
      loadTemplates();
    }
  }, [open, inboxId, loadTemplates]);

  // Resetar ao fechar
  useEffect(() => {
    if (!open) {
      setStep("list");
      setSelectedTemplate(null);
      setSearchQuery("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!lockedTemplateName || !open) return;
    const match = templates.find(
      (template) =>
        template.name === lockedTemplateName &&
        (!lockedTemplateLanguage || template.language === lockedTemplateLanguage)
    );
    if (match) {
      if (autoSendIfNoVariables && hasNoVariables(match)) {
        // Envio automático se não houver variáveis
        handleSendTemplate([], match);
      } else {
        setSelectedTemplate(match);
        setStep("preview");
        setError(null);
      }
    } else if (templates.length > 0) {
      setError("Template do fluxo não encontrado nesta inbox.");
    }
  }, [lockedTemplateName, lockedTemplateLanguage, templates, open, autoSendIfNoVariables]);

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setStep("preview");
  };

  const handleSendTemplate = async (components: TemplateComponent[], templateOverride?: WhatsAppTemplate) => {
    const template = templateOverride || selectedTemplate;
    if (!template) return;
    if (sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await onSend({
        name: template.name,
        languageCode: template.language,
        components,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar template");
    } finally {
      setIsSending(false);
      sendingRef.current = false;
    }
  };

  const visibleTemplates = useMemo(() => {
    if (!lockedTemplateName) return templates;
    return templates.filter(
      (template) =>
        template.name === lockedTemplateName &&
        (!lockedTemplateLanguage || template.language === lockedTemplateLanguage)
    );
  }, [templates, lockedTemplateName, lockedTemplateLanguage]);

  // Formatar data da última atualização
  const lastUpdatedFormatted = useMemo(() => {
    if (!lastUpdatedAt) return null;
    try {
      const date = new Date(lastUpdatedAt);
      return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, [lastUpdatedAt]);

  // Se estiver em modo auto-envio, não mostramos o conteúdo até termos certeza que precisa de input
  const isSilentAutoSending = autoSendIfNoVariables && !error && (isLoading || (lockedTemplateName && !selectedTemplate && templates.length > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && !isSilentAutoSending ? (
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === "list" ? "Selecionar Template" : "Configurar Template"}
            </DialogTitle>
            <DialogDescription>
              {step === "list" ? (
                <>
                  Escolha um template para enviar ao cliente.
                  {lastUpdatedFormatted && (
                    <span className="block text-xs mt-1">
                      Atualizado em {lastUpdatedFormatted}
                    </span>
                  )}
                </>
              ) : (
                `Template: ${selectedTemplate?.name}`
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Conteúdo */}
          <div className="flex-1 min-h-0">
            {step === "list" ? (
              <TemplateList
                templates={visibleTemplates}
                isLoading={isLoading || isSyncing}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelect={handleSelectTemplate}
                onRefresh={syncTemplates}
              />
            ) : selectedTemplate ? (
              <TemplatePreview
                template={selectedTemplate}
                onBack={() => setStep("list")}
                onSend={handleSendTemplate}
                isSending={isSending}
                variableTokens={variableTokens}
                allowMediaLink={allowMediaLink}
                prefillValues={prefillValues}
              />
            ) : null}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

