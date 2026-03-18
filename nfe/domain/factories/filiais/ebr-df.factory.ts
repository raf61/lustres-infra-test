
import { getItemNfeDescription } from "../../config/nfe-item-description-map"
import { findIbgeCode } from "../../config/ibge-municipios-map"

export class EbrDfFactory {
    static getRequiredExtras() {
        return []
    }

    // Método estático para construir o payload da NF
    static build(pedido: any, extras: any = {}, filial: any) {
        const cliente = pedido.cliente
        const dadosCadastrais = filial.dadosCadastrais || {}

        // Utilitários de formatação
        const formatCnpj = (v: string) => v ? v.replace(/\D/g, '') : ''
        const formatCep = (v: string) => v ? v.replace(/\D/g, '') : ''

        // === Construção do Texto "Outras Informações" ===
        const linhasLegais = [
            "DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL e",
            "NAO GERA DIREITO A CREDITO FISCAL DE IPI"
        ]

        // Adiciona observações do pedido
        // Observações internas do pedido NÃO vão para a nota fiscal
        // if (pedido.observacoes) { linhasLegais.push(...) }

        const additionalInformation = linhasLegais.join(" ")

        // === Dados do Serviço e Valor ===
        const itensTodos = (pedido as any).itens || []

        // Usar todos os itens para a nota fiscal, não filtrar mais
        const itensServicos = itensTodos

        const totalServicos = itensServicos.reduce((acc: number, item: any) => {
            const qtd = item.quantidade ?? 1
            const valor = item.valorUnitarioPraticado ?? item.valorUnitario ?? 0
            return acc + (qtd * valor)
        }, 0)

        const servicoPrestado = itensServicos.map((item: any) => {
            const qtd = item.quantidade ?? 1
            const nome = getItemNfeDescription(item)
            return `${qtd}x ${nome}`
        }).join("\n") || ""

        const cityName = cliente.cidade || ""
        const cityCode = findIbgeCode(cityName)

        return {
            borrower: {
                type: cliente.cnpj && cliente.cnpj.replace(/\D/g, '').length > 11 ? "LegalEntity" : "NaturalPerson",
                name: cliente.razaoSocial,
                federalTaxNumber: formatCnpj(cliente.cnpj),
                municipalTaxNumber: cliente.inscricaoMunicipal || "",
                email: (cliente as any).email || (cliente as any).emailSindico || "",
                address: {
                    country: "BRA",
                    postalCode: formatCep(cliente.cep),
                    street: cliente.logradouro || "",
                    number: cliente.numero || "S/N",
                    additionalInformation: cliente.complemento || "",
                    district: cliente.bairro || "",
                    city: {
                        code: cityCode,
                        name: cityName
                    },
                    state: cliente.estado || ""
                }
            },
            cityServiceCode: "1701",
            cnaeCode: "8211300",
            nbsCode: "113032000",
            description: servicoPrestado,
            servicesAmount: totalServicos,

            retentionType: "WithheldByBuyer",
            issAmountWithheld: totalServicos * (5 / 100),// não to conseguindo.

            issuedOn: new Date().toISOString(),

            // Texto legal completo
            additionalInformation: additionalInformation,

            location: {
                country: "BRA",
                postalCode: formatCep(cliente.cep),
                street: cliente.logradouro || "",
                number: cliente.numero || "S/N",
                additionalInformation: cliente.complemento || "",
                district: cliente.bairro || "",
                city: {
                    code: cityCode,
                    name: cityName
                },
                state: cliente.estado || ""
            }
        }
    }
}
