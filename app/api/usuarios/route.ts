import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET: listar todos os usuários
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const roleParam = searchParams.get("role")
    const limitParam = searchParams.get("limit")
    const take = limitParam ? Number.parseInt(limitParam, 10) || 100 : 100

    const usuarios = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      where: roleParam ? { role: roleParam as any } : undefined,
      take,
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

    return NextResponse.json({ data: usuarios })
  } catch (error) {
    console.error("[USUARIOS_GET]", error)
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 })
  }
}

// POST: criar novo usuário
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { name, fullname, email, role, password } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios" },
        { status: 400 }
      )
    }

    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está cadastrado" },
        { status: 400 }
      )
    }

    // Gerar ID numérico sequencial
    const allUsers = await prisma.user.findMany({
      select: { id: true },
    })

    // Pega o maior ID numérico existente e incrementa
    let nextId = 1
    for (const user of allUsers) {
      const numId = Number.parseInt(user.id, 10)
      if (!Number.isNaN(numId) && numId >= nextId) {
        nextId = numId + 1
      }
    }

    // Hash para senha
    const bcrypt = await import("bcryptjs")
    const passwordHash = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
      data: {
        id: String(nextId),
        name,
        fullname: fullname || null,
        email,
        role: role || "VENDEDOR",
        passwordHash,
        active: true,
      },
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

    return NextResponse.json({ data: newUser }, { status: 201 })
  } catch (error) {
    console.error("[USUARIOS_POST]", error)
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 })
  }
}

