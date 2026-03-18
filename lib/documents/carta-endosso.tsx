
import React from "react"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import { prisma } from "@/lib/prisma"
import { storage } from "@/lib/storage"
import { resolveEmpresaLogoDataUrl } from "@/lib/documents/logo-utils"

type GenerateEndossoParams = {
  pedidoId: number
}

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 110, height: 70, objectFit: "contain" },
  title: { textAlign: "center", fontSize: 14, fontWeight: "bold", marginVertical: 12 },
  text: { fontSize: 11, lineHeight: 1.4, marginBottom: 6 },
  signature: { marginTop: 40, alignItems: "flex-start" },
  underline: { marginTop: 4, borderBottomWidth: 1, borderBottomColor: "#000", width: 240 },
  small: { fontSize: 9, color: "#333" },
})

export type CartaEndossoProps = {
  logoDataUrl: string | null
  cnpjFilial: string
  clienteNome: string
  clienteEndereco: string
  clienteCidadeUf: string
  empresaEndossanteNome: string
  empresaEndossanteCnpj: string
  empresaSacadoNome: string
  empresaSacadoCnpj: string
}

export function CartaEndossoDoc({
  logoDataUrl,
  cnpjFilial,
  clienteNome,
  clienteEndereco,
  clienteCidadeUf,
  empresaEndossanteNome,
  empresaEndossanteCnpj,
  empresaSacadoNome,
  empresaSacadoCnpj,
}: CartaEndossoProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.row, { marginBottom: 16 }]}>
          <View style={{ width: "40%" }}>
            {logoDataUrl ? <Image src={logoDataUrl} style={styles.logo} /> : null /* placeholder logo */}
          </View>
          <View style={{ width: "60%", alignItems: "flex-end" }}>
            <Text style={styles.small}>CNPJ: {cnpjFilial}</Text>
          </View>
        </View>

        <Text style={styles.title}>CARTA DE ENDOSSO</Text>

        <View style={{ marginBottom: 10 }}>
          <Text style={styles.text}>{clienteNome}</Text>
          <Text style={styles.text}>Endereço: {clienteEndereco}</Text>
          <Text style={styles.text}>{clienteCidadeUf}</Text>
        </View>

        <View style={{ marginTop: 6, marginBottom: 12 }}>
          <Text style={styles.text}>Prezados Senhores,</Text>
        </View>

        <View>
          <Text style={styles.text}>
            Pela presente informamos que endossamos as duplicatas ou depósitos da {empresaEndossanteNome}, pelo Banco
            Itau ou Santander, colocados em cobrança para a empresa {empresaSacadoNome} CNPJ: {empresaSacadoCnpj}. Com
            nota fiscal da empresa {empresaEndossanteNome} CNPJ: {cnpjFilial}.{" "}
            {/* Texto mantido conforme modelo fornecido */}
          </Text>
          <Text style={styles.text}>Sem mais para o momento, firmamos-nos.</Text>
        </View>

        <View style={{ marginTop: 60, gap: 40 }}>
          <View style={styles.signature}>
            <Image src="data:image/jpeg;base64,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" style={styles.logo} />
            <View style={styles.underline} />
            <Text style={styles.small}>{empresaEndossanteNome}</Text>
            <Text style={styles.small}>{cnpjFilial}</Text>
          </View>
          <View style={styles.signature}>
            <Image src="data:image/jpeg;base64,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" style={styles.logo} />
            <View style={styles.underline} />
            <Text style={styles.small}>{empresaSacadoNome}</Text>
            <Text style={styles.small}>{empresaSacadoCnpj}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generateCartaEndossoPdfBuffer({ pedidoId }: GenerateEndossoParams): Promise<{ buffer: Buffer, fileName: string } | null> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      orcamento: {
        select: {
          empresaId: true,
          empresa: { select: { nome: true, logoUrl: true } },
          filial: { select: { cnpj: true, dadosCadastrais: true } },
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
          cep: true,
        },
      },
    },
  })

  if (!pedido?.orcamento || pedido.orcamento.empresaId !== 1) {
    return null
  }

  const cliente = pedido.cliente
  const enderecoParts = [
    [cliente.logradouro, cliente.numero].filter(Boolean).join(", "),
    cliente.complemento,
    [cliente.bairro, cliente.cep].filter(Boolean).join(" "),
  ]
    .filter((p) => p && p.trim().length)
    .join(" - ")
  const cidadeUf = [cliente.cidade, cliente.estado].filter(Boolean).join(" / ")

  const empresa = pedido.orcamento.empresa
  const filial = pedido.orcamento.filial
  const cnpjFilial = filial?.cnpj || "CNPJ não informado"
  const logoDataUrl = await resolveEmpresaLogoDataUrl({
    logoUrl: empresa?.logoUrl ?? null,
    empresaId: pedido.orcamento?.empresaId ?? null,
  })

  const doc = (
    <CartaEndossoDoc
      logoDataUrl={logoDataUrl}
      cnpjFilial={cnpjFilial}
      clienteNome={cliente.razaoSocial}
      clienteEndereco={enderecoParts || ""}
      clienteCidadeUf={cidadeUf}
      empresaEndossanteNome="JS SERVIÇOS/EMPRESA BRASILEIRA DE RAIOS"
      empresaEndossanteCnpj={cnpjFilial}
      empresaSacadoNome="SISTEMAS DE COBRANÇA ASSERTIVAS LTDA"
      empresaSacadoCnpj="54.229.821/0001-23"
    />
  )

  const buffer = await renderToBuffer(doc)
  const fileName = `carta-endosso-${pedidoId}.pdf`

  return { buffer, fileName }
}

export async function generateCartaEndossoPdf({ pedidoId }: GenerateEndossoParams) {
  const result = await generateCartaEndossoPdfBuffer({ pedidoId })
  if (!result) {
    throw new Error("Carta de endosso permitida apenas para empresaId=1 (Empresa Brasileira de Raios).")
  }

  const { buffer, fileName } = result
  const key = `documentos/endosso/carta_endosso_${pedidoId}.pdf`
  const upload = await storage.uploadPrivateObject({
    key,
    contentType: "application/pdf",
    body: buffer,
  })

  return upload.url
}


