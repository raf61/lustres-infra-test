"use client"

import { RefObject, ReactNode, FormEvent, ChangeEvent } from "react"
import { Filter, Database, Search, Loader2, Phone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Máscara de telefone: (00) 00000-0000 ou (00) 0000-0000
function formatPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export interface EstadoOption {
  sigla: string
  nome: string
}

export interface LeadsFilterCardProps {
  // Total count display
  totalCount: number
  totalLabel: string

  // Loading state
  loading?: boolean

  // Search refs
  generalSearchRef: RefObject<HTMLInputElement | null>
  bairroInputRef: RefObject<HTMLInputElement | null>
  telefoneInputRef?: RefObject<HTMLInputElement | null>

  // Estado/Cidade
  estadoOptions: EstadoOption[]
  cidadeOptions: string[]
  selectedEstado: string
  selectedCidade: string
  onEstadoChange: (value: string) => void
  onCidadeChange: (value: string) => void

  // Actions
  onSearchSubmit: () => void
  onClearFilters: () => void

  // Extra filters slot (Vendedor, Limite, Categoria, etc.)
  extraFilters?: ReactNode

  // Auto submit on select change (not text fields)
  autoSubmitOnSelectChange?: boolean

  // Active filter indicators (for blue border highlight)
  activeFilters?: {
    search?: boolean
    estado?: boolean
    cidade?: boolean
    bairro?: boolean
    telefone?: boolean
  }
}

const activeFilterClass = "ring-2 ring-blue-500 border-blue-500"

export function LeadsFilterCard({
  totalCount,
  totalLabel,
  loading = false,
  generalSearchRef,
  bairroInputRef,
  telefoneInputRef,
  estadoOptions,
  cidadeOptions,
  selectedEstado,
  selectedCidade,
  onEstadoChange,
  onCidadeChange,
  onSearchSubmit,
  onClearFilters,
  extraFilters,
  autoSubmitOnSelectChange = false,
  activeFilters = {},
}: LeadsFilterCardProps) {
  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSearchSubmit()
  }

  const handleEstadoChangeWithAutoSubmit = (value: string) => {
    onEstadoChange(value)
    if (autoSubmitOnSelectChange) {
      // Use setTimeout to ensure state update happens first
      setTimeout(() => onSearchSubmit(), 0)
    }
  }

  const handleCidadeChangeWithAutoSubmit = (value: string) => {
    onCidadeChange(value)
    if (autoSubmitOnSelectChange) {
      setTimeout(() => onSearchSubmit(), 0)
    }
  }

  return (
    <Card className="border-border bg-card sm:gap-0">
      <CardHeader className="pb-3 sm:gap-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{totalCount}</span>
            <span className="text-sm text-muted-foreground">{totalLabel}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <form className="flex flex-wrap items-end gap-3" onSubmit={handleFormSubmit}>

          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Busca Geral</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome, cidade, bairro..."
                ref={generalSearchRef}
                className={`pl-8 h-8 text-sm bg-background border-border text-foreground ${activeFilters.search ? activeFilterClass : ""}`}
              />
            </div>
          </div>
          <Button type="submit" className="h-8 px-4 text-sm" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </form>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <Select value={selectedEstado} onValueChange={handleEstadoChangeWithAutoSubmit}>
              <SelectTrigger className={`h-8 w-[100px] text-sm bg-background border-border ${activeFilters.estado ? activeFilterClass : ""}`}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Todos</SelectItem>
                {estadoOptions.map((estado) => (
                  <SelectItem key={estado.sigla} value={estado.sigla}>
                    {estado.sigla}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cidade</label>
            <Select value={selectedCidade} onValueChange={handleCidadeChangeWithAutoSubmit} disabled={selectedEstado === "all"}>
              <SelectTrigger className={`h-8 w-[140px] text-sm bg-background border-border ${activeFilters.cidade ? activeFilterClass : ""}`}>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Todas</SelectItem>
                {cidadeOptions.map((cidade) => (
                  <SelectItem key={cidade} value={cidade}>
                    {cidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">Bairro</div>
            <Input
              placeholder="Bairro..."
              ref={bairroInputRef}
              className={`h-8 w-[120px] text-sm bg-background border-border ${activeFilters.bairro ? activeFilterClass : ""}`}
            />
          </div>

          {telefoneInputRef && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Telefone</div>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="(00) 00000-0000"
                  inputMode="tel"
                  ref={telefoneInputRef}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    e.target.value = formatPhoneMask(e.target.value)
                  }}
                  className={`h-8 w-[170px] pl-8 text-sm bg-background border-border ${activeFilters.telefone ? activeFilterClass : ""}`}
                />
              </div>
            </div>
          )}



          {extraFilters}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground self-end"
          >
            Limpar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

