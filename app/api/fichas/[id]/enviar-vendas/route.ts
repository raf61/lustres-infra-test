import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { mapFichaToClientData } from "@/domain/client/transform"
import { getLoggedUserId } from "@/lib/vendor-dashboard"
import { makeClientVisibleInDashboard } from "@/domain/client/vendor-dashboard-rules"

// Remove formatação do CNPJ para comparação
const normalizeCnpj = (cnpj: string) => cnpj.trim().replace(/\D/g, "")

// Formata CNPJ: 00.000.000/0000-00
const formatCnpj = (cnpj: string) => {
  const digits = cnpj.trim().replace(/\D/g, "")
  if (digits.length !== 14) return cnpj
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Obtém o ID do usuário logado
    const currentUserId = await getLoggedUserId()

    if (!currentUserId) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 })
    }

    const { id } = await params
    const fichaId = Number.parseInt(id, 10)

    if (Number.isNaN(fichaId)) {
      return NextResponse.json({ error: "ID da ficha inválido" }, { status: 400 })
    }

    // Buscar a ficha com os gerentes associados
    const ficha = await (prisma.ficha.findUnique as any)({
      where: { id: fichaId },
      include: {
        gerentesAdministradora: {
          select: { gerenteId: true },
        },
      },
    }) as {
      id: number
      cnpj: string
      razaoSocial: string | null
      fichaStatus: string
      ultimaManutencao: Date | null
      cep: string | null
      logradouro: string | null
      numero: string | null
      complemento: string | null
      bairro: string | null
      estado: string | null
      cidade: string | null
      telefoneCondominio: string | null
      celularCondominio: string | null
      nomeSindico: string | null
      telefoneSindico: string | null
      dataInicioMandato: Date | null
      dataFimMandato: Date | null
      dataAniversarioSindico: Date | null
      emailSindico: string | null
      nomePorteiro: string | null
      telefonePorteiro: string | null
      quantidadeSPDA: number | null
      quantidadeAndares: number | null
      especificacaoCondominio: string | null
      observacao: string | null
      dataContatoAgendado: Date | null
      administradoraId: number | null
      gerentesAdministradora: { gerenteId: number }[]
    } | null

    if (!ficha) {
      return NextResponse.json({ error: "Ficha não encontrada" }, { status: 404 })
    }

    if (ficha.fichaStatus === "FINALIZADA") {
      return NextResponse.json(
        { error: "Esta ficha já foi enviada para vendas" },
        { status: 400 }
      )
    }

    // Normaliza e formata o CNPJ da ficha para buscar cliente existente
    const cnpjNormalizado = normalizeCnpj(ficha.cnpj)
    const cnpjFormatado = formatCnpj(ficha.cnpj)

    // Executar transação para garantir atomicidade
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buscar cliente existente pelo CNPJ (com ou sem formatação)
      const clienteExistente = await tx.client.findFirst({
        where: {
          OR: [
            { cnpj: ficha.cnpj },
            { cnpj: cnpjNormalizado },
            { cnpj: cnpjFormatado },
          ],
        },
        select: { id: true },
      })

      let cliente: { id: number }

      const dadosCliente = mapFichaToClientData(ficha)

      // Buscar o último log da ficha para identificar quem a trabalhou nela por último
      const lastLog = await tx.fichaLog.findFirst({
        where: { fichaId },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { role: true } } },
      })

      const targetVendedorId = lastLog?.user?.role === "VENDEDOR" ? lastLog.userId : undefined
      const extraData = targetVendedorId ? { vendedor: { connect: { id: targetVendedorId } } } : {}

      if (clienteExistente) {
        // Atualiza cliente existente
        cliente = await tx.client.update({
          where: { id: clienteExistente.id },
          data: {
            ...dadosCliente,
            ...extraData,
          },
          select: { id: true },
        })
      } else {
        // Cria novo cliente com CNPJ formatado
        cliente = await tx.client.create({
          data: {
            cnpj: cnpjFormatado,
            ...dadosCliente,
            ...extraData,
          },
          select: { id: true },
        })
      }

      if (targetVendedorId) {
        await makeClientVisibleInDashboard(tx, {
          clientId: cliente.id,
          vendedorId: targetVendedorId,
          category: "EXPLORADO",
          reason: "Ficha enviada da pesquisa para vendas",
        })
      }

      // 2. Transferir gerentes da ficha para o cliente
      if (ficha.gerentesAdministradora.length > 0) {
        // Primeiro, remove vínculos existentes do cliente com os mesmos gerentes (evita duplicação)
        await (tx as any).gerenteAdministradoraVinculo.deleteMany({
          where: {
            clientId: cliente.id,
            gerenteId: { in: ficha.gerentesAdministradora.map((g: { gerenteId: number }) => g.gerenteId) },
          },
        })

        // Atualiza os vínculos da ficha para apontar para o cliente
        for (const g of ficha.gerentesAdministradora) {
          await (tx as any).gerenteAdministradoraVinculo.update({
            where: { fichaId_gerenteId: { fichaId: fichaId, gerenteId: g.gerenteId } },
            data: { clientId: cliente.id, fichaId: null },
          })
        }
      }

      // 3. Atualizar status da ficha para FINALIZADA
      await tx.ficha.update({
        where: { id: fichaId },
        data: { fichaStatus: "FINALIZADA" },
      })

      // 4. Criar FichaLog do tipo ENVIADO
      await tx.fichaLog.create({
        data: {
          fichaId: fichaId,
          tipo: "ENVIADO",
          userId: currentUserId,
        },
      })

      return cliente
    })

    return NextResponse.json({
      message: "Ficha enviada para vendas com sucesso",
      clienteId: result.id,
    })
  } catch (error) {
    console.error("[FICHA_ENVIAR_VENDAS]", error)
    return NextResponse.json(
      { error: "Erro ao enviar ficha para vendas" },
      { status: 500 }
    )
  }
}

