"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, X, UserPlus } from "lucide-react"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface Gerente {
  nome: string
  email: string
  telefone: string
}

export function CadastroAdministradoraDialog() {
  const [open, setOpen] = useState(false)
  const [nomeAdministradora, setNomeAdministradora] = useState("")
  const [gerentes, setGerentes] = useState<Gerente[]>([{ nome: "", email: "", telefone: "" }])

  const adicionarGerente = () => {
    setGerentes([...gerentes, { nome: "", email: "", telefone: "" }])
  }

  const removerGerente = (index: number) => {
    if (gerentes.length > 1) {
      setGerentes(gerentes.filter((_, i) => i !== index))
    }
  }

  const atualizarGerente = (index: number, campo: keyof Gerente, valor: string) => {
    const novosGerentes = [...gerentes]
    novosGerentes[index][campo] = valor
    setGerentes(novosGerentes)
  }

  const handleSubmit = () => {
    console.log("[v0] Cadastrando administradora:", {
      nome: nomeAdministradora,
      gerentes: gerentes.filter((g) => g.nome && g.email),
    })
    setOpen(false)
    // Reset form
    setNomeAdministradora("")
    setGerentes([{ nome: "", email: "", telefone: "" }])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Nova Administradora
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Nova Administradora</DialogTitle>
          <DialogDescription>
            Adicione uma nova administradora e seus gerentes. Uma administradora pode ter múltiplos gerentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Administradora</Label>
            <Input
              id="nome"
              placeholder="Ex: Administradora Prime"
              value={nomeAdministradora}
              onChange={(e) => setNomeAdministradora(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Gerentes</Label>
              <Button type="button" variant="outline" size="sm" onClick={adicionarGerente}>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar Gerente
              </Button>
            </div>

            <div className="space-y-3">
              {gerentes.map((gerente, index) => (
                <Card key={index} className="border-border bg-card/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`gerente-nome-${index}`}>Nome</Label>
                            <Input
                              id={`gerente-nome-${index}`}
                              placeholder="Nome do gerente"
                              value={gerente.nome}
                              onChange={(e) => atualizarGerente(index, "nome", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`gerente-email-${index}`}>Email</Label>
                            <Input
                              id={`gerente-email-${index}`}
                              type="email"
                              placeholder="email@exemplo.com"
                              value={gerente.email}
                              onChange={(e) => atualizarGerente(index, "email", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`gerente-telefone-${index}`}>Telefone</Label>
                            <Input
                              id={`gerente-telefone-${index}`}
                              placeholder="(21) 99999-9999"
                              value={gerente.telefone}
                              onChange={(e) => atualizarGerente(index, "telefone", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      {gerentes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removerGerente(index)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Cadastrar Administradora</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
