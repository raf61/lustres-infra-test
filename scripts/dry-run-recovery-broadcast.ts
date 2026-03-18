import { prisma } from "../lib/prisma";
import { format } from "date-fns";

async function dryRunBroadcast() {
    console.log("🚀 Iniciando Dry Run para extração de contatos (Pesquisa)...");

    // Filtro de 3 meses atras (Dez/25, Jan/26, Fev/26)
    // Como hoje é Março, pegamos desde 01/12/2025
    const startDate = new Date("2025-12-01T00:00:00Z");

    const clients = await prisma.client.findMany({
        where: {
            // Clientes ativos (Presumindo que visivelDashVendedor ou algum status indique atividade, 
            // mas o pedido já é um forte sinal de atividade)
            pedidos: {
                some: {
                    createdAt: {
                        gte: startDate,
                    },
                },
            },
        },
        select: {
            id: true,
            razaoSocial: true,
            nomeSindico: true,
            celularCondominio: true,
            telefoneSindico: true,
        },
        take: 10, // Limite solicitado para teste
    });

    console.log(`📊 Clientes encontrados com pedidos desde ${startDate.toLocaleDateString()}: ${clients.length}`);

    const contacts = clients.map((c) => {
        // Tenta pegar o melhor celular disponível
        const phone = c.telefoneSindico || c.celularCondominio;

        // Normalização básica para o padrão do Broadcast (apenas números)
        const normalizedPhone = phone ? phone.replace(/\D/g, "") : "";
        // Adiciona 55 se não tiver
        const finalPhone = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;

        return {
            phoneNumber: finalPhone,
            contactName: c.nomeSindico || "Síndico(a)",
            clientId: c.id,
            razaoSocial: c.razaoSocial, // Guardamos para as variáveis do template
        };
    }).filter(c => c.phoneNumber.length >= 10);

    // Montagem do payload do POST
    const payload = {
        inboxId: "cml51kqqv0000jv16opatx82u",
        name: `Campanha de Recuperação Info - ${format(new Date(), "dd/MM/yyyy")}`,
        chatbotFlowId: "cmms9okxa0001jl04p2ls4ap7",
        contacts: contacts.map(c => ({
            phoneNumber: c.phoneNumber,
            contactName: c.contactName,
            clientId: c.clientId
        })),
        message: {
            contentType: "template",
            contentAttributes: {
                template: {
                    name: "finalizar_cadastro_pedido",
                    language: { code: "pt_BR" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: "{{nome_pessoa}}" }, // Marcadores para o worker de broadcast saber o que injetar
                                { type: "text", text: "{{razao_social}}" }
                            ]
                        }
                    ]
                }
            }
        }
    };

    console.log("\n📦 JSON PAYLOAD SUGERIDO (Primeiros 10):");
    console.log(JSON.stringify(payload, null, 2));

    console.log("\n⚠️ OBSERVAÇÃO: O sistema de broadcast substitui as variáveis {{...}} automaticamente se os campos existirem no metadado do contato.");
}

dryRunBroadcast()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
