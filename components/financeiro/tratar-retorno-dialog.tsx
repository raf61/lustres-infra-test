"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { FileUp, Upload, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface TratarRetornoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ResultadoItem {
  sucesso: boolean
  mensagem: string
  debitoId: number
  cliente?: string
  valorReceber?: number
  valorRecebido?: number
  vencimento?: string
  codigoOcorrencia?: number
  codigoMovimento?: number // Para Santander CNAB 240
  descricaoOcorrencia?: string
  tipo: "baixado" | "ja_baixado" | "nao_localizado" | "erro" | "rejeitado" | "sem_compensacao" | "id_invalido"
}

interface ResultadoRetorno {
  totalTratados: number
  totalErros: number
  nomeArquivo: string
  resultados: ResultadoItem[]
}

// Bancos suportados para leitura de retorno
const BANCOS_SUPORTADOS = [
  { codigo: 341, nome: "Itaú", cnab: "400" },
  { codigo: 33, nome: "Santander", cnab: "240" },
]

export function TratarRetornoDialog({ open, onOpenChange }: TratarRetornoDialogProps) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [bancoSelecionado, setBancoSelecionado] = useState<string>("341")
  const [processando, setProcessando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoRetorno | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setArquivo(file)
      setResultado(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setArquivo(file)
      setResultado(null)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleSubmit = async () => {
    if (!arquivo) {
      toast({ variant: "destructive", title: "Selecione um arquivo" })
      return
    }

    if (!bancoSelecionado) {
      toast({ variant: "destructive", title: "Selecione um banco" })
      return
    }

    setProcessando(true)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append("arquivo", arquivo)
      formData.append("bancoCodigo", bancoSelecionado)

      const res = await fetch("/api/retornos", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar arquivo")
      }

      setResultado(data.data)

      if (data.data.totalTratados > 0) {
        toast({
          title: "Retorno processado",
          description: `${data.data.totalTratados} título(s) baixado(s) com sucesso.`,
        })
      } else if (data.data.totalErros > 0) {
        toast({
          variant: "destructive",
          title: "Processamento concluído com erros",
          description: `${data.data.totalErros} erro(s) encontrado(s).`,
        })
      } else {
        toast({
          title: "Processamento concluído",
          description: "Nenhuma baixa realizada.",
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido"
      toast({ variant: "destructive", title: "Erro", description: message })
    } finally {
      setProcessando(false)
    }
  }

  const handleClose = () => {
    if (!processando) {
      setArquivo(null)
      setResultado(null)
      onOpenChange(false)
    }
  }

  const getIconForTipo = (tipo: ResultadoItem["tipo"]) => {
    switch (tipo) {
      case "baixado":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "ja_baixado":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case "nao_localizado":
      case "erro":
      case "rejeitado":
      case "id_invalido":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "sem_compensacao":
        return <AlertCircle className="h-4 w-4 text-orange-500" />
      default:
        return null
    }
  }

  const getBadgeForTipo = (tipo: ResultadoItem["tipo"]) => {
    switch (tipo) {
      case "baixado":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500">Baixado</Badge>
      case "ja_baixado":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500">Já baixado</Badge>
      case "nao_localizado":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500">Não localizado</Badge>
      case "erro":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500">Erro</Badge>
      case "rejeitado":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500">Rejeitado</Badge>
      case "sem_compensacao":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500">Sem compensação</Badge>
      case "id_invalido":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500">ID inválido</Badge>
      default:
        return null
    }
  }

  // Filtra apenas os tipos relevantes: baixas (pagamentos reais) e erros
  const resultadosFiltrados = resultado?.resultados.filter(item => {
    const tiposErro = ["erro", "nao_localizado", "rejeitado", "id_invalido", "ja_baixado"]
    if (tiposErro.includes(item.tipo)) return true

    // Para "baixado", queremos APENAS os que foram realmente pagos/liquidados (que geraram baixa no sistema)
    // O backend envia "Título Baixado no Sistema." para liquidações.
    // Outras ocorrências (como "Entrada confirmada") também vêm como "baixado" (sucesso=true), mas não queremos mostrá-las.
    if (item.tipo === "baixado") {
      return item.mensagem === "Título Baixado no Sistema."
    }

    return false
  })

  // Recalcular totais baseados no filtro para exibição no resumo
  const totalBaixadosReais = resultadosFiltrados?.filter(i => i.tipo === "baixado").length || 0
  const totalErrosReais = resultadosFiltrados?.filter(i => i.tipo !== "baixado").length || 0

  const handlePrint = () => {
    if (!resultado || !resultadosFiltrados) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({ variant: "destructive", title: "Erro", description: "Permita popups para imprimir." })
      return
    }

    const html = `
      <html>
        <head>
          <title>Relatório de Processamento de Retorno</title>
          <style>
            body { font-family: monospace; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 5px; text-align: left; }
            h1 { font-size: 16px; margin-bottom: 5px; }
            .summary { margin-bottom: 20px; }
            .error { color: red; font-weight: bold; }
            .success { color: green; }
          </style>
        </head>
        <body>
          <h1>Relatório de Retorno Bancário</h1>
          <div class="summary">
            <p><strong>Arquivo:</strong> ${resultado.nomeArquivo}</p>
            <p><strong>Data Impressão:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            <p><strong>Baixas Realizadas:</strong> ${totalBaixadosReais}</p>
            <p><strong>Erros/Alertas:</strong> ${totalErrosReais}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Cliente</th>
                <th>Vencimento</th>
                <th>Valor Recebido</th>
                <th>Status</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>
              ${resultadosFiltrados.map(item => `
                <tr>
                  <td>${item.debitoId}</td>
                  <td>${item.cliente || '-'}</td>
                  <td>${item.vencimento ? new Date(item.vencimento).toLocaleDateString("pt-BR") : '-'}</td>
                  <td>${item.valorRecebido ? `R$ ${item.valorRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : '-'}</td>
                  <td class="${item.tipo === 'baixado' ? 'success' : 'error'}">${item.tipo.toUpperCase()}</td>
                  <td>${item.mensagem}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Tratar Retorno Bancário
          </DialogTitle>
          <DialogDescription>
            Faça upload do arquivo de retorno CNAB para processar as baixas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Seleção de banco */}
          <div className="space-y-2">
            <Label htmlFor="banco">Banco</Label>
            <Select value={bancoSelecionado} onValueChange={setBancoSelecionado} disabled={processando}>
              <SelectTrigger id="banco">
                <SelectValue placeholder="Selecione o banco" />
              </SelectTrigger>
              <SelectContent>
                {BANCOS_SUPORTADOS.map((banco) => (
                  <SelectItem key={banco.codigo} value={banco.codigo.toString()}>
                    {banco.nome} (CNAB {banco.cnab})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload de arquivo */}
          <div className="space-y-2">
            <Label>Arquivo de Retorno</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${arquivo ? "border-green-500 bg-green-500/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ret,.txt,.RET,.TXT"
                onChange={handleFileChange}
                className="hidden"
                disabled={processando}
              />
              {arquivo ? (
                <div className="flex items-center justify-center gap-2 text-green-500">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{arquivo.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({(arquivo.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique ou arraste o arquivo de retorno aqui
                  </p>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: .RET, .TXT</p>
                </div>
              )}
            </div>
          </div>

          {/* Resultados */}
          {resultado && (
            <div className="space-y-3 flex-1 overflow-hidden">
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{resultado.totalTratados} baixado(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">{resultado.totalErros} erro(s)</span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button variant="ghost" size="sm" className="h-8 gap-2" onClick={handlePrint}>
                    <span className="sr-only">Imprimir</span>
                    🖨️ Imprimir
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[250px] rounded-lg border">
                <div className="p-3 space-y-2">
                  {resultadosFiltrados?.map((item, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${item.tipo === "baixado"
                        ? "bg-green-500/5 border-green-500/20"
                        : item.tipo === "ja_baixado" || item.tipo === "sem_compensacao"
                          ? "bg-yellow-500/5 border-yellow-500/20"
                          : item.tipo === "nao_localizado" || item.tipo === "erro" || item.tipo === "rejeitado" || item.tipo === "id_invalido"
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-muted"
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        {getIconForTipo(item.tipo)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">Título #{item.debitoId}</span>
                            {getBadgeForTipo(item.tipo)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.mensagem}</p>
                          {item.cliente && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Cliente: {item.cliente}
                              {item.valorRecebido !== undefined && (
                                <> | Recebido: R$ {item.valorRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {resultadosFiltrados?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma baixa ou erro encontrado neste arquivo.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={processando}>
            {resultado ? "Fechar" : "Cancelar"}
          </Button>
          {!resultado && (
            <Button onClick={handleSubmit} disabled={!arquivo || processando}>
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Processar Retorno
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

