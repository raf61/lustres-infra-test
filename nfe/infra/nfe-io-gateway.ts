
import { NfeGateway } from '../domain/gateways/nfe-gateway'

export class NfeIoGateway implements NfeGateway {
    private apiKey: string
    private baseUrl: string = 'https://api.nfe.io/v1'

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.NFE_IO_API_KEY || ''

        if (this.apiKey) {
            console.log(`[NfeIoGateway] Ready (Native Fetch). Key: ${this.apiKey.substring(0, 4)}...`)
        } else {
            console.warn("[NfeIoGateway] ALERTA: Sem API Key!")
        }
    }

    private async request(method: string, endpoint: string, body?: any, responseType: 'json' | 'buffer' | 'text' = 'json', customTimeout?: number) {
        const url = `${this.baseUrl}${endpoint}`
        const headers: HeadersInit = {
            'Authorization': this.apiKey,
            'Accept': 'application/json'
        }
        if (body) {
            headers['Content-Type'] = 'application/json'
            console.log("[NfeIoGateway] Payload Payload:", JSON.stringify(body, null, 2))
        }

        console.log(`[NfeIoGateway] ${method} ${url}`)

        const timeout = customTimeout || 90000 // 90 segundos de timeout padrão
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
            const res = await fetch(url, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
                cache: 'no-store'
            })

            if (!res.ok) {
                let erro = res.statusText
                try {
                    const data = await res.json()
                    erro = JSON.stringify(data)
                } catch {
                    try { erro = await res.text() } catch { }
                }
                throw new Error(`Nfe.io Error ${res.status}: ${erro}`)
            }

            if (responseType === 'buffer') return Buffer.from(await res.arrayBuffer())
            if (responseType === 'text') return await res.text()
            return await res.json()

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.error(`[NfeIoGateway] Requisição abortada por timeout (${timeout}ms): ${method} ${url}`)
                throw new Error(`A prefeitura ou a Nfe.io demorou muito para responder (Timeout de ${timeout / 1000}s). Tente novamente em instantes.`)
            }
            console.error(`[NfeIoGateway] Falha na requisição: ${error.message}`)
            throw error
        } finally {
            clearTimeout(timeoutId)
        }
    }

    async issueServiceInvoice(companyId: string, payload: any) {
        // Envia a solicitação de emissão
        const invoice = await this.request('POST', `/companies/${companyId}/serviceinvoices`, payload)

        console.log(`[NfeIoGateway] Nota criada. ID: ${invoice.id}. Status: ${invoice.status}`)

        // Opcional: Implementar polling rápido aqui se quiser simular o 'createAndWait' da lib

        return invoice
    }

    async fetchServiceInvoice(companyId: string, invoiceId: string, timeout = 30000) {
        return await this.request('GET', `/companies/${companyId}/serviceinvoices/${invoiceId}`, undefined, 'json', timeout)
    }

    async cancelServiceInvoice(companyId: string, invoiceId: string) {
        return await this.request('DELETE', `/companies/${companyId}/serviceinvoices/${invoiceId}`, undefined, 'json', 45000)
    }

    async downloadPdf(companyId: string, invoiceId: string): Promise<Buffer> {
        return await this.request('GET', `/companies/${companyId}/serviceinvoices/${invoiceId}/pdf`, undefined, 'buffer', 120000)
    }

    async downloadXml(companyId: string, invoiceId: string): Promise<string> {
        return await this.request('GET', `/companies/${companyId}/serviceinvoices/${invoiceId}/xml`, undefined, 'text', 120000)
    }

    async createCompany(data: any) {
        return await this.request('POST', `/companies`, data)
    }
}
