import React from "react"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import { DocumentoOperacionalTipo } from "@prisma/client"
import { formatCNPJ, formatPhone } from "@/lib/formatters"
import { prisma } from "@/lib/prisma"
import { resolveEmpresaLogoDataUrl } from "@/lib/documents/logo-utils"
import { resolveDocOperacionalAssinaturaUrl } from "@/lib/signatures"
import { storage } from "@/lib/storage"

type GenerateOrdemServicoParams = {
  documentoId: number
}

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "bold", textAlign: "center", marginVertical: 12 },
  text: { fontSize: 11, lineHeight: 1.4 },
  label: { fontSize: 11, fontWeight: "bold" },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  signatureBlock: { width: "47%", alignItems: "center" },
  logo: { width: 120, height: 60, objectFit: "contain" },
})

type OrdemServicoDocProps = {
  logoDataUrl: string | null
  empresaCnpj: string
  clienteRazaoSocial: string
  clienteCnpj: string
  endereco: string
  bairro: string
  estado: string
  telefone: string
  dataPedido: string
  pedidoNumero: string
  vendedorNome: string
  solicitanteNome: string
  detalhamentoPedido: string
  detalhamento: string
  assinaturaTecnico?: { url: string | null; nome: string }
  assinaturaCondominio?: { url: string | null; nome: string }
}

function OrdemServicoDoc({
  logoDataUrl,
  empresaCnpj,
  clienteRazaoSocial,
  clienteCnpj,
  endereco,
  bairro,
  estado,
  telefone,
  dataPedido,
  pedidoNumero,
  vendedorNome,
  solicitanteNome,
  detalhamentoPedido,
  detalhamento,
  assinaturaTecnico,
  assinaturaCondominio,
}: OrdemServicoDocProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.row, { marginBottom: 12 }]}>
          <View style={{ width: "50%" }}>{logoDataUrl ? <Image src={logoDataUrl} style={styles.logo} /> : null}</View>
          <View style={{ width: "50%", alignItems: "flex-end" }}>
            <Text style={styles.text}>CNPJ: {empresaCnpj}</Text>
          </View>
        </View>

        <Text style={styles.title}>ORDEM DE SERVIÇOS</Text>

        <View style={{ marginBottom: 8 }}>
          <Text style={styles.text}>
            <Text style={styles.label}>Cliente: </Text>
            {clienteRazaoSocial} {clienteCnpj ? `(${clienteCnpj})` : ""}
          </Text>
        </View>
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.text}>
            <Text style={styles.label}>Endereço: </Text>
            {endereco}
          </Text>
        </View>

        <View style={[styles.row, { marginBottom: 8 }]}>
          <Text style={styles.text}>Bairro: {bairro}</Text>
          <Text style={styles.text}>UF: {estado}</Text>
          <Text style={styles.text}>Tel: {telefone}</Text>
        </View>

        <View style={[styles.row, { marginBottom: 8 }]}>
          <Text style={styles.text}>Data: {dataPedido}</Text>
          <Text style={styles.text}>Solicitante: {solicitanteNome}</Text>
        </View>

        <View style={[styles.row, { marginBottom: 12 }]}>
          <Text style={styles.text}>Pedido: {pedidoNumero}</Text>
          <Text style={styles.text}>Vendedor(a): {vendedorNome}</Text>
        </View>


        <Text style={styles.sectionTitle}>SERVIÇO A SER EXECUTADO</Text>
        <Text style={styles.text}>{detalhamentoPedido || "—"}</Text>

        <Text style={styles.sectionTitle}>DETALHAMENTO DO TÉCNICO</Text>
        <Text style={styles.text}>{detalhamento}</Text>

        <View style={{ marginTop: 36, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={styles.signatureBlock}>
            {assinaturaCondominio?.url ? (
              <Image src={assinaturaCondominio.url} style={{ width: 180, height: 60, objectFit: "contain" }} />
            ) : null}
            <Text style={{ marginTop: 0, fontSize: 11 }}>________________________________</Text>
            <Text style={{ marginTop: 6, fontSize: 11 }}>{assinaturaCondominio?.nome ?? ""}</Text>
            <Text style={{ marginTop: 6, fontSize: 10 }}>Acompanhei a ordem de serviço acima.</Text>
          </View>
          <View style={styles.signatureBlock}>
            {assinaturaTecnico?.url ? (
              <Image src={assinaturaTecnico.url} style={{ width: 180, height: 60, objectFit: "contain" }} />
            ) : null}
            <Text style={{ marginTop: 0, fontSize: 11 }}>________________________________</Text>
            <Text style={{ marginTop: 6, fontSize: 11 }}>{assinaturaTecnico?.nome ?? ""}</Text>
            <Text style={{ marginTop: 6, fontSize: 10 }}>Concluí a ordem de serviço acima.</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generateOrdemServicoPdfBuffer({
  documentoId,
}: GenerateOrdemServicoParams): Promise<{ buffer: Buffer, fileName: string } | null> {
  const documento = await prisma.documentoOperacional.findUnique({
    where: { id: documentoId },
    include: {
      assinaturas: true,
      pedido: {
        select: {
          id: true,
          createdAt: true,
          observacoes: true,
          detalhamento: true,
          vendedor: { select: { name: true, fullname: true } },
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
              telefoneCondominio: true,
              nomeSindico: true,
            },
          },
          orcamento: {
            select: {
              empresaId: true,
              empresa: { select: { id: true, logoUrl: true } },
              filial: { select: { cnpj: true } },
            },
          },
        },
      },
    },
  })

  if (!documento || documento.tipo !== DocumentoOperacionalTipo.ORDEM_SERVICO || !documento.pedido) {
    return null
  }

  const detalhamento = (documento.dadosExtras as { detalhamento?: string } | null)?.detalhamento ?? ""
  const pedido = documento.pedido

  const endereco = [
    pedido.cliente.logradouro ? `${pedido.cliente.logradouro}${pedido.cliente.numero ? `, ${pedido.cliente.numero}` : ""}` : null,
    pedido.cliente.complemento || null,
    pedido.cliente.cidade || null,
    pedido.cliente.cep || null,
  ]
    .filter(Boolean)
    .join(" | ")

  const assinaturaTecnico = documento.assinaturas.find(
    (assinatura) => (assinatura.dadosExtras as { role?: string } | null)?.role === "funcionario_tecnico",
  )
  const assinaturaCondominio = documento.assinaturas.find(
    (assinatura) => (assinatura.dadosExtras as { role?: string } | null)?.role === "funcionario_condominio",
  )

  const tecnicoUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaTecnico?.url)
  const condominioUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaCondominio?.url)

  const logoDataUrl = await resolveEmpresaLogoDataUrl({
    logoUrl: pedido.orcamento?.empresa?.logoUrl ?? null,
    empresaId: pedido.orcamento?.empresaId ?? pedido.orcamento?.empresa?.id ?? null,
  })

  const doc = (
    <OrdemServicoDoc
      logoDataUrl={logoDataUrl}
      empresaCnpj={formatCNPJ(pedido.orcamento?.filial?.cnpj ?? "")}
      clienteRazaoSocial={pedido.cliente.razaoSocial ?? ""}
      clienteCnpj={formatCNPJ(pedido.cliente.cnpj ?? "")}
      endereco={endereco}
      bairro={pedido.cliente.bairro ?? ""}
      estado={pedido.cliente.estado ?? ""}
      telefone={formatPhone(pedido.cliente.telefoneCondominio ?? "")}
      dataPedido={new Date(pedido.createdAt).toLocaleDateString("pt-BR")}
      pedidoNumero={String(pedido.id)}
      vendedorNome={pedido.vendedor?.fullname ?? pedido.vendedor?.name ?? ""}
      solicitanteNome={pedido.cliente.nomeSindico ?? ""}
      detalhamentoPedido={pedido.detalhamento ?? ""}
      detalhamento={detalhamento}
      assinaturaTecnico={
        assinaturaTecnico
          ? { url: tecnicoUrlResolvida, nome: assinaturaTecnico.nomeCompletoAssinante }
          : { url: null, nome: "" }
      }
      assinaturaCondominio={
        assinaturaCondominio
          ? { url: condominioUrlResolvida, nome: assinaturaCondominio.nomeCompletoAssinante }
          : { url: null, nome: "" }
      }
    />
  )
  const buffer = await renderToBuffer(doc)
  const fileName = `ordem-servico-${documentoId}.pdf`

  return { buffer, fileName }
}

export async function generateOrdemServicoPdf({
  documentoId,
}: GenerateOrdemServicoParams): Promise<string | null> {
  const result = await generateOrdemServicoPdfBuffer({ documentoId })
  if (!result) return null

  const { buffer } = result
  const key = `documentos/ordens_servico/ordem_servico_${documentoId}.pdf`
  const upload = await storage.uploadPrivateObject({
    key,
    contentType: "application/pdf",
    body: buffer,
  })

  const storedUrl = upload.url
  await prisma.documentoOperacional.update({
    where: { id: documentoId },
    data: { url: storedUrl },
  })

  return storedUrl
}

