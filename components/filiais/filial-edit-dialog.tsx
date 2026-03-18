"use client"

import { useEffect, useState } from "react"
import { Loader2, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { maskCEP, maskCNPJ, maskPhone } from "@/lib/formatters"

import type { Filial } from "./filiais-dashboard"

type FormState = {
  razao_social: string
  logradouro: string
  numero: string
  complemento: string
  municipio: string
  bairro: string
  cep: string
  tel: string
  inscricao_municipal: string
  cod_atividade: string
}

const defaultState: FormState = {
  razao_social: "",
  logradouro: "",
  numero: "",
  complemento: "",
  municipio: "",
  bairro: "",
  cep: "",
  tel: "",
  inscricao_municipal: "",
  cod_atividade: "",
}

interface FilialEditDialogProps {
  filial: Filial
  onSaved?: (filial: Filial) => void
}

export function FilialEditDialog({ filial, onSaved }: FilialEditDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(defaultState)

  useEffect(() => {
    const dados = filial.dadosCadastrais ?? {}
    setForm({
      razao_social: dados.razao_social ?? "",
      logradouro: dados.logradouro ?? "",
      numero: dados.numero ?? "",
      complemento: dados.complemento ?? "",
      municipio: dados.municipio ?? "",
      bairro: dados.bairro ?? "",
      cep: dados.cep ?? "",
      tel: dados.tel ?? "",
      inscricao_municipal: filial.inscricao_municipal ?? "",
      cod_atividade: filial.cod_atividade ?? "",
    })
  }, [filial, open])

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const payload = {
        dadosCadastrais: {
          razao_social: form.razao_social,
          logradouro: form.logradouro,
          numero: form.numero,
          complemento: form.complemento,
          municipio: form.municipio,
          bairro: form.bairro,
          cep: form.cep.replace(/\D/g, ""),
          tel: form.tel.replace(/\D/g, ""),
        },
        inscricao_municipal: form.inscricao_municipal || null,
        cod_atividade: form.cod_atividade || null,
      }

      const res = await fetch(`/api/filiais/${filial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null)
        throw new Error(errorBody?.error || "Erro ao salvar filial")
      }

      const json = await res.json()
      const saved = json?.data as Filial
      onSaved?.(saved)
      toast({ title: "Filial atualizada", description: "Dados salvos com sucesso." })
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : "Não foi possível salvar a filial.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edição da filial</DialogTitle>
          <p className="text-sm text-muted-foreground">
            CNPJ e UF não são editáveis. Ajuste somente os dados cadastrais.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input value={maskCNPJ(filial.cnpj)} disabled />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Input value={filial.uf} disabled />
          </div>

          <div className="space-y-2">
            <Label>Razão Social</Label>
            <Input value={form.razao_social} onChange={(e) => updateField("razao_social", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Inscrição Municipal</Label>
            <Input
              value={form.inscricao_municipal}
              onChange={(e) => updateField("inscricao_municipal", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Logradouro</Label>
            <Input value={form.logradouro} onChange={(e) => updateField("logradouro", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={form.numero} onChange={(e) => updateField("numero", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Município</Label>
            <Input value={form.municipio} onChange={(e) => updateField("municipio", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input value={form.complemento} onChange={(e) => updateField("complemento", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={maskCEP(form.cep)} onChange={(e) => updateField("cep", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={maskPhone(form.tel)} onChange={(e) => updateField("tel", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Atividade Principal</Label>
            <Input value={form.cod_atividade} onChange={(e) => updateField("cod_atividade", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

