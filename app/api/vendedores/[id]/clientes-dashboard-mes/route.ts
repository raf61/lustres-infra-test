import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

interface HistoricoEvento {
  type: string
  category: string | null
  createdAt: Date
}

interface DistribuicaoCategoria {
  categoria: string
  quantidade: number
}

/**
 * Retorna a contagem de clientes únicos que passaram pelo dashboard do vendedor
 * durante o mês especificado (ou mês atual se não especificado).
 * 
 * Também retorna:
 * - Distribuição por categoria dos clientes que ENTRARAM no dashboard
 * - Quantidade de clientes que SAÍRAM do dashboard até o fim do mês
 * 
 * Lógica: Um cliente é contado se esteve no dashboard em qualquer momento do mês.
 * Isso significa que teve um INDASH antes ou durante o mês E 
 * (não teve OUTDASH OU o OUTDASH foi durante ou após o início do mês)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: vendedorId } = await params
    const searchParams = request.nextUrl.searchParams
    
    const now = new Date()
    const mesParam = searchParams.get("mes")
    const anoParam = searchParams.get("ano")
    
    const mesSelecionado = mesParam ? parseInt(mesParam, 10) : now.getMonth() + 1
    const anoSelecionado = anoParam ? parseInt(anoParam, 10) : now.getFullYear()
    
    // Período do mês selecionado
    const inicioMes = new Date(anoSelecionado, mesSelecionado - 1, 1)
    const fimMes = new Date(anoSelecionado, mesSelecionado, 0, 23, 59, 59, 999)

    // Buscar todos os eventos INDASH e OUTDASH do vendedor
    const historico = await prisma.historicoClient.findMany({
      where: {
        vendedorId: vendedorId,
      },
      orderBy: {
        createdAt: "asc"
      }
    })

    // Agrupar por cliente
    const eventosPorCliente = new Map<number, HistoricoEvento[]>()
    
    for (const evento of historico) {
      if (!eventosPorCliente.has(evento.clientId)) {
        eventosPorCliente.set(evento.clientId, [])
      }
      eventosPorCliente.get(evento.clientId)!.push({
        type: evento.type,
        category: evento.category,
        createdAt: evento.createdAt
      })
    }

    let count = 0
    const categoriasEntrada = new Map<string, number>() // Distribuição por categoria (INDASH)
    let saidasNoMes = 0 // Quantos clientes saíram (OUTDASH) no mês

    // Para cada cliente, verificar se esteve no dashboard em algum momento do período
    for (const [, eventos] of eventosPorCliente) {
      // Ordenar eventos por data
      eventos.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      
      // Construir intervalos de presença no dashboard
      // Cada INDASH inicia um intervalo, cada OUTDASH fecha
      let dentroIntervalo = false
      let inicioIntervalo: Date | null = null
      let categoriaEntrada: string | null = null
      let clienteContado = false
      let clienteSaiuNoMes = false
      
      for (const evento of eventos) {
        if (evento.type === "INDASH") {
          if (!dentroIntervalo) {
            dentroIntervalo = true
            inicioIntervalo = evento.createdAt
            categoriaEntrada = evento.category
          }
        } else if (evento.type === "OUTDASH") {
          if (dentroIntervalo && inicioIntervalo) {
            // Verificar se este intervalo [inicioIntervalo, evento.createdAt] 
            // intersecta com [inicioMes, fimMes]
            if (inicioIntervalo <= fimMes && evento.createdAt >= inicioMes) {
              if (!clienteContado) {
                count++
                clienteContado = true
                
                // Registrar categoria de entrada (do INDASH)
                const cat = categoriaEntrada ?? "SEM_CATEGORIA"
                categoriasEntrada.set(cat, (categoriasEntrada.get(cat) || 0) + 1)
              }
              
              // Verificar se o OUTDASH foi dentro do mês
              if (evento.createdAt >= inicioMes && evento.createdAt <= fimMes && !clienteSaiuNoMes) {
                saidasNoMes++
                clienteSaiuNoMes = true
              }
            }
            dentroIntervalo = false
            inicioIntervalo = null
            categoriaEntrada = null
          }
        }
      }
      
      // Se ainda está dentro de um intervalo (sem OUTDASH), considera até agora
      if (!clienteContado && dentroIntervalo && inicioIntervalo) {
        // Intervalo [inicioIntervalo, now] - se intersecta com [inicioMes, fimMes]
        if (inicioIntervalo <= fimMes) {
          count++
          
          // Registrar categoria de entrada (do INDASH)
          const cat = categoriaEntrada ?? "SEM_CATEGORIA"
          categoriasEntrada.set(cat, (categoriasEntrada.get(cat) || 0) + 1)
        }
      }
    }

    const labelMes = inicioMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

    // Converter mapa de categorias para array ordenado
    const distribuicaoCategorias: DistribuicaoCategoria[] = Array.from(categoriasEntrada.entries())
      .map(([categoria, quantidade]) => ({ categoria, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)

    return NextResponse.json({
      mes: mesSelecionado,
      ano: anoSelecionado,
      label: labelMes,
      clientesNoDashboard: count,
      distribuicaoCategorias, // Distribuição por categoria dos que ENTRARAM
      saidasNoMes, // Quantos SAÍRAM durante o mês
    })
  } catch (error) {
    console.error("Erro ao buscar clientes no dashboard por mês:", error)
    return NextResponse.json(
      { error: "Erro ao buscar dados" },
      { status: 500 }
    )
  }
}
