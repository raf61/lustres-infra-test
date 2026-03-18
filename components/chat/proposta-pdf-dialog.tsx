import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatPhone } from "@/lib/formatters"

type PropostaEmpresaKey = "EBR" | "FRANKLIN"

type PropostaPdfDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClient?: { id: number; razaoSocial: string } | null
  defaultContactName?: string | null
  defaultConsultorNome?: string | null
  defaultConsultorCelular?: string | null
  defaultConsultorEmail?: string | null
}

const normalizeTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

const parseNumber = (value: string) => Number(String(value).replace(",", "."))

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 })

const formatDatePtBr = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" })
  return formatter.format(date)
}

const getNextDefaultVencimento = (reference = new Date()) => {
  const base = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const candidates: Date[] = []
  const days = [5, 10, 20]

  for (const day of days) {
    const currentMonthDate = new Date(base.getFullYear(), base.getMonth(), day)
    if (currentMonthDate >= base) {
      candidates.push(currentMonthDate)
    } else {
      candidates.push(new Date(base.getFullYear(), base.getMonth() + 1, day))
    }
  }

  candidates.sort((a, b) => a.getTime() - b.getTime())
  return candidates[0]
}

export function PropostaPdfDialog({
  open,
  onOpenChange,
  defaultClient,
  defaultContactName,
  defaultConsultorNome,
  defaultConsultorCelular,
  defaultConsultorEmail,
}: PropostaPdfDialogProps) {
  const { toast } = useToast()
  const [empresa, setEmpresa] = useState<PropostaEmpresaKey>("EBR")
  const [razaoSocial, setRazaoSocial] = useState("")
  const [vocativo, setVocativo] = useState("")
  const [produto, setProduto] = useState("Manutencao em SPDA")
  const [valorUnitario, setValorUnitario] = useState("510")
  const [numeroParcelas, setNumeroParcelas] = useState("5")
  const [primeiroVencimento, setPrimeiroVencimento] = useState("")
  const [garantiaMeses, setGarantiaMeses] = useState("12")
  const [consultorNome, setConsultorNome] = useState("")
  const [consultorCelular, setConsultorCelular] = useState("")
  const [consultorEmail, setConsultorEmail] = useState("")

  const [cnpj, setCnpj] = useState("")
  const [endereco, setEndereco] = useState("")
  const [cnpjEmpresa, setCnpjEmpresa] = useState("")
  const [conclusaoDias, setConclusaoDias] = useState("10")
  const [clientUf, setClientUf] = useState<string | null>(null)
  const [filiais, setFiliais] = useState<any[]>([])
  const [filialMap, setFilialMap] = useState<Record<number, Record<string, string | null>>>({})

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const id = defaultClient?.id
    if (!id) return

    const fetchData = async () => {
      try {
        const [clientRes, filiaisRes, mapRes] = await Promise.all([
          fetch(`/api/clients/${id}`),
          fetch("/api/filiais"),
          fetch("/api/filiais/map")
        ])

        if (clientRes.ok) {
          const clientData = await clientRes.json()
          setRazaoSocial(normalizeTitleCase(clientData.razaoSocial))
          setCnpj(clientData.cnpj || "")
          setClientUf(clientData.estado || null)

          const addr = [
            clientData.logradouro ? `${clientData.logradouro}${clientData.numero ? `, ${clientData.numero}` : ""}` : null,
            clientData.complemento,
            [clientData.bairro, clientData.cidade, clientData.estado].filter(Boolean).join(" - ")
          ].filter(Boolean).join(" | ")
          setEndereco(addr)
        }

        if (filiaisRes.ok) {
          const { data } = await filiaisRes.json()
          setFiliais(data)
        }

        if (mapRes.ok) {
          const { data } = await mapRes.json()
          setFilialMap(data)
        }
      } catch (err) {
        console.error("Erro ao buscar dados do cliente/filiais/map:", err)
      }
    }

    fetchData()

    const nomeContato = defaultContactName?.trim() ?? ""
    setVocativo(nomeContato ? `Prezado Sr. ${normalizeTitleCase(nomeContato)}` : "")
    setProduto("Manutenção em SPDA")
    setValorUnitario("510")
    setNumeroParcelas("5")
    setPrimeiroVencimento(formatDatePtBr(getNextDefaultVencimento()))
    setGarantiaMeses("12")
    setEmpresa("EBR")
    setConclusaoDias("10")
    setConsultorNome(defaultConsultorNome?.trim() ?? "")
    const initialCelular = defaultConsultorCelular?.trim() || (empresa === "EBR" ? "0800-123-0133" : "4003-1571")
    setConsultorCelular(initialCelular)
    setConsultorEmail(defaultConsultorEmail?.trim() ?? "")
  }, [open, defaultClient?.id, defaultContactName])

  // Lógica para resolver o CNPJ da empresa (filial)
  useEffect(() => {
    if (!clientUf || filiais.length === 0 || Object.keys(filialMap).length === 0) return

    const empresaId = empresa === "EBR" ? 1 : 2
    const targetUf = filialMap[empresaId]?.[clientUf]

    if (targetUf) {
      const filial = filiais.find(f => f.empresaId === empresaId && f.uf === targetUf)
      if (filial) {
        setCnpjEmpresa(filial.cnpj)
      }
    } else {
      // Fallback padrão se não encontrar mapeamento
      setCnpjEmpresa(empresa === "EBR" ? "51.621.017/0001-05" : "00.000.000/0001-00")
    }
  }, [empresa, clientUf, filiais, filialMap])

  // Atualiza o celular padrão quando a empresa muda (se não houver um customizado)
  useEffect(() => {
    const defaultEbr = "0800-123-0133"
    const defaultFranklin = "4003-1571"

    setConsultorCelular(prev => {
      // Se era o padrão da EBR e mudou pra Franklin
      if (prev === defaultEbr && empresa === "FRANKLIN") return defaultFranklin
      // Se era o padrão da Franklin e mudou pra EBR
      if (prev === defaultFranklin && empresa === "EBR") return defaultEbr
      // Se está vazio, coloca o padrão
      if (!prev.trim()) return empresa === "EBR" ? defaultEbr : defaultFranklin
      return prev
    })
  }, [empresa])


  const handleSubmit = async () => {
    if (!razaoSocial.trim() || !vocativo.trim() || !produto.trim()) {
      toast({
        title: "Preencha os campos obrigatorios",
        description: "Razao social, vocativo e produto sao obrigatorios.",
        variant: "destructive",
      })
      return
    }
    if (!primeiroVencimento.trim()) {
      toast({
        title: "Preencha o primeiro vencimento",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/orcamentos/proposta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa,
          razaoSocial,
          vocativo,
          produto,
          valorPorEquipamento: 1,
          valorUnitario: parseNumber(valorUnitario),
          subtotal: parseNumber(valorUnitario),
          numeroParcelas: parseNumber(numeroParcelas),
          primeiraParcela: primeiroVencimento,
          garantiaMeses: parseNumber(garantiaMeses),
          consultorNome,
          consultorCelular,
          consultorEmail,
          cnpj,
          endereco,
          cnpjEmpresa,
          conclusaoDias: parseNumber(conclusaoDias),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Nao foi possivel gerar o PDF.")
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get("content-disposition") ?? ""
      const fileNameMatch = contentDisposition.match(/filename="(.+?)"/)
      const fileName = fileNameMatch?.[1] ?? "proposta-orcamento.pdf"

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast({ description: "PDF gerado com sucesso." })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Erro ao gerar PDF",
        description: error instanceof Error ? error.message : "Nao foi possivel gerar o PDF.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDF de proposta</DialogTitle>
          <DialogDescription>Preencha os dados para gerar a proposta em PDF.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 text-sm">
          <div className="grid gap-2">
            <Label>Empresa</Label>
            <Select value={empresa} onValueChange={(value) => setEmpresa(value as PropostaEmpresaKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EBR">EBR</SelectItem>
                <SelectItem value="FRANKLIN">Franklin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Razao social</Label>
            <Input value={razaoSocial} onChange={(event) => setRazaoSocial(event.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Vocativo</Label>
            <Input value={vocativo} onChange={(event) => setVocativo(event.target.value)} />
          </div>

          {/* <div className="grid gap-2">
            <Label>Produto</Label>
            <Input value={produto} onChange={(event) => setProduto(event.target.value)} />
          </div> */}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Valor unitário</Label>
              <Input value={valorUnitario} onChange={(event) => setValorUnitario(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Número de parcelas</Label>
              <Input value={numeroParcelas} onChange={(event) => setNumeroParcelas(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Primeiro vencimento</Label>
              <Input
                value={primeiroVencimento}
                onChange={(event) => setPrimeiroVencimento(event.target.value)}
                placeholder="10 de Agosto de 2025"
              />
            </div>
            <div className="grid gap-2">
              <Label>Garantia (meses)</Label>
              <Input value={garantiaMeses} onChange={(event) => setGarantiaMeses(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>CNPJ do Cliente</Label>
              <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Dias para conclusão</Label>
              <Input value={conclusaoDias} onChange={(event) => setConclusaoDias(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Endereço</Label>
            <Input value={endereco} onChange={(event) => setEndereco(event.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>CNPJ da Empresa (Filial)</Label>
            <Input value={cnpjEmpresa} onChange={(event) => setCnpjEmpresa(event.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>Consultor(a)</Label>
            <Input value={consultorNome} onChange={(event) => setConsultorNome(event.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Celular (Vendedor ou Central)</Label>
              <Input
                value={consultorCelular}
                onChange={(event) => setConsultorCelular(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={consultorEmail} onChange={(event) => setConsultorEmail(event.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Gerando..." : "Gerar PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

