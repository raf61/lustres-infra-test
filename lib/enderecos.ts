type PartialEndereco = {
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
}

export const buildEndereco = (cliente: PartialEndereco) => {
  const partes: string[] = []
  if (cliente.logradouro) {
    const numero = cliente.numero ? `, ${cliente.numero}` : ""
    partes.push(`${cliente.logradouro}${numero}`)
  }
  if (cliente.complemento) {
    partes.push(cliente.complemento)
  }
  const bairroCidadeEstado = [cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(" - ")
  if (bairroCidadeEstado) {
    partes.push(bairroCidadeEstado)
  }
  return partes.join(" | ") || "Endereço não informado"
}

