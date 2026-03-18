import { PrismaClient } from "@prisma/client"
import { IClientChatContactRepository } from "../domain/repositories/client-chat-contact-repository"
import { PrismaClientChatContactRepository } from "../infra/repositories/prisma-client-chat-contact-repository"

export type BulkSyncChatContactsInput = {
    clientIds: number[]
}

export type UnlinkedItem = {
    clientId: number
    razaoSocial: string
    contactId: string
    contactWaId: string
    contactName: string | null
}

export type BulkSyncChatContactsOutput = {
    processed: number
    unlinkedCount: number
    unlinkedItems: UnlinkedItem[]
}

/**
 * UseCase responsável por sincronizar os vínculos de chat de múltiplos clientes.
 */
export class BulkSyncChatContactsUseCase {
    private readonly clientChatContactRepository: IClientChatContactRepository

    constructor(private readonly prisma: any) {
        this.clientChatContactRepository = new PrismaClientChatContactRepository()
    }

    async execute(input: BulkSyncChatContactsInput): Promise<BulkSyncChatContactsOutput> {
        const { clientIds } = input

        if (!clientIds || clientIds.length === 0) {
            return { processed: 0, unlinkedCount: 0, unlinkedItems: [] }
        }

        const results: BulkSyncChatContactsOutput = {
            processed: 0,
            unlinkedCount: 0,
            unlinkedItems: [],
        }

        const clients = await this.prisma.client.findMany({
            where: { id: { in: clientIds } },
            select: {
                id: true,
                razaoSocial: true,
                telefoneSindico: true,
                telefoneCondominio: true,
                celularCondominio: true,
                telefonePorteiro: true,
                chatContacts: {
                    include: {
                        contact: {
                            select: {
                                id: true,
                                waId: true,
                                name: true
                            }
                        }
                    }
                }
            }
        })

        const getNormalizedVariants = (phone: string | null | undefined): string[] => {
            if (!phone) return []
            const digits = phone.replace(/\D/g, "")
            if (!digits) return []

            const variants = new Set<string>()
            variants.add(digits)

            if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
                variants.add("55" + digits)
            }

            if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
                variants.add(digits.slice(2))
            }

            const currentArray = Array.from(variants)
            currentArray.forEach(v => {
                if (v.startsWith("55")) {
                    if (v.length === 13) {
                        variants.add(v.slice(0, 4) + v.slice(5))
                    } else if (v.length === 12 && !["1", "2", "3", "4", "5"].includes(v[4])) {
                        variants.add(v.slice(0, 4) + "9" + v.slice(4))
                    }
                }
                else {
                    if (v.length === 11) {
                        variants.add(v.slice(0, 2) + v.slice(3))
                    } else if (v.length === 10 && !["1", "2", "3", "4", "5"].includes(v[2])) {
                        variants.add(v.slice(0, 2) + "9" + v.slice(2))
                    }
                }
            })

            return Array.from(variants)
        }

        for (const client of clients) {
            results.processed++

            const currentPhones = new Set<string>()
                ;[
                    client.telefoneSindico,
                    client.telefoneCondominio,
                    client.celularCondominio,
                    client.telefonePorteiro
                ].forEach(phone => {
                    getNormalizedVariants(phone).forEach(variant => currentPhones.add(variant))
                })

            for (const link of client.chatContacts) {
                const contactWaIdPure = link.contact.waId.replace(/\D/g, "")

                if (!currentPhones.has(contactWaIdPure)) {
                    const deletedCount = await this.clientChatContactRepository.removeLink(
                        link.contact.id,
                        client.id
                    )

                    if (deletedCount > 0) {
                        results.unlinkedCount += deletedCount
                        results.unlinkedItems.push({
                            clientId: client.id,
                            razaoSocial: client.razaoSocial,
                            contactId: link.contact.id,
                            contactWaId: link.contact.waId,
                            contactName: link.contact.name
                        })
                    }
                }
            }
        }

        return results
    }
}
