
"use client"

import * as React from "react"
import { Check, Loader2, Send, X } from "lucide-react"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface SendDocumentsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pedidoId: number
    clientData: any // Passar os dados do cliente para extrair telefones
    documentosOperacionais: any[]
    boletos?: any[]
    nfes?: any[]
}

export function SendDocumentsDialog({
    open,
    onOpenChange,
    pedidoId,
    clientData,
    documentosOperacionais,
    boletos = [],
    nfes = [],
}: SendDocumentsDialogProps) {
    const [loading, setLoading] = React.useState(false)
    const [selectedDocs, setSelectedDocs] = React.useState<string[]>([])
    const [selectedPhones, setSelectedPhones] = React.useState<string[]>([])
    const [inboxes, setInboxes] = React.useState<any[]>([])
    const [selectedInboxId, setSelectedInboxId] = React.useState<string>("")

    // Fetch inboxes
    React.useEffect(() => {
        if (open) {
            fetch("/api/chat/inboxes")
                .then(res => res.json())
                .then(data => {
                    const list = Array.isArray(data.inboxes) ? data.inboxes : []
                    const waInboxes = list.filter((i: any) => i.provider === "whatsapp_cloud")
                    setInboxes(waInboxes)
                    if (waInboxes.length > 0) {
                        setSelectedInboxId(waInboxes[0].id)
                    }
                })
                .catch(err => console.error("Error fetching inboxes:", err))
        }
    }, [open])

    // Extração de telefones
    const availablePhones = React.useMemo(() => {
        const phones: { label: string; value: string; type: string }[] = []

        if (clientData?.telefoneCondominio) {
            phones.push({ label: `Tel. Condomínio: ${clientData.telefoneCondominio}`, value: clientData.telefoneCondominio, type: "condominio" })
        }
        if (clientData?.celularCondominio) {
            phones.push({ label: `Cel. Condomínio: ${clientData.celularCondominio}`, value: clientData.celularCondominio, type: "condominio" })
        }
        if (clientData?.telefoneSindico) {
            phones.push({ label: `Síndico: ${clientData.nomeSindico || "Não informado"} (${clientData.telefoneSindico})`, value: clientData.telefoneSindico, type: "sindico" })
        }

        // Gerentes da Administradora
        if (clientData?.gerentesAdministradora) {
            clientData.gerentesAdministradora.forEach((v: any) => {
                const g = v.gerente
                if (g?.celular) {
                    phones.push({ label: `Gerente: ${g.nome} (${g.celular})`, value: g.celular, type: "gerente" })
                }
                if (g?.whatsapp && g?.whatsapp !== g?.celular) {
                    phones.push({ label: `Gerente (WA): ${g.nome} (${g.whatsapp})`, value: g.whatsapp, type: "gerente" })
                }
            })
        }

        // Remove duplicates by value
        return Array.from(new Map(phones.map(p => [p.value, p])).values())
    }, [clientData])

    // Filtra quais documentos dinâmicos mostrar baseado na disponibilidade
    const dynamicDocs = React.useMemo(() => {
        const docs = [
            { id: "laudo", label: "Laudo Técnico", available: true },
            { id: "recibo", label: "Recibo", available: true },
        ]

        // Boletos: Mostrar se houver débitos elegíveis (status 0 e banco suportado)
        const hasElegibleBoletos = boletos.some(debito => {
            const bancoCodigo = debito.bancoCodigo || debito.banco?.bancoCodigo
            return debito.status === 0 && (bancoCodigo === 341 || bancoCodigo === 33)
        })
        console.log("[SendDocs] hasElegibleBoletos:", hasElegibleBoletos, "boletos count:", boletos.length)
        if (hasElegibleBoletos) {
            docs.push({ id: "boletos", label: "Boletos de Pagamento", available: true })
        }

        // NF-es: Mostrar apenas as AUTHORIZED
        const authorizedNfes = nfes.filter(nf => nf.status === 'AUTHORIZED')
        authorizedNfes.forEach(nf => {
            docs.push({ id: `nfe_${nf.id}`, label: `NF-e nº ${nf.number || nf.id}`, available: true })
        })

        // Endosso: Mostra se for EBR (ID 1) OU se já existir um documento desse tipo no pedido
        const hasEndosso = documentosOperacionais.some(d => d.tipo === "CARTA_ENDOSSO")
        if (clientData?.empresaId === 1 || clientData?.orcamento?.empresa?.id === 1 || hasEndosso) {
            docs.push({ id: "endosso", label: "Carta de Endosso", available: true })
        }

        // Documentos que dependem de terem sido gerados (estarem na lista de operacionais)
        const hasTermo = documentosOperacionais.some(d => d.tipo === "TERMO_CONCLUSAO")
        if (hasTermo) docs.push({ id: "termo", label: "Termo de Conclusão", available: true })

        const hasOS = documentosOperacionais.some(d => d.tipo === "ORDEM_SERVICO")
        if (hasOS) docs.push({ id: "os", label: "Ordem de Serviço", available: true })

        const hasVistoria = documentosOperacionais.some(d => d.tipo === "RELATORIO_VISTORIA")
        if (hasVistoria) docs.push({ id: "vistoria", label: "Relatório de Vistoria", available: true })

        return docs
    }, [clientData, documentosOperacionais, boletos, nfes])

    const otherDocs = React.useMemo(() => {
        // Filtra documentos que NÃO são os padrões acima para não duplicar na lista de "Outros"
        const standardTypes = ["LAUDO_TECNICO", "TERMO_CONCLUSAO", "RELATORIO_VISTORIA", "CARTA_ENDOSSO", "ORDEM_SERVICO"]
        return documentosOperacionais.filter(d => !standardTypes.includes(d.tipo))
    }, [documentosOperacionais])

    const handleToggleDoc = (id: string) => {
        setSelectedDocs((prev) =>
            prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
        )
    }

    const handleTogglePhone = (phone: string) => {
        setSelectedPhones((prev) =>
            prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]
        )
    }

    const handleSend = async () => {
        if (selectedDocs.length === 0) {
            toast.error("Selecione pelo menos um documento")
            return
        }
        if (selectedPhones.length === 0) {
            toast.error("Selecione pelo menos um telefone")
            return
        }

        setLoading(true)
        try {
            const empresaId = clientData?.empresaId || clientData?.orcamento?.empresa?.id
            let nomeEmpresa = "Empresa Brasileira de Raios"
            if (empresaId === 2) {
                nomeEmpresa = "Franklin Instalações de Pararaios"
            }

            const payload = {
                selectedDocuments: selectedDocs.map(d => {
                    if (d.startsWith("op_")) return { type: "documento_operacional", id: parseInt(d.replace("op_", "")) }
                    if (d.startsWith("nfe_")) return { type: "nfe_pdf", id: d.replace("nfe_", "") }
                    if (d === "boletos") return { type: "boletos" }
                    return { type: d }
                }),
                phoneNumbers: selectedPhones,
                nomeEmpresa,
                inboxId: selectedInboxId
            }

            const res = await fetch(`/api/pedidos/${pedidoId}/documentos/enviar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Erro ao enviar documentos")
            }

            toast.success("Documentos enviados com sucesso!")
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full sm:max-w-md h-[100dvh] sm:h-auto flex flex-col overflow-hidden p-0 sm:p-6">
                <div className="p-4 sm:p-0 flex flex-col h-full">
                    <DialogHeader>
                        <DialogTitle>Enviar Documentos via WhatsApp</DialogTitle>
                        <DialogDescription>
                            Selecione os documentos e os contatos que receberão o PDF concatenado.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4 overflow-y-auto max-h-[70vh] pr-2">
                        <div className="grid gap-2">
                            <Label htmlFor="inbox-select" className="text-sm font-semibold">
                                Canal de Envio (WhatsApp)
                            </Label>
                            <Select value={selectedInboxId} onValueChange={setSelectedInboxId}>
                                <SelectTrigger id="inbox-select">
                                    <SelectValue placeholder="Selecione um canal" />
                                </SelectTrigger>
                                <SelectContent>
                                    {inboxes.map((inbox) => (
                                        <SelectItem key={inbox.id} value={inbox.id}>
                                            {inbox.name} {inbox.phoneNumber ? `(${inbox.phoneNumber})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                1. Selecionar Documentos
                                <Badge variant="outline" className="ml-auto">{selectedDocs.length} selecionados</Badge>
                            </h4>
                            <ScrollArea className="h-[220px] border rounded-md p-2">
                                <div className="grid gap-3">
                                    <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Disponíveis para envio</div>
                                    {dynamicDocs.map((doc) => (
                                        <div key={doc.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`doc-${doc.id}`}
                                                checked={selectedDocs.includes(doc.id)}
                                                onCheckedChange={() => handleToggleDoc(doc.id)}
                                            />
                                            <Label htmlFor={`doc-${doc.id}`} className="text-sm cursor-pointer font-medium">
                                                {doc.label}
                                            </Label>
                                        </div>
                                    ))}

                                    {otherDocs.length > 0 && (
                                        <>
                                            <Separator className="my-1" />
                                            <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Outros Documentos</div>
                                            {otherDocs.map((doc) => (
                                                <div key={doc.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`doc-op-${doc.id}`}
                                                        checked={selectedDocs.includes(`op_${doc.id}`)}
                                                        onCheckedChange={() => handleToggleDoc(`op_${doc.id}`)}
                                                    />
                                                    <Label htmlFor={`doc-op-${doc.id}`} className="text-sm truncate cursor-pointer">
                                                        {doc.tipo} - {new Date(doc.createdAt || doc.id).toLocaleDateString()}
                                                    </Label>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        <div className="grid gap-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                2. Selecionar Contatos
                                <Badge variant="outline" className="ml-auto">{selectedPhones.length} selecionados</Badge>
                            </h4>
                            <ScrollArea className="h-[150px] border rounded-md p-2">
                                <div className="grid gap-3">
                                    {availablePhones.length > 0 ? (
                                        availablePhones.map((phone, idx) => (
                                            <div key={`${phone.value}-${idx}`} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`phone-${idx}`}
                                                    checked={selectedPhones.includes(phone.value)}
                                                    onCheckedChange={() => handleTogglePhone(phone.value)}
                                                />
                                                <Label htmlFor={`phone-${idx}`} className="text-sm cursor-pointer">
                                                    {phone.label}
                                                </Label>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic text-center py-4">
                                            Nenhum telefone encontrado para este cliente.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSend} disabled={loading || selectedDocs.length === 0 || selectedPhones.length === 0}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-4 w-4" />
                                    Enviar Documentos
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
