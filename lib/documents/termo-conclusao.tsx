
import React from "react"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"

import { getEmpresaContato, type EmpresaContato } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { resolveDocOperacionalAssinaturaUrl } from "@/lib/signatures"
import { storage } from "@/lib/storage"
import { resolveEmpresaLogoDataUrl } from "@/lib/documents/logo-utils"

type GenerateTermoParams = {
  documentoId: number
}

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: "Helvetica" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { textAlign: "center", fontSize: 14, fontWeight: "bold", marginTop: 8, marginBottom: 18 },
  text: { fontSize: 11, lineHeight: 1.4 },
  signatureBlock: { width: "47%", alignItems: "center" },
  logo: { width: 120, height: 60, objectFit: "contain" },
})

type TermoProps = {
  logoDataUrl: string | null
  condominio: string
  pedidoNumero: string
  tipoServico: string
  horaEntrada: string
  horaSaida: string
  data: string
  assinaturaTecnico?: { url: string | null; nome: string }
  assinaturaCondominio?: { url: string | null; nome: string }
  empresaContato: EmpresaContato
}

function TermoDoc({
  logoDataUrl,
  condominio,
  pedidoNumero,
  tipoServico,
  horaEntrada,
  horaSaida,
  data,
  assinaturaTecnico,
  assinaturaCondominio,
  empresaContato,
}: TermoProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.row, { marginBottom: 16 }]}>
          <View style={{ width: "40%" }}>
            {logoDataUrl ? <Image src={logoDataUrl} style={styles.logo} /> : null}
            <View style={{ marginTop: 6, gap: 2 }}>
              <Text style={{ fontSize: 9, color: "#555" }}>{empresaContato.telefone}</Text>
              <Text style={{ fontSize: 9, color: "#555" }}>{empresaContato.email}</Text>
              <Text style={{ fontSize: 9, color: "#555" }}>{empresaContato.site}</Text>
            </View>
          </View>
          <View style={{ width: "60%" }}><Text style={styles.title}>TERMO DE CONCLUSÃO DE SERVIÇOS DO {condominio}</Text>
          </View>
        </View>


        <View style={{ marginBottom: 12 }}>
          <Text style={styles.text}>
            DE ACORDO COM O PEDIDO {pedidoNumero} CONCLUÍMOS O SERVIÇO DE <Text style={{ fontWeight: "bold" }}>{tipoServico.toUpperCase()}</Text>.
          </Text>
        </View>

        <View style={{ marginTop: 20, gap: 8 }}>
          <Text style={styles.text}>Horário de entrada do funcionário: <Text style={{ fontSize: 11, fontWeight: "bold" }}>{horaEntrada}</Text></Text>
          <Text style={styles.text}>Horário de saída do funcionário: <Text style={{ fontSize: 11, fontWeight: "bold" }}>{horaSaida}</Text></Text>
        </View>

        <View style={{ marginTop: 36, flexDirection: "row", justifyContent: "space-between" }}>
          <View style={styles.signatureBlock}>
            {assinaturaTecnico?.url ? <Image src={assinaturaTecnico.url} style={{ width: 180, height: 60, objectFit: "contain" }} /> : null}
            <Text style={{ marginTop: 0, fontSize: 11 }}>________________________________</Text>
            <Text style={{ marginTop: 6, fontSize: 11 }}>{assinaturaTecnico?.nome ?? ""}</Text>
            <Text style={{ marginTop: 2, fontSize: 11 }}>(Funcionário)</Text>
          </View>
          <View style={styles.signatureBlock}>
            {assinaturaCondominio?.url ? (
              <Image src={assinaturaCondominio.url} style={{ width: 180, height: 60, objectFit: "contain" }} />
            ) : null}
            <Text style={{ marginTop: 0, fontSize: 11 }}>________________________________</Text>
            <Text style={{ marginTop: 6, fontSize: 11 }}>{assinaturaCondominio?.nome ?? ""}</Text>
            <Text style={{ marginTop: 2, fontSize: 11 }}>(Funcionário do Condomínio)</Text>
          </View>
        </View>

        <View style={{ marginTop: 28, alignItems: "flex-end" }}>
          <Text style={[styles.text, { fontWeight: "bold" }]}>Data: {data}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateTermoConclusaoPdfBuffer({ documentoId }: GenerateTermoParams): Promise<{ buffer: Buffer, fileName: string } | null> {
  const documento = await prisma.documentoOperacional.findUnique({
    where: { id: documentoId },
    include: {
      assinaturas: true,
      pedido: {
        select: {
          id: true,
          cliente: { select: { razaoSocial: true } },
          orcamento: {
            select: {
              empresaId: true,
              empresa: { select: { id: true, logoUrl: true, nome: true } as any } as any,
            } as any,
          },
        },
      },
    },
  })

  if (!documento || !documento.pedido) return null
  const documentoData = documento as any

  const tipoServico = (documentoData.dadosExtras as any)?.tipoServico ?? ""
  const condominio = documentoData.pedido.cliente?.razaoSocial ?? ""
  const pedidoNumero = String(documentoData.pedido.id)

  // Busca assinaturas do documento
  const assinaturaTecnico = (documentoData.assinaturas as any[])?.find(
    (a: any) => a?.dadosExtras?.role === "funcionario_tecnico",
  )
  const assinaturaCondominio = (documentoData.assinaturas as any[])?.find(
    (a: any) => a?.dadosExtras?.role === "funcionario_condominio",
  )

  // Resolve URLs para data URL (necessário para @react-pdf)
  const tecnicoUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaTecnico?.url)
  const condominioUrlResolvida = await resolveDocOperacionalAssinaturaUrl(assinaturaCondominio?.url)

  const visita = await prisma.visitaTecnica.findFirst({
    where: { pedidoId: documentoData.pedidoId },
    orderBy: { dataRegistroFim: "desc" },
    select: { dataRegistroInicio: true, dataRegistroFim: true },
  })

  const horaEntrada = visita?.dataRegistroInicio
    ? new Date(visita.dataRegistroInicio).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    })
    : ""
  const horaSaida = visita?.dataRegistroFim
    ? new Date(visita.dataRegistroFim).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    })
    : ""
  const dataStr =
    visita?.dataRegistroFim || visita?.dataRegistroInicio
      ? new Date(visita.dataRegistroFim ?? visita.dataRegistroInicio!).toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
      : new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })

  const logoFromEmpresa = documentoData.pedido.orcamento?.empresa?.logoUrl ?? null
  const logoDataUrl = await resolveEmpresaLogoDataUrl({
    logoUrl: logoFromEmpresa,
    empresaId: documentoData.pedido.orcamento?.empresaId ?? documentoData.pedido.orcamento?.empresa?.id ?? null,
  })

  const empresaNome = documentoData.pedido.orcamento?.empresa?.nome ?? null
  const empresaContato = getEmpresaContato(empresaNome)

  const doc = (
    <TermoDoc
      logoDataUrl={logoDataUrl}
      condominio={condominio}
      pedidoNumero={pedidoNumero}
      tipoServico={tipoServico}
      horaEntrada={horaEntrada}
      horaSaida={horaSaida}
      data={dataStr}
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
      empresaContato={empresaContato}
    />
  )

  const buffer = await renderToBuffer(doc)
  const fileName = `termo-conclusao-${documentoId}.pdf`

  return { buffer, fileName }
}

export async function generateTermoConclusaoPdf({ documentoId }: GenerateTermoParams): Promise<string | null> {
  const result = await generateTermoConclusaoPdfBuffer({ documentoId })
  if (!result) return null

  const { buffer } = result
  const key = `documentos/termos_conclusao/termo_conclusao_${documentoId}.pdf`
  const uploaded = await storage.uploadPrivateObject({
    key,
    contentType: "application/pdf",
    body: buffer,
  })

  await prisma.documentoOperacional.update({
    where: { id: documentoId },
    data: { url: uploaded.url },
  })

  return uploaded.url
}


