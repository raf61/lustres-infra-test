"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, FileText, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { formatCurrency, formatCurrencyExtenso, formatNumberExtenso, formatCNPJ, formatCEP, formatLocalDate, parseLocalDate } from "@/lib/formatters"
import { Checkbox } from "@/components/ui/checkbox"

interface GenerateContratoModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contrato: any | null
}

export function GenerateContratoModal({ open, onOpenChange, contrato }: GenerateContratoModalProps) {
    const { toast } = useToast()
    const [generating, setGenerating] = useState(false)
    const [saveToDb, setSaveToDb] = useState(true)

    // Form state
    const [formData, setFormData] = useState<any>({
        cnpj_empresa: "54.621.017/0001-05", // Valores padrão da EBR
        endereco_empresa: "Rua Maria Calmon 34",
        bairro_empresa: "Méier",
        cidade_empresa: "Rio de Janeiro",
        uf_empresa: "RJ",
        razao_social_cliente: "",
        cnpj_cliente: "",
        endereco_cliente: "",
        bairo_cliente: "",
        cidade_cliente: "",
        estado_cliente: "",
        cep_cliente: "",
        nome_sindico: "",
        cpf_sindico: "",
        valor_cobrado_formatado_em_reais: "",
        valor_cobrado_extenso: "",
        porcentagem_desconto_segundo_ano: "10%",
        valor_segundo_ano_formatado: "",
        valor_segundo_ano_extenso: "",
        numero_parcelas: "",
        numero_parcelas_extenso: "",
        valor_parcelas: "",
        valor_parcelas_extenso: "",
        dia_vencimento_padrao: "10",
        cidade_foro: "Rio de Janeiro",
        uf_foro: "RJ",
        nome_cidade_assinatura_contrato: "Rio de Janeiro",
        dia_assinatura_contrato: formatLocalDate(new Date(), "dd"),
        mes_assinatura_contrato_extenso: formatLocalDate(new Date(), "MMMM"),
        ano_assinatura_contrato: formatLocalDate(new Date(), "yyyy"),
        id_contrato: "",
        ano_contrato: "",
        valor_total_formatado: "",
        valor_total_extenso: "",
        observacoes: ""
    })

    useEffect(() => {
        if (open && contrato) {
            const c = contrato;
            const descontoPercentual = 10; // 10% padrão
            const numParcelas = 10; // 10 parcelas padrão

            // Se o contrato já tem valorTotal salvo no DB, deriva v1 e v2
            // Fórmula: total = v1 + v1*(1-d) = v1*(2-d) → v1 = total / (2-d)
            let valorPrimeiroAno: number;
            let valorSegundoAno: number;
            const savedTotal = c.valorTotal;

            if (savedTotal && savedTotal > 0) {
                const d = descontoPercentual / 100;
                valorPrimeiroAno = Math.round((savedTotal / (2 - d)) * 100) / 100;
                valorSegundoAno = Math.round((savedTotal - valorPrimeiroAno) * 100) / 100;
            } else {
                valorPrimeiroAno = 500; // Valor padrão
                valorSegundoAno = valorPrimeiroAno * (1 - (descontoPercentual / 100));
            }

            const valorTotal = valorPrimeiroAno + valorSegundoAno;
            const valorPorParcela = valorTotal / numParcelas;

            setFormData({
                cnpj_empresa: "51.621.017/0001-05",
                endereco_empresa: "Rua Maria Calmon, 34",
                bairro_empresa: "Méier",
                cidade_empresa: "Rio de Janeiro",
                uf_empresa: "RJ",
                razao_social_cliente: c.cliente?.razaoSocial || "",
                cnpj_cliente: formatCNPJ(c.cliente?.cnpj) || "",
                endereco_cliente: `${c.cliente?.logradouro || ""}, ${c.cliente?.numero || ""}${c.cliente?.complemento ? " - " + c.cliente?.complemento : ""}`,
                bairo_cliente: c.cliente?.bairro || "",
                cidade_cliente: c.cliente?.cidade || "",
                estado_cliente: c.cliente?.estado || "",
                cep_cliente: formatCEP(c.cliente?.cep) || "",
                nome_sindico: c.cliente?.nomeSindico || "",
                cpf_sindico: "", // Ainda não temos no banco
                valor_cobrado_formatado_em_reais: formatCurrency(valorPrimeiroAno),
                valor_cobrado_extenso: formatCurrencyExtenso(valorPrimeiroAno),
                porcentagem_desconto_segundo_ano: `${descontoPercentual}%`,
                valor_segundo_ano_formatado: formatCurrency(valorSegundoAno),
                valor_segundo_ano_extenso: formatCurrencyExtenso(valorSegundoAno),
                numero_parcelas: numParcelas.toString(),
                numero_parcelas_extenso: formatNumberExtenso(numParcelas),
                valor_parcelas: formatCurrency(valorPorParcela),
                valor_parcelas_extenso: formatCurrencyExtenso(valorPorParcela),
                dia_vencimento_padrao: "10",
                cidade_foro: c.cliente?.cidade || "Rio de Janeiro",
                uf_foro: c.cliente?.estado || "RJ",
                nome_cidade_assinatura_contrato: "Rio de Janeiro",
                dia_assinatura_contrato: formatLocalDate(new Date(), "dd"),
                mes_assinatura_contrato_extenso: formatLocalDate(new Date(), "MMMM"),
                ano_assinatura_contrato: formatLocalDate(new Date(), "yyyy"),
                id_contrato: c.id.toString(),
                ano_contrato: formatLocalDate(c.dataInicio, "yyyy"),
                valor_total_formatado: formatCurrency(valorTotal),
                valor_total_extenso: formatCurrencyExtenso(valorTotal),
                observacoes: c.observacoes || ""
            })
        }
    }, [open, contrato])

    const handleGenerate = async () => {
        if (!contrato) return
        try {
            setGenerating(true)
            const res = await fetch(`/api/contratos/${contrato.id}/docx`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, __saveToDb: saveToDb })
            })

            if (!res.ok) throw new Error("Erro ao gerar documento")

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `contrato_${contrato.id}_personalizado.docx`
            document.body.appendChild(a)
            a.click()
            a.remove()

            toast({ title: "Sucesso", description: "Documento gerado com sucesso!" })
            onOpenChange(false)
        } catch (error) {
            toast({ title: "Erro", description: "Falha ao gerar documento", variant: "destructive" })
        } finally {
            setGenerating(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData((prev: any) => {
            const next = { ...prev, [name]: value }

            const getNumeric = (val: string) => parseFloat(val.replace(/[^\d,]/g, "").replace(",", "."))

            // Lógica de auto-preenchimento
            if (name === "valor_cobrado_formatado_em_reais") {
                const v1 = getNumeric(value)
                if (!isNaN(v1)) {
                    next.valor_cobrado_extenso = formatCurrencyExtenso(v1)
                    const descStr = prev.porcentagem_desconto_segundo_ano.replace("%", "")
                    const desc = parseFloat(descStr) / 100 || 0
                    const v2 = v1 * (1 - desc)
                    next.valor_segundo_ano_formatado = formatCurrency(v2)
                    next.valor_segundo_ano_extenso = formatCurrencyExtenso(v2)

                    // Recalcula total
                    const total = v1 + v2
                    next.valor_total_formatado = formatCurrency(total)
                    next.valor_total_extenso = formatCurrencyExtenso(total)

                    // Recalcula parcela
                    const n = parseInt(prev.numero_parcelas)
                    if (!isNaN(n) && n > 0) {
                        const vp = (v1 + v2) / n
                        next.valor_parcelas = formatCurrency(vp)
                        next.valor_parcelas_extenso = formatCurrencyExtenso(vp)
                    }
                }
            }

            if (name === "porcentagem_desconto_segundo_ano") {
                const descVal = parseFloat(value.replace("%", ""))
                if (!isNaN(descVal)) {
                    const desc = descVal / 100
                    const v1 = getNumeric(prev.valor_cobrado_formatado_em_reais)
                    if (!isNaN(v1)) {
                        const v2 = v1 * (1 - desc)
                        next.valor_segundo_ano_formatado = formatCurrency(v2)
                        next.valor_segundo_ano_extenso = formatCurrencyExtenso(v2)

                        // Recalcula total
                        const total = v1 + v2
                        next.valor_total_formatado = formatCurrency(total)
                        next.valor_total_extenso = formatCurrencyExtenso(total)

                        // Recalcula parcela
                        const n = parseInt(prev.numero_parcelas)
                        if (!isNaN(n) && n > 0) {
                            const vp = (v1 + v2) / n
                            next.valor_parcelas = formatCurrency(vp)
                            next.valor_parcelas_extenso = formatCurrencyExtenso(vp)
                        }
                    }
                }
            }

            if (name === "numero_parcelas") {
                const n = parseInt(value)
                if (!isNaN(n)) {
                    next.numero_parcelas_extenso = formatNumberExtenso(n)
                    if (n > 0) {
                        const v1 = getNumeric(prev.valor_cobrado_formatado_em_reais)
                        const v2 = getNumeric(prev.valor_segundo_ano_formatado)
                        if (!isNaN(v1) && !isNaN(v2)) {
                            const vp = (v1 + v2) / n
                            next.valor_parcelas = formatCurrency(vp)
                            next.valor_parcelas_extenso = formatCurrencyExtenso(vp)
                        }
                    }
                }
            }

            if (name === "valor_parcelas") {
                const numeric = getNumeric(value)
                if (!isNaN(numeric)) next.valor_parcelas_extenso = formatCurrencyExtenso(numeric)
            }

            if (name === "valor_segundo_ano_formatado") {
                const v2 = getNumeric(value)
                if (!isNaN(v2)) {
                    next.valor_segundo_ano_extenso = formatCurrencyExtenso(v2)
                    // Recalcula parcela baseado no novo v2
                    const v1 = getNumeric(prev.valor_cobrado_formatado_em_reais)
                    const n = parseInt(prev.numero_parcelas)
                    const total = (isNaN(v1) ? 0 : v1) + v2
                    next.valor_total_formatado = formatCurrency(total)
                    next.valor_total_extenso = formatCurrencyExtenso(total)

                    if (!isNaN(v1) && !isNaN(n) && n > 0) {
                        const vp = (v1 + v2) / n
                        next.valor_parcelas = formatCurrency(vp)
                        next.valor_parcelas_extenso = formatCurrencyExtenso(vp)
                    }
                }
            }

            return next
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Personalizar Minuta de Contrato
                    </DialogTitle>
                    <DialogDescription>
                        Confirme ou altere os dados abaixo antes de gerar o documento DOCX.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    <div className="col-span-2 space-y-2">
                        <Label className="text-xs font-bold uppercase text-blue-600">Dados da Contratada (Empresa)</Label>
                        <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <div className="space-y-1">
                                <Label htmlFor="cnpj_empresa" className="text-[10px] uppercase">CNPJ Empresa</Label>
                                <Input id="cnpj_empresa" name="cnpj_empresa" value={formData.cnpj_empresa} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="endereco_empresa" className="text-[10px] uppercase">Endereço Empresa</Label>
                                <Input id="endereco_empresa" name="endereco_empresa" value={formData.endereco_empresa} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="col-span-2 grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="bairro_empresa" className="text-[10px] uppercase">Bairro Empresa</Label>
                                    <Input id="bairro_empresa" name="bairro_empresa" value={formData.bairro_empresa} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="cidade_empresa" className="text-[10px] uppercase">Cidade</Label>
                                    <Input id="cidade_empresa" name="cidade_empresa" value={formData.cidade_empresa} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="uf_empresa" className="text-[10px] uppercase">UF</Label>
                                    <Input id="uf_empresa" name="uf_empresa" value={formData.uf_empresa} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-2 space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Dados da Contratante (Cliente)</Label>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border">
                            <div className="space-y-1">
                                <Label htmlFor="razao_social_cliente" className="text-[10px] uppercase">Razão Social</Label>
                                <Input id="razao_social_cliente" name="razao_social_cliente" value={formData.razao_social_cliente} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cnpj_cliente" className="text-[10px] uppercase">CNPJ Cliente</Label>
                                <Input id="cnpj_cliente" name="cnpj_cliente" value={formData.cnpj_cliente} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="endereco_cliente" className="text-[10px] uppercase">Endereço</Label>
                                <Input id="endereco_cliente" name="endereco_cliente" value={formData.endereco_cliente} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bairo_cliente" className="text-[10px] uppercase">Bairro</Label>
                                <Input id="bairo_cliente" name="bairo_cliente" value={formData.bairo_cliente} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="cidade_cliente" className="text-[10px] uppercase">Cidade</Label>
                                    <Input id="cidade_cliente" name="cidade_cliente" value={formData.cidade_cliente} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="estado_cliente" className="text-[10px] uppercase">Estado</Label>
                                    <Input id="estado_cliente" name="estado_cliente" value={formData.estado_cliente} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="cep_cliente" className="text-[10px] uppercase">CEP</Label>
                                    <Input id="cep_cliente" name="cep_cliente" value={formData.cep_cliente} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Representante</Label>
                        <div className="space-y-3 bg-slate-50 p-3 rounded-lg border">
                            <div className="space-y-1">
                                <Label htmlFor="nome_sindico" className="text-[10px] uppercase">Nome do Síndico</Label>
                                <Input id="nome_sindico" name="nome_sindico" value={formData.nome_sindico} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="cpf_sindico" className="text-[10px] uppercase">CPF do Síndico</Label>
                                <Input id="cpf_sindico" name="cpf_sindico" value={formData.cpf_sindico} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Financeiro</Label>
                        <div className="space-y-3 bg-slate-50 p-3 rounded-lg border">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="valor_cobrado_formatado_em_reais" className="text-[10px] uppercase">Valor 1º Ano</Label>
                                    <Input id="valor_cobrado_formatado_em_reais" name="valor_cobrado_formatado_em_reais" value={formData.valor_cobrado_formatado_em_reais} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="porcentagem_desconto_segundo_ano" className="text-[10px] uppercase">Desc. 2º Ano</Label>
                                    <Input id="porcentagem_desconto_segundo_ano" name="porcentagem_desconto_segundo_ano" value={formData.porcentagem_desconto_segundo_ano} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="valor_segundo_ano_formatado" className="text-[10px] uppercase">Valor 2º Ano</Label>
                                <Input id="valor_segundo_ano_formatado" name="valor_segundo_ano_formatado" value={formData.valor_segundo_ano_formatado} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1 col-span-1">
                                    <Label htmlFor="numero_parcelas" className="text-[10px] uppercase">Nº Parc.</Label>
                                    <Input id="numero_parcelas" name="numero_parcelas" value={formData.numero_parcelas} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1 col-span-1">
                                    <Label htmlFor="dia_vencimento_padrao" className="text-[10px] uppercase">Dia Venc.</Label>
                                    <Input id="dia_vencimento_padrao" name="dia_vencimento_padrao" value={formData.dia_vencimento_padrao} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                                <div className="space-y-1 col-span-1">
                                    <Label htmlFor="valor_parcelas" className="text-[10px] uppercase">Vlr Parcela</Label>
                                    <Input id="valor_parcelas" name="valor_parcelas" value={formData.valor_parcelas} onChange={handleChange} className="h-8 text-xs" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-2 space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Cláusulas de Foro e Assinatura</Label>
                        <div className="grid grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border">
                            <div className="space-y-1">
                                <Label htmlFor="cidade_foro" className="text-[10px] uppercase">Cidade Foro</Label>
                                <Input id="cidade_foro" name="cidade_foro" value={formData.cidade_foro} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="uf_foro" className="text-[10px] uppercase">UF Foro</Label>
                                <Input id="uf_foro" name="uf_foro" value={formData.uf_foro} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="nome_cidade_assinatura_contrato" className="text-[10px] uppercase">Cidade Assinatura</Label>
                                <Input id="nome_cidade_assinatura_contrato" name="nome_cidade_assinatura_contrato" value={formData.nome_cidade_assinatura_contrato} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="dia_assinatura_contrato" className="text-[10px] uppercase">Dia</Label>
                                <Input id="dia_assinatura_contrato" name="dia_assinatura_contrato" value={formData.dia_assinatura_contrato} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="mes_assinatura_contrato_extenso" className="text-[10px] uppercase">Mês (Extenso)</Label>
                                <Input id="mes_assinatura_contrato_extenso" name="mes_assinatura_contrato_extenso" value={formData.mes_assinatura_contrato_extenso} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="ano_assinatura_contrato" className="text-[10px] uppercase">Ano</Label>
                                <Input id="ano_assinatura_contrato" name="ano_assinatura_contrato" value={formData.ano_assinatura_contrato} onChange={handleChange} className="h-8 text-xs" />
                            </div>
                        </div>
                    </div>

                    <div className="col-span-2 space-y-1">
                        <Label htmlFor="observacoes" className="text-[10px] uppercase font-bold text-slate-500">Observações Extras</Label>
                        <Textarea id="observacoes" name="observacoes" value={formData.observacoes} onChange={handleChange} rows={2} className="text-xs" />
                    </div>
                </div>

                <DialogFooter className="border-t pt-4 !flex-row flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="save-db-check"
                            checked={saveToDb}
                            onCheckedChange={(checked) => setSaveToDb(!!checked)}
                        />
                        <Label htmlFor="save-db-check" className="text-xs cursor-pointer text-slate-600">
                            Atualizar valor total no banco de dados
                        </Label>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={generating}>
                            Cancelar
                        </Button>
                        <Button onClick={handleGenerate} disabled={generating} className="bg-blue-600 hover:bg-blue-700">
                            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                            Gerar Documento DOCX
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
