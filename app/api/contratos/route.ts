import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLoggedUserId } from "@/lib/vendor-dashboard";
import { auth } from "@/auth";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const session = await auth();
        const isAdmin = ["MASTER", "ADMINISTRADOR", "FINANCEIRO", "SUPERVISOR"].includes(session?.user?.role as string);
        const loggedVendedorId = session?.user?.id;

        // Filtros básicos
        const status = searchParams.get("status") || "vigente";
        const search = searchParams.get("search") || "";
        const cnpj = searchParams.get("cnpj") || "";
        const estado = searchParams.get("estado") || "";
        const cidade = searchParams.get("cidade") || "";
        const bairro = searchParams.get("bairro") || "";
        const month = searchParams.get("month");
        const year = searchParams.get("year");

        const page = parseInt(searchParams.get("page") || "1");
        const pageSize = 60;
        const skip = (page - 1) * pageSize;

        // Se for vendedor e não admin, filtra apenas os dele
        const vendedorIdFilter = isAdmin ? undefined : (loggedVendedorId || undefined);

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Construção do WHERE
        const where: any = {
            vendedorId: vendedorIdFilter,
        };

        // Filtro de Status Complexo
        if (status === "vigente") {
            where.status = "OK";
            where.dataFim = { gte: now };
        } else if (status === "expirado") {
            where.status = "OK";
            where.dataFim = { lt: now };
        } else if (status === "pendente") {
            where.status = "PENDENTE";
        } else if (status === "cancelado") {
            where.status = "CANCELADO";
        }


        // Busca por Cliente (Razão Social ou CNPJ)
        if (search || cnpj || (estado && estado !== "all") || (cidade && cidade !== "all") || bairro) {
            where.cliente = {};
            if (search) where.cliente.razaoSocial = { contains: search, mode: 'insensitive' };
            if (cnpj) where.cliente.cnpj = { contains: cnpj.replace(/\D/g, "") };
            if (estado && estado !== "all") where.cliente.estado = estado;
            if (cidade && cidade !== "all") where.cliente.cidade = { contains: cidade, mode: 'insensitive' };
            if (bairro) where.cliente.bairro = { contains: bairro, mode: 'insensitive' };
        }

        // Filtro de Mês/Ano baseado em dataFim
        if (year && year !== "all") {
            const y = parseInt(year);
            if (month && month !== "all") {
                const m = parseInt(month) - 1;
                where.dataFim = {
                    ...where.dataFim,
                    gte: new Date(y, m, 1),
                    lt: new Date(y, m + 1, 1),
                };
            } else {
                where.dataFim = {
                    ...where.dataFim,
                    gte: new Date(y, 0, 1),
                    lt: new Date(y + 1, 0, 1),
                };
            }
        }

        const [contratos, total, summaryByStatusData, byEstadoRaw] = await Promise.all([
            prisma.contratoManutencao.findMany({
                where,
                include: {
                    cliente: {
                        select: {
                            id: true,
                            razaoSocial: true,
                            cnpj: true,
                            cep: true,
                            logradouro: true,
                            numero: true,
                            complemento: true,
                            bairro: true,
                            cidade: true,
                            estado: true,
                            nomeSindico: true
                        }
                    },
                    vendedor: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: { dataFim: 'asc' },
                skip,
                take: pageSize
            }),
            prisma.contratoManutencao.count({ where }),
            // Sumários globais (ignorando filtros de status mas respeitando vendedor/search?)
            // O usuário pediu "nos filtros ponha vigente, expirado e cancelado"
            // Por performance e simplicidade, vamos calcular counts básicos baseados no vendedor logado
            prisma.$transaction([
                prisma.contratoManutencao.count({ where: { vendedorId: vendedorIdFilter, status: "OK", dataFim: { gte: now } } }),
                prisma.contratoManutencao.count({ where: { vendedorId: vendedorIdFilter, status: "OK", dataFim: { lt: now } } }),
                prisma.contratoManutencao.count({ where: { vendedorId: vendedorIdFilter, status: "PENDENTE" } }),
                prisma.contratoManutencao.count({ where: { vendedorId: vendedorIdFilter, status: "CANCELADO" } }),
                prisma.contratoManutencao.count({ where: { vendedorId: vendedorIdFilter } }),
            ]),
            // Agrupamento por Estado (apenas para Vigentes?)
            prisma.$queryRaw<{ estado: string; count: number }[]>`
                SELECT c.estado, COUNT(*)::int as count 
                FROM "ContratoManutencao" cm
                JOIN "Client" c ON c.id = cm."clienteId"
                WHERE cm.status = 'OK' AND cm."dataFim" >= ${now}
                ${vendedorIdFilter ? Prisma.sql`AND cm."vendedorId" = ${vendedorIdFilter}` : Prisma.sql`AND 1=1`}
                GROUP BY c.estado
                ORDER BY count DESC
            `
        ]);

        // Contagem mensal para o calendário (baseado no dataFim do ano selecionado)
        let byMonth: Record<string, number> = {};
        if (year && year !== "all") {
            const y = parseInt(year);
            const monthlyCounts = await prisma.contratoManutencao.groupBy({
                by: ['dataFim'],
                where: {
                    vendedorId: vendedorIdFilter,
                    status: "OK",
                    dataFim: {
                        gte: new Date(y, 0, 1),
                        lt: new Date(y + 1, 0, 1),
                    }
                },
                _count: true
            });

            // Agrupar por mês
            monthlyCounts.forEach(item => {
                const month = (item.dataFim.getMonth() + 1).toString().padStart(2, "0");
                byMonth[month] = (byMonth[month] || 0) + item._count;
            });
        }

        return NextResponse.json({
            data: contratos,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            },
            summary: {
                vigentes: summaryByStatusData[0],
                expirados: summaryByStatusData[1],
                pendentes: summaryByStatusData[2],
                cancelados: summaryByStatusData[3],
                total: summaryByStatusData[4],
                byEstado: byEstadoRaw,
                byMonth // Adicionado aqui

            }
        });
    } catch (error) {
        console.error("[GET_ALL_CONTRATOS]", error);
        return NextResponse.json({ error: "Erro ao buscar contratos" }, { status: 500 });
    }
}
