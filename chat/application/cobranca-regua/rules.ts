import { COBRANCA_REGUA_RULES } from "./regua-config"

export type CobrancaReguaRule = {
  key: string
  label: string
  offsetStartDays: number
  offsetEndDays: number
  inboxId: string
  templateName: string
  parameters?: {
    headerDocument?: {
      linkToken: string
      filenameToken?: string
    }
    headerMedia?: {
      linkToken: string
    }
    headerTextTokens?: string[]
    headerTextParamNames?: string[]
    bodyTextTokens?: string[]
    bodyTextParamNames?: string[]
    buttonTextTokens?: string[]
  }
}

export const loadCobrancaReguaRules = (): CobrancaReguaRule[] => {
  return (COBRANCA_REGUA_RULES || []).filter(
    (rule) => rule?.key && rule?.inboxId && rule?.templateName,
  ) as CobrancaReguaRule[]
}


