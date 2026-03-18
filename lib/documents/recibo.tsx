
import React from "react"
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from "@react-pdf/renderer"
import { formatCurrency } from "@/lib/formatters"

const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 10, fontFamily: "Helvetica" },
    header: { flexDirection: "row", marginBottom: 20, borderBottom: 1, paddingBottom: 10 },
    logoSection: { width: "70%" },
    logo: { maxHeight: 60, objectFit: "contain" },
    cnpj: { fontSize: 8, marginTop: 5, color: "#555" },
    reciboTitleSection: { width: "30%", alignItems: "flex-end", justifyContent: "center" },
    reciboTitle: { fontWeight: "bold", fontSize: 12, marginBottom: 5 },
    reciboMeta: { fontSize: 9, textAlign: "right" },

    section: { marginBottom: 15 },
    sectionTitle: { fontWeight: "bold", fontSize: 11, marginBottom: 8, textAlign: "center", backgroundColor: "#eee", padding: 4 },

    clientInfo: { padding: 5, gap: 2 },
    bold: { fontWeight: "bold" },

    table: { width: "100%", marginTop: 10 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", borderTop: 1, borderBottom: 1, fontWeight: "bold" },
    tableRow: { flexDirection: "row", borderBottom: 0.5, borderColor: "#ccc" },
    cell: { padding: 4 },
    cellUni: { width: "10%" },
    cellQtd: { width: "10%", textAlign: "center" },
    cellDesc: { width: "50%" },
    cellVal: { width: "15%", textAlign: "right" },
    cellTotal: { width: "15%", textAlign: "right" },

    totalsSection: { marginTop: 10, borderBottom: 1, borderLeft: 1, borderRight: 1 },
    totalRow: { flexDirection: "row", borderTop: 1 },
    totalLabel: { width: "85%", padding: 5, textAlign: "right", fontWeight: "bold" },
    totalValue: { width: "15%", padding: 5, textAlign: "right", fontWeight: "bold" },

    footer: { marginTop: 20, textAlign: "right", fontStyle: "italic", fontSize: 8, color: "#666" }
})

export type ReciboPdfProps = {
    logoUrl: string
    numeroRecibo: string
    data: string
    cliente: {
        razaoSocial: string
        endereco: string
        bairro: string
        cidadeUF: string
        cep: string
        cnpj: string
        email: string
        telefone: string
    }
    condPagamento: string
    itens: Array<{
        quantidade: number
        descricao: string
        valorUnitario: number
        valorTotal: number
    }>
    valorTotal: number
    vendedor: string
    pedidoId: number
    impressoEm: string
}

export function ReciboDoc(props: ReciboPdfProps) {
    const { logoUrl, numeroRecibo, data, cliente, condPagamento, itens, valorTotal, vendedor, pedidoId, impressoEm } = props

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoSection}>
                        <Image src={logoUrl} style={styles.logo} />
                        <Text style={styles.cnpj}>CNPJ: 51.621.017/0001-05</Text>
                    </View>
                    <View style={styles.reciboTitleSection}>
                        <Text style={styles.reciboTitle}>RECIBO</Text>
                        <Text style={styles.reciboMeta}>№ {numeroRecibo}</Text>
                        <Text style={styles.reciboMeta}>{data}</Text>
                    </View>
                </View>

                {/* Cliente */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>USUÁRIO DOS SERVIÇOS</Text>
                    <View style={styles.clientInfo}>
                        <Text><Text style={styles.bold}>Cliente:</Text> {cliente.razaoSocial}</Text>
                        <Text><Text style={styles.bold}>Endereço:</Text> {cliente.endereco}  <Text style={styles.bold}>Bairro:</Text> {cliente.bairro}</Text>
                        <Text><Text style={styles.bold}>Cidade/Estado:</Text> {cliente.cidadeUF}  <Text style={styles.bold}>CEP:</Text> {cliente.cep}</Text>
                        <Text><Text style={styles.bold}>Tel:</Text> {cliente.telefone}</Text>
                        <Text><Text style={styles.bold}>CNPJ:</Text> {cliente.cnpj}  <Text style={styles.bold}>Email:</Text> {cliente.email}</Text>
                        <Text style={{ marginTop: 4 }}><Text style={styles.bold}>Cond. de pagamento:</Text> {condPagamento}</Text>
                    </View>
                </View>

                {/* Itens */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.cell, styles.cellUni]}>Uni.</Text>
                        <Text style={[styles.cell, styles.cellQtd]}>Qtd.</Text>
                        <Text style={[styles.cell, styles.cellDesc]}>Discriminação</Text>
                        <Text style={[styles.cell, styles.cellVal]}>Valor Un.</Text>
                        <Text style={[styles.cell, styles.cellTotal]}>Total</Text>
                    </View>
                    {itens.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                            <Text style={[styles.cell, styles.cellUni]}></Text>
                            <Text style={[styles.cell, styles.cellQtd]}>{item.quantidade}</Text>
                            <Text style={[styles.cell, styles.cellDesc]}>{item.descricao}</Text>
                            <Text style={[styles.cell, styles.cellVal]}>{formatCurrency(item.valorUnitario)}</Text>
                            <Text style={[styles.cell, styles.cellTotal]}>{formatCurrency(item.valorTotal)}</Text>
                        </View>
                    ))}
                </View>

                {/* Totais */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>{formatCurrency(valorTotal)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>TOTAL</Text>
                        <Text style={styles.totalValue}>{formatCurrency(valorTotal)}</Text>
                    </View>
                </View>

                {/* Info do Pedido */}
                <View style={{ marginTop: 15, fontSize: 9 }}>
                    <Text>Pedido: {pedidoId}</Text>
                    <Text>Vendedor: {vendedor}</Text>
                </View>

                <Text style={styles.footer}>Impresso em: {impressoEm}</Text>
            </Page>
        </Document>
    )
}

export async function generateReciboPdfBuffer(pedidoId: number): Promise<{ buffer: Buffer, fileName: string } | null> {
    const { prisma } = await import("@/lib/prisma")

    const pedido = await prisma.pedido.findUnique({
        where: { id: pedidoId },
        include: {
            cliente: true,
            orcamento: { include: { empresa: true } },
            vendedor: true,
            itens: { include: { item: true } }
        }
    })

    if (!pedido) return null

    const empresaNome = pedido.orcamento?.empresa?.nome || pedido.legacyEmpresaFaturamento || ""
    const isFranklin = empresaNome.toLowerCase().includes("franklin")
    const logoRelPath = isFranklin ? "public/logo_franklin.png" : "public/logo_ebr.png"

    const { resolveEmpresaLogoDataUrl } = await import("./logo-utils")
    const logoDataUrl = await resolveEmpresaLogoDataUrl({ logoUrl: logoRelPath })

    const dataPedido = pedido.createdAt
    const dataFormatada = dataPedido.toLocaleDateString("pt-BR")
    const impressoEm = new Date().toLocaleDateString("pt-BR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const numeroRecibo = `${pedido.id}${dataPedido.getFullYear()}`

    if (!pedido || !pedido.cliente) return null
    const c = pedido.cliente
    const enderecoCompleto = [c.logradouro, c.numero, c.complemento].filter(Boolean).join(" ")

    const parcelas = pedido.orcamento?.parcelas || 1
    const total = pedido.itens.reduce((acc, it) => acc + (it.quantidade * it.valorUnitarioPraticado), 0)
    const valorParcela = total / parcelas
    const condPagamento = `${parcelas}x de ${formatCurrency(valorParcela)} no boleto bancário`

    const props: ReciboPdfProps = {
        logoUrl: logoDataUrl as any,
        numeroRecibo,
        data: dataFormatada,
        cliente: {
            razaoSocial: c.razaoSocial ?? "",
            endereco: enderecoCompleto,
            bairro: c.bairro ?? "",
            cidadeUF: `${c.cidade ?? ""} / ${c.estado ?? ""}`,
            cep: c.cep ?? "",
            cnpj: c.cnpj ?? "",
            email: c.emailSindico ?? "",
            telefone: c.telefoneSindico ?? ""
        },
        condPagamento,
        itens: pedido.itens.map(pi => ({
            quantidade: pi.quantidade,
            descricao: pi.item.nome,
            valorUnitario: pi.valorUnitarioPraticado,
            valorTotal: pi.quantidade * pi.valorUnitarioPraticado
        })),
        valorTotal: total,
        vendedor: pedido.vendedor?.name || "Não informado",
        pedidoId,
        impressoEm
    }

    const buffer = await renderToBuffer(<ReciboDoc {...props} />)
    return { buffer, fileName: `recibo-${pedidoId}.pdf` }
}
