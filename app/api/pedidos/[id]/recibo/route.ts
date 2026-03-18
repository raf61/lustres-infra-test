import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const pedidoId = parseInt(id)

        if (isNaN(pedidoId)) {
            return new NextResponse("ID Inválido", { status: 400 })
        }

        const pedido = await prisma.pedido.findUnique({
            where: { id: pedidoId },
            include: {
                cliente: true,
                orcamento: {
                    include: { empresa: true }
                },
                vendedor: true,
                itens: { include: { item: true } }
            }
        })

        if (!pedido) {
            return new NextResponse("Pedido não encontrado", { status: 404 })
        }

        // Determine Logo
        // Se empresa do orçamento indicar Franklin, usa logo da Franklin.
        const empresaNome = pedido.orcamento?.empresa?.nome || pedido.legacyEmpresaFaturamento || ""
        const isFranklin = empresaNome.toLowerCase().includes("franklin")
        const logoUrl = isFranklin ? "/logo_franklin.png" : "/logo_ebr.png"

        // Formatação de dados
        const dataPedido = pedido.createdAt
        const dia = dataPedido.getDate().toString().padStart(2, '0')
        const mes = (dataPedido.getMonth() + 1).toString().padStart(2, '0')
        const ano = dataPedido.getFullYear()
        const dataFormatada = `${dia}/${mes}/${ano}`
        const dataExtenso = dataPedido.toLocaleDateString("pt-BR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

        // Numero "319952026" parece ser ID + ANO.
        const numeroRecibo = `${pedido.id}${ano}`

        // Cliente
        const c = pedido.cliente
        const enderecoCompleto = [c.logradouro, c.numero, c.complemento].filter(Boolean).join(" ")
        const bairro = c.bairro || ""
        const cidadeUF = `${c.cidade || ""} / ${c.estado || ""}`
        const cep = c.cep || ""

        // Telefones do Sindico
        const telSindico = c.telefoneSindico || ""
        const emailSindico = c.emailSindico || ""

        // Itens HTML
        let itensHtml = ""
        let total = 0

        if (pedido.itens && pedido.itens.length > 0) {
            pedido.itens.forEach(pi => {
                const valorTotalItem = pi.quantidade * pi.valorUnitarioPraticado
                total += valorTotalItem
                itensHtml += `
             <tr>
                <td class="bt br" width="40" style="font-size: 10pt;">&nbsp;</td>
                <td class="bt br" width="40" style="width: 40px;font-size: 10pt; text-align: center;">${pi.quantidade}</td>
                <td class="bt br" width="280" style="width: 280px;font-size: 10pt; padding-left: 5px;">${pi.item.nome}</td>
                <td class="bt br text-right" width="120" style="width: 120px;font-size: 10pt; text-align: right; padding-right: 5px;">
                    ${pi.valorUnitarioPraticado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td class="bt text-right" width="80" style="width: 80px;font-size: 10pt; text-align: right; padding-right: 5px;">
                    ${valorTotalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
             </tr>
            `
            })
        }

        const totalFormatado = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const vendedorNome = pedido.vendedor?.name || "Não informado"
        const parcelas = pedido.orcamento?.parcelas || 1
        const valorParcela = (total / (parcelas || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const condPagamento = `${parcelas}x de ${valorParcela} no boleto bancário`

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>Recibo #${pedidoId}</title>
    <style>
        body { font-family: 'Open Sans', Arial, sans-serif; -webkit-print-color-adjust: exact; }
        .relatorio { width: 820px; margin: 0 auto; border-collapse: collapse; }
        .bt { border-top: 1px solid #000; }
        .bb { border-bottom: 1px solid #000; }
        .bl { border-left: 1px solid #000; }
        .br { border-right: 1px solid #000; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        td { padding: 4px; vertical-align: top; }
        p { margin: 2px 0; }
    </style>
</head>
<body style="background: #fff; padding: 20px;">
    <div class="relatorio">
        <table class="relatorio bl br bb" style="width: 100%; border: 1px solid #000;">
           <tr>
              <td colspan="3" class="text-center" style="font-size: 11pt; border-right: 1px solid #000;" width="550">
                    <img src="${logoUrl}" style="max-height: 80px; float: left; margin: 10px;" />
                    <div style="padding-top: 10px;">
                        
                        <span>CNPJ: 51.621.017/0001-05</span>
                    </div>
              </td>
              <td colspan="2" class="text-center" style="font-size: 10pt; vertical-align: middle;" width="270">
                 <p style="font-weight: 700; text-transform: uppercase;">Recibo de prestação de serviços</p>
                 <p>
                    <strong>Nº ${numeroRecibo}</strong><br />
                    ${dataFormatada}<br />
                    Natureza dos Serviços: <strong>Manutenção</strong>
                 </p>
              </td>
           </tr>
           <tr>
              <td colspan="5" class="bt">
                 <p style="font-size: 12pt; font-weight: 700; text-align: center; margin-top: 10px; margin-bottom: 10px;">USUÁRIO DOS SERVIÇOS</p>
                 <p style="font-size: 10pt; padding: 0 10px;">
                    <strong>Cliente: </strong> ${c.razaoSocial}<br />
                    <strong>Endereço: </strong> ${enderecoCompleto}  <strong>Bairro: </strong> ${bairro}<br/>
                    <strong>Cidade/Estado: </strong> ${cidadeUF} <strong>CEP:</strong> ${cep}<br />
                    <strong>Tel. Sindico: </strong> ${telSindico}<br />
                    <strong>CNPJ: </strong> ${c.cnpj} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Email: </strong>${emailSindico} <br />
                    <strong>Cond. de pagamento: </strong> ${condPagamento}
                 </p>
                 <br/>
              </td>
           </tr>
           <tr style="background-color: #eee;">
              <td class="bt br" width="40" style="font-size: 10pt; font-weight: bold;">Uni.</td>
              <td class="bt br text-center" width="40" style="font-size: 10pt; font-weight: bold;">Qtd.</td>
              <td class="bt br" width="280" style="font-size: 10pt; font-weight: bold;">Discriminação</td>
              <td class="bt br text-right" width="120" style="font-size: 10pt; font-weight: bold;">Valor Unitário</td>
              <td class="bt text-right" width="80" style="font-size: 10pt; font-weight: bold;">Valor Total</td>
           </tr>
           ${itensHtml}

           <tr>
              <td colspan="5" class="bt br" style="border-bottom: 0;">&nbsp;</td>
           </tr>
           <tr>
              <td colspan="3" class="bt br" style="font-size: 10pt;">Pedido: ${pedidoId}</td>
              <td class="bt br" style="font-size: 10pt; font-weight: bold;">Valor dos serviços</td>
              <td class="bt br text-right" style="font-size: 10pt; font-weight: bold;">${totalFormatado}</td>
           </tr>
           <tr>
              <td colspan="3" class="bt br" style="font-size: 10pt;">Vendedor: ${vendedorNome}</td>
              <td class="bt br">&nbsp;</td>
              <td class="bt br text-right">&nbsp;</td>
           </tr>
           <tr>
              <td colspan="3" class="bt br bb">&nbsp;</td>
              <td class="bt br bb" style="font-size: 10pt; font-weight: bold;">Total da nota</td>
              <td class="bt br text-right bb" style="font-size: 10pt; font-weight: bold;">${totalFormatado}</td>
           </tr>
        </table>
        
        <p>&nbsp;</p>
        
        <table style="width: 100%;">
            <tr>
                <td align="right">
                    <div style="font-size: 9pt; color: #666;">
                        Impresso em: ${dataExtenso}
                    </div>
                </td>
            </tr>
        </table>
    </div>
    <script>
        window.print();
    </script>
</body>
</html>
    `

        return new NextResponse(html, {
            headers: {
                "Content-Type": "text/html",
            }
        })

    } catch (error) {
        console.error(error)
        return new NextResponse("Erro interno", { status: 500 })
    }
}
