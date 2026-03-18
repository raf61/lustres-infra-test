import { prisma } from '../../../lib/prisma';
import { IClientRepository, ClientSummary, ClientUpdateParams } from '../../domain/repositories/client-repository';

export class PrismaClientRepository implements IClientRepository {
  async findById(id: number): Promise<ClientSummary | null> {
    const record = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        razaoSocial: true,
        cnpj: true,
        nomeSindico: true,
        dataContatoAgendado: true,
      },
    });

    if (!record) return null;
    return {
      id: record.id,
      razaoSocial: record.razaoSocial,
      cnpj: record.cnpj,
      nomeSindico: record.nomeSindico,
      dataContatoAgendado: record.dataContatoAgendado,
    };
  }

  async findByCnpj(cnpj: string): Promise<ClientSummary | null> {
    const normalizedCnpj = cnpj.trim().replace(/\D/g, '');
    if (!normalizedCnpj) return null;
    const rows = await prisma.$queryRaw<
      Array<{ id: number; razaoSocial: string; cnpj: string; nomeSindico: string | null; dataContatoAgendado: Date | null }>
    >`
      SELECT id, "razaoSocial", cnpj, "nomeSindico", "dataContatoAgendado"
      FROM "Client"
      WHERE regexp_replace(cnpj, '\\D', '', 'g') = ${normalizedCnpj}
      LIMIT 1
    `;

    const client = rows[0] || null;

    if (!client) return null;
    return {
      id: client.id,
      razaoSocial: client.razaoSocial,
      cnpj: client.cnpj,
      nomeSindico: client.nomeSindico,
      dataContatoAgendado: client.dataContatoAgendado,
    };
  }

  async update(id: number, data: ClientUpdateParams): Promise<void> {
    await prisma.client.update({
      where: { id },
      data: {
        ...(data.nomeSindico !== undefined ? { nomeSindico: data.nomeSindico } : {}),
        ...(data.telefoneSindico !== undefined ? { telefoneSindico: data.telefoneSindico } : {}),
        ...(data.emailSindico !== undefined ? { emailSindico: data.emailSindico } : {}),
        ...(data.telefoneCondominio !== undefined ? { telefoneCondominio: data.telefoneCondominio } : {}),
        ...(data.celularCondominio !== undefined ? { celularCondominio: data.celularCondominio } : {}),
        ...(data.observacao !== undefined ? { observacao: data.observacao } : {}),
        ...(data.dataContatoAgendado !== undefined ? { dataContatoAgendado: data.dataContatoAgendado } : {}),
      },
    });
  }
}

