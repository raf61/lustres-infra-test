"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, Search, Mail, Phone, User } from "lucide-react"
import { useState } from "react"
import { CadastroAdministradoraDialog } from "./cadastro-administradora-dialog"

const administradoras = [
  {
    id: "1",
    nome: "Administradora Prime",
    gerentes: [
      { nome: "Maria Santos", email: "maria@prime.com.br", telefone: "(21) 3333-4444" },
      { nome: "João Costa", email: "joao@prime.com.br", telefone: "(21) 3333-4445" },
    ],
    condominios: 15,
  },
  {
    id: "2",
    nome: "Gestão Total",
    gerentes: [{ nome: "Pedro Oliveira", email: "pedro@gestaototal.com.br", telefone: "(21) 2222-3333" }],
    condominios: 8,
  },
]

export function AdministradorasDashboard() {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Administradoras
            </h1>
            <p className="text-muted-foreground">Gestão de administradoras e seus gerentes</p>
          </div>
          <CadastroAdministradoraDialog />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Administradoras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{administradoras.length}</div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Gerentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {administradoras.reduce((acc, adm) => acc + adm.gerentes.length, 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Condomínios Atendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {administradoras.reduce((acc, adm) => acc + adm.condominios, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Buscar Administradoras</CardTitle>
            <CardDescription className="text-muted-foreground">
              Encontre administradoras e seus gerentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border text-foreground"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {administradoras.map((adm) => (
            <Card key={adm.id} className="border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">{adm.nome}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {adm.condominios} condomínios • {adm.gerentes.length} gerente(s)
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" className="border-border bg-transparent">
                    Editar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Gerentes ({adm.gerentes.length})</h3>
                  <p className="text-xs text-muted-foreground">Todos receberão cópia dos emails e documentos</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Nome</TableHead>
                      <TableHead className="text-muted-foreground">Email</TableHead>
                      <TableHead className="text-muted-foreground">Telefone</TableHead>
                      <TableHead className="text-muted-foreground">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adm.gerentes.map((gerente, index) => (
                      <TableRow key={index} className="border-border hover:bg-accent/5">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">{gerente.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {gerente.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {gerente.telefone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            Contatar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
