import React from "react"
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { resolveEmpresaLogoDataUrl } from "./logo-utils"
import { getEmpresaContato, type EmpresaContato } from "@/lib/constants"

export type PropostaEmpresaKey = "EBR" | "FRANKLIN"

export type PropostaOrcamentoInput = {
  empresa: PropostaEmpresaKey
  razaoSocial: string
  vocativo: string
  produto: string
  valorPorEquipamento: number
  valorUnitario: number
  subtotal: number
  numeroParcelas: number
  primeiraParcela: string
  garantiaMeses: number
  consultorNome: string
  consultorCelular: string
  consultorEmail: string
  // Novos campos para a proposta moderna
  cnpj?: string
  endereco?: string
  cnpjEmpresa?: string
  data?: string
  conclusaoDias?: number
}

const LOGO_BY_EMPRESA: Record<PropostaEmpresaKey, string> = {
  EBR: "/logo_ebr.png",
  FRANKLIN: "/logo_franklin.png",
}

const currency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatQuantidade = (value: number) => String(value).padStart(2, "0")

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 22,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1f2933",
  },
  logo: {

    height: 140,
    objectFit: "contain",
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1f4e8c",
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 4,
    color: "#2b2b2b",
    fontWeight: "bold",
  },
  paragraph: {
    marginBottom: 8,
    lineHeight: 1.3,
    fontWeight: "bold",
    color: "black",
  },
  paragraphCenter: {
    marginTop: 10,
    marginBottom: 10,
    lineHeight: 0.5,
    textAlign: "center",
    color: "#2b2b2b",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 6,
    color: "#1f4e8c",
    backgroundColor: "#fff59d",
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  listItem: {
    marginLeft: 10,
    marginBottom: 3,
    flexDirection: "row",
  },
  listBullet: {
    color: "#1f4e8c",
    fontWeight: "bold",
  },
  listText: {
    color: "black",
    fontWeight: "bold",
  },
  label: { fontWeight: "bold", color: "#1f4e8c" },
  investment: {
    marginTop: 2,
    marginBottom: 6,
  },
  callout: {
    border: "1 solid #000000",
    padding: 8,
    marginTop: 50,
    marginBottom: 8,
    textAlign: "center",
    backgroundColor: "#fff59d",
  },
  image: {
    width: "100%",
    height: 180,
    marginTop: 10,
    objectFit: "cover",
  },
  footer: {
    marginTop: 4,
    fontSize: 10,
    textAlign: "center",
    color: "#1f2933",
  },
  validity: {
    marginTop: 8,
    fontSize: 10,
    textAlign: "center",
    color: "#1f2933",
    fontWeight: "bold",
  },
  footerTitle: {
    marginTop: 6,
    fontSize: 10,
    textAlign: "center",
    color: "#1f2933",
    fontWeight: "bold",
  },
  footerName: {
    marginTop: 2,
    fontSize: 11,
    textAlign: "center",
    color: "#1f2933",
    fontWeight: "bold",
  },
  footerRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerIcon: {
    width: 14,
    height: 14,
    objectFit: "contain",
    marginRight: 6,
  },
  footerContact: {
    fontSize: 11,
    color: "#1f2933",
    fontWeight: "bold",
  },
})

function PropostaDoc(props: {
  logoDataUrl: string | null
  buildingDataUrl: string | null
  zapDataUrl: string | null
  emailDataUrl: string | null
  input: PropostaOrcamentoInput & { valorParcela: number }
}) {
  const { logoDataUrl, buildingDataUrl, zapDataUrl, emailDataUrl, input } = props

  const escopoItems = [
    "Reaperto dos isoladores, conectores e luminosos",
    "Teste de resistividade do solo (Medição ôhmica)",
    "Certificação da conformidade (Laudo Técnico)",
    "Verificação do aterramento",
    "Alinhamento do mastro e esticamento de cabos (quando houver necessidade)",
    "Correção do sistema de contraventagem (quando houver necessidade)",
  ]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {logoDataUrl ? <Image src={logoDataUrl} style={styles.logo} /> : null}

        <Text style={styles.title}>Proposta de serviço de manutenção preventiva do SPDA</Text>
        <Text style={styles.subtitle}>{input.razaoSocial}</Text>
        <Text style={styles.subtitle}>{input.vocativo}</Text>

        <Text style={styles.paragraphCenter}>
          Apresentamos nossa proposta para o serviço de certificação da manutenção do sistema de proteção contra
          descargas atmosféricas (SPDA).
        </Text>

        <Text style={styles.sectionTitle}>Objetivo:</Text>
        <Text style={styles.paragraph}>
          Garantir que o SPDA esteja em conformidade com a NBR 5419, garantindo a segurança do condomínio.
        </Text>

        <Text style={styles.sectionTitle}>Escopo do Serviço:</Text>
        {escopoItems.map((item) => (
          <Text key={item} style={styles.listItem}>
            <Text style={styles.listBullet}>• </Text>
            <Text style={styles.listText}>{item}</Text>
          </Text>
        ))}

        <Text style={styles.sectionTitle}>Condições de pagamento:</Text>
        <Text style={styles.listItem}>
          <Text style={styles.listBullet}>• </Text>
          <Text style={styles.label}>Produto:</Text>
          <Text> {input.produto}</Text>
        </Text>
        <Text style={styles.listItem}>
          <Text style={styles.listBullet}>• </Text>
          <Text style={styles.label}>Valor por equipamento:</Text>
          <Text> {formatQuantidade(input.valorPorEquipamento)}</Text>
        </Text>
        <Text style={styles.listItem}>
          <Text style={styles.listBullet}>• </Text>
          <Text style={styles.label}>Valor Un:</Text>
          <Text> {currency(input.valorUnitario)}</Text>
        </Text>
        <Text style={styles.listItem}>
          <Text style={styles.listBullet}>• </Text>
          <Text style={styles.label}>Subtotal:</Text>
          <Text> {currency(input.subtotal)}</Text>
        </Text>

        <Text style={styles.sectionTitle}>Investimento:</Text>
        <Text style={styles.listItem}>
          <Text style={styles.listBullet}>• </Text>
          <Text style={styles.listText}>
            O valor pode ser parcelado em até {input.numeroParcelas}x no boleto bancário sem juros{" "}
            {currency(input.valorParcela)} Reais
          </Text>
        </Text>
        <Text style={styles.listItem}>
          <Text style={styles.listBullet}>• </Text>
          <Text style={styles.label}>Primeira parcela:</Text>
          <Text> {input.primeiraParcela}</Text>
        </Text>

        <Text style={styles.sectionTitle}>Garantia:</Text>
        <Text style={styles.listItem}>
          <Text style={styles.listBullet}>• </Text>
          <Text style={styles.listText}>{input.garantiaMeses} meses do serviço realizado.</Text>
        </Text>

        <Text style={styles.sectionTitle}>Documentos finais:</Text>
        <Text style={styles.paragraph}>
          Ao término do serviço, será emitido um laudo técnico com validade de 12 meses e ART em até 15 dias úteis,
          mediante a conformidade APTO do sistema.
        </Text>
        <Text style={styles.callout}>
          Após a manutenção do equipamento do SPDA, caso haja alguma irregularidade, nosso departamento de engenharia
          entrará em contato, orientando o procedimento a ser seguido.
        </Text>

        <Text style={styles.validity}>Validade da proposta: 07 dias após o envio</Text>
        {buildingDataUrl ? <Image src={buildingDataUrl} style={styles.image} /> : null}

        <Text style={styles.footerTitle}>Atenciosamente,</Text>
        <Text style={styles.footerName}>Consultor(a): {input.consultorNome}</Text>
        <View style={styles.footerRow}>
          {zapDataUrl ? <Image src={zapDataUrl} style={styles.footerIcon} /> : null}
          <Text style={styles.footerContact}>Contato: {input.consultorCelular}</Text>
        </View>
        <View style={styles.footerRow}>
          {emailDataUrl ? <Image src={emailDataUrl} style={styles.footerIcon} /> : null}
          <Text style={styles.footerContact}>{input.consultorEmail}</Text>
        </View>
      </Page>
    </Document>
  )
}

/**
 * Gera a proposta usando o NOVO MODELO (Moderna).
 */
export async function generatePropostaOrcamentoPdf(input: PropostaOrcamentoInput) {
  const empresaNome = input.empresa === "EBR" ? "Empresa Brasileira de Raios" : "Franklin"
  const empresaContato = getEmpresaContato(empresaNome)

  const cnpjEmpresa = input.cnpjEmpresa || (input.empresa === "EBR" ? "51.621.017/0001-05" : "00.000.000/0001-00")

  const [logoDataUrl, illustrationDataUrl, abntDataUrl, whatsappQrDataUrl] = await Promise.all([
    resolveEmpresaLogoDataUrl({ logoUrl: input.empresa === "EBR" ? "public/logo_ebr.png" : "public/logo_franklin.png" }),
    resolveEmpresaLogoDataUrl({ logoUrl: "public/para-raios-ilustracao-nova.png" }),
    resolveEmpresaLogoDataUrl({ logoUrl: "public/abnt-imagem.png" }),
    input.empresa === "EBR" ? resolveEmpresaLogoDataUrl({ logoUrl: "public/qrcode_zap_ebr.png" }) : Promise.resolve(null),
  ])

  // @ts-ignore - Usando a estrutura interna da proposta moderna mas mantendo o nome da função padrão
  return renderToBuffer(
    <PropostaModernaDoc
      logoDataUrl={logoDataUrl}
      illustrationDataUrl={illustrationDataUrl}
      abntDataUrl={abntDataUrl}
      whatsappQrDataUrl={whatsappQrDataUrl}
      input={input as any}
      empresaContato={empresaContato}
      cnpjEmpresa={cnpjEmpresa}
    />
  )
}

/**
 * Gera a proposta usando o MODELO ANTIGO (Obsoleto).
 */
export async function generatePropostaOrcamentoPdfLegacy(
  input: PropostaOrcamentoInput & { valorParcela: number },
) {
  const logoPath = LOGO_BY_EMPRESA[input.empresa] ?? LOGO_BY_EMPRESA.EBR

  const [logoDataUrl, buildingDataUrl, zapDataUrl, emailDataUrl] = await Promise.all([
    resolveEmpresaLogoDataUrl({ logoUrl: logoPath }),
    resolveEmpresaLogoDataUrl({ logoUrl: "public/building.jpg" }),
    resolveEmpresaLogoDataUrl({ logoUrl: "public/zap.jpg" }),
    resolveEmpresaLogoDataUrl({ logoUrl: "public/at.jpg" }),
  ])

  return renderToBuffer(
    <PropostaDoc
      logoDataUrl={logoDataUrl}
      buildingDataUrl={buildingDataUrl}
      zapDataUrl={zapDataUrl}
      emailDataUrl={emailDataUrl}
      input={input}
    />,
  )
}

// ---------------- NOVO COMPONENTE (MODERNA) ----------------

const modernStyles = StyleSheet.create({
  page: { paddingTop: 20, paddingHorizontal: 40, paddingBottom: 20, fontSize: 10, fontFamily: "Helvetica", color: "#333" },
  header: { flexDirection: "row", border: "1 solid #bfbfbf", padding: 8, marginBottom: 15, alignItems: "center" },
  logoContainer: { width: "33%", alignItems: "center" },
  logo: { width: 80, height: 60, objectFit: "contain" },
  companyInfo: { width: "34%", alignItems: "center", justifyContent: "center" },
  orcamentoInfo: { width: "33%", border: "1 solid #333", padding: 5, alignItems: "center", justifyContent: "center" },
  clientSection: { marginBottom: 10 },
  bold: { fontWeight: "bold" },
  greeting: { marginTop: 5, marginBottom: 5 },
  text: { lineHeight: 0.8, marginBottom: 8, textAlign: "justify" },
  listContainer: { marginBottom: 8 },
  listItem: { flexDirection: "row", marginBottom: 1 },
  bullet: { width: 10 },
  illustrationSection: { flexDirection: "row", marginTop: 5, marginBottom: 5, alignItems: "flex-start" },
  illustration: { width: "40%", height: 140, objectFit: "contain" },
  illustrationList: { width: "60%", paddingLeft: 10 },
  red: { color: "red" },
  investmentSection: { marginTop: 5, marginBottom: 5 },
  additionalInfo: { fontSize: 9, marginTop: 5, color: "#555" },
  footer: { marginTop: "auto", flexDirection: "row", alignItems: "center", position: "relative", minHeight: 60 },
  signatureSection: { flex: 1, alignItems: "center", justifyContent: "center" },
  abntLogo: { width: 100, height: 50, objectFit: "contain" }
})

function PropostaModernaDoc(props: {
  logoDataUrl: string | null
  illustrationDataUrl: string | null
  abntDataUrl: string | null
  whatsappQrDataUrl: string | null
  input: PropostaOrcamentoInput
  empresaContato: EmpresaContato
  cnpjEmpresa: string
}) {
  const { logoDataUrl, illustrationDataUrl, abntDataUrl, whatsappQrDataUrl, input, empresaContato, cnpjEmpresa } = props
  const data = input.data || new Date().toLocaleDateString("pt-BR")
  const conclusaoDias = input.conclusaoDias || 10
  const garantiaMeses = input.garantiaMeses || 12

  return (
    <Document title={`Proposta EBR - ${input.razaoSocial}`}>
      <Page size="A4" style={modernStyles.page}>
        <View style={modernStyles.header}>
          <View style={modernStyles.logoContainer}>
            {logoDataUrl ? <Image src={logoDataUrl} style={modernStyles.logo} /> : null}
            <Text style={{ fontSize: 9, marginTop: 4, fontWeight: "bold" }}>{empresaContato.telefone}</Text>
            <Text style={{ fontSize: 9 }}>www.{empresaContato.site}</Text>
          </View>
          <View style={modernStyles.companyInfo}>
            <Text style={[modernStyles.bold, { fontSize: 10, textAlign: "center" }]}>
              {input.empresa === "EBR" ? "EMPRESA BRASILEIRA DE RAIOS" : "FRANKLIN PARARAIOS"}
            </Text>
            <Text style={{ fontSize: 9, marginTop: 2 }}>CNPJ: {cnpjEmpresa}</Text>
            {whatsappQrDataUrl && input.empresa === "EBR" ? (
              <Image src={whatsappQrDataUrl} style={{ width: 60, height: 60, marginTop: 2 }} />
            ) : null}
          </View>
          <View style={modernStyles.orcamentoInfo}>
            <Text style={modernStyles.bold}>ORÇAMENTO</Text>
            <Text>DATA: {data}</Text>
          </View>
        </View>

        <View style={modernStyles.clientSection}>
          <Text style={modernStyles.bold}>{input.razaoSocial}</Text>
          <Text><Text style={modernStyles.bold}>CNPJ: </Text>{input.cnpj || "---"}</Text>
          <Text><Text style={modernStyles.bold}>Endereço: </Text>{input.endereco || "---"}</Text>
        </View>

        <View style={modernStyles.greeting}>
          <Text>{input.vocativo}</Text>
        </View>

        <Text style={modernStyles.text}>
          Apresentamos nossa proposta para Certificação Anual da Manutenção do Sistema de Proteção Contra Descargas Atmosféricas (SPDA) do condomínio, garantindo a proteção por mais {garantiaMeses} meses de segurança, conforme determina a NBR 5419 ABNT, com observância das normas do CREA, COSCIP e do Corpo de Bombeiros.
        </Text>

        <Text style={[modernStyles.bold, { textDecoration: "underline", marginBottom: 5 }]}>Procedimento padrão para emissão do Certificado Anual:</Text>
        <View style={modernStyles.listContainer}>
          {[
            "Alinhar mastro e cabos e pintar com tinta anticorrosiva, quando necessário;",
            "Correção no sistema contra ventagem;",
            "Verificação de isoladores, captores e luminoso;",
            "Manutenção no sistema elétrico;",
            "Verificação de descida;",
            "Verificação do aterramento;",
            "Teste de resistividade do Solo (Medição Ôhmica);",
            "Anotação de Responsabilidade Técnica registrada no CREA."
          ].map((item, idx) => (
            <View key={idx} style={modernStyles.listItem}>
              <Text style={modernStyles.bullet}>-</Text>
              <Text>{item}</Text>
            </View>
          ))}
        </View>

        <View style={modernStyles.illustrationSection}>
          {illustrationDataUrl && input.empresa === "EBR" ? (
            <Image src={illustrationDataUrl} style={modernStyles.illustration} />
          ) : (
            <View style={modernStyles.illustration} />
          )}
          <View style={modernStyles.illustrationList}>
            <Text style={[modernStyles.bold, { textDecoration: "underline", marginBottom: 5, fontSize: 9 }]}>Sistema de Proteção Contra Descargas Atmosféricas</Text>
            {[
              { id: 1, text: "Captor SPDA tipo Franklin" },
              { id: 2, text: "Mastro Galvanizado" },
              { id: 3, text: "Suporte isoladores para mastros" },
              { id: 4, text: "Base de fixação e contraventagens" },
              { id: 5, text: "Gaiola de Faraday" },
              { id: 6, text: "Terminal aéreo" },
              { id: 7, text: "Condutor de descida (cabo de cobre nu)" },
              { id: 8, text: "Suporte de isoladores para condutor de descida" },
              { id: 9, text: "Haste de aterramento" }
            ].map((item) => (
              <View key={item.id} style={modernStyles.listItem}>
                <Text style={[modernStyles.bold, modernStyles.red, { width: 15 }]}>{item.id}</Text>
                <Text style={{ fontSize: 9 }}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={modernStyles.investmentSection}>
          <Text style={[modernStyles.bold, { marginBottom: 2 }]}>Custo de Manutenção de SPDA: {currency(input.valorUnitario)} por sistema</Text>
          <Text style={[modernStyles.bold, { marginBottom: 2 }]}>Forma de pagamento: Parcelamento em até {input.numeroParcelas} vezes sem juros no boleto bancário.</Text>
          <Text style={[modernStyles.bold, { marginBottom: 2 }]}>Conclusão em até {conclusaoDias} dias úteis.</Text>
          <Text style={[modernStyles.bold, { marginBottom: 2 }]}>Ao final do serviço é emitido o Certificado com validade de {garantiaMeses} meses.</Text>
          <Text style={modernStyles.bold}>
            ART (Anotação de Responsabilidade Técnica - CREA) em até 15 dias úteis, mediante <Text style={{ textDecoration: "underline" }}>Conformidade</Text> e <Text style={{ textDecoration: "underline" }}>Aptidão</Text> do sistema.
          </Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={modernStyles.text}>
            Havendo a necessidade de troca de peças, nosso departamento de engenharia entrará em contato orientando a aquisição necessária. Faremos a substituição, sem custo de mão de obra.
          </Text>
        </View>

        <View style={modernStyles.additionalInfo}>
          <Text style={[modernStyles.bold, { marginBottom: 3, lineHeight: 0.8 }]}>INFORMAÇÕES ADICIONAIS:</Text>
          <Text style={{ textAlign: "justify", lineHeight: 0.8 }}>
            Os materiais a serem utilizados nos serviços acima descritos, serão adquiridos de fornecedores de primeira linha, de acordo com aprovação do cliente: Tinta- Coral ou equivalente, Conectores/ Terminais – Intelli, Hastes de Terra- Cadweld, Mastros/Isoladores/Suportes (Galvanizados a fogo) Paratec, Cabo de cobre nu – Normatizado conforme norma, Eletroduto PVC – Tigre ou equivalente - Abraçadeiras D – Paratec.
          </Text>
        </View>

        <View style={modernStyles.footer}>
          {/* Espaçador invisível à esquerda para equilibrar o centramento da assinatura se necessário, 
              mas como a assinatura tem flex:1 e a imagem está à direita, vamos usar um container absoluto para a imagem ou flexbox cuidadoso */}
          <View style={{ width: 100 }} />
          <View style={modernStyles.signatureSection}>
            <Text style={modernStyles.bold}>{input.consultorNome}</Text>
            <Text>Departamento Comercial</Text>
            <Text>{input.consultorCelular || empresaContato.telefone}</Text>
          </View>
          <View style={{ width: 100, alignItems: "flex-end" }}>
            {abntDataUrl && input.empresa === "EBR" ? (
              <Image src={abntDataUrl} style={modernStyles.abntLogo} />
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  )
}

