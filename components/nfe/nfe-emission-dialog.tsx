"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, AlertTriangle, FileText, User, MapPin, DollarSign } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"

interface NfeEmissionDialogProps {
    pedidoId: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function NfeEmissionDialog({ pedidoId, open, onOpenChange, onSuccess }: NfeEmissionDialogProps) {
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(false)
    const [draft, setDraft] = useState<any>(null)
    const [payload, setPayload] = useState<any>(null)
    const [extras, setExtras] = useState<any>({})
    const { toast } = useToast()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open && pedidoId) {
            loadDraft()
        } else {
            setDraft(null)
            setPayload(null)
            setExtras({})
            setError(null)
        }
    }, [open, pedidoId])

    const loadDraft = async () => {
        setInitializing(true)
        setError(null)
        try {
            const res = await fetch(`/api/nfe/draft?pedidoId=${pedidoId}`)
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || "Falha ao carregar rascunho")

            setDraft(data)
            setPayload(data.initialPayload)

            // Inicializa extras se necessário, ou deixa vazio para preencher
            // Se já tiver valor no payload (ex: se factory tivesse lógica de preencher), manteria.
        } catch (err: any) {
            console.error(err)
            setError(err.message)
        } finally {
            setInitializing(false)
        }
    }

    const updatePayload = (path: string, value: any) => {
        setPayload((prev: any) => {
            const newPayload = JSON.parse(JSON.stringify(prev))
            const parts = path.split('.')
            let current = newPayload
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) current[parts[i]] = {}
                current = current[parts[i]]
            }
            current[parts[parts.length - 1]] = value
            return newPayload
        })
    }

    const handleEmit = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/nfe/issue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pedidoId,
                    extras,
                    overridePayload: payload // OQ O USUÁRIO EDITOU É O QUE VALE
                }),
            })

            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Erro na emissão da NF")

            toast({
                title: "Nota Fiscal Emitida!",
                description: `Número: ${json.number || 'Aguardando'} - Status: ${json.status}`,
                variant: "default",
                className: "bg-green-600 text-white border-none"
            })

            onSuccess?.()
            onOpenChange(false)
        } catch (err: any) {
            toast({
                title: "Falha na Emissão",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle>Emitir Nota Fiscal de Serviço (Revisão)</DialogTitle>
                    <DialogDescription>
                        Revise e edite todos os campos antes de confirmar. O que você vê aqui será enviado para a Prefeitura.
                    </DialogDescription>
                </DialogHeader>

                {initializing ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Calculando impostos e gerando rascunho...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-6">
                        <div className="p-4 bg-red-100 rounded-full">
                            <AlertTriangle className="h-10 w-10 text-red-600" />
                        </div>
                        <h3 className="font-semibold text-lg">Não foi possível preparar a nota</h3>
                        <p className="text-sm text-muted-foreground max-w-md bg-slate-50 p-2 rounded border font-mono text-xs">{error}</p>
                        <Button variant="outline" onClick={loadDraft}>Tentar Novamente</Button>
                    </div>
                ) : payload ? (
                    <Tabs defaultValue="tomador" className="flex-1 flex flex-col overflow-hidden min-h-0">
                        <TabsList className="mx-6 mt-4 w-auto justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                            <TabsTrigger value="tomador" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-3 bg-transparent font-medium text-muted-foreground ring-offset-0 focus-visible:ring-0 focus-visible:outline-none">
                                <User className="w-4 h-4 mr-2" />
                                Tomador
                            </TabsTrigger>
                            <TabsTrigger value="endereco" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-3 bg-transparent font-medium text-muted-foreground ring-offset-0 focus-visible:ring-0 focus-visible:outline-none">
                                <MapPin className="w-4 h-4 mr-2" />
                                Endereço
                            </TabsTrigger>
                            <TabsTrigger value="servico" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-3 bg-transparent font-medium text-muted-foreground ring-offset-0 focus-visible:ring-0 focus-visible:outline-none">
                                <FileText className="w-4 h-4 mr-2" />
                                Serviço
                            </TabsTrigger>
                            <TabsTrigger value="valores" className="data-[state=active]:border-primary data-[state=active]:text-primary border-b-2 border-transparent rounded-none px-2 py-3 bg-transparent font-medium text-muted-foreground ring-offset-0 focus-visible:ring-0 focus-visible:outline-none">
                                <DollarSign className="w-4 h-4 mr-2" />
                                Valores & Impostos
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-3xl mx-auto space-y-6">

                                {/* ABA TOMADOR */}
                                <TabsContent value="tomador" className="space-y-4 m-0">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2 col-span-2">
                                            <Label>Razão Social / Nome</Label>
                                            <Input
                                                value={payload.borrower.name}
                                                onChange={e => updatePayload('borrower.name', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>CNPJ / CPF (Apenas números)</Label>
                                            <Input
                                                value={payload.borrower.federalTaxNumber}
                                                onChange={e => updatePayload('borrower.federalTaxNumber', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>E-mail</Label>
                                            <Input
                                                value={payload.borrower.email}
                                                onChange={e => updatePayload('borrower.email', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Inscrição Municipal</Label>
                                            <Input
                                                value={payload.borrower.municipalTaxNumber}
                                                onChange={e => updatePayload('borrower.municipalTaxNumber', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {draft.requiredExtras?.length > 0 && (
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-4 mt-6">
                                            <h4 className="font-semibold text-blue-900 flex items-center gap-2 text-sm">
                                                <AlertTriangle className="h-4 w-4" />
                                                Campos Específicos (Obrigatórios)
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                {draft.requiredExtras.map((field: string) => (
                                                    <div key={field} className="space-y-2">
                                                        <Label htmlFor={field} className="capitalize">{field === 'codigoObra' ? 'CNO / Código de Obra' : field}</Label>
                                                        <Input
                                                            id={field}
                                                            value={extras[field] || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value
                                                                setExtras({ ...extras, [field]: val })

                                                                if (field === 'codigoObra' && payload) {
                                                                    let currentInfo = payload.additionalInformation || ''
                                                                    const label = 'Cod. Obra: '

                                                                    if (currentInfo.includes(label)) {
                                                                        // Atualiza linha existente baseada na label
                                                                        const lines = currentInfo.split('\n')
                                                                        const newLines = lines.map((line: string) =>
                                                                            line.includes(label) ? `${label}${val}` : line
                                                                        )
                                                                        updatePayload('additionalInformation', newLines.join('\n'))
                                                                    } else {
                                                                        // Adiciona nova linha
                                                                        const separator = currentInfo.length > 0 && !currentInfo.endsWith('\n') ? '\n' : ''
                                                                        updatePayload('additionalInformation', `${currentInfo}${separator}${label}${val}`)
                                                                    }
                                                                }
                                                            }}
                                                            className="bg-white"
                                                            placeholder="Ex: 12345"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* ABA ENDEREÇO */}
                                <TabsContent value="endereco" className="space-y-4 m-0">
                                    <div className="grid grid-cols-6 gap-4">
                                        <div className="col-span-2 space-y-2">
                                            <Label>CEP</Label>
                                            <Input
                                                value={payload.borrower.address.postalCode}
                                                onChange={e => updatePayload('borrower.address.postalCode', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-4 space-y-2">
                                            <Label>Logradouro (Rua, Av...)</Label>
                                            <Input
                                                value={payload.borrower.address.street}
                                                onChange={e => updatePayload('borrower.address.street', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <Label>Número</Label>
                                            <Input
                                                value={payload.borrower.address.number}
                                                onChange={e => updatePayload('borrower.address.number', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-4 space-y-2">
                                            <Label>Complemento</Label>
                                            <Input
                                                value={payload.borrower.address.additionalInformation}
                                                onChange={e => updatePayload('borrower.address.additionalInformation', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-3 space-y-2">
                                            <Label>Bairro</Label>
                                            <Input
                                                value={payload.borrower.address.district}
                                                onChange={e => updatePayload('borrower.address.district', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <Label>Cidade</Label>
                                            <Input
                                                value={payload.borrower.address.city.name}
                                                onChange={e => updatePayload('borrower.address.city.name', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-1 space-y-2">
                                            <Label>UF</Label>
                                            <Input
                                                value={payload.borrower.address.state}
                                                onChange={e => updatePayload('borrower.address.state', e.target.value)}
                                                maxLength={2}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-2">
                                            <Label>Código IBGE (Opcional)</Label>
                                            <Input
                                                value={payload.borrower.address.city.code || ""}
                                                onChange={e => updatePayload('borrower.address.city.code', e.target.value)}
                                                placeholder="Ex: 3304557"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* ABA SERVIÇO */}
                                <TabsContent value="servico" className="space-y-4 m-0">
                                    <div className="space-y-2">
                                        <Label>Descrição Completa do Serviço</Label>
                                        <Textarea
                                            value={payload.description}
                                            onChange={e => updatePayload('description', e.target.value)}
                                            className="min-h-[120px] font-mono text-sm"
                                        />
                                    </div>
                                    {draft.companyId !== 'fc84183542f046f686b991fb479b7daf' && (
                                        <div className="space-y-2">
                                            <Label>Outras Informações / Observações Legais</Label>
                                            <Textarea
                                                value={payload.additionalInformation}
                                                onChange={e => updatePayload('additionalInformation', e.target.value)}
                                                className="min-h-[100px] font-mono text-sm"
                                            />
                                            <p className="text-xs text-muted-foreground">Inclua leis, decretos ou observações obrigatórias aqui.</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Código do Serviço Municipal</Label>
                                            <Input
                                                value={payload.cityServiceCode}
                                                onChange={e => updatePayload('cityServiceCode', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* ABA VALORES */}
                                <TabsContent value="valores" className="space-y-6 m-0">
                                    <div className="p-4 bg-slate-50 border rounded-lg space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-lg font-semibold">Valor Total do Serviço (R$)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={payload.servicesAmount}
                                                onChange={e => updatePayload('servicesAmount', parseFloat(e.target.value) || 0)}
                                                className="text-xl font-mono h-12"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-4 border p-4 rounded-lg">
                                            <Label className="font-semibold">Retenção de ISS</Label>
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="iss-retained"
                                                    checked={payload.issRetained}
                                                    onCheckedChange={(checked) => updatePayload('issRetained', checked)}
                                                />
                                                <Label htmlFor="iss-retained">ISS Retido na Fonte?</Label>
                                            </div>
                                            {payload.issRetained && (
                                                <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded border border-blue-100">
                                                    O valor e a alíquota do ISS serão calculados automaticamente pela Nfe.io com base no código de serviço e município.
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground">Habilite apenas se o tomador for responsável pelo recolhimento (ex: Órgão Público).</p>
                                        </div>

                                        {/* Outros impostos podem ser adicionados aqui se necessário */}
                                    </div>
                                </TabsContent>

                            </div>
                        </div>
                    </Tabs>
                ) : null}

                <DialogFooter className="p-6 border-t bg-slate-50">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        onClick={handleEmit}
                        disabled={loading || initializing || !payload}
                        className="min-w-[150px]"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                        Emitir Nota Agora
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
