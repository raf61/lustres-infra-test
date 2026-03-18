import { PrismaClient, VisitaTecnicaStatus } from "@prisma/client"

type ChecklistItem = {
  itemId: number
  nome: string
  quantidade: number
  condicoes: string
}

type SalvarChecklistInput = {
  visitaId: number
  checklist: ChecklistItem[]
}

async function salvarChecklist(
  prisma: PrismaClient,
  input: SalvarChecklistInput
) {
  const visita = await prisma.visitaTecnica.findUnique({
    where: { id: input.visitaId },
    select: { status: true, checklist: true },
  })

  if (!visita) {
    throw new Error("Visita técnica não encontrada.")
  }

  if (visita.status !== VisitaTecnicaStatus.EM_EXECUCAO) {
    throw new Error("Checklist só pode ser salvo durante a execução.")
  }

  if (visita.checklist !== null) {
    throw new Error("Checklist já foi salvo para esta visita.")
  }

  const updated = await prisma.visitaTecnica.update({
    where: { id: input.visitaId },
    data: { checklist: input.checklist as any },
    select: { id: true, checklist: true },
  })

  return updated
}

export async function salvarChecklistNormal(
  prisma: PrismaClient,
  input: SalvarChecklistInput
) {
  return salvarChecklist(prisma, input)
}

export async function salvarChecklistOs(
  _prisma: PrismaClient,
  _input: SalvarChecklistInput
) {
  throw new Error("Checklist não disponível para Ordem de Serviço.")
}


