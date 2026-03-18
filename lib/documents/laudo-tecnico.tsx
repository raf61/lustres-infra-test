
import React from "react"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import fs from "fs/promises"
import path from "path"

import { getEmpresaContato, type EmpresaContato } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"
import { resolveEmpresaLogoDataUrl } from "@/lib/documents/logo-utils"

type GenerateLaudoParams = {
  pedidoId: number
}

const styles = StyleSheet.create({
  page: { padding: 18, fontFamily: "Helvetica" },
  frame: { border: "2 solid #000", padding: 18, minHeight: "100%" },
  row: { flexDirection: "row" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  title: { fontSize: 25, fontWeight: "bold", textAlign: "center", marginVertical: 14, marginBottom: 20 },
  paragraph: { fontSize: 11, lineHeight: 1.5, textAlign: "center", marginBottom: 8 },
  bold: { fontWeight: "bold" },
})

const buildEndereco = (cliente: {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
}) => {
  const partes = [
    cliente.logradouro ? `${cliente.logradouro}${cliente.numero ? `, ${cliente.numero}` : ""}` : null,
    cliente.complemento,
    [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - "),
  ].filter(Boolean)

  return partes.join(" | ")
}

type LaudoProps = {
  logoDataUrl: string | null
  whatsappQrDataUrl: string | null
  cnpjFilial: string
  condominio: string
  condominioEndereco: string
  condominioCnpj: string
  pedidoNumero: string
  empresaNome: string
  mesReferencia: string
  medicaoOhmica: number | null
  medicaoOhmicaMulti?: Array<{ torre: string; valor: number }> | null
  empresaContato: EmpresaContato
}

function LaudoDoc({
  logoDataUrl,
  whatsappQrDataUrl,
  cnpjFilial,
  condominio,
  condominioEndereco,
  condominioCnpj,
  pedidoNumero,
  empresaNome,
  mesReferencia,
  medicaoOhmica,
  medicaoOhmicaMulti,
  empresaContato,
}: LaudoProps) {
  const medicoes = medicaoOhmicaMulti && Array.isArray(medicaoOhmicaMulti) && medicaoOhmicaMulti.length > 0
    ? medicaoOhmicaMulti
    : typeof medicaoOhmica === "number" ? [{ torre: "", valor: medicaoOhmica }] : []

  const hasMedicao = medicoes.length > 0

  // Apto se TODAS forem <= 10. Inapto se pelo menos uma for > 10.
  const isApto = hasMedicao && medicoes.every(m => m.valor <= 10)
  const status = isApto ? "APTO" : "INAPTO"

  const formatMedicaoTexto = (items: Array<{ torre: string; valor: number }>) => {
    const formatted = items.map(m => m.valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }))
    if (formatted.length === 0) return ""
    if (formatted.length === 1) return formatted[0]
    const last = formatted.pop()
    return `${formatted.join("; ")} e ${last}`
  }

  const medicaoTexto = hasMedicao
    ? `${formatMedicaoTexto(medicoes)} ${status}`
    : ""

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          {/* Cabeçalho */}
          <View style={[styles.row, { justifyContent: "space-between", alignItems: "center", marginBottom: 10 }]}>
            <View style={{ width: "34%", alignItems: "center" }}>
              {logoDataUrl ? <Image src={logoDataUrl} style={{ width: 120, height: 90, objectFit: "contain" }} /> : null}
              {cnpjFilial ? <Text style={{ marginTop: 4, fontSize: 10 }}>{cnpjFilial}</Text> : null}
              <View style={{ marginTop: 4, gap: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 8, color: "#555" }}>{empresaContato.telefone}</Text>
                <Text style={{ fontSize: 8, color: "#555" }}>{empresaContato.email}</Text>
                <Text style={{ fontSize: 8, color: "#555" }}>{empresaContato.site}</Text>
              </View>
            </View>
            <View style={{ width: "46%", alignItems: "center" }}>
              <Text style={styles.title}>Laudo Técnico</Text>
            </View>
            <View style={{ width: "20%", alignItems: "flex-end" }}>
              {whatsappQrDataUrl ? (
                <Image
                  src={whatsappQrDataUrl}
                  style={{ width: 100, height: 100, objectFit: "contain" }}
                />
              ) : null}
            </View>
          </View>

          {/* Conteúdo */}
          <View style={{ marginTop: 10, gap: 6 }}>
            <Text style={styles.paragraph}>
              Certificamos a conclusão do serviço prestado de manutenção preventiva anual no{" "}
              <Text style={styles.bold}>SPDA</Text> (Sistema de Proteção Contra Descargas Atmosféricas) referente ao
            </Text>

            <Text style={[styles.paragraph, styles.bold, { fontSize: 16, marginBottom: 0 }]}>{condominio}</Text>

            <Text style={[styles.paragraph, styles.bold, { fontSize: 12, marginBottom: 0, marginTop: 0 }]}>{condominioEndereco}</Text>

            <Text style={[styles.paragraph, styles.bold, { fontSize: 12, marginBottom: 0, marginTop: 0 }]}>CNPJ: {condominioCnpj}</Text>

            <Text style={styles.paragraph}>
              Atestamos para devidos fins que o sistema fixo de proteção coletiva <Text style={styles.bold}>SPDA</Text> e
              aterramento encontra-se <Text style={styles.bold}>{status}</Text> de acordo com a <Text style={styles.bold}>NBR5419 das normas da ABNT</Text>{" "}
              (Associação Brasileira de Normas Técnicas). Estando em conformidade com as normas vigentes do{" "}
              <Text style={styles.bold}>CREA</Text> e <Text style={styles.bold}>COSCIP</Text>.
            </Text>

            <Text style={[styles.paragraph, styles.bold, { marginTop: 6, fontSize: 16 }]}>
              {hasMedicao ? `MEDIÇÃO ÔHMICA: ${medicaoTexto}` : status}
            </Text>
            <Text style={[styles.paragraph, { fontSize: 10 }]}>Aparelho de medição: Minipa – ET - Earth ClampTester - 4310</Text>

            <Text style={styles.paragraph}>
              Os serviços prestados de manutenção referente ao SPDA têm garantia de 12 meses a contar do mês de{" "}
              <Text style={styles.bold}>{mesReferencia}</Text>.
            </Text>

            <Text style={[styles.paragraph, styles.bold, { marginTop: 4 }]}>RM: {pedidoNumero}</Text>

            <Text style={styles.paragraph}>
              Desde que nenhuma outra empresa/pessoas que não sejam técnicos e/ou representantes legais da{" "}
              <Text style={styles.bold}>{empresaNome}</Text>, executem qualquer procedimento no sistema.
            </Text>
          </View>

          {/* Rodapé */}
          <View style={{ marginTop: 28, alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "bold" }}>Rodrigo da Conceição Prata</Text>
            <Text style={{ fontSize: 10 }}>Registro CREA 2015119749 RNP</Text>
            <Text style={{ fontSize: 10 }}>Engenheiro Eletricista</Text>
            <View><Image style={{ width: 60, objectFit: "contain" }} src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAA2AEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiuc8ReNNN8O3cFg8F7f6lcKXisNPh82YqOrYyAF9yRQB0dFcN/wtHSrZ1/tnSNe0SJjtE+o2DLFk+rKWArtLe4hu7aO4tpo5oJFDJJGwZWB6EEdRQBLRRRQAUUUUAISAMnpXz14L+KSp4z1q6k0C71G91q6ZbKe3I3MicJD82AAFwSQe/I9Pf72N5bC4jj++8TKv1I4rwnwF4W/wCEo+BE1tCCmqWl5NcWEynDxTrtIwe2cY/GgD0SDxtd/wBp2ul+K/C02jwak3kW00tzHcxSuekb7fuk9gc5qnYQD4f+ObfSbfKeG9eZvssRPy2d2OSi+iuM4HqOK425+IVj40+C+oxapOkHiCz8tBHnEkk4YGN4x1ySDkDp83au3+KAm/4VmdUkXZfabLa3yf7EqSLn9CwoA9AopFYMoYdCMimu6xozuwVFBLMxwAB3NAD6KhtrmC8to7m1njngkUNHLE4ZXB7gjgipqACvmn/hH5tK8Y+J445tRudK0y/M17plldPC4tpRvWWMKRuK9GHpj8PpavH9e0HW/CfxF1b4hW0Rm03MC3NvG255LYxhZjt9UZUYD6+lAGFonhjRPDXxe8P6vphgufDetwv9hmlPmeVPszjc3IYsBjPOWI7V0/xQ8UQag9x4AjhkW9vmtcS5G3yi5eRvYKsZyT61y/xA8KXK+G5r/wAJQf2n4avZU1GKC1c7rKcHmSIDnYykgqPunnjGK5/W7238P+ONXs9Okv7u71HRUsIXv5TNMtxMY8rvPQhH6dulAHuU/wARfDNv4NTxSL0vpTP5SMkZ3s+7btCnnPBP0Ga3JtS0x9DOo3NzbjS5YBI00zARmNh1OeMEHv61xWlfCDRdNvYma6up9OhBeLTZCPJSZoxG8vqSQM89CSaur8OYpNH0HRbzWLq60jSiWe0kRQLog5jEhH8KdNvfAzQB19jaWthZQ2tjDFBaxKFijiUBVX2AqzVHV9PfVNJuLGO9urFpl2i5tX2yR89VParcaeXEqF2faANzdW9z70APpCAwIIyD2oooA4mX4W6As8r2Fzq+lRysXeDTtQkhiJPX5QcD8MVpaf4B8MabBZxwaVEzWlwbqKWUl5POPWQsTkngdfQegoooA6WiiigAooooA//Z" /></View>
          </View>
        </View>
      </Page>
    </Document>
  )
}


export async function generateLaudoTecnicoPdfBuffer({ pedidoId }: GenerateLaudoParams): Promise<{ buffer: Buffer, fileName: string } | null> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      medicaoOhmica: true,
      medicaoOhmicaMulti: true,
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
        },
      },
      orcamento: {
        select: {
          empresa: {
            select: { id: true, nome: true, logoUrl: true } as any,
          } as any,
          filial: {
            select: { cnpj: true },
          },
        },
      },
    },
  })

  if (!pedido) return null
  const pedidoData = pedido as any

  const condominio = pedidoData.cliente?.razaoSocial ?? ""
  const condominioEndereco = buildEndereco(pedidoData.cliente ?? {})
  const condominioCnpj = pedidoData.cliente?.cnpj ?? ""
  const cnpjFilial = pedidoData.orcamento?.filial?.cnpj ?? ""
  const empresaNome = pedidoData.orcamento?.filial?.empresa?.nome ?? pedidoData.orcamento?.empresa?.nome ?? "Empresa Brasileira de Raios"
  const medicaoOhmica = pedidoData.medicaoOhmica ?? null
  const medicaoOhmicaMulti = pedidoData.medicaoOhmicaMulti ?? null

  const logoFromEmpresa = pedidoData.orcamento?.empresa?.logoUrl ?? null
  const logoDataUrl = await resolveEmpresaLogoDataUrl({
    logoUrl: logoFromEmpresa,
    empresaId: pedidoData.orcamento?.empresa?.id ?? null,
  })

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

  const now = new Date()
  const mesReferencia = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  const empresaContato = getEmpresaContato(empresaNome)

  const doc = (
    <LaudoDoc
      logoDataUrl={logoDataUrl}
      whatsappQrDataUrl={whatsappQrDataUrl}
      cnpjFilial={cnpjFilial}
      condominio={condominio}
      condominioEndereco={condominioEndereco}
      condominioCnpj={condominioCnpj}
      pedidoNumero={String(pedidoData.id)}
      empresaNome={empresaNome}
      mesReferencia={mesReferencia}
      medicaoOhmica={medicaoOhmica}
      medicaoOhmicaMulti={medicaoOhmicaMulti}
      empresaContato={empresaContato}
    />
  )

  const buffer = await renderToBuffer(doc)
  const fileName = `laudo-tecnico-${pedidoId}.pdf`

  return { buffer, fileName }
}

export async function generateLaudoTecnicoPdf({ pedidoId }: GenerateLaudoParams): Promise<string | null> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      medicaoOhmica: true,
      medicaoOhmicaMulti: true,
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
        },
      },
      orcamento: {
        select: {
          empresa: {
            select: { id: true, nome: true, logoUrl: true } as any,
          } as any,
          filial: {
            select: { cnpj: true },
          },
        },
      },
    },
  })

  if (!pedido) return null
  const pedidoData = pedido as any

  const condominio = pedidoData.cliente?.razaoSocial ?? ""
  const condominioEndereco = buildEndereco(pedidoData.cliente ?? {})
  const condominioCnpj = pedidoData.cliente?.cnpj ?? ""
  const cnpjFilial = pedidoData.orcamento?.filial?.cnpj ?? ""
  const empresaNome = pedidoData.orcamento?.filial?.empresa?.nome ?? pedidoData.orcamento?.empresa?.nome ?? "Empresa Brasileira de Raios"
  const medicaoOhmica = pedidoData.medicaoOhmica ?? null
  const medicaoOhmicaMulti = pedidoData.medicaoOhmicaMulti ?? null

  const logoFromEmpresa = pedidoData.orcamento?.empresa?.logoUrl ?? null
  const logoDataUrl = await resolveEmpresaLogoDataUrl({
    logoUrl: logoFromEmpresa,
    empresaId: pedidoData.orcamento?.empresa?.id ?? null,
  })

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

  const now = new Date()
  const mesReferencia = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  const empresaContato = getEmpresaContato(empresaNome)

  const doc = (
    <LaudoDoc
      logoDataUrl={logoDataUrl}
      whatsappQrDataUrl={whatsappQrDataUrl}
      cnpjFilial={cnpjFilial}
      condominio={condominio}
      condominioEndereco={condominioEndereco}
      condominioCnpj={condominioCnpj}
      pedidoNumero={String(pedidoData.id)}
      empresaNome={empresaNome}
      mesReferencia={mesReferencia}
      medicaoOhmica={medicaoOhmica}
      medicaoOhmicaMulti={medicaoOhmicaMulti}
      empresaContato={empresaContato}
    />
  )

  const buffer = await renderToBuffer(doc)
  const key = `documentos/laudos/laudo_tecnico_${pedidoId}.pdf`
  const upload = await storage.uploadPrivateObject({
    key,
    contentType: "application/pdf",
    body: buffer,
  })

  return upload.url
}

