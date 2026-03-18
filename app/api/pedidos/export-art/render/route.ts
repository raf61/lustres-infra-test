import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

function formatCNPJ(cnpj: string | null): string {
  if (!cnpj) return "-"
  const clean = cnpj.replace(/\D/g, "")
  if (clean.length !== 14) return cnpj
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function formatAddress(cliente: {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
}): string {
  const parts = [
    cliente.logradouro,
    cliente.numero ? `nº ${cliente.numero}` : null,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade,
    cliente.estado,
    cliente.cep,
  ].filter(Boolean)
  return parts.join(", ") || "-"
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new NextResponse("Não autorizado", { status: 401 })
    }

    // Aceitar tanto JSON quanto form-data
    let pedidoIds: number[] = []
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      const body = await request.json()
      pedidoIds = body?.pedidoIds || []
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      const idsStr = formData.get("pedidoIds")
      if (typeof idsStr === "string") {
        try {
          pedidoIds = JSON.parse(idsStr)
        } catch {
          pedidoIds = []
        }
      }
    }

    if (!Array.isArray(pedidoIds) || pedidoIds.length === 0) {
      return new NextResponse("Nenhum pedido selecionado", { status: 400 })
    }

    // Buscar pedidos
    const pedidos = await prisma.pedido.findMany({
      where: {
        id: { in: pedidoIds },
      },
      select: {
        id: true,
        createdAt: true,
        cliente: {
          select: {
            id: true,
            razaoSocial: true,
            cnpj: true,
            cep: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            estado: true,
            quantidadeAndares: true,
            especificacaoCondominio: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    const today = formatDate(new Date())

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exportação ART - ${today}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
      color: white;
      padding: 30px 40px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      opacity: 0.85;
      font-size: 14px;
    }
    
    .summary {
      display: flex;
      justify-content: center;
      gap: 40px;
      padding: 20px 40px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .summary-item {
      text-align: center;
    }
    
    .summary-item .value {
      font-size: 32px;
      font-weight: 700;
      color: #1e3a5f;
    }
    
    .summary-item .label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .table-container {
      padding: 30px 40px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    
    thead {
      background: #1e3a5f;
      color: white;
    }
    
    th {
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    
    td {
      padding: 16px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    
    tr:hover {
      background: #f8fafc;
    }
    
    tr:nth-child(even) {
      background: #fafafa;
    }
    
    tr:nth-child(even):hover {
      background: #f1f5f9;
    }
    
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: #dcfce7;
      color: #166534;
    }
    
    .cliente-nome {
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 4px;
    }
    
    .cliente-cnpj {
      font-size: 12px;
      color: #64748b;
    }
    
    .endereco {
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
    }
    
    .footer {
      padding: 20px 40px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .container {
        box-shadow: none;
        border-radius: 0;
      }
      
      .header {
        background: #1e3a5f !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      thead {
        background: #1e3a5f !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Exportação para ART</h1>
      <div class="subtitle">Gerado em ${today} por ${session.user.email || session.user.name || "Usuário"}</div>
    </div>
    
    <div class="summary">
      <div class="summary-item">
        <div class="value">${pedidos.length}</div>
        <div class="label">Pedidos Exportados</div>
      </div>
      <div class="summary-item">
        <div class="value">${today}</div>
        <div class="label">Data da Exportação</div>
      </div>
    </div>
    
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width: 80px;">#</th>
            <th style="width: 100px;">Pedido</th>
            <th style="width: 120px;">Data</th>
            <th>Cliente</th>
            <th>Endereço</th>
            <th style="width: 100px;">Andares</th>
            <th style="width: 120px;">Tipo</th>
          </tr>
        </thead>
        <tbody>
          ${pedidos.map((pedido, index) => `
            <tr>
              <td>${index + 1}</td>
              <td><strong>#${pedido.id}</strong></td>
              <td>${formatDate(pedido.createdAt)}</td>
              <td>
                <div class="cliente-nome">${pedido.cliente?.razaoSocial || "-"}</div>
                <div class="cliente-cnpj">${formatCNPJ(pedido.cliente?.cnpj || null)}</div>
              </td>
              <td class="endereco">${pedido.cliente ? formatAddress(pedido.cliente) : "-"}</td>
              <td>${pedido.cliente?.quantidadeAndares || "-"}</td>
              <td>${pedido.cliente?.especificacaoCondominio || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      Sistema EBR • Exportação ART • ${pedidos.length} registro(s)
    </div>
  </div>
</body>
</html>
`

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("[EXPORT_ART_RENDER]", error)
    return new NextResponse("Erro ao gerar relatório", { status: 500 })
  }
}
