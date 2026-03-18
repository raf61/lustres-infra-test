"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Can } from "@/components/auth/can"

type InboxAllowedRolesItem = {
  id: string
  name: string
  provider: string
  phoneNumber: string | null
  allowedRoles: string[]
}

const parseRoles = (value: string) =>
  value
    .split(",")
    .map((role) => role.trim())
    .filter((role) => role.length > 0)

export default function InboxesPage() {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inboxes, setInboxes] = useState<InboxAllowedRolesItem[]>([])
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const [newInbox, setNewInbox] = useState({
    name: "",
    phoneNumberId: "",
    displayPhoneNumber: "",
    allowedRoles: "",
    wabaId: "",
  })

  const loadInboxes = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/chat/inboxes/allowed-roles", { cache: "no-store" })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Erro ao carregar inboxes")
      }
      const payload = await response.json()
      const list = Array.isArray(payload?.inboxes) ? payload.inboxes : []
      setInboxes(list)
      setInputValues(
        list.reduce((acc: Record<string, string>, inbox: InboxAllowedRolesItem) => {
          acc[inbox.id] = inbox.allowedRoles.join(", ")
          return acc
        }, {})
      )
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar inboxes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInboxes()
  }, [])

  const orderedInboxes = useMemo(
    () => inboxes.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [inboxes]
  )

  const handleChange = (id: string, value: string) => {
    setInputValues((current) => ({ ...current, [id]: value }))
  }

  const handleSave = async (inboxId: string) => {
    setSavingId(inboxId)
    setError(null)
    try {
      const roles = parseRoles(inputValues[inboxId] || "")
      const response = await fetch(`/api/chat/inboxes/${inboxId}/allowed-roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowedRoles: roles }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Erro ao salvar")
      }
      const payload = await response.json()
      setInboxes((current) =>
        current.map((inbox) =>
          inbox.id === inboxId ? { ...inbox, allowedRoles: payload.allowedRoles || roles } : inbox
        )
      )
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar")
    } finally {
      setSavingId(null)
    }
  }

  const handleSyncTemplates = async (inboxId: string) => {
    setSyncingId(inboxId)
    setError(null)
    try {
      const response = await fetch(`/api/chat/inboxes/${inboxId}/templates/sync`, {
        method: "POST",
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Erro ao sincronizar templates")
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao sincronizar templates")
    } finally {
      setSyncingId(null)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const response = await fetch("/api/chat/inboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newInbox.name,
          phoneNumberId: newInbox.phoneNumberId,
          displayPhoneNumber: newInbox.displayPhoneNumber || null,
          allowedRoles: parseRoles(newInbox.allowedRoles),
          whatsappCloud: {
            wabaId: newInbox.wabaId || null,
          },
        }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || "Erro ao criar inbox")
      }
      setNewInbox({
        name: "",
        phoneNumberId: "",
        displayPhoneNumber: "",
        allowedRoles: "",
        wabaId: "",
      })
      await loadInboxes()
    } catch (err: any) {
      setError(err?.message || "Erro ao criar inbox")
    } finally {
      setCreating(false)
    }
  }

  return (
    <DashboardLayout>
      <Can roles={["MASTER", "ADMINISTRADOR"]} fallback={<div>Sem permissão.</div>}>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Configurar inboxes</h1>
            <p className="text-muted-foreground">
              Edite apenas os allowed roles (lista separada por vírgula).
            </p>
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}
          {loading ? <div className="text-sm text-muted-foreground">Carregando...</div> : null}

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="font-medium text-foreground">Criar nova inbox</div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={newInbox.name}
                onChange={(event) => setNewInbox((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome da inbox"
              />
              <Input value="whatsapp_cloud" disabled />
              <Input
                value={newInbox.phoneNumberId}
                onChange={(event) =>
                  setNewInbox((current) => ({ ...current, phoneNumberId: event.target.value }))
                }
                placeholder="Phone Number ID"
              />
              <Input
                value={newInbox.displayPhoneNumber}
                onChange={(event) =>
                  setNewInbox((current) => ({ ...current, displayPhoneNumber: event.target.value }))
                }
                placeholder="Número exibido (opcional)"
              />
              <Input
                value={newInbox.wabaId}
                onChange={(event) => setNewInbox((current) => ({ ...current, wabaId: event.target.value }))}
                placeholder="WABA ID"
              />
              <Input
                value={newInbox.allowedRoles}
                onChange={(event) =>
                  setNewInbox((current) => ({ ...current, allowedRoles: event.target.value }))
                }
                placeholder="Allowed roles (opcional) - ex: MASTER, SAC"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCreate} disabled={creating}>
                {creating ? "Criando..." : "Criar inbox"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {orderedInboxes.map((inbox) => (
              <div
                key={inbox.id}
                className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{inbox.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {inbox.provider}
                      {inbox.phoneNumber ? ` • ${inbox.phoneNumber}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSyncTemplates(inbox.id)}
                      disabled={syncingId === inbox.id}
                    >
                      {syncingId === inbox.id ? "Sincronizando..." : "Sync templates"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(inbox.id)}
                      disabled={savingId === inbox.id}
                    >
                      {savingId === inbox.id ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
                <Input
                  value={inputValues[inbox.id] ?? ""}
                  onChange={(event) => handleChange(inbox.id, event.target.value)}
                  placeholder="MASTER, ADMINISTRADOR, SAC"
                />
              </div>
            ))}
          </div>
        </div>
      </Can>
    </DashboardLayout>
  )
}

