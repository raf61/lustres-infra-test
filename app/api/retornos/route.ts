import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  lerArquivoRetornoCNAB400,
  CODIGO_BANCO_ITAU,
  OCORRENCIA as OCORRENCIA_ITAU,
  type ResultadoProcessamento,
  type ResultadoRetorno,
} from "@/lib/cnab-retorno/itau"
import {
  lerArquivoRetornoCNAB240,
  CODIGO_BANCO_SANTANDER,
  MOVIMENTO_SANTANDER,
  type DetalheRetornoCNAB240,
  type ResultadoProcessamentoSantander,
  type ResultadoRetornoSantander,
} from "@/lib/cnab-retorno/santander"

/**
 * POST /api/retornos
 * 
 * Processa arquivo de retorno CNAB.
 * 
 * FormData:
 * - arquivo: File (arquivo de retorno)
 * - bancoCodigo: string (código FEBRABAN do banco, ex: "341" para Itaú, "033" para Santander)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const arquivo = formData.get("arquivo") as File | null
    const bancoCodigoStr = formData.get("bancoCodigo") as string | null

    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })
    }

    if (!bancoCodigoStr) {
      return NextResponse.json({ error: "Código do banco não informado" }, { status: 400 })
    }

    const bancoCodigo = parseInt(bancoCodigoStr, 10)

    // Lê o conteúdo do arquivo
    const conteudo = await arquivo.text()

    if (!conteudo.trim()) {
      return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 })
    }

    // =====================================================
    // SANTANDER - CNAB 240
    // =====================================================
    if (bancoCodigo === CODIGO_BANCO_SANTANDER) {
      return processarRetornoSantander(conteudo, arquivo.name)
    }

    // =====================================================
    // ITAÚ - CNAB 400
    // =====================================================
    if (bancoCodigo === CODIGO_BANCO_ITAU) {
      return processarRetornoItau(conteudo, arquivo.name)
    }

    // Banco não suportado
    return NextResponse.json(
      { error: `Banco ${bancoCodigo} não suportado. Bancos suportados: Itaú (341), Santander (33).` },
      { status: 400 }
    )
  } catch (error) {
    console.error("Erro ao processar retorno:", error)
    const message = error instanceof Error ? error.message : "Erro desconhecido"
    return NextResponse.json({ error: `Erro ao processar arquivo: ${message}` }, { status: 500 })
  }
}

// =====================================================
// PROCESSAMENTO SANTANDER (CNAB 240)
// Lógica idêntica ao legado DebitoController.cs (banco == "san")
// =====================================================
async function processarRetornoSantander(conteudo: string, nomeArquivo: string) {
  // Parseia o arquivo de retorno
  const detalhes = lerArquivoRetornoCNAB240(conteudo)

  if (detalhes.length === 0) {
    return NextResponse.json({ error: "Arquivo não processado. Nenhum detalhe encontrado." }, { status: 400 })
  }

  // Filtra apenas detalhes com identificação de título válida
  // (igual ao legado: cnab400.ListaDetalhes.Where(a => a.SegmentoT.IdentificacaoTituloEmpresa.Trim().Length > 0))
  const detalhesValidos = detalhes.filter(d => d.segmentoT.identificacaoTituloEmpresa.trim().length > 0)

  const resultados: ResultadoProcessamentoSantander[] = []
  let totalTratados = 0
  let totalErros = 0

  for (const detalhe of detalhesValidos) {
    // O ID do débito vem do IdentificacaoTituloEmpresa (igual ao legado)
    const idDebitoStr = detalhe.segmentoT.identificacaoTituloEmpresa.trim()
    const idDebito = parseInt(idDebitoStr, 10)

    // Validação de ID mínimo (igual ao legado: idDebito < 9999)
    // if (isNaN(idDebito) || idDebito < 9999) {
    //   resultados.push({
    //     sucesso: false,
    //     mensagem: `Título com identificação MENOR que o mínimo do sistema.`,
    //     debitoId: idDebito || 0,
    //     codigoMovimento: detalhe.segmentoT.idCodigoMovimento,
    //     tipo: "id_invalido",
    //   })
    //   totalErros++
    //   continue
    // }

    // Processa de acordo com o código de movimento (igual ao legado)
    switch (detalhe.segmentoT.idCodigoMovimento) {
      case MOVIMENTO_SANTANDER.LIQUIDACAO: {
        // Busca o débito
        const debito = await prisma.debito.findUnique({
          where: { id: idDebito },
          include: {
            pedido: {
              include: {
                orcamento: {
                  include: {
                    cliente: true,
                  },
                },
              },
            },
          },
        })

        if (!debito) {
          resultados.push({
            sucesso: false,
            mensagem: `Título NÃO LOCALIZADO no Sistema.`,
            debitoId: idDebito,
            codigoMovimento: detalhe.segmentoT.idCodigoMovimento,
            tipo: "nao_localizado",
          })
          totalErros++
          continue
        }

        const clienteNome = debito.pedido?.orcamento?.cliente?.razaoSocial || "Cliente não identificado"

        // Verifica se já foi baixado (stats != 0)
        if (debito.stats !== 0) {
          resultados.push({
            sucesso: false,
            mensagem: `Título já baixado anteriormente em ${debito.dataOcorrencia?.toLocaleDateString("pt-BR") || "data desconhecida"}.`,
            debitoId: idDebito,
            cliente: clienteNome,
            valorReceber: debito.receber,
            valorRecebido: debito.recebido || undefined,
            vencimento: debito.vencimento,
            codigoMovimento: detalhe.segmentoT.idCodigoMovimento,
            tipo: "ja_baixado",
          })
          totalErros++
          continue
        }

        // Baixa o débito (igual ao legado: _repositorio.Baixar)
        // Usa valores do Segmento U:
        // - detalhe.SegmentoU.DataOcorrencia
        // - detalhe.SegmentoU.ValorLiquidoASerCreditado (como recebido)
        // - detalhe.SegmentoU.ValorOutrosCreditos (como acrescimos)
        // - detalhe.SegmentoU.ValorDescontoConcedido (como descontos)
        // stats = 2 (baixado via retorno bancário)
        try {
          await prisma.debito.update({
            where: { id: idDebito },
            data: {
              dataOcorrencia: detalhe.segmentoU.dataOcorrencia,
              recebido: detalhe.segmentoU.valorLiquidoASerCreditado,
              acrescimos: detalhe.segmentoU.valorOutrosCreditos || 0,
              descontos: detalhe.segmentoU.valorDescontoConcedido || 0,
              stats: 2, // 2 = baixado via retorno (igual ao legado)
            },
          })

          resultados.push({
            sucesso: true,
            mensagem: "Título Baixado no Sistema.",
            debitoId: idDebito,
            cliente: clienteNome,
            valorReceber: debito.receber,
            valorRecebido: detalhe.segmentoU.valorLiquidoASerCreditado,
            vencimento: debito.vencimento,
            codigoMovimento: detalhe.segmentoT.idCodigoMovimento,
            tipo: "baixado",
          })
          totalTratados++
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Erro desconhecido"
          resultados.push({
            sucesso: false,
            mensagem: `Ocorreu um erro no sistema ao baixar Título: ${errorMessage}`,
            debitoId: idDebito,
            cliente: clienteNome,
            valorReceber: debito.receber,
            vencimento: debito.vencimento,
            codigoMovimento: detalhe.segmentoT.idCodigoMovimento,
            tipo: "erro",
          })
          totalErros++
        }
        break
      }

      case MOVIMENTO_SANTANDER.BAIXADO_SEM_COMPENSACAO: {
        // Título baixado no banco sem compensação bancária (igual ao legado)
        resultados.push({
          sucesso: false,
          mensagem: `Título BAIXADO no banco sem COMPENSAÇÃO BANCÁRIA.`,
          debitoId: idDebito,
          codigoMovimento: detalhe.segmentoT.idCodigoMovimento,
          tipo: "sem_compensacao",
        })
        // Não conta como erro nem tratado - é apenas informativo
        break
      }

      default: {
        // Outras ocorrências - registra mas não processa
        // (igual ao legado, que só trata 6 e 29)
        resultados.push({
          sucesso: true,
          mensagem: `Código de movimento: ${detalhe.segmentoT.idCodigoMovimento}`,
          debitoId: idDebito,
          codigoMovimento: detalhe.segmentoT.idCodigoMovimento,
          tipo: "baixado",
        })
        break
      }
    }
  }

  const resultado: ResultadoRetornoSantander = {
    detalhes: detalhesValidos,
    resultados,
    totalTratados,
    totalErros,
    nomeArquivo,
  }

  return NextResponse.json({
    success: true,
    data: resultado,
  })
}

// =====================================================
// PROCESSAMENTO ITAÚ (CNAB 400)
// Lógica idêntica ao legado DebitoController.cs (banco == "i")
// =====================================================
async function processarRetornoItau(conteudo: string, nomeArquivo: string) {
  // Parseia o arquivo de retorno
  const { header, detalhes } = lerArquivoRetornoCNAB400(conteudo)

  if (detalhes.length === 0) {
    return NextResponse.json({ error: "Nenhum detalhe encontrado no arquivo" }, { status: 400 })
  }

  // Processa cada detalhe
  const resultados: ResultadoProcessamento[] = []
  let totalTratados = 0
  let totalErros = 0

  for (const detalhe of detalhes) {
    // O nosso número é o ID do débito (igual ao legado)
    const idDebito = parseInt(detalhe.nossoNumero.replace(/^0+/, ""), 10)

    if (isNaN(idDebito) || idDebito <= 0) {
      resultados.push({
        sucesso: false,
        mensagem: `Nosso número inválido: ${detalhe.nossoNumero}`,
        debitoId: 0,
        codigoOcorrencia: detalhe.codigoOcorrencia,
        descricaoOcorrencia: detalhe.descricaoOcorrencia,
        tipo: "erro",
      })
      totalErros++
      continue
    }

    switch (detalhe.codigoOcorrencia) {
      case OCORRENCIA_ITAU.LIQUIDACAO:
      case OCORRENCIA_ITAU.LIQUIDACAO_PARCIAL: {
        // Busca o débito
        const debito = await prisma.debito.findUnique({
          where: { id: idDebito },
          include: {
            pedido: {
              include: {
                orcamento: {
                  include: {
                    cliente: true,
                  },
                },
              },
            },
          },
        })

        if (!debito) {
          resultados.push({
            sucesso: false,
            mensagem: `Título NÃO LOCALIZADO no Sistema.`,
            debitoId: idDebito,
            codigoOcorrencia: detalhe.codigoOcorrencia,
            descricaoOcorrencia: detalhe.descricaoOcorrencia,
            tipo: "nao_localizado",
          })
          totalErros++
          continue
        }

        const clienteNome = debito.pedido?.orcamento?.cliente?.razaoSocial || "Cliente não identificado"

        // Verifica se já foi baixado (stats != 0)
        if (debito.stats !== 0) {
          resultados.push({
            sucesso: false,
            mensagem: `Título já baixado anteriormente em ${debito.dataOcorrencia?.toLocaleDateString("pt-BR") || "data desconhecida"}.`,
            debitoId: idDebito,
            cliente: clienteNome,
            valorReceber: debito.receber,
            valorRecebido: debito.recebido || undefined,
            vencimento: debito.vencimento,
            codigoOcorrencia: detalhe.codigoOcorrencia,
            descricaoOcorrencia: detalhe.descricaoOcorrencia,
            tipo: "ja_baixado",
          })
          totalErros++
          continue
        }

        // Baixa o débito (igual ao legado: _repositorio.Baixar)
        // stats = 2 (baixado via retorno bancário)
        try {
          await prisma.debito.update({
            where: { id: idDebito },
            data: {
              dataOcorrencia: detalhe.dataOcorrencia,
              recebido: detalhe.valorPrincipal,
              acrescimos: detalhe.outrosDebitos || 0,
              descontos: detalhe.descontos,
              stats: 2, // 2 = baixado via retorno (igual ao legado)
              // email não é atualizado aqui pois não temos usuário logado via API
            },
          })

          resultados.push({
            sucesso: true,
            mensagem: "Título Baixado no Sistema.",
            debitoId: idDebito,
            cliente: clienteNome,
            valorReceber: debito.receber,
            valorRecebido: detalhe.valorPrincipal,
            vencimento: debito.vencimento,
            codigoOcorrencia: detalhe.codigoOcorrencia,
            descricaoOcorrencia: detalhe.descricaoOcorrencia,
            tipo: "baixado",
          })
          totalTratados++
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Erro desconhecido"
          resultados.push({
            sucesso: false,
            mensagem: `Erro ao baixar título: ${errorMessage}`,
            debitoId: idDebito,
            cliente: clienteNome,
            valorReceber: debito.receber,
            vencimento: debito.vencimento,
            codigoOcorrencia: detalhe.codigoOcorrencia,
            descricaoOcorrencia: detalhe.descricaoOcorrencia,
            tipo: "erro",
          })
          totalErros++
        }
        break
      }

      case OCORRENCIA_ITAU.BAIXADO_SEM_COMPENSACAO: {
        // Título baixado no banco sem compensação bancária
        resultados.push({
          sucesso: false,
          mensagem: `Título BAIXADO no banco sem COMPENSAÇÃO BANCÁRIA. Sacado: ${detalhe.nomeSacado.trim()}`,
          debitoId: idDebito,
          codigoOcorrencia: detalhe.codigoOcorrencia,
          descricaoOcorrencia: detalhe.descricaoOcorrencia,
          tipo: "sem_compensacao",
        })
        // Não conta como erro nem tratado - é apenas informativo
        break
      }

      case OCORRENCIA_ITAU.ENTRADA_REJEITADA: {
        resultados.push({
          sucesso: false,
          mensagem: `Título REJEITADO. Erros: ${detalhe.erros}`,
          debitoId: idDebito,
          codigoOcorrencia: detalhe.codigoOcorrencia,
          descricaoOcorrencia: detalhe.descricaoOcorrencia,
          tipo: "rejeitado",
        })
        totalErros++
        break
      }

      case OCORRENCIA_ITAU.ENTRADA_CONFIRMADA: {
        // Entrada confirmada - apenas informativo, não precisa fazer nada
        resultados.push({
          sucesso: true,
          mensagem: "Entrada confirmada no banco.",
          debitoId: idDebito,
          codigoOcorrencia: detalhe.codigoOcorrencia,
          descricaoOcorrencia: detalhe.descricaoOcorrencia,
          tipo: "baixado", // Não é erro
        })
        break
      }

      default: {
        // Outras ocorrências - apenas registra
        resultados.push({
          sucesso: true,
          mensagem: detalhe.descricaoOcorrencia,
          debitoId: idDebito,
          codigoOcorrencia: detalhe.codigoOcorrencia,
          descricaoOcorrencia: detalhe.descricaoOcorrencia,
          tipo: "baixado",
        })
        break
      }
    }
  }

  const resultado: ResultadoRetorno = {
    header,
    detalhes,
    resultados,
    totalTratados,
    totalErros,
    nomeArquivo,
  }

  return NextResponse.json({
    success: true,
    data: resultado,
  })
}

