"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Building2, Loader2, MapPin, Phone, Shield } from "lucide-react"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { FilialEditDialog } from "@/components/filiais/filial-edit-dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { maskCNPJ, maskCEP, maskPhone } from "@/lib/formatters"
import { cn } from "@/lib/utils"

type DadosCadastrais = {
  razao_social?: string
  logradouro?: string
  numero?: string
  complemento?: string
  municipio?: string
  bairro?: string
  cep?: string
  tel?: string
}

export type Filial = {
  id: number
  empresaId: number
  cnpj: string
  uf: string
  dadosCadastrais: DadosCadastrais | null
  inscricao_municipal: string | null
  cod_atividade: string | null
  empresa?: { id: number; nome: string | null }
}

const EMPRESAS_TABS = [
  { id: 1, nome: "Empresa Brasileira de Raios" },
  { id: 2, nome: "Franklin Instalações" },
]

const fallbackDados: DadosCadastrais = {
  razao_social: "",
  logradouro: "",
  numero: "",
  complemento: "",
  municipio: "",
  bairro: "",
  cep: "",
  tel: "",
}

export function FiliaisDashboard() {
  const [selectedEmpresa, setSelectedEmpresa] = useState(String(EMPRESAS_TABS[0].id))
  const [filiais, setFiliais] = useState<Filial[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const empresaSelecionada = useMemo(
    () => EMPRESAS_TABS.find((item) => String(item.id) === selectedEmpresa),
    [selectedEmpresa],
  )

  const loadFiliais = useCallback(
    async (empresaId: number) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/filiais?empresaId=${empresaId}`)
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error || "Erro ao buscar filiais")
        }
        const json = await res.json()
        setFiliais(Array.isArray(json?.data) ? json.data : [])
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : "Erro ao buscar filiais")
        setFiliais([])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    loadFiliais(Number(selectedEmpresa)).catch(console.error)
  }, [loadFiliais, selectedEmpresa])

  const handleUpdated = (updated: Filial) => {
    setFiliais((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Filiais
            </h1>
            <p className="text-muted-foreground">Gestão de filiais por empresa</p>
          </div>
        </div>

        <Tabs value={selectedEmpresa} onValueChange={setSelectedEmpresa} className="w-full">
          <div className="flex mb-4">
            <TabsList className="inline-flex rounded-2xl border border-slate-300 bg-white p-0 shadow-sm overflow-hidden">
              {EMPRESAS_TABS.map((empresa, index) => (
                <TabsTrigger
                  key={empresa.id}
                  value={String(empresa.id)}
                  className={cn(
                    "px-6 py-3 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-blue-600 data-[state=active]:text-white",
                    index < EMPRESAS_TABS.length - 1 ? "border-r border-slate-300" : "",
                  )}
                >
                  {empresa.nome}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {EMPRESAS_TABS.map((empresa) => (
            <TabsContent key={empresa.id} value={String(empresa.id)}>
              <Card className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">{empresa.nome}</CardTitle>
                    <p className="text-sm text-muted-foreground">Filiais cadastradas</p>
                  </div>
                  <Badge variant="secondary">{filiais.length} filiais</Badge>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando filiais...
                    </div>
                  ) : error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : filiais.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma filial encontrada.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>CNPJ</TableHead>
                          <TableHead>UF</TableHead>
                          <TableHead>Razão Social</TableHead>
                          <TableHead>Endereço</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filiais.map((filial) => {
                          const dados = filial.dadosCadastrais ?? fallbackDados
                          return (
                            <TableRow key={filial.id} className="border-border">
                              <TableCell className="font-medium">{maskCNPJ(filial.cnpj)}</TableCell>
                              <TableCell>{filial.uf}</TableCell>
                              <TableCell>{dados.razao_social || "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                  <span>
                                    {[dados.logradouro, dados.numero].filter(Boolean).join(", ") || "—"}
                                    {dados.bairro ? ` - ${dados.bairro}` : ""}
                                    {dados.municipio ? `, ${dados.municipio}` : ""}
                                    {dados.cep ? ` • ${maskCEP(dados.cep)}` : ""}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" />
                                    {dados.tel ? maskPhone(dados.tel) : "—"}
                                  </div>
                                  {filial.inscricao_municipal && (
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-4 w-4" />
                                      <span className="text-xs">Inscr. Mun.: {filial.inscricao_municipal}</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <FilialEditDialog filial={filial} onSaved={handleUpdated} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

