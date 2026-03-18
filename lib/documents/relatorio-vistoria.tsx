
import { DocumentoOperacionalTipo } from "@prisma/client"
import React from "react"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import fs from "fs/promises"
import path from "path"

import { getEmpresaContato, type EmpresaContato } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { resolveDocOperacionalAssinaturaUrl } from "@/lib/signatures"
import { storage } from "@/lib/storage"
import { resolveEmpresaLogoDataUrl } from "@/lib/documents/logo-utils"
import { resolveFilialId } from "@/app/api/orcamentos/filial-map"


type GenerateRelatorioParams = {
  pedidoId: number
  visitaId: number
  cnpjEmpresa?: string
}

type ChecklistSalvo = {
  itemId: number
  nome: string
  quantidade: number
  condicoes?: string
}

const currency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const buildEndereco = (cliente?: {
  razaoSocial: string
  cnpj: string
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
}) => {
  if (!cliente) return ""
  return [
    cliente.logradouro ? `${cliente.logradouro}${cliente.numero ? `, ${cliente.numero}` : ""}` : null,
    cliente.complemento,
    [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - "),
  ]
    .filter(Boolean)
    .join(" | ")
}

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingHorizontal: 22, paddingBottom: 16, fontSize: 9, fontFamily: "Helvetica" },
  row: { flexDirection: "row" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  table: { width: "100%", border: "1 solid #bfbfbf" },
  cell: {
    borderRight: "1 solid #bfbfbf",
    borderBottom: "1 solid #bfbfbf",
    padding: 5,
    justifyContent: "center",
  },
  bold: { fontWeight: "bold" },
})

type ProdutosDto = {
  nome: string
  condicoes: string
  quantidade: number | ""
  substituido: string
  precoUnitario: number
  total: number
}

type ServicosDto = { nome: string; valor: number; quantidade: number }

function RelatorioDoc(props: {
  logoDataUrl: string | null
  cnpjEmpresa: string
  clienteRazao: string
  clienteCnpj: string
  endereco: string
  numeroLaudo: string
  dataLaudo: string
  observacoes: string
  produtos: ProdutosDto[]
  servicos: ServicosDto[]
  valorTotal: number
  tecnicoNome: string
  vendedorNome: string
  qtdSpda: number
  // Assinatura do funcionário do prédio (responsável do condomínio)
  assinaturaFuncionarioPredio?: string | null
  assinaturaFuncionarioPredioNome?: string | null
  // Assinatura do técnico da empresa
  assinaturaTecnico?: string | null
  whatsappQrDataUrl?: string | null
  blankSignatures?: boolean
  empresaContato: EmpresaContato
  empresaNome: string | null
}) {
  const {
    logoDataUrl,
    clienteRazao,
    clienteCnpj,
    endereco,
    numeroLaudo,
    dataLaudo,
    observacoes,
    produtos,
    servicos,
    valorTotal,
    tecnicoNome,
    vendedorNome,
    qtdSpda,
    cnpjEmpresa,
    assinaturaFuncionarioPredio,
    assinaturaFuncionarioPredioNome,
    assinaturaTecnico,
    whatsappQrDataUrl,
    blankSignatures = false,
    empresaContato,
    empresaNome,
  } = props

  const produtosHeaders = ["Equipamento", "Condições", "Qtd.", "Substituído", "Preço unitário", "Preço total"]
  const produtosWidths = ["36%", "14%", "8%", "14%", "14%", "14%"]
  const vendedorNomeSafe = vendedorNome ?? ""

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Espaço topo */}
        <View style={{ paddingTop: 10 }} />

        {/* Header */}
        <View
          style={{
            border: "1 solid #bfbfbf",
            padding: 6,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <View style={{ width: "33%", padding: 4, alignItems: "center" }}>
            {logoDataUrl ? <Image src={logoDataUrl} style={{ width: 120, height: 60, objectFit: "contain" }} /> : null}
            <View style={{ marginTop: 4, gap: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 7, color: "#555" }}>{empresaContato.telefone}</Text>
              <Text style={{ fontSize: 7, color: "#555" }}>{empresaContato.email}</Text>
              <Text style={{ fontSize: 7, color: "#555" }}>{empresaContato.site}</Text>
            </View>
          </View>
          <View style={{ width: "34%", alignItems: "center", justifyContent: "center", gap: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: "bold", textAlign: "center" }}>{empresaNome ?? "Empresa Brasileira de Raios"}</Text>
            <Text style={{ fontSize: 8 }}>CNPJ: {cnpjEmpresa}</Text>
            {whatsappQrDataUrl ? (
              <Image src={whatsappQrDataUrl} style={{ width: 50, height: 50, marginTop: 1 }} />
            ) : null}
          </View>
          <View
            style={{
              width: "33%",
              border: "1 solid #bfbfbf",
              padding: 5,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "bold" }}>LAUDO TÉCNICO</Text>
            <Text style={{ fontSize: 10, marginTop: 3 }}>Pedido {numeroLaudo}</Text>
            <Text style={{ fontSize: 9, marginTop: 1 }}>{dataLaudo}</Text>
          </View>
        </View>

        {/* Dados cliente */}
        <View style={{ border: "1 solid #bfbfbf", padding: 7, marginBottom: 5 }}>
          <Text>
            <Text style={{ fontWeight: "bold" }}>Cliente:</Text> {clienteRazao}
          </Text>
          <Text>
            <Text style={{ fontWeight: "bold" }}>Endereço:</Text> {endereco}
          </Text>
          <Text>
            <Text style={{ fontWeight: "bold" }}>CNPJ:</Text> {clienteCnpj}
          </Text>
        </View>

        {/* Observações */}
        <View style={{ fontSize: 9, paddingTop: 8, paddingBottom: 8 }}>
          <Text>
            <Text style={{ fontWeight: "bold" }}>Observações:</Text> {observacoes}
          </Text>
        </View>

        {/* Título */}
        <View
          style={{
            border: "1 solid #bfbfbf",
            padding: 6,
            marginBottom: 6,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 9.5, fontWeight: "bold" }}>
            Relatório de medição em sistema de proteção contra descargas atmosféricas (SPDA)
          </Text>
        </View>

        {/* Tabela Produtos */}
        {/* IMPORTANTE: Preço unitário e preço total dos produtos ficam em branco (não exibe valores).
            Os valores de produtos NÃO são somados ao valor total do documento. */}
        <View style={{ width: "100%", border: "1 solid #bfbfbf", marginBottom: 4 }}>
          <View style={{ flexDirection: "row", backgroundColor: "#f2f2f2" }}>
            {produtosHeaders.map((h, idx) => (
              <View key={h} style={[styles.cell, { width: produtosWidths[idx] }]}>
                <Text style={{ fontSize: 9, fontWeight: "bold", textAlign: "center" }}>{h}</Text>
              </View>
            ))}
          </View>
          {(produtos.length
            ? produtos
            : [{ nome: "Sem produtos vinculados.", condicoes: "", quantidade: "", substituido: "", precoUnitario: 0, total: 0 }]
          ).map((p, idx) => (
            <View style={{ flexDirection: "row" }} key={`${p.nome}-${idx}`}>
              <View style={[styles.cell, { width: produtosWidths[0] }]}>
                <Text style={{ fontSize: 9 }}>{p.nome}</Text>
              </View>
              <View style={[styles.cell, { width: produtosWidths[1] }]}>
                <Text style={{ fontSize: 9 }}>
                  {p.condicoes}
                </Text>
              </View>
              <View style={[styles.cell, { width: produtosWidths[2] }]}>
                <Text style={{ fontSize: 9, textAlign: "center" }}>{p.quantidade ?? ""}</Text>
              </View>
              <View style={[styles.cell, { width: produtosWidths[3] }]}>
                <Text style={{ fontSize: 9, textAlign: "center" }}>{p.substituido ?? ""}</Text>
              </View>
              {/* Preço unitário: deixar em branco (não exibir valor) */}
              <View style={[styles.cell, { width: produtosWidths[4] }]}>
                <Text style={{ fontSize: 9, textAlign: "right" }}>{/* vazio */}</Text>
              </View>
              {/* Preço total: deixar em branco (não exibir valor) */}
              <View style={[styles.cell, { width: produtosWidths[5], borderRight: "0 solid transparent" }]}>
                <Text style={{ fontSize: 9, textAlign: "right" }}>{/* vazio */}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Serviços */}
        <View style={{ width: "100%", border: "1 solid #bfbfbf" }}>
          <View style={{ flexDirection: "row", backgroundColor: "#f2f2f2" }}>
            <View style={[styles.cell, { width: "70%" }]}>
              <Text style={{ fontSize: 9, fontWeight: "bold", textAlign: "center" }}>SERVIÇOS</Text>
            </View>
            <View style={[styles.cell, { width: "15%" }]}>
              <Text style={{ fontSize: 9, fontWeight: "bold", textAlign: "center" }}>Qtd.</Text>
            </View>
            <View style={[styles.cell, { width: "15%", borderRight: "0 solid transparent" }]}>
              <Text style={{ fontSize: 9, fontWeight: "bold", textAlign: "center" }}>Valor</Text>
            </View>
          </View>
          {(servicos.length ? servicos : [{ nome: "Sem serviços vinculados", valor: 0, quantidade: 0 }]).map((s, idx) => {
            const subtotal = (s.valor ?? 0)
            return (
              <View style={{ flexDirection: "row" }} key={`${s.nome}-${idx}`}>
                <View style={[styles.cell, { width: "70%" }]}>
                  <Text style={{ fontSize: 9 }}>{s.nome}</Text>
                </View>
                <View style={[styles.cell, { width: "15%", alignItems: "center" }]}>
                  <Text style={{ fontSize: 9, textAlign: "center" }}>{s.quantidade ?? 1}</Text>
                </View>
                <View style={[styles.cell, { width: "15%", borderRight: "0 solid transparent" }]}>
                  <Text style={{ fontSize: 9, textAlign: "right" }}>{currency(subtotal)}</Text>
                </View>
              </View>
            )
          })}
          <View style={{ flexDirection: "row" }}>
            <View style={[styles.cell, { width: "70%", alignItems: "flex-end" }]}>
              <Text style={{ fontSize: 9, fontWeight: "bold" }}>Valor total</Text>
            </View>
            <View style={[styles.cell, { width: "30%", borderRight: "0 solid transparent" }]}>
              <Text style={{ fontSize: 9, fontWeight: "bold", textAlign: "right" }}>{currency(valorTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Rodapé */}
        <View style={{ marginTop: 6, border: "1 solid #bfbfbf", flexDirection: "row" }}>
          {/* Lado esquerdo: Assinatura do funcionário do prédio */}
          <View
            style={{
              width: "55%",
              paddingBottom: 10,
              borderRight: "1 solid #bfbfbf",
              alignItems: "stretch",
              paddingHorizontal: 6,
              paddingTop: 4,
            }}
          >
            <Text style={{ fontSize: 9.5, textAlign: "center" }}>
              Iniciamos nesta data os devidos procedimentos de manutenção. Caso não seja feita a adequação necessária dos
              sistemas, o laudo técnico será cobrado.
            </Text>
            <View style={{ paddingTop: 20, alignItems: "center" }}>
              {assinaturaFuncionarioPredio ? (
                <Image src={assinaturaFuncionarioPredio} style={{ width: 150, objectFit: "contain" }} />
              ) : null}
              <Text style={{ fontSize: 9, textAlign: "center" }}>
                __________________________
              </Text>
              {blankSignatures ? (
                <Text style={{ fontSize: 9, textAlign: "center" }}> </Text>
              ) : (
                <Text style={{ fontSize: 9, textAlign: "center" }}>
                  ({assinaturaFuncionarioPredioNome ?? ""})
                </Text>
              )}
              <Text style={{ fontSize: 9, textAlign: "center", paddingBottom: 6, marginTop: 4 }}>
                Funcionário do Prédio - Acompanhei os serviços
              </Text>
            </View>
          </View>

          {/* Lado direito: Data, Vendedor e Assinatura do Técnico */}
          <View style={{ width: "45%", paddingLeft: 8, paddingTop: 8 }}>
            <Text style={{ fontSize: 9 }}>Data: {dataLaudo}</Text>
            <Text style={{ fontSize: 9 }}>Vendedor: {vendedorNomeSafe}</Text>
            <Text style={{ fontSize: 9 }}>Técnico: {tecnicoNome}</Text>

            {/* Assinatura do Técnico */}
            <View style={{ paddingTop: 16, alignItems: "center" }}>
              {assinaturaTecnico ? (
                <Image src={assinaturaTecnico} style={{ width: 120, objectFit: "contain" }} />
              ) : null}
              <Text style={{ fontSize: 9, textAlign: "center" }}>
                __________________________
              </Text>
              {blankSignatures ? (
                <Text style={{ fontSize: 9, textAlign: "center" }}> </Text>
              ) : (
                <Text style={{ fontSize: 9, textAlign: "center" }}>
                  ({tecnicoNome})
                </Text>
              )}
              <Text style={{ fontSize: 9, textAlign: "center", marginTop: 2 }}>
                Técnico Responsável
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generateRelatorioVistoriaPdfBuffer({
  pedidoId,
  visitaId,
  cnpjEmpresa,
}: GenerateRelatorioParams): Promise<{ buffer: Buffer, fileName: string } | null> {
  const [pedido, visita, docRelatorio] = await Promise.all([
    prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        vendedor: { select: { name: true, fullname: true } },
        orcamento: {
          select: {
            empresa: {
              // logoUrl adicionado recentemente
              select: { id: true, nome: true, logoUrl: true } as any,
            } as any,
            filial: {
              select: { cnpj: true },
            },
          },
        },
        cliente: {
          select: {
            razaoSocial: true,
            cnpj: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            estado: true,
            quantidadeSPDA: true,
          },
        },
        itens: {
          select: {
            quantidade: true,
            valorUnitarioPraticado: true,
            item: { select: { id: true, nome: true, categoria: true, valor: true } },
          },
        },
      },
    }),
    prisma.visitaTecnica.findUnique({
      where: { id: visitaId },
      select: {
        checklist: true,
        dataMarcada: true,
        tecnico: { select: { fullname: true, name: true } },
        listaExtras: {
          select: {
            itens: {
              select: { itemId: true }
            }
          }
        }
      },
    }),
    prisma.documentoOperacional.findUnique({
      where: { pedidoId_tipo: { pedidoId, tipo: DocumentoOperacionalTipo.RELATORIO_VISTORIA } },
      select: {
        assinaturas: { select: { url: true, nomeCompletoAssinante: true, dadosExtras: true } },
      },
    }),
  ])

  if (!pedido) return null
  const pedidoData = pedido as any
  const visitaData = visita as any
  const docRelatorioData = docRelatorio as any

  const checklistSalvo = Array.isArray(visitaData?.checklist) ? (visitaData?.checklist as ChecklistSalvo[]) : []
  const checklistMap = new Map<number, ChecklistSalvo>()
  checklistSalvo.forEach((c) => checklistMap.set(Number(c.itemId), c))

  // Lista todos os produtos do catálogo, marcando condições/quantidade/preços para os que estão no checklist.
  const todosProdutos = await prisma.item.findMany({
    where: { categoria: "Produto" },
    select: { id: true, nome: true, valor: true },
    orderBy: { nome: "asc" },
  })

  // Determine items in Lista Extra for this visit
  const itemsInListaExtra = new Set<string>()
  visitaData?.listaExtras?.forEach((le: any) => {
    le.itens?.forEach((lei: any) => {
      itemsInListaExtra.add(String(lei.itemId))
    })
  })

  const produtos = todosProdutos.map((item) => {
    const isGaiola = item.nome.toLowerCase().includes("gaiola de faraday")
    const salvo = checklistMap.get(Number(item.id))

    // NOVO CRITÉRIO: Só é INAPTO se estiver na LISTA EXTRA. Caso contrário, APTO.
    // Regra Gaiola de Faraday: colunas vazias
    const condicoes = isGaiola ? "" : (itemsInListaExtra.has(String(item.id)) ? "INAPTO" : "APTO")

    const quantidade = isGaiola ? "" : (salvo ? salvo.quantidade : ("" as any))
    const precoUnitario = item.valor ?? 0
    const total = salvo ? precoUnitario * (salvo.quantidade || 0) : 0
    return {
      nome: item.nome,
      condicoes,
      quantidade,
      precoUnitario,
      total,
      substituido: "",
    }
  })

  const servicos = (pedidoData.itens ?? [])
    .filter((it: any) => it.item?.categoria === "Serviço")
    .map((it: any) => ({
      nome: it.item?.nome ?? "Serviço",
      valor: it.valorUnitarioPraticado ?? it.item?.valor ?? 0,
      quantidade: it.quantidade ?? 1,
    }))

  // IMPORTANTE: O valor total considera APENAS serviços.
  // Os valores de produtos NÃO são somados (conforme requisito).
  const totalServicos = servicos.reduce((acc: number, s: any) => acc + s.valor * (s.quantidade ?? 1), 0)
  const valorTotal = totalServicos // Apenas serviços!

  const logoFromEmpresa = pedidoData.orcamento?.empresa?.logoUrl ?? null
  const logoDataUrl = await resolveEmpresaLogoDataUrl({
    logoUrl: logoFromEmpresa,
    empresaId: pedidoData.orcamento?.empresa?.id ?? null,
  })
  // CNPJ da empresa/filial: prioriza filial do orçamento; senão, fallback por UF/Empresa
  let filialCnpj = pedidoData.orcamento?.filial?.cnpj ?? null
  if (!filialCnpj && pedidoData.orcamento?.empresa?.id && pedidoData.cliente?.estado) {
    const resolvedFilialId = await resolveFilialId(prisma as any, pedidoData.orcamento.empresa.id, pedidoData.cliente.estado)
    if (resolvedFilialId) {
      const filial = await prisma.filial.findUnique({ where: { id: resolvedFilialId }, select: { cnpj: true } })
      filialCnpj = filial?.cnpj ?? null
    }
  }

  const cnpjEmpresaHeader = filialCnpj ?? cnpjEmpresa ?? ""

  // QR Code do WhatsApp
  const empresaId = pedidoData.orcamento?.empresa?.id ?? null
  let whatsappQrDataUrl: string | null = null
  if (empresaId === 1) {
    try {
      const qrPath = path.join(process.cwd(), "public", "qrcode_zap_ebr.png")
      const qrBuffer = await fs.readFile(qrPath)
      whatsappQrDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`
    } catch {
      whatsappQrDataUrl = null
    }
  }

  const empresaNome = pedidoData.orcamento?.empresa?.nome ?? null
  const empresaContato = getEmpresaContato(empresaNome)

  // Busca assinaturas pelo role em dadosExtras (igual ao termo-conclusao.tsx)
  const assinaturas = (docRelatorioData?.assinaturas ?? []) as any[]

  // Assinatura do funcionário do prédio (responsável do condomínio)
  const assinaturaFuncionarioPredioData = assinaturas.find(
    (a: any) => a?.dadosExtras?.role === "funcionario_condominio"
  )
  const assinaturaFuncionarioPredioNome = assinaturaFuncionarioPredioData?.nomeCompletoAssinante ?? null

  // Assinatura do técnico
  const assinaturaTecnicoData = assinaturas.find(
    (a: any) => a?.dadosExtras?.role === "funcionario_tecnico"
  )

  // Resolve URLs para data URL (necessário para @react-pdf)
  const funcionarioPredioUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaFuncionarioPredioData?.url)
  const tecnicoUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaTecnicoData?.url)

  const vendedorNome = pedidoData?.vendedor?.fullname ?? pedidoData?.vendedor?.name ?? ""
  const tecnicoNome = visitaData?.tecnico?.fullname ?? visitaData?.tecnico?.name ?? ""

  const doc = (
    <RelatorioDoc
      logoDataUrl={logoDataUrl}
      cnpjEmpresa={cnpjEmpresaHeader}
      clienteRazao={pedidoData.cliente?.razaoSocial ?? ""}
      clienteCnpj={pedidoData.cliente?.cnpj ?? ""}
      endereco={buildEndereco(pedidoData.cliente)}
      numeroLaudo={String(pedidoData.id)}
      dataLaudo={new Date().toLocaleDateString("pt-BR")}
      observacoes=""
      produtos={produtos}
      servicos={servicos}
      valorTotal={valorTotal}
      tecnicoNome={tecnicoNome}
      vendedorNome={vendedorNome}
      qtdSpda={pedidoData.cliente?.quantidadeSPDA ?? 0}
      assinaturaFuncionarioPredio={funcionarioPredioUrlResolvida}
      assinaturaFuncionarioPredioNome={assinaturaFuncionarioPredioNome}
      assinaturaTecnico={tecnicoUrlResolvida}
      whatsappQrDataUrl={whatsappQrDataUrl}
      blankSignatures={false}
      empresaContato={empresaContato}
      empresaNome={empresaNome}
    />
  )

  const buffer = await renderToBuffer(doc)
  const fileName = `relatorio-vistoria-${pedidoId}.pdf`

  return { buffer, fileName }
}

export async function generateRelatorioVistoriaPdf({
  pedidoId,
  visitaId,
  cnpjEmpresa,
}: GenerateRelatorioParams): Promise<string | null> {
  const result = await generateRelatorioVistoriaPdfBuffer({ pedidoId, visitaId, cnpjEmpresa })
  if (!result) return null

  const { buffer } = result
  const key = `documentos/relatorios_vistoria/relatorio_vistoria_${visitaId}.pdf`
  const upload = await storage.uploadPrivateObject({
    key,
    contentType: "application/pdf",
    body: buffer,
  })

  const storedUrl = upload.url
  await prisma.documentoOperacional.updateMany({
    where: { pedidoId, tipo: DocumentoOperacionalTipo.RELATORIO_VISTORIA },
    data: { url: storedUrl },
  })

  return storedUrl
}

export async function renderRelatorioVistoriaBlankPdfBuffer(input: {
  pedidoId: number
  cnpjEmpresa?: string
}): Promise<Buffer | null> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: input.pedidoId },
    select: {
      id: true,
      vendedor: { select: { name: true, fullname: true } },
      orcamento: {
        select: {
          empresa: {
            select: { id: true, nome: true, logoUrl: true } as any,
          } as any,
          filial: { select: { cnpj: true } },
        },
      },
      cliente: {
        select: {
          razaoSocial: true,
          cnpj: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          cidade: true,
          estado: true,
          quantidadeSPDA: true,
        },
      },
      itens: {
        select: {
          quantidade: true,
          valorUnitarioPraticado: true,
          item: { select: { id: true, nome: true, categoria: true, valor: true } },
        },
      },
      visitasTecnicas: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tecnico: { select: { name: true, fullname: true } },
        },
      },
    },
  })

  // Também buscar o documento operacional para pegar assinaturas se houver
  const docRelatorio = await prisma.documentoOperacional.findUnique({
    where: { pedidoId_tipo: { pedidoId: input.pedidoId, tipo: DocumentoOperacionalTipo.RELATORIO_VISTORIA } },
    select: {
      assinaturas: { select: { url: true, nomeCompletoAssinante: true, dadosExtras: true } },
    },
  })

  if (!pedido) return null
  const pedidoData = pedido as any

  const servicos = (pedidoData.itens ?? [])
    .filter((it: any) => it.item?.categoria === "Serviço")
    .map((it: any) => ({
      nome: it.item?.nome ?? "Serviço",
      valor: it.valorUnitarioPraticado ?? it.item?.valor ?? 0,
      quantidade: it.quantidade ?? 1,
    }))

  const totalServicos = servicos.reduce((acc: number, s: any) => acc + s.valor * (s.quantidade ?? 1), 0)
  const valorTotal = totalServicos

  const logoFromEmpresa = pedidoData.orcamento?.empresa?.logoUrl ?? null
  const logoDataUrl = await resolveEmpresaLogoDataUrl({
    logoUrl: logoFromEmpresa,
    empresaId: pedidoData.orcamento?.empresa?.id ?? null,
  })

  // Mesma garantia de filialId para o PDF em branco
  let filialCnpj = pedidoData.orcamento?.filial?.cnpj ?? null
  if (!filialCnpj && pedidoData.orcamento?.empresa?.id && pedidoData.cliente?.estado) {
    const resolvedFilialId = await resolveFilialId(prisma as any, pedidoData.orcamento.empresa.id, pedidoData.cliente.estado)
    if (resolvedFilialId) {
      const filial = await prisma.filial.findUnique({ where: { id: resolvedFilialId }, select: { cnpj: true } })
      filialCnpj = filial?.cnpj ?? null
    }
  }

  const cnpjEmpresaHeader = filialCnpj ?? input.cnpjEmpresa ?? ""

  const empresaNome = pedidoData.orcamento?.empresa?.nome ?? null
  const empresaContato = getEmpresaContato(empresaNome)

  // QR Code do WhatsApp
  const empresaId = pedidoData.orcamento?.empresa?.id ?? null
  let whatsappQrDataUrl: string | null = null
  if (empresaId === 1) {
    try {
      const qrPath = path.join(process.cwd(), "public", "qrcode_zap_ebr.png")
      const qrBuffer = await fs.readFile(qrPath)
      whatsappQrDataUrl = `data:image/png;base64,${qrBuffer.toString("base64")}`
    } catch {
      whatsappQrDataUrl = null
    }
  }

  // Resolver nomes e assinaturas
  const vendedorNome = pedidoData?.vendedor?.fullname ?? pedidoData?.vendedor?.name ?? ""
  const tecnicoNome = pedidoData.visitasTecnicas?.[0]?.tecnico?.fullname ?? pedidoData.visitasTecnicas?.[0]?.tecnico?.name ?? ""

  const assinaturas = (docRelatorio?.assinaturas ?? []) as any[]
  const assinaturaFuncionarioPredioData = assinaturas.find((a: any) => a?.dadosExtras?.role === "funcionario_condominio")
  const assinaturaFuncionarioPredioNome = assinaturaFuncionarioPredioData?.nomeCompletoAssinante ?? null
  const assinaturaTecnicoData = assinaturas.find((a: any) => a?.dadosExtras?.role === "funcionario_tecnico")

  const funcionarioPredioUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaFuncionarioPredioData?.url)
  const tecnicoUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaTecnicoData?.url)

  // Mapear itens do pedido para fácil consulta
  const pedidoProdutosMap = new Map<number, number>()
    ; (pedidoData.itens ?? []).forEach((it: any) => {
      const itemId = it.item?.id
      if (itemId && it.item?.categoria === "Produto") {
        pedidoProdutosMap.set(Number(itemId), Number(it.quantidade))
      }
    })

  // Lista os mesmos itens (equipamentos) do modo normal.
  // Preenche Condições e Qtd conforme o que há no pedido.
  const todosProdutos = await prisma.item.findMany({
    where: { categoria: "Produto" },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  })

  const hasVisits = (pedidoData.visitasTecnicas?.length ?? 0) > 0

  const produtos: ProdutosDto[] = todosProdutos.map((item) => {
    const isGaiola = item.nome.toLowerCase().includes("gaiola de faraday")
    const qty = pedidoProdutosMap.get(Number(item.id))

    // Se ainda não houve visita OU se for gaiola de faraday, fica tudo em branco
    let condicoes = ""
    let quantidade: number | "" = ""

    if (hasVisits && !isGaiola) {
      condicoes = qty !== undefined ? "INAPTO" : "APTO"
      quantidade = qty !== undefined ? qty : ""
    }

    return {
      nome: item.nome,
      condicoes,
      quantidade,
      substituido: "",
      precoUnitario: 0,
      total: 0,
    }
  })

  const doc = (
    <RelatorioDoc
      logoDataUrl={logoDataUrl}
      cnpjEmpresa={cnpjEmpresaHeader}
      clienteRazao={pedidoData.cliente?.razaoSocial ?? ""}
      clienteCnpj={pedidoData.cliente?.cnpj ?? ""}
      endereco={buildEndereco(pedidoData.cliente)}
      numeroLaudo={String(pedidoData.id)}
      dataLaudo={new Date().toLocaleDateString("pt-BR")}
      observacoes=""
      produtos={produtos}
      servicos={servicos}
      valorTotal={valorTotal}
      tecnicoNome={tecnicoNome}
      vendedorNome={vendedorNome}
      qtdSpda={pedidoData.cliente?.quantidadeSPDA ?? 0}
      assinaturaFuncionarioPredio={funcionarioPredioUrlResolvida}
      assinaturaFuncionarioPredioNome={assinaturaFuncionarioPredioNome}
      assinaturaTecnico={tecnicoUrlResolvida}
      whatsappQrDataUrl={whatsappQrDataUrl}
      blankSignatures={false}
      empresaContato={empresaContato}
      empresaNome={empresaNome}
    />
  )

  return await renderToBuffer(doc)
}

