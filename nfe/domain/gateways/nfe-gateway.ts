// Interface agnóstica para o provedor de nota fiscal
// Isso garante Clean Architecture: o domínio não depende da lib nfe-io diretamente

export interface NfeGateway {
    createCompany(data: any): Promise<any>
    issueServiceInvoice(companyId: string, payload: any): Promise<any>
    cancelServiceInvoice(companyId: string, invoiceId: string): Promise<any>
    downloadPdf(companyId: string, invoiceId: string): Promise<Buffer>
    downloadXml(companyId: string, invoiceId: string): Promise<string>
}
