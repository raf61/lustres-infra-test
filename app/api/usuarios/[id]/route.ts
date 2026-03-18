import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { cleanupVendorAssignments } from "@/domain/client/vendor-deactivation"

// GET: buscar usuário por ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const usuario = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        fullname: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!usuario) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    return NextResponse.json({ data: usuario })
  } catch (error) {
    console.error("[USUARIO_GET_BY_ID]", error)
    return NextResponse.json({ error: "Erro ao buscar usuário" }, { status: 500 })
  }
}

// PUT: atualizar usuário
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Nota: desativação (active: false) só pode ser feita via DELETE.
    // Reativação (active: true) pode ser feita via PUT.
    const { name, fullname, email, role, active, password } = body

    // Verificar se usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    // Bloquear tentativa de desativar via PUT
    if (active === false) {
      return NextResponse.json(
        { error: "Para desativar um usuário, use o botão de desativar" },
        { status: 400 }
      )
    }

    // Verificar se novo email já está em uso por outro usuário
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email },
      })
      if (emailInUse) {
        return NextResponse.json(
          { error: "Este email já está sendo usado por outro usuário" },
          { status: 400 }
        )
      }
    }

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (fullname !== undefined) updateData.fullname = fullname || null
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role
    if (active === true) updateData.active = true // Apenas reativação é permitida

    // Se uma nova senha foi fornecida, fazer hash
    if (password) {
      const bcrypt = await import("bcryptjs")
      updateData.passwordHash = await bcrypt.hash(password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        fullname: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ data: updatedUser })
  } catch (error) {
    console.error("[USUARIO_PUT]", error)
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 })
  }
}

// DELETE: desativar usuário (soft delete)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 })
    }

    // Se for vendedor, limpar suas atribuições de clientes antes de desativar
    if (existingUser.role === "VENDEDOR" && existingUser.active) {
      await cleanupVendorAssignments(
        prisma,
        id,
        "Vendedor desativado via soft delete"
      )
    }

    // Soft delete - apenas desativar
    await prisma.user.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json({ message: "Usuário desativado com sucesso" })
  } catch (error) {
    console.error("[USUARIO_DELETE]", error)
    return NextResponse.json({ error: "Erro ao desativar usuário" }, { status: 500 })
  }
}
