import { getItemNfeDescription } from "../../config/nfe-item-description-map"
import { findIbgeCode } from "../../config/ibge-municipios-map"

export class EbrRjFactory {
    static getRequiredExtras() {
        return ['codigoObra'] // Campos que a UI deve renderizar como input extra
    }

    // Método estático para construir o payload da NF
    static build(pedido: any, extras: { codigoObra?: string } = {}, filial: any = null) {
        const cliente = pedido.cliente
        const dadosCadastrais = filial?.dadosCadastrais || {}
        // Fallback hardcoded por segurança de compatibilidade antiga
        const locationFallback = {
            postalCode: "20710030",
            street: "RUA MARIA CALMON",
            number: "34",
            district: "MEIER",
            city: "RIO DE JANEIRO"
        }

        // Utilitários de formatação e sanitização
        const formatCnpj = (v: string) => v ? v.replace(/\D/g, '') : ''
        const formatCep = (v: string) => v ? v.replace(/\D/g, '') : ''
        const sanitize = (text: string) => {
            return text
                .replace(/[&%#@<>]/g, '') // Remove caracteres especiais proibidos
                .replace(/https?:\/\/\S+/g, '') // Remove URLs
                .replace(/<[^>]*>?/gm, '') // Remove tags HTML
                .replace(/\n{2,}/g, '\n') // Remove quebras de linha excessivas
                .replace(/[ ]{2,}/g, ' ') // Remove espaços duplicados
                .trim();
        }

        // === Construção do Texto "Outras Informações" ===
        // O usuário solicitou que nas informações complementares conste APENAS o código da obra para a EBR RJ
        const additionalInformation = extras.codigoObra ? `Cod. Obra: ${extras.codigoObra.replace(/\D/g, '')}` : ""

        // === Dados do Serviço e Valor ===
        const itensTodos = (pedido as any).itens || []
        const itensServicos = itensTodos

        const totalServicos = itensServicos.reduce((acc: number, item: any) => {
            const qtd = item.quantidade ?? 1
            const valor = item.valorUnitarioPraticado ?? item.valorUnitario ?? 0
            return acc + (qtd * valor)
        }, 0)

        const servicoPrestado = sanitize(itensServicos.map((item: any) => {
            const qtd = item.quantidade ?? 1
            const nome = getItemNfeDescription(item)
            return `${qtd}x ${nome}`
        }).join("\n") || "SERVIÇOS DE ADEQUAÇÃO PREDIAL").substring(0, 1000)

        // Resolução IBGE automático
        const cityName = cliente.cidade || ""
        const cityCode = findIbgeCode(cityName)

        return {
            borrower: {
                type: cliente.cnpj && cliente.cnpj.replace(/\D/g, '').length > 11 ? "LegalEntity" : "NaturalPerson",
                name: cliente.razaoSocial,
                federalTaxNumber: formatCnpj(cliente.cnpj),
                municipalTaxNumber: cliente.inscricaoMunicipal && cliente.inscricaoMunicipal.trim() !== "" ? cliente.inscricaoMunicipal : null,
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
            cityServiceCode: "070202.059",
            description: servicoPrestado,
            servicesAmount: totalServicos,

            issuedOn: new Date().toISOString(),
            issRetained: false,

            additionalInformation: additionalInformation,

            // Novo campo construction para código de obra
            ...(extras.codigoObra && {
                construction: {
                    workId: { scheme: 'bra.cno', value: extras.codigoObra.replace(/\D/g, '') }
                }
            }),

            location: {
                state: filial?.uf || "RJ",
                country: "BRA",
                postalCode: formatCep(dadosCadastrais.cep || locationFallback.postalCode),
                street: dadosCadastrais.logradouro || locationFallback.street,
                number: dadosCadastrais.numero || locationFallback.number,
                district: dadosCadastrais.bairro || locationFallback.district,
                additionalInformation: dadosCadastrais.complemento || "",
                city: {
                    code: "3304557",
                    name: dadosCadastrais.municipio || locationFallback.city
                }
            }
        }
    }
}
