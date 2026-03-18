import { prisma } from "../lib/prisma";
import { format } from "date-fns";

/**
 * RODA O DISPARO DE FATO VIA API
 * 
 * 1. Extrai os clientes (Ativos + Pedidos recentes)
 * 2. Monta o Payload do Broadcast
 * 3. Envia o POST para a rota de API com Autenticação
 */

// CONFIGURAÇÕES
const API_URL = "https://sistema-ebr.vercel.app/api/chat/broadcast";
const AUTH_TOKEN = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDLUhTNTEyIiwia2lkIjoiNk1IcWN4aDVqTkJ0cndZa2k1RHE0RUNRLUpYdXlGWkNJUVhYaDdFdVk4NTA4aUZfY3MwWDJ1YXJmd1ZVeEdYUXpzNF9tcmpsQ0FSeHBLaDc2bjV4UFEifQ.._zhOZNVzSrSTmVLR3tkVWw.oE760ibxcka9Eh9YhEaM8wa6KY7xB_nSdqYDV-h3Z9Suh4ZwfiW-38SQovbslZ0mlDRdv5rPlKuJs9JVaE70YFcCUCF2Nke5L--uRG2NTO9Gd8LmZDRRGSGNBuL8OC5jI8wd3jUQDKOxNi4G1QQvpM6eUginetFk37IACp3aUr6jOkR3qY6S_5bSVKCfutDjzIopyYZkj0nD52nambvfNOz0jzRNCYZMOsUEPNMPqbdRR6r0p0L5rStaF4efRjdy.a2VCjmwL0beXFzt1K5sLSw_OLqaDvm4KMzkVby2ckJY"; // Preencha com o token do Auth.js (Session Cookie ou JWT se disponível)
const DRY_RUN = false; // Mude para false para disparar de verdade
const LIMIT = 60; // Mude para 0 para processar a lista inteira
const excludeIds = [8110, 8112, 8257, 8292, 8406, 8546, 8566, 8568, 8632, 8703, 8712, 8722, 8756, 8758, 8794, 8803, 8821, 8884, 8899, 8939, 8977, 9005, 9016, 9055, 9105, 9106, 9120, 9163, 9169, 9225, 9241, 9385, 9552, 9609, 9634, 9650, 9658, 9741, 9803, 9848, 9862, 9937, 9975, 10042, 10043, 10141, 10151, 10212, 10221, 10271, 10301, 10330, 10394, 10396, 10404, 10418, 11602, 11644, 11653, 11688, 11703, 11712, 11715, 11731, 11744, 11779, 11787, 11837, 11982, 12003, 12066, 12099, 12113, 12116, 12157, 12246, 12251, 12266, 12296, 12382, 13527, 13557, 13572, 13578, 13683, 13774, 13787, 14918, 14957, 15058, 16133, 16219, 16242, 16288, 16318, 16334, 16403, 16500, 16513, 16549, 16585, 16703, 16736, 16909, 16925, 16950, 17010, 17014, 17015, 17064, 17193, 17204, 17244, 17287, 17309, 17360, 17377, 17398, 17484, 17700, 17807, 17860, 17874, 17917, 17939, 17997, 18011, 18013, 18060, 18103, 19126, 19131, 19140, 20149, 20172, 20240, 20474, 20533, 20588, 20752, 20788, 20801, 20931, 20992, 21097, 21131, 21151, 21190, 21208, 21212, 21217, 21275, 21278, 21308, 21406, 21416, 21458, 21462, 21480, 21582, 21783, 21784, 21993, 22034, 22044, 22096, 22122, 22124, 22132, 22139, 22168, 22177, 22227, 22296, 22310, 22328, 22368, 22508, 22514, 22568, 22607, 22608, 22648, 22738, 22888, 22917, 22938, 22952, 22978, 23050, 23069, 23099, 23181, 23199, 23250, 23313, 23331, 23363, 23473, 23496, 23498, 23538, 23552, 23571, 24635, 24778, 24975, 24989, 25004, 25099, 25159, 25165, 25179, 25180, 25188, 25190, 25206, 25218, 25308, 25339, 25351, 25352, 25353, 25357, 25381, 25411, 25442, 25481, 25487, 25511, 25543, 25544, 25566, 25573, 25591, 25681, 25683, 25688, 25696, 25723, 25724, 25760, 25783, 25787, 25888, 25892, 25969, 26079, 26130, 26134, 26138, 26160, 26216, 26318, 26434, 26471, 26502, 26552, 26559, 26568, 26575, 26650, 26676, 26683, 26733, 26737, 26739, 26753, 26762, 26778, 26814, 26858, 26875, 26877, 26892, 26901, 26910, 26915, 26931, 26953, 26962, 26980, 26990, 26998, 27000, 27017, 27033, 27079, 27093, 27104, 27131, 27139, 27259, 27300, 27334, 27402, 27409, 27426, 27457, 27498, 27534, 27555, 27593, 27606, 27609, 27642, 27652, 27674, 27685, 27686, 27714, 27720, 27734, 27737, 27745, 27752, 27778, 27800, 27830, 27874, 27887, 27905, 27922, 27939, 27946, 27955, 27984, 27988, 27997, 28101, 28106, 28122, 28130, 28160, 28171, 28173, 28180, 28190, 28199, 28204, 28210, 28212, 28214, 28240, 28258, 28275, 28298, 28299, 28308, 28311, 28353, 28400, 28406, 28424, 28432, 28450, 28479, 28495, 28537, 28541, 28545, 28546, 28560, 28567, 28575, 28588, 28593, 28596, 28607, 28609, 28611, 28622, 28627, 28629, 28630, 28639, 28691, 28731, 28811, 28824, 28840, 28847, 28863, 28867, 28870, 28871, 28873, 28877, 28881, 28883, 28885, 28886, 28887, 28888, 28890, 28891, 28892, 28894, 28895, 28896, 28897, 28898, 28899, 28900, 28901, 28902, 28903, 28904, 28906, 28907, 28908, 28909, 28910, 28911, 28912, 28968, 28969];
async function executeBroadcast() {
    console.log(`🚀 Iniciando Processo de Disparo (${DRY_RUN ? "DRY RUN" : "REAL"})`);

    const startDate = new Date("2025-12-01T00:00:00Z");
    const endDate = new Date("2026-02-28T23:59:59Z");

    console.log(await prisma.client.count({
        where: {
            pedidos: {
                some: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    },
                },
            },
        },
    }));

    let clients = await prisma.client.findMany({
        where: {
            id: { notIn: excludeIds },
            pedidos: {
                some: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
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
        take: LIMIT > 0 ? LIMIT : undefined,
    });

    if (clients.length === 0) {
        console.log("❌ Nenhum cliente encontrado nos critérios.");
        return;
    }

    console.log(`✅ ${clients.length} clientes extraídos.`);

    console.log("🆔 IDs dos Clientes sendo processados:", JSON.stringify(clients.map(c => c.id)));

    let contacts = clients.map((c) => {
        const phone = c.telefoneSindico || c.celularCondominio;
        const normalizedPhone = phone ? phone.replace(/\D/g, "") : "";
        const finalPhone = normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;

        return {
            phoneNumber: finalPhone,
            contactName: c.nomeSindico || "Síndico(a)",
            clientId: c.id,
        };
    }).filter(c => c.phoneNumber.length >= 10);

    const payload = {
        inboxId: "cml51kqqv0000jv16opatx82u",
        name: `Recuperação de Mandato - ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        chatbotFlowId: "cmms9okxa0001jl04p2ls4ap7", // SEU NOVO FLUXO
        forceChatbotAssign: true,
        keepChatbot: true,
        contacts,
        message: {
            contentType: "template",
            contentAttributes: {
                template: {
                    name: "finalizar_cadastro_pedido",
                    languageCode: "pt_BR",
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", parameter_name: "nome_pessoa", text: "{{contact.name}}" },
                                { type: "text", parameter_name: "razao_social", text: "{{client.razaoSocial}}" }
                            ]
                        }
                    ]
                }
            }
        }
    };

    if (DRY_RUN) {
        console.log("\n📦 [DRY RUN] Payload que seria enviado:");
        console.log(JSON.stringify(payload, null, 2));
        console.log("\nPara disparar de verdade, altere DRY_RUN = false no script.");
        return;
    }

    console.log(`📤 Enviando POST para ${API_URL}...`);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // No Auth.js, geralmente você precisará passar o Cookie de sessão se rodar fora do browser, 
                // ou um cabeçalho de Authorization se houver suporte a JWT.
                "Cookie": `__Secure-authjs.session-token=${AUTH_TOKEN}`
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok) {
            console.log("✨ Disparo aceito com sucesso pela API!");
            console.log("Resultado:", result.data);
        } else {
            console.error("❌ Erro no disparo:", result.error || response.statusText);
        }
    } catch (error) {
        console.error("❌ Falha na conexão com a API:", error);
    }
}

executeBroadcast()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
