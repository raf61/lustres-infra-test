export type ClientSummary = {
  id: number;
  razaoSocial: string;
  cnpj: string;
  nomeSindico?: string | null;
  dataContatoAgendado?: Date | null;
};

export type ClientUpdateParams = {
  nomeSindico?: string | null;
  telefoneSindico?: string | null;
  emailSindico?: string | null;
  telefoneCondominio?: string | null;
  celularCondominio?: string | null;
  observacao?: string | null;
  dataContatoAgendado?: Date | null;
};

export interface IClientRepository {
  findById(id: number): Promise<ClientSummary | null>;
  findByCnpj(cnpj: string): Promise<ClientSummary | null>;
  update(id: number, data: ClientUpdateParams): Promise<void>;
}

