"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { formatCNPJ, formatPhone, formatRazaoSocial } from "@/lib/formatters"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Ban, Database, Download, Building2, MapPin, Plus, BarChart3, Users, Check, ChevronsUpDown, Loader2, Clock, Receipt, ShoppingCart } from "lucide-react"
import { ClienteDetailDialog } from "./cliente-detail-dialog"
import { Badge } from "@/components/ui/badge"
import { CadastroClienteDialog } from "./cadastro-cliente-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { CriarOrcamentoDialog } from "@/components/orcamentos/criar-orcamento-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LeadsFilterCard } from "./leads-filter-card"
import { LeadsStateDistribution } from "./leads-state-distribution"
import { LeadsVendorDistribution } from "./leads-vendor-distribution"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { CLIENTS_MAX_LIMIT } from "@/lib/constants"


type RawClientSummary = {
  id: number
  cnpj: string
  razaoSocial: string
  nomeSindico: string | null
  telefoneSindico: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  dataContatoAgendado: string | null
  administradoraStringAntigo: string | null
  categoria: "ativo" | "agendado" | "explorado" | null
  administradora: {
    id: string
    nome: string
  } | null
  vendedor: {
    name: string | null
    role: string | null
  } | null
  vendedorAlocadoEm: string | null
  isContratoVigente: boolean
}
const estados_cidades = { "estados": [{ "sigla": "AC", "nome": "Acre", "cidades": ["Acrelândia", "Assis Brasil", "Brasiléia", "Bujari", "Capixaba", "Cruzeiro do Sul", "Epitaciolândia", "Feijó", "Jordão", "Mâncio Lima", "Manoel Urbano", "Marechal Thaumaturgo", "Plácido de Castro", "Porto Acre", "Porto Walter", "Rio Branco", "Rodrigues Alves", "Santa Rosa do Purus", "Sena Madureira", "Senador Guiomard", "Tarauacá", "Xapuri"] }, { "sigla": "AL", "nome": "Alagoas", "cidades": ["Água Branca", "Anadia", "Arapiraca", "Atalaia", "Barra de Santo Antônio", "Barra de São Miguel", "Batalha", "Belém", "Belo Monte", "Boca da Mata", "Branquinha", "Cacimbinhas", "Cajueiro", "Campestre", "Campo Alegre", "Campo Grande", "Canapi", "Capela", "Carneiros", "Chã Preta", "Coité do Nóia", "Colônia Leopoldina", "Coqueiro Seco", "Coruripe", "Craíbas", "Delmiro Gouveia", "Dois Riachos", "Estrela de Alagoas", "Feira Grande", "Feliz Deserto", "Flexeiras", "Girau do Ponciano", "Ibateguara", "Igaci", "Igreja Nova", "Inhapi", "Jacaré dos Homens", "Jacuípe", "Japaratinga", "Jaramataia", "Jequiá da Praia", "Joaquim Gomes", "Jundiá", "Junqueiro", "Lagoa da Canoa", "Limoeiro de Anadia", "Maceió", "Major Isidoro", "Mar Vermelho", "Maragogi", "Maravilha", "Marechal Deodoro", "Maribondo", "Mata Grande", "Matriz de Camaragibe", "Messias", "Minador do Negrão", "Monteirópolis", "Murici", "Novo Lino", "Olho d'Água das Flores", "Olho d'Água do Casado", "Olho d'Água Grande", "Olivença", "Ouro Branco", "Palestina", "Palmeira dos Índios", "Pão de Açúcar", "Pariconha", "Paripueira", "Passo de Camaragibe", "Paulo Jacinto", "Penedo", "Piaçabuçu", "Pilar", "Pindoba", "Piranhas", "Poço das Trincheiras", "Porto Calvo", "Porto de Pedras", "Porto Real do Colégio", "Quebrangulo", "Rio Largo", "Roteiro", "Santa Luzia do Norte", "Santana do Ipanema", "Santana do Mundaú", "São Brás", "São José da Laje", "São José da Tapera", "São Luís do Quitunde", "São Miguel dos Campos", "São Miguel dos Milagres", "São Sebastião", "Satuba", "Senador Rui Palmeira", "Tanque d'Arca", "Taquarana", "Teotônio Vilela", "Traipu", "União dos Palmares", "Viçosa"] }, { "sigla": "AM", "nome": "Amazonas", "cidades": ["Alvarães", "Amaturá", "Anamã", "Anori", "Apuí", "Atalaia do Norte", "Autazes", "Barcelos", "Barreirinha", "Benjamin Constant", "Beruri", "Boa Vista do Ramos", "Boca do Acre", "Borba", "Caapiranga", "Canutama", "Carauari", "Careiro", "Careiro da Várzea", "Coari", "Codajás", "Eirunepé", "Envira", "Fonte Boa", "Guajará", "Humaitá", "Ipixuna", "Iranduba", "Itacoatiara", "Itamarati", "Itapiranga", "Japurá", "Juruá", "Jutaí", "Lábrea", "Manacapuru", "Manaquiri", "Manaus", "Manicoré", "Maraã", "Maués", "Nhamundá", "Nova Olinda do Norte", "Novo Airão", "Novo Aripuanã", "Parintins", "Pauini", "Presidente Figueiredo", "Rio Preto da Eva", "Santa Isabel do Rio Negro", "Santo Antônio do Içá", "São Gabriel da Cachoeira", "São Paulo de Olivença", "São Sebastião do Uatumã", "Silves", "Tabatinga", "Tapauá", "Tefé", "Tonantins", "Uarini", "Urucará", "Urucurituba"] }, { "sigla": "AP", "nome": "Amapá", "cidades": ["Amapá", "Calçoene", "Cutias", "Ferreira Gomes", "Itaubal", "Laranjal do Jari", "Macapá", "Mazagão", "Oiapoque", "Pedra Branca do Amapari", "Porto Grande", "Pracuúba", "Santana", "Serra do Navio", "Tartarugalzinho", "Vitória do Jari"] }, { "sigla": "BA", "nome": "Bahia", "cidades": ["Abaíra", "Abaré", "Acajutiba", "Adustina", "Água Fria", "Aiquara", "Alagoinhas", "Alcobaça", "Almadina", "Amargosa", "Amélia Rodrigues", "América Dourada", "Anagé", "Andaraí", "Andorinha", "Angical", "Anguera", "Antas", "Antônio Cardoso", "Antônio Gonçalves", "Aporá", "Apuarema", "Araças", "Aracatu", "Araci", "Aramari", "Arataca", "Aratuípe", "Aurelino Leal", "Baianópolis", "Baixa Grande", "Banzaê", "Barra", "Barra da Estiva", "Barra do Choça", "Barra do Mendes", "Barra do Rocha", "Barreiras", "Barro Alto", "Barrocas", "Barro Preto", "Belmonte", "Belo Campo", "Biritinga", "Boa Nova", "Boa Vista do Tupim", "Bom Jesus da Lapa", "Bom Jesus da Serra", "Boninal", "Bonito", "Boquira", "Botuporã", "Brejões", "Brejolândia", "Brotas de Macaúbas", "Brumado", "Buerarema", "Buritirama", "Caatiba", "Cabaceiras do Paraguaçu", "Cachoeira", "Caculé", "Caém", "Caetanos", "Caetité", "Cafarnaum", "Cairu", "Caldeirão Grande", "Camacan", "Camaçari", "Camamu", "Campo Alegre de Lourdes", "Campo Formoso", "Canápolis", "Canarana", "Canavieiras", "Candeal", "Candeias", "Candiba", "Cândido Sales", "Cansanção", "Canudos", "Capela do Alto Alegre", "Capim Grosso", "Caraíbas", "Caravelas", "Cardeal da Silva", "Carinhanha", "Casa Nova", "Castro Alves", "Catolândia", "Catu", "Caturama", "Central", "Chorrochó", "Cícero Dantas", "Cipó", "Coaraci", "Cocos", "Conceição da Feira", "Conceição do Almeida", "Conceição do Coité", "Conceição do Jacuípe", "Conde", "Condeúba", "Contendas do Sincorá", "Coração de Maria", "Cordeiros", "Coribe", "Coronel João Sá", "Correntina", "Cotegipe", "Cravolândia", "Crisópolis", "Cristópolis", "Cruz das Almas", "Curaçá", "Dário Meira", "Dias d'Ávila", "Dom Basílio", "Dom Macedo Costa", "Elísio Medrado", "Encruzilhada", "Entre Rios", "Érico Cardoso", "Esplanada", "Euclides da Cunha", "Eunápolis", "Fátima", "Feira da Mata", "Feira de Santana", "Filadélfia", "Firmino Alves", "Floresta Azul", "Formosa do Rio Preto", "Gandu", "Gavião", "Gentio do Ouro", "Glória", "Gongogi", "Governador Mangabeira", "Guajeru", "Guanambi", "Guaratinga", "Heliópolis", "Iaçu", "Ibiassucê", "Ibicaraí", "Ibicoara", "Ibicuí", "Ibipeba", "Ibipitanga", "Ibiquera", "Ibirapitanga", "Ibirapuã", "Ibirataia", "Ibitiara", "Ibititá", "Ibotirama", "Ichu", "Igaporã", "Igrapiúna", "Iguaí", "Ilhéus", "Inhambupe", "Ipecaetá", "Ipiaú", "Ipirá", "Ipupiara", "Irajuba", "Iramaia", "Iraquara", "Irará", "Irecê", "Itabela", "Itaberaba", "Itabuna", "Itacaré", "Itaeté", "Itagi", "Itagibá", "Itagimirim", "Itaguaçu da Bahia", "Itaju do Colônia", "Itajuípe", "Itamaraju", "Itamari", "Itambé", "Itanagra", "Itanhém", "Itaparica", "Itapé", "Itapebi", "Itapetinga", "Itapicuru", "Itapitanga", "Itaquara", "Itarantim", "Itatim", "Itiruçu", "Itiúba", "Itororó", "Ituaçu", "Ituberá", "Iuiú", "Jaborandi", "Jacaraci", "Jacobina", "Jaguaquara", "Jaguarari", "Jaguaripe", "Jandaíra", "Jequié", "Jeremoabo", "Jiquiriçá", "Jitaúna", "João Dourado", "Juazeiro", "Jucuruçu", "Jussara", "Jussari", "Jussiape", "Lafaiete Coutinho", "Lagoa Real", "Laje", "Lajedão", "Lajedinho", "Lajedo do Tabocal", "Lamarão", "Lapão", "Lauro de Freitas", "Lençóis", "Licínio de Almeida", "Livramento de Nossa Senhora", "Luís Eduardo Magalhães", "Macajuba", "Macarani", "Macaúbas", "Macururé", "Madre de Deus", "Maetinga", "Maiquinique", "Mairi", "Malhada", "Malhada de Pedras", "Manoel Vitorino", "Mansidão", "Maracás", "Maragogipe", "Maraú", "Marcionílio Souza", "Mascote", "Mata de São João", "Matina", "Medeiros Neto", "Miguel Calmon", "Milagres", "Mirangaba", "Mirante", "Monte Santo", "Morpará", "Morro do Chapéu", "Mortugaba", "Mucugê", "Mucuri", "Mulungu do Morro", "Mundo Novo", "Muniz Ferreira", "Muquém de São Francisco", "Muritiba", "Mutuípe", "Nazaré", "Nilo Peçanha", "Nordestina", "Nova Canaã", "Nova Fátima", "Nova Ibiá", "Nova Itarana", "Nova Redenção", "Nova Soure", "Nova Viçosa", "Novo Horizonte", "Novo Triunfo", "Olindina", "Oliveira dos Brejinhos", "Ouriçangas", "Ourolândia", "Palmas de Monte Alto", "Palmeiras", "Paramirim", "Paratinga", "Paripiranga", "Pau Brasil", "Paulo Afonso", "Pé de Serra", "Pedrão", "Pedro Alexandre", "Piatã", "Pilão Arcado", "Pindaí", "Pindobaçu", "Pintadas", "Piraí do Norte", "Piripá", "Piritiba", "Planaltino", "Planalto", "Poções", "Pojuca", "Ponto Novo", "Porto Seguro", "Potiraguá", "Prado", "Presidente Dutra", "Presidente Jânio Quadros", "Presidente Tancredo Neves", "Queimadas", "Quijingue", "Quixabeira", "Rafael Jambeiro", "Remanso", "Retirolândia", "Riachão das Neves", "Riachão do Jacuípe", "Riacho de Santana", "Ribeira do Amparo", "Ribeira do Pombal", "Ribeirão do Largo", "Rio de Contas", "Rio do Antônio", "Rio do Pires", "Rio Real", "Rodelas", "Ruy Barbosa", "Salinas da Margarida", "Salvador", "Santa Bárbara", "Santa Brígida", "Santa Cruz Cabrália", "Santa Cruz da Vitória", "Santa Inês", "Santa Luzia", "Santa Maria da Vitória", "Santa Rita de Cássia", "Santa Teresinha", "Santaluz", "Santana", "Santanópolis", "Santo Amaro", "Santo Antônio de Jesus", "Santo Estêvão", "São Desidério", "São Domingos", "São Felipe", "São Félix", "São Félix do Coribe", "São Francisco do Conde", "São Gabriel", "São Gonçalo dos Campos", "São José da Vitória", "São José do Jacuípe", "São Miguel das Matas", "São Sebastião do Passé", "Sapeaçu", "Sátiro Dias", "Saubara", "Saúde", "Seabra", "Sebastião Laranjeiras", "Senhor do Bonfim", "Sento Sé", "Serra do Ramalho", "Serra Dourada", "Serra Preta", "Serrinha", "Serrolândia", "Simões Filho", "Sítio do Mato", "Sítio do Quinto", "Sobradinho", "Souto Soares", "Tabocas do Brejo Velho", "Tanhaçu", "Tanque Novo", "Tanquinho", "Taperoá", "Tapiramutá", "Teixeira de Freitas", "Teodoro Sampaio", "Teofilândia", "Teolândia", "Terra Nova", "Tremedal", "Tucano", "Uauá", "Ubaíra", "Ubaitaba", "Ubatã", "Uibaí", "Umburanas", "Una", "Urandi", "Uruçuca", "Utinga", "Valença", "Valente", "Várzea da Roça", "Várzea do Poço", "Várzea Nova", "Varzedo", "Vera Cruz", "Vereda", "Vitória da Conquista", "Wagner", "Wanderley", "Wenceslau Guimarães", "Xique-Xique"] }, { "sigla": "CE", "nome": "Ceará", "cidades": ["Abaiara", "Acarape", "Acaraú", "Acopiara", "Aiuaba", "Alcântaras", "Altaneira", "Alto Santo", "Amontada", "Antonina do Norte", "Apuiarés", "Aquiraz", "Aracati", "Aracoiaba", "Ararendá", "Araripe", "Aratuba", "Arneiroz", "Assaré", "Aurora", "Baixio", "Banabuiú", "Barbalha", "Barreira", "Barro", "Barroquinha", "Baturité", "Beberibe", "Bela Cruz", "Boa Viagem", "Brejo Santo", "Camocim", "Campos Sales", "Canindé", "Capistrano", "Caridade", "Cariré", "Caririaçu", "Cariús", "Carnaubal", "Cascavel", "Catarina", "Catunda", "Caucaia", "Cedro", "Chaval", "Choró", "Chorozinho", "Coreaú", "Crateús", "Crato", "Croatá", "Cruz", "Deputado Irapuan Pinheiro", "Ererê", "Eusébio", "Farias Brito", "Forquilha", "Fortaleza", "Fortim", "Frecheirinha", "General Sampaio", "Graça", "Granja", "Granjeiro", "Groaíras", "Guaiúba", "Guaraciaba do Norte", "Guaramiranga", "Hidrolândia", "Horizonte", "Ibaretama", "Ibiapina", "Ibicuitinga", "Icapuí", "Icó", "Iguatu", "Independência", "Ipaporanga", "Ipaumirim", "Ipu", "Ipueiras", "Iracema", "Irauçuba", "Itaiçaba", "Itaitinga", "Itapajé", "Itapipoca", "Itapiúna", "Itarema", "Itatira", "Jaguaretama", "Jaguaribara", "Jaguaribe", "Jaguaruana", "Jardim", "Jati", "Jijoca de Jericoaroara", "Juazeiro do Norte", "Jucás", "Lavras da Mangabeira", "Limoeiro do Norte", "Madalena", "Maracanaú", "Maranguape", "Marco", "Martinópole", "Massapê", "Mauriti", "Meruoca", "Milagres", "Milhã", "Miraíma", "Missão Velha", "Mombaça", "Monsenhor Tabosa", "Morada Nova", "Moraújo", "Morrinhos", "Mucambo", "Mulungu", "Nova Olinda", "Nova Russas", "Novo Oriente", "Ocara", "Orós", "Pacajus", "Pacatuba", "Pacoti", "Pacujá", "Palhano", "Palmácia", "Paracuru", "Paraipaba", "Parambu", "Paramoti", "Pedra Branca", "Penaforte", "Pentecoste", "Pereiro", "Pindoretama", "Piquet Carneiro", "Pires Ferreira", "Poranga", "Porteiras", "Potengi", "Potiretama", "Quiterianópolis", "Quixadá", "Quixelô", "Quixeramobim", "Quixeré", "Redenção", "Reriutaba", "Russas", "Saboeiro", "Salitre", "Santa Quitéria", "Santana do Acaraú", "Santana do Cariri", "São Benedito", "São Gonçalo do Amarante", "São João do Jaguaribe", "São Luís do Curu", "Senador Pompeu", "Senador Sá", "Sobral", "Solonópole", "Tabuleiro do Norte", "Tamboril", "Tarrafas", "Tauá", "Tejuçuoca", "Tianguá", "Trairi", "Tururu", "Ubajara", "Umari", "Umirim", "Uruburetama", "Uruoca", "Varjota", "Várzea Alegre", "Viçosa do Ceará"] }, { "sigla": "DF", "nome": "Distrito Federal", "cidades": ["Águas Claras", "Arniqueira", "Brasília", "Brazlândia", "Candangolândia", "Ceilândia", "Cruzeiro", "Estrutural", "Fercal", "Gama", "Guará", "Itapoã", "Jardim Botânico", "Lago Norte", "Lago Sul", "Núcleo Bandeirante", "Octogonal", "Paranoá", "Park Way", "Planaltina", "Plano Piloto", "Pôr do Sol", "Recanto das Emas", "Riacho Fundo II", "Riacho Fundo", "Samambaia", "Santa Maria", "São Sebastião", "SIA", "Sobradinho II", "Sobradinho", "Sol Nascente", "Sudoeste", "Taguatinga", "Varjão", "Vicente Pires"] }, { "sigla": "ES", "nome": "Espírito Santo", "cidades": ["Afonso Cláudio", "Água Doce do Norte", "Águia Branca", "Alegre", "Alfredo Chaves", "Alto Rio Novo", "Anchieta", "Apiacá", "Aracruz", "Atilio Vivacqua", "Baixo Guandu", "Barra de São Francisco", "Boa Esperança", "Bom Jesus do Norte", "Brejetuba", "Cachoeiro de Itapemirim", "Cariacica", "Castelo", "Colatina", "Conceição da Barra", "Conceição do Castelo", "Divino de São Lourenço", "Domingos Martins", "Dores do Rio Preto", "Ecoporanga", "Fundão", "Governador Lindenberg", "Guaçuí", "Guarapari", "Ibatiba", "Ibiraçu", "Ibitirama", "Iconha", "Irupi", "Itaguaçu", "Itapemirim", "Itarana", "Iúna", "Jaguaré", "Jerônimo Monteiro", "João Neiva", "Laranja da Terra", "Linhares", "Mantenópolis", "Marataizes", "Marechal Floriano", "Marilândia", "Mimoso do Sul", "Montanha", "Mucurici", "Muniz Freire", "Muqui", "Nova Venécia", "Pancas", "Pedro Canário", "Pinheiros", "Piúma", "Ponto Belo", "Presidente Kennedy", "Rio Bananal", "Rio Novo do Sul", "Santa Leopoldina", "Santa Maria de Jetibá", "Santa Teresa", "São Domingos do Norte", "São Gabriel da Palha", "São José do Calçado", "São Mateus", "São Roque do Canaã", "Serra", "Sooretama", "Vargem Alta", "Venda Nova do Imigrante", "Viana", "Vila Pavão", "Vila Valério", "Vila Velha", "Vitória"] }, { "sigla": "GO", "nome": "Goiás", "cidades": ["Abadia de Goiás", "Abadiânia", "Acreúna", "Adelândia", "Água Fria de Goiás", "Água Limpa", "Águas Lindas de Goiás", "Alexânia", "Aloândia", "Alto Horizonte", "Alto Paraíso de Goiás", "Alvorada do Norte", "Amaralina", "Americano do Brasil", "Amorinópolis", "Anápolis", "Anhanguera", "Anicuns", "Aparecida de Goiânia", "Aparecida do Rio Doce", "Aporé", "Araçu", "Aragarças", "Aragoiânia", "Araguapaz", "Arenópolis", "Aruanã", "Aurilândia", "Avelinópolis", "Baliza", "Barro Alto", "Bela Vista de Goiás", "Bom Jardim de Goiás", "Bom Jesus de Goiás", "Bonfinópolis", "Bonópolis", "Brazabrantes", "Britânia", "Buriti Alegre", "Buriti de Goiás", "Buritinópolis", "Cabeceiras", "Cachoeira Alta", "Cachoeira de Goiás", "Cachoeira Dourada", "Caçu", "Caiapônia", "Caldas Novas", "Caldazinha", "Campestre de Goiás", "Campinaçu", "Campinorte", "Campo Alegre de Goiás", "Campos Limpo de Goiás", "Campos Belos", "Campos Verdes", "Carmo do Rio Verde", "Castelândia", "Catalão", "Caturaí", "Cavalcante", "Ceres", "Cezarina", "Chapadão do Céu", "Cidade Ocidental", "Cocalzinho de Goiás", "Colinas do Sul", "Córrego do Ouro", "Corumbá de Goiás", "Corumbaíba", "Cristalina", "Cristianópolis", "Crixás", "Cromínia", "Cumari", "Damianópolis", "Damolândia", "Davinópolis", "Diorama", "Divinópolis de Goiás", "Doverlândia", "Edealina", "Edéia", "Estrela do Norte", "Faina", "Fazenda Nova", "Firminópolis", "Flores de Goiás", "Formosa", "Formoso", "Gameleira de Goiás", "Goianápolis", "Goiandira", "Goianésia", "Goiânia", "Goianira", "Goiás", "Goiatuba", "Gouvelândia", "Guapó", "Guaraíta", "Guarani de Goiás", "Guarinos", "Heitoraí", "Hidrolândia", "Hidrolina", "Iaciara", "Inaciolândia", "Indiara", "Inhumas", "Ipameri", "Ipiranga de Goiás", "Iporá", "Israelândia", "Itaberaí", "Itaguari", "Itaguaru", "Itajá", "Itapaci", "Itapirapuã", "Itapuranga", "Itarumã", "Itauçu", "Itumbiara", "Ivolândia", "Jandaia", "Jaraguá", "Jataí", "Jaupaci", "Jesúpolis", "Joviânia", "Jussara", "Lagoa Santa", "Leopoldo de Bulhões", "Luziânia", "Mairipotaba", "Mambaí", "Mara Rosa", "Marzagão", "Matrinchã", "Maurilândia", "Mimoso de Goiás", "Minaçu", "Mineiros", "Moiporá", "Monte Alegre de Goiás", "Montes Claros de Goiás", "Montividiu", "Montividiu do Norte", "Morrinhos", "Morro Agudo de Goiás", "Mossâmedes", "Mozarlândia", "Mundo Novo", "Mutunópolis", "Nazário", "Nerópolis", "Niquelândia", "Nova América", "Nova Aurora", "Nova Crixás", "Nova Glória", "Nova Iguaçu de Goiás", "Nova Roma", "Nova Veneza", "Novo Brasil", "Novo Gama", "Novo Planalto", "Orizona", "Ouro Verde de Goiás", "Ouvidor", "Padre Bernardo", "Palestina de Goiás", "Palmeiras de Goiás", "Palmelo", "Palminópolis", "Panamá", "Paranaiguara", "Paraúna", "Perolândia", "Petrolina de Goiás", "Pilar de Goiás", "Piracanjuba", "Piranhas", "Pirenópolis", "Pires do Rio", "Planaltina", "Pontalina", "Porangatu", "Porteirão", "Portelândia", "Posse", "Professor Jamil", "Quirinópolis", "Rialma", "Rianápolis", "Rio Quente", "Rio Verde", "Rubiataba", "Sanclerlândia", "Santa Bárbara de Goiás", "Santa Cruz de Goiás", "Santa Fé de Goiás", "Santa Helena de Goiás", "Santa Isabel", "Santa Rita do Araguaia", "Santa Rita do Novo Destino", "Santa Rosa de Goiás", "Santa Tereza de Goiás", "Santa Terezinha de Goiás", "Santo Antônio da Barra", "Santo Antônio de Goiás", "Santo Antônio do Descoberto", "São Domingos", "São Francisco de Goiás", "São João d'Aliança", "São João da Paraúna", "São Luís de Montes Belos", "São Luíz do Norte", "São Miguel do Araguaia", "São Miguel do Passa Quatro", "São Patrício", "São Simão", "Senador Canedo", "Serranópolis", "Silvânia", "Simolândia", "Sítio d'Abadia", "Taquaral de Goiás", "Teresina de Goiás", "Terezópolis de Goiás", "Três Ranchos", "Trindade", "Trombas", "Turvânia", "Turvelândia", "Uirapuru", "Uruaçu", "Uruana", "Urutaí", "Valparaíso de Goiás", "Varjão", "Vianópolis", "Vicentinópolis", "Vila Boa", "Vila Propício"] }, { "sigla": "MA", "nome": "Maranhão", "cidades": ["Açailândia", "Afonso Cunha", "Água Doce do Maranhão", "Alcântara", "Aldeias Altas", "Altamira do Maranhão", "Alto Alegre do Maranhão", "Alto Alegre do Pindaré", "Alto Parnaíba", "Amapá do Maranhão", "Amarante do Maranhão", "Anajatuba", "Anapurus", "Apicum-Açu", "Araguanã", "Araioses", "Arame", "Arari", "Axixá", "Bacabal", "Bacabeira", "Bacuri", "Bacurituba", "Balsas", "Barão de Grajaú", "Barra do Corda", "Barreirinhas", "Bela Vista do Maranhão", "Belágua", "Benedito Leite", "Bequimão", "Bernardo do Mearim", "Boa Vista do Gurupi", "Bom Jardim", "Bom Jesus das Selvas", "Bom Lugar", "Brejo", "Brejo de Areia", "Buriti", "Buriti Bravo", "Buriticupu", "Buritirana", "Cachoeira Grande", "Cajapió", "Cajari", "Campestre do Maranhão", "Cândido Mendes", "Cantanhede", "Capinzal do Norte", "Carolina", "Carutapera", "Caxias", "Cedral", "Central do Maranhão", "Centro do Guilherme", "Centro Novo do Maranhão", "Chapadinha", "Cidelândia", "Codó", "Coelho Neto", "Colinas", "Conceição do Lago-Açu", "Coroatá", "Cururupu", "Davinópolis", "Dom Pedro", "Duque Bacelar", "Esperantinópolis", "Estreito", "Feira Nova do Maranhão", "Fernando Falcão", "Formosa da Serra Negra", "Fortaleza dos Nogueiras", "Fortuna", "Godofredo Viana", "Gonçalves Dias", "Governador Archer", "Governador Edison Lobão", "Governador Eugênio Barros", "Governador Luiz Rocha", "Governador Newton Bello", "Governador Nunes Freire", "Graça Aranha", "Grajaú", "Guimarães", "Humberto de Campos", "Icatu", "Igarapé do Meio", "Igarapé Grande", "Imperatriz", "Itaipava do Grajaú", "Itapecuru Mirim", "Itinga do Maranhão", "Jatobá", "Jenipapo dos Vieiras", "João Lisboa", "Joselândia", "Junco do Maranhão", "Lago da Pedra", "Lago do Junco", "Lago dos Rodrigues", "Lago Verde", "Lagoa do Mato", "Lagoa Grande do Maranhão", "Lajeado Novo", "Lima Campos", "Loreto", "Luís Domingues", "Magalhães de Almeida", "Maracaçumé", "Marajá do Sena", "Maranhãozinho", "Mata Roma", "Matinha", "Matões", "Matões do Norte", "Milagres do Maranhão", "Mirador", "Miranda do Norte", "Mirinzal", "Monção", "Montes Altos", "Morros", "Nina Rodrigues", "Nova Colinas", "Nova Iorque", "Nova Olinda do Maranhão", "Olho d'Água das Cunhãs", "Olinda Nova do Maranhão", "Paço do Lumiar", "Palmeirândia", "Paraibano", "Parnarama", "Passagem Franca", "Pastos Bons", "Paulino Neves", "Paulo Ramos", "Pedreiras", "Pedro do Rosário", "Penalva", "Peri Mirim", "Peritoró", "Pindaré Mirim", "Pinheiro", "Pio XII", "Pirapemas", "Poção de Pedras", "Porto Franco", "Porto Rico do Maranhão", "Presidente Dutra", "Presidente Juscelino", "Presidente Médici", "Presidente Sarney", "Presidente Vargas", "Primeira Cruz", "Raposa", "Riachão", "Ribamar Fiquene", "Rosário", "Sambaíba", "Santa Filomena do Maranhão", "Santa Helena", "Santa Inês", "Santa Luzia", "Santa Luzia do Paruá", "Santa Quitéria do Maranhão", "Santa Rita", "Santana do Maranhão", "Santo Amaro do Maranhão", "Santo Antônio dos Lopes", "São Benedito do Rio Preto", "São Bento", "São Bernardo", "São Domingos do Azeitão", "São Domingos do Maranhão", "São Félix de Balsas", "São Francisco do Brejão", "São Francisco do Maranhão", "São João Batista", "São João do Carú", "São João do Paraíso", "São João do Soter", "São João dos Patos", "São José de Ribamar", "São José dos Basílios", "São Luís", "São Luís Gonzaga do Maranhão", "São Mateus do Maranhão", "São Pedro da Água Branca", "São Pedro dos Crentes", "São Raimundo das Mangabeiras", "São Raimundo do Doca Bezerra", "São Roberto", "São Vicente Ferrer", "Satubinha", "Senador Alexandre Costa", "Senador La Rocque", "Serrano do Maranhão", "Sítio Novo", "Sucupira do Norte", "Sucupira do Riachão", "Tasso Fragoso", "Timbiras", "Timon", "Trizidela do Vale", "Tufilândia", "Tuntum", "Turiaçu", "Turilândia", "Tutóia", "Urbano Santos", "Vargem Grande", "Viana", "Vila Nova dos Martírios", "Vitória do Mearim", "Vitorino Freire", "Zé Doca"] }, { "sigla": "MG", "nome": "Minas Gerais", "cidades": ["Abadia dos Dourados", "Abaeté", "Abre Campo", "Acaiaca", "Açucena", "Água Boa", "Água Comprida", "Aguanil", "Águas Formosas", "Águas Vermelhas", "Aimorés", "Aiuruoca", "Alagoa", "Albertina", "Além Paraíba", "Alfenas", "Alfredo Vasconcelos", "Almenara", "Alpercata", "Alpinópolis", "Alterosa", "Alto Caparaó", "Alto Jequitibá", "Alto Rio Doce", "Alvarenga", "Alvinópolis", "Alvorada de Minas", "Amparo do Serra", "Andradas", "Andrelândia", "Angelândia", "Antônio Carlos", "Antônio Dias", "Antônio Prado de Minas", "Araçaí", "Aracitaba", "Araçuaí", "Araguari", "Arantina", "Araponga", "Araporã", "Arapuá", "Araújos", "Araxá", "Arceburgo", "Arcos", "Areado", "Argirita", "Aricanduva", "Arinos", "Astolfo Dutra", "Ataléia", "Augusto de Lima", "Baependi", "Baldim", "Bambuí", "Bandeira", "Bandeira do Sul", "Barão de Cocais", "Barão de Monte Alto", "Barbacena", "Barra Longa", "Barroso", "Bela Vista de Minas", "Belmiro Braga", "Belo Horizonte", "Belo Oriente", "Belo Vale", "Berilo", "Berizal", "Bertópolis", "Betim", "Bias Fortes", "Bicas", "Biquinhas", "Boa Esperança", "Bocaina de Minas", "Bocaiúva", "Bom Despacho", "Bom Jardim de Minas", "Bom Jesus da Penha", "Bom Jesus do Amparo", "Bom Jesus do Galho", "Bom Repouso", "Bom Sucesso", "Bonfim", "Bonfinópolis de Minas", "Bonito de Minas", "Borda da Mata", "Botelhos", "Botumirim", "Brás Pires", "Brasilândia de Minas", "Brasília de Minas", "Brasópolis", "Braúnas", "Brumadinho", "Bueno Brandão", "Buenópolis", "Bugre", "Buritis", "Buritizeiro", "Cabeceira Grande", "Cabo Verde", "Cachoeira da Prata", "Cachoeira de Minas", "Cachoeira de Pajeú", "Cachoeira Dourada", "Caetanópolis", "Caeté", "Caiana", "Cajuri", "Caldas", "Camacho", "Camanducaia", "Cambuí", "Cambuquira", "Campanário", "Campanha", "Campestre", "Campina Verde", "Campo Azul", "Campo Belo", "Campo do Meio", "Campo Florido", "Campos Altos", "Campos Gerais", "Cana Verde", "Canaã", "Canápolis", "Candeias", "Cantagalo", "Caparaó", "Capela Nova", "Capelinha", "Capetinga", "Capim Branco", "Capinópolis", "Capitão Andrade", "Capitão Enéas", "Capitólio", "Caputira", "Caraí", "Caranaíba", "Carandaí", "Carangola", "Caratinga", "Carbonita", "Careaçu", "Carlos Chagas", "Carmésia", "Carmo da Cachoeira", "Carmo da Mata", "Carmo de Minas", "Carmo do Cajuru", "Carmo do Paranaíba", "Carmo do Rio Claro", "Carmópolis de Minas", "Carneirinho", "Carrancas", "Carvalhópolis", "Carvalhos", "Casa Grande", "Cascalho Rico", "Cássia", "Cataguases", "Catas Altas", "Catas Altas da Noruega", "Catuji", "Catuti", "Caxambu", "Cedro do Abaeté", "Central de Minas", "Centralina", "Chácara", "Chalé", "Chapada do Norte", "Chapada Gaúcha", "Chiador", "Cipotânea", "Claraval", "Claro dos Poções", "Cláudio", "Coimbra", "Coluna", "Comendador Gomes", "Comercinho", "Conceição da Aparecida", "Conceição da Barra de Minas", "Conceição das Alagoas", "Conceição das Pedras", "Conceição de Ipanema", "Conceição do Mato Dentro", "Conceição do Pará", "Conceição do Rio Verde", "Conceição dos Ouros", "Cônego Marinho", "Confins", "Congonhal", "Congonhas", "Congonhas do Norte", "Conquista", "Conselheiro Lafaiete", "Conselheiro Pena", "Consolação", "Contagem", "Coqueiral", "Coração de Jesus", "Cordisburgo", "Cordislândia", "Corinto", "Coroaci", "Coromandel", "Coronel Fabriciano", "Coronel Murta", "Coronel Pacheco", "Coronel Xavier Chaves", "Córrego Danta", "Córrego do Bom Jesus", "Córrego Fundo", "Córrego Novo", "Couto de Magalhães de Minas", "Crisólita", "Cristais", "Cristália", "Cristiano Otoni", "Cristina", "Crucilândia", "Cruzeiro da Fortaleza", "Cruzília", "Cuparaque", "Curral de Dentro", "Curvelo", "Datas", "Delfim Moreira", "Delfinópolis", "Delta", "Descoberto", "Desterro de Entre Rios", "Desterro do Melo", "Diamantina", "Diogo de Vasconcelos", "Dionísio", "Divinésia", "Divino", "Divino das Laranjeiras", "Divinolândia de Minas", "Divinópolis", "Divisa Alegre", "Divisa Nova", "Divisópolis", "Dom Bosco", "Dom Cavati", "Dom Joaquim", "Dom Silvério", "Dom Viçoso", "Dona Euzébia", "Dores de Campos", "Dores de Guanhães", "Dores do Indaiá", "Dores do Turvo", "Doresópolis", "Douradoquara", "Durandé", "Elói Mendes", "Engenheiro Caldas", "Engenheiro Navarro", "Entre Folhas", "Entre Rios de Minas", "Ervália", "Esmeraldas", "Espera Feliz", "Espinosa", "Espírito Santo do Dourado", "Estiva", "Estrela Dalva", "Estrela do Indaiá", "Estrela do Sul", "Eugenópolis", "Ewbank da Câmara", "Extrema", "Fama", "Faria Lemos", "Felício dos Santos", "Felisburgo", "Felixlândia", "Fernandes Tourinho", "Ferros", "Fervedouro", "Florestal", "Formiga", "Formoso", "Fortaleza de Minas", "Fortuna de Minas", "Francisco Badaró", "Francisco Dumont", "Francisco Sá", "Franciscópolis", "Frei Gaspar", "Frei Inocêncio", "Frei Lagonegro", "Fronteira", "Fronteira dos Vales", "Fruta de Leite", "Frutal", "Funilândia", "Galiléia", "Gameleiras", "Glaucilândia", "Goiabeira", "Goianá", "Gonçalves", "Gonzaga", "Gouveia", "Governador Valadares", "Grão Mogol", "Grupiara", "Guanhães", "Guapé", "Guaraciaba", "Guaraciama", "Guaranésia", "Guarani", "Guarará", "Guarda-Mor", "Guaxupé", "Guidoval", "Guimarânia", "Guiricema", "Gurinhatã", "Heliodora", "Iapu", "Ibertioga", "Ibiá", "Ibiaí", "Ibiracatu", "Ibiraci", "Ibirité", "Ibitiúra de Minas", "Ibituruna", "Icaraí de Minas", "Igarapé", "Igaratinga", "Iguatama", "Ijaci", "Ilicínea", "Imbé de Minas", "Inconfidentes", "Indaiabira", "Indianópolis", "Ingaí", "Inhapim", "Inhaúma", "Inimutaba", "Ipaba", "Ipanema", "Ipatinga", "Ipiaçu", "Ipuiúna", "Iraí de Minas", "Itabira", "Itabirinha de Mantena", "Itabirito", "Itacambira", "Itacarambi", "Itaguara", "Itaipé", "Itajubá", "Itamarandiba", "Itamarati de Minas", "Itambacuri", "Itambé do Mato Dentro", "Itamogi", "Itamonte", "Itanhandu", "Itanhomi", "Itaobim", "Itapagipe", "Itapecerica", "Itapeva", "Itatiaiuçu", "Itaú de Minas", "Itaúna", "Itaverava", "Itinga", "Itueta", "Ituiutaba", "Itumirim", "Iturama", "Itutinga", "Jaboticatubas", "Jacinto", "Jacuí", "Jacutinga", "Jaguaraçu", "Jaíba", "Jampruca", "Janaúba", "Januária", "Japaraíba", "Japonvar", "Jeceaba", "Jenipapo de Minas", "Jequeri", "Jequitaí", "Jequitibá", "Jequitinhonha", "Jesuânia", "Joaíma", "Joanésia", "João Monlevade", "João Pinheiro", "Joaquim Felício", "Jordânia", "José Gonçalves de Minas", "José Raydan", "Josenópolis", "Juatuba", "Juiz de Fora", "Juramento", "Juruaia", "Juvenília", "Ladainha", "Lagamar", "Lagoa da Prata", "Lagoa dos Patos", "Lagoa Dourada", "Lagoa Formosa", "Lagoa Grande", "Lagoa Santa", "Lajinha", "Lambari", "Lamim", "Laranjal", "Lassance", "Lavras", "Leandro Ferreira", "Leme do Prado", "Leopoldina", "Liberdade", "Lima Duarte", "Limeira do Oeste", "Lontra", "Luisburgo", "Luislândia", "Luminárias", "Luz", "Machacalis", "Machado", "Madre de Deus de Minas", "Malacacheta", "Mamonas", "Manga", "Manhuaçu", "Manhumirim", "Mantena", "Mar de Espanha", "Maravilhas", "Maria da Fé", "Mariana", "Marilac", "Mário Campos", "Maripá de Minas", "Marliéria", "Marmelópolis", "Martinho Campos", "Martins Soares", "Mata Verde", "Materlândia", "Mateus Leme", "Mathias Lobato", "Matias Barbosa", "Matias Cardoso", "Matipó", "Mato Verde", "Matozinhos", "Matutina", "Medeiros", "Medina", "Mendes Pimentel", "Mercês", "Mesquita", "Minas Novas", "Minduri", "Mirabela", "Miradouro", "Miraí", "Miravânia", "Moeda", "Moema", "Monjolos", "Monsenhor Paulo", "Montalvânia", "Monte Alegre de Minas", "Monte Azul", "Monte Belo", "Monte Carmelo", "Monte Formoso", "Monte Santo de Minas", "Monte Sião", "Montes Claros", "Montezuma", "Morada Nova de Minas", "Morro da Garça", "Morro do Pilar", "Munhoz", "Muriaé", "Mutum", "Muzambinho", "Nacip Raydan", "Nanuque", "Naque", "Natalândia", "Natércia", "Nazareno", "Nepomuceno", "Ninheira", "Nova Belém", "Nova Era", "Nova Lima", "Nova Módica", "Nova Ponte", "Nova Porteirinha", "Nova Resende", "Nova Serrana", "Nova União", "Novo Cruzeiro", "Novo Oriente de Minas", "Novorizonte", "Olaria", "Olhos-d'Água", "Olímpio Noronha", "Oliveira", "Oliveira Fortes", "Onça de Pitangui", "Oratórios", "Orizânia", "Ouro Branco", "Ouro Fino", "Ouro Preto", "Ouro Verde de Minas", "Padre Carvalho", "Padre Paraíso", "Pai Pedro", "Paineiras", "Pains", "Paiva", "Palma", "Palmópolis", "Papagaios", "Pará de Minas", "Paracatu", "Paraguaçu", "Paraisópolis", "Paraopeba", "Passa Quatro", "Passa Tempo", "Passa-Vinte", "Passabém", "Passos", "Patis", "Patos de Minas", "Patrocínio", "Patrocínio do Muriaé", "Paula Cândido", "Paulistas", "Pavão", "Peçanha", "Pedra Azul", "Pedra Bonita", "Pedra do Anta", "Pedra do Indaiá", "Pedra Dourada", "Pedralva", "Pedras de Maria da Cruz", "Pedrinópolis", "Pedro Leopoldo", "Pedro Teixeira", "Pequeri", "Pequi", "Perdigão", "Perdizes", "Perdões", "Periquito", "Pescador", "Piau", "Piedade de Caratinga", "Piedade de Ponte Nova", "Piedade do Rio Grande", "Piedade dos Gerais", "Pimenta", "Pingo-d'Água", "Pintópolis", "Piracema", "Pirajuba", "Piranga", "Piranguçu", "Piranguinho", "Pirapetinga", "Pirapora", "Piraúba", "Pitangui", "Piumhi", "Planura", "Poço Fundo", "Poços de Caldas", "Pocrane", "Pompéu", "Ponte Nova", "Ponto Chique", "Ponto dos Volantes", "Porteirinha", "Porto Firme", "Poté", "Pouso Alegre", "Pouso Alto", "Prados", "Prata", "Pratápolis", "Pratinha", "Presidente Bernardes", "Presidente Juscelino", "Presidente Kubitschek", "Presidente Olegário", "Prudente de Morais", "Quartel Geral", "Queluzito", "Raposos", "Raul Soares", "Recreio", "Reduto", "Resende Costa", "Resplendor", "Ressaquinha", "Riachinho", "Riacho dos Machados", "Ribeirão das Neves", "Ribeirão Vermelho", "Rio Acima", "Rio Casca", "Rio do Prado", "Rio Doce", "Rio Espera", "Rio Manso", "Rio Novo", "Rio Paranaíba", "Rio Pardo de Minas", "Rio Piracicaba", "Rio Pomba", "Rio Preto", "Rio Vermelho", "Ritápolis", "Rochedo de Minas", "Rodeiro", "Romaria", "Rosário da Limeira", "Rubelita", "Rubim", "Sabará", "Sabinópolis", "Sacramento", "Salinas", "Salto da Divisa", "Santa Bárbara", "Santa Bárbara do Leste", "Santa Bárbara do Monte Verde", "Santa Bárbara do Tugúrio", "Santa Cruz de Minas", "Santa Cruz de Salinas", "Santa Cruz do Escalvado", "Santa Efigênia de Minas", "Santa Fé de Minas", "Santa Helena de Minas", "Santa Juliana", "Santa Luzia", "Santa Margarida", "Santa Maria de Itabira", "Santa Maria do Salto", "Santa Maria do Suaçuí", "Santa Rita de Caldas", "Santa Rita de Ibitipoca", "Santa Rita de Jacutinga", "Santa Rita de Minas", "Santa Rita do Itueto", "Santa Rita do Sapucaí", "Santa Rosa da Serra", "Santa Vitória", "Santana da Vargem", "Santana de Cataguases", "Santana de Pirapama", "Santana do Deserto", "Santana do Garambéu", "Santana do Jacaré", "Santana do Manhuaçu", "Santana do Paraíso", "Santana do Riacho", "Santana dos Montes", "Santo Antônio do Amparo", "Santo Antônio do Aventureiro", "Santo Antônio do Grama", "Santo Antônio do Itambé", "Santo Antônio do Jacinto", "Santo Antônio do Monte", "Santo Antônio do Retiro", "Santo Antônio do Rio Abaixo", "Santo Hipólito", "Santos Dumont", "São Bento Abade", "São Brás do Suaçuí", "São Domingos das Dores", "São Domingos do Prata", "São Félix de Minas", "São Francisco", "São Francisco de Paula", "São Francisco de Sales", "São Francisco do Glória", "São Geraldo", "São Geraldo da Piedade", "São Geraldo do Baixio", "São Gonçalo do Abaeté", "São Gonçalo do Pará", "São Gonçalo do Rio Abaixo", "São Gonçalo do Rio Preto", "São Gonçalo do Sapucaí", "São Gotardo", "São João Batista do Glória", "São João da Lagoa", "São João da Mata", "São João da Ponte", "São João das Missões", "São João del Rei", "São João do Manhuaçu", "São João do Manteninha", "São João do Oriente", "São João do Pacuí", "São João do Paraíso", "São João Evangelista", "São João Nepomuceno", "São Joaquim de Bicas", "São José da Barra", "São José da Lapa", "São José da Safira", "São José da Varginha", "São José do Alegre", "São José do Divino", "São José do Goiabal", "São José do Jacuri", "São José do Mantimento", "São Lourenço", "São Miguel do Anta", "São Pedro da União", "São Pedro do Suaçuí", "São Pedro dos Ferros", "São Romão", "São Roque de Minas", "São Sebastião da Bela Vista", "São Sebastião da Vargem Alegre", "São Sebastião do Anta", "São Sebastião do Maranhão", "São Sebastião do Oeste", "São Sebastião do Paraíso", "São Sebastião do Rio Preto", "São Sebastião do Rio Verde", "São Thomé das Letras", "São Tiago", "São Tomás de Aquino", "São Vicente de Minas", "Sapucaí-Mirim", "Sardoá", "Sarzedo", "Sem-Peixe", "Senador Amaral", "Senador Cortes", "Senador Firmino", "Senador José Bento", "Senador Modestino Gonçalves", "Senhora de Oliveira", "Senhora do Porto", "Senhora dos Remédios", "Sericita", "Seritinga", "Serra Azul de Minas", "Serra da Saudade", "Serra do Salitre", "Serra dos Aimorés", "Serrania", "Serranópolis de Minas", "Serranos", "Serro", "Sete Lagoas", "Setubinha", "Silveirânia", "Silvianópolis", "Simão Pereira", "Simonésia", "Sobrália", "Soledade de Minas", "Tabuleiro", "Taiobeiras", "Taparuba", "Tapira", "Tapiraí", "Taquaraçu de Minas", "Tarumirim", "Teixeiras", "Teófilo Otoni", "Timóteo", "Tiradentes", "Tiros", "Tocantins", "Tocos do Moji", "Toledo", "Tombos", "Três Corações", "Três Marias", "Três Pontas", "Tumiritinga", "Tupaciguara", "Turmalina", "Turvolândia", "Ubá", "Ubaí", "Ubaporanga", "Uberaba", "Uberlândia", "Umburatiba", "Unaí", "União de Minas", "Uruana de Minas", "Urucânia", "Urucuia", "Vargem Alegre", "Vargem Bonita", "Vargem Grande do Rio Pardo", "Varginha", "Varjão de Minas", "Várzea da Palma", "Varzelândia", "Vazante", "Verdelândia", "Veredinha", "Veríssimo", "Vermelho Novo", "Vespasiano", "Viçosa", "Vieiras", "Virgem da Lapa", "Virgínia", "Virginópolis", "Virgolândia", "Visconde do Rio Branco", "Volta Grande", "Wenceslau Braz"] }, { "sigla": "MS", "nome": "Mato Grosso do Sul", "cidades": ["Água Clara", "Alcinópolis", "Amambaí", "Anastácio", "Anaurilândia", "Angélica", "Antônio João", "Aparecida do Taboado", "Aquidauana", "Aral Moreira", "Bandeirantes", "Bataguassu", "Bataiporã", "Bela Vista", "Bodoquena", "Bonito", "Brasilândia", "Caarapó", "Camapuã", "Campo Grande", "Caracol", "Cassilândia", "Chapadão do Sul", "Corguinho", "Coronel Sapucaia", "Corumbá", "Costa Rica", "Coxim", "Deodápolis", "Dois Irmãos do Buriti", "Douradina", "Dourados", "Eldorado", "Fátima do Sul", "Glória de Dourados", "Guia Lopes da Laguna", "Iguatemi", "Inocência", "Itaporã", "Itaquiraí", "Ivinhema", "Japorã", "Jaraguari", "Jardim", "Jateí", "Juti", "Ladário", "Laguna Carapã", "Maracaju", "Miranda", "Mundo Novo", "Naviraí", "Nioaque", "Nova Alvorada do Sul", "Nova Andradina", "Novo Horizonte do Sul", "Paranaíba", "Paranhos", "Pedro Gomes", "Ponta Porã", "Porto Murtinho", "Ribas do Rio Pardo", "Rio Brilhante", "Rio Negro", "Rio Verde de Mato Grosso", "Rochedo", "Santa Rita do Pardo", "São Gabriel do Oeste", "Selvíria", "Sete Quedas", "Sidrolândia", "Sonora", "Tacuru", "Taquarussu", "Terenos", "Três Lagoas", "Vicentina"] }, { "sigla": "MT", "nome": "Mato Grosso", "cidades": ["Acorizal", "Água Boa", "Alta Floresta", "Alto Araguaia", "Alto Boa Vista", "Alto Garças", "Alto Paraguai", "Alto Taquari", "Apiacás", "Araguaiana", "Araguainha", "Araputanga", "Arenápolis", "Aripuanã", "Barão de Melgaço", "Barra do Bugres", "Barra do Garças", "Bom Jesus do Araguaia", "Brasnorte", "Cáceres", "Campinápolis", "Campo Novo do Parecis", "Campo Verde", "Campos de Júlio", "Canabrava do Norte", "Canarana", "Carlinda", "Castanheira", "Chapada dos Guimarães", "Cláudia", "Cocalinho", "Colíder", "Colniza", "Comodoro", "Confresa", "Conquista d'Oeste", "Cotriguaçu", "Curvelândia", "Cuiabá", "Denise", "Diamantino", "Dom Aquino", "Feliz Natal", "Figueirópolis d'Oeste", "Gaúcha do Norte", "General Carneiro", "Glória d'Oeste", "Guarantã do Norte", "Guiratinga", "Indiavaí", "Itaúba", "Itiquira", "Jaciara", "Jangada", "Jauru", "Juara", "Juína", "Juruena", "Juscimeira", "Lambari d'Oeste", "Lucas do Rio Verde", "Luciára", "Marcelândia", "Matupá", "Mirassol d'Oeste", "Nobres", "Nortelândia", "Nossa Senhora do Livramento", "Nova Bandeirantes", "Nova Brasilândia", "Nova Canãa do Norte", "Nova Guarita", "Nova Lacerda", "Nova Marilândia", "Nova Maringá", "Nova Monte Verde", "Nova Mutum", "Nova Nazaré", "Nova Olímpia", "Nova Santa Helena", "Nova Ubiratã", "Nova Xavantina", "Novo Horizonte do Norte", "Novo Mundo", "Novo Santo Antônio", "Novo São Joaquim", "Paranaíta", "Paranatinga", "Pedra Preta", "Peixoto de Azevedo", "Planalto da Serra", "Poconé", "Pontal do Araguaia", "Ponte Branca", "Pontes e Lacerda", "Porto Alegre do Norte", "Porto dos Gaúchos", "Porto Esperidião", "Porto Estrela", "Poxoréo", "Primavera do Leste", "Querência", "Reserva do Cabaçal", "Ribeirão Cascalheira", "Ribeirãozinho", "Rio Branco", "Rondolândia", "Rondonópolis", "Rosário Oeste", "Salto do Céu", "Santa Carmem", "Santa Cruz do Xingu", "Santa Rita do Trivelato", "Santa Terezinha", "Santo Afonso", "Santo Antônio do Leste", "Santo Antônio do Leverger", "São Félix do Araguaia", "São José do Povo", "São José do Rio Claro", "São José do Xingu", "São José dos Quatro Marcos", "São Pedro da Cipa", "Sapezal", "Serra Nova Dourada", "Sinop", "Sorriso", "Tabaporã", "Tangará da Serra", "Tapurah", "Terra Nova do Norte", "Tesouro", "Torixoréu", "União do Sul", "Vale de São Domingos", "Várzea Grande", "Vera", "Vila Bela da Santíssima Trindade", "Vila Rica"] }, { "sigla": "PA", "nome": "Pará", "cidades": ["Abaetetuba", "Abel Figueiredo", "Acará", "Afuá", "Água Azul do Norte", "Alenquer", "Almeirim", "Altamira", "Anajás", "Ananindeua", "Anapu", "Augusto Corrêa", "Aurora do Pará", "Aveiro", "Bagre", "Baião", "Bannach", "Barcarena", "Belém", "Belterra", "Benevides", "Bom Jesus do Tocantins", "Bonito", "Bragança", "Brasil Novo", "Brejo Grande do Araguaia", "Breu Branco", "Breves", "Bujaru", "Cachoeira do Arari", "Cachoeira do Piriá", "Cametá", "Canaã dos Carajás", "Capanema", "Capitão Poço", "Castanhal", "Chaves", "Colares", "Conceição do Araguaia", "Concórdia do Pará", "Cumaru do Norte", "Curionópolis", "Curralinho", "Curuá", "Curuçá", "Dom Eliseu", "Eldorado dos Carajás", "Faro", "Floresta do Araguaia", "Garrafão do Norte", "Goianésia do Pará", "Gurupá", "Igarapé-Açu", "Igarapé-Miri", "Inhangapi", "Ipixuna do Pará", "Irituia", "Itaituba", "Itupiranga", "Jacareacanga", "Jacundá", "Juruti", "Limoeiro do Ajuru", "Mãe do Rio", "Magalhães Barata", "Marabá", "Maracanã", "Marapanim", "Marituba", "Medicilândia", "Melgaço", "Mocajuba", "Moju", "Monte Alegre", "Muaná", "Nova Esperança do Piriá", "Nova Ipixuna", "Nova Timboteua", "Novo Progresso", "Novo Repartimento", "Óbidos", "Oeiras do Pará", "Oriximiná", "Ourém", "Ourilândia do Norte", "Pacajá", "Palestina do Pará", "Paragominas", "Parauapebas", "Pau d'Arco", "Peixe-Boi", "Piçarra", "Placas", "Ponta de Pedras", "Portel", "Porto de Moz", "Prainha", "Primavera", "Quatipuru", "Redenção", "Rio Maria", "Rondon do Pará", "Rurópolis", "Salinópolis", "Salvaterra", "Santa Bárbara do Pará", "Santa Cruz do Arari", "Santa Isabel do Pará", "Santa Luzia do Pará", "Santa Maria das Barreiras", "Santa Maria do Pará", "Santana do Araguaia", "Santarém", "Santarém Novo", "Santo Antônio do Tauá", "São Caetano de Odivela", "São Domingos do Araguaia", "São Domingos do Capim", "São Félix do Xingu", "São Francisco do Pará", "São Geraldo do Araguaia", "São João da Ponta", "São João de Pirabas", "São João do Araguaia", "São Miguel do Guamá", "São Sebastião da Boa Vista", "Sapucaia", "Senador José Porfírio", "Soure", "Tailândia", "Terra Alta", "Terra Santa", "Tomé-Açu", "Tracuateua", "Trairão", "Tucumã", "Tucuruí", "Ulianópolis", "Uruará", "Vigia", "Viseu", "Vitória do Xingu", "Xinguara"] }, { "sigla": "PB", "nome": "Paraíba", "cidades": ["Água Branca", "Aguiar", "Alagoa Grande", "Alagoa Nova", "Alagoinha", "Alcantil", "Algodão de Jandaíra", "Alhandra", "Amparo", "Aparecida", "Araçagi", "Arara", "Araruna", "Areia", "Areia de Baraúnas", "Areial", "Aroeiras", "Assunção", "Baía da Traição", "Bananeiras", "Baraúna", "Barra de Santa Rosa", "Barra de Santana", "Barra de São Miguel", "Bayeux", "Belém", "Belém do Brejo do Cruz", "Bernardino Batista", "Boa Ventura", "Boa Vista", "Bom Jesus", "Bom Sucesso", "Bonito de Santa Fé", "Boqueirão", "Borborema", "Brejo do Cruz", "Brejo dos Santos", "Caaporã", "Cabaceiras", "Cabedelo", "Cachoeira dos Índios", "Cacimba de Areia", "Cacimba de Dentro", "Cacimbas", "Caiçara", "Cajazeiras", "Cajazeirinhas", "Caldas Brandão", "Camalaú", "Campina Grande", "Campo de Santana", "Capim", "Caraúbas", "Carrapateira", "Casserengue", "Catingueira", "Catolé do Rocha", "Caturité", "Conceição", "Condado", "Conde", "Congo", "Coremas", "Coxixola", "Cruz do Espírito Santo", "Cubati", "Cuité", "Cuité de Mamanguape", "Cuitegi", "Curral de Cima", "Curral Velho", "Damião", "Desterro", "Diamante", "Dona Inês", "Duas Estradas", "Emas", "Esperança", "Fagundes", "Frei Martinho", "Gado Bravo", "Guarabira", "Gurinhém", "Gurjão", "Ibiara", "Igaracy", "Imaculada", "Ingá", "Itabaiana", "Itaporanga", "Itapororoca", "Itatuba", "Jacaraú", "Jericó", "João Pessoa", "Juarez Távora", "Juazeirinho", "Junco do Seridó", "Juripiranga", "Juru", "Lagoa", "Lagoa de Dentro", "Lagoa Seca", "Lastro", "Livramento", "Logradouro", "Lucena", "Mãe d'Água", "Malta", "Mamanguape", "Manaíra", "Marcação", "Mari", "Marizópolis", "Massaranduba", "Mataraca", "Matinhas", "Mato Grosso", "Maturéia", "Mogeiro", "Montadas", "Monte Horebe", "Monteiro", "Mulungu", "Natuba", "Nazarezinho", "Nova Floresta", "Nova Olinda", "Nova Palmeira", "Olho d'Água", "Olivedos", "Ouro Velho", "Parari", "Passagem", "Patos", "Paulista", "Pedra Branca", "Pedra Lavrada", "Pedras de Fogo", "Pedro Régis", "Piancó", "Picuí", "Pilar", "Pilões", "Pilõezinhos", "Pirpirituba", "Pitimbu", "Pocinhos", "Poço Dantas", "Poço de José de Moura", "Pombal", "Prata", "Princesa Isabel", "Puxinanã", "Queimadas", "Quixabá", "Remígio", "Riachão", "Riachão do Bacamarte", "Riachão do Poço", "Riacho de Santo Antônio", "Riacho dos Cavalos", "Rio Tinto", "Salgadinho", "Salgado de São Félix", "Santa Cecília", "Santa Cruz", "Santa Helena", "Santa Inês", "Santa Luzia", "Santa Rita", "Santa Teresinha", "Santana de Mangueira", "Santana dos Garrotes", "Santarém", "Santo André", "São Bentinho", "São Bento", "São Domingos de Pombal", "São Domingos do Cariri", "São Francisco", "São João do Cariri", "São João do Rio do Peixe", "São João do Tigre", "São José da Lagoa Tapada", "São José de Caiana", "São José de Espinharas", "São José de Piranhas", "São José de Princesa", "São José do Bonfim", "São José do Brejo do Cruz", "São José do Sabugi", "São José dos Cordeiros", "São José dos Ramos", "São Mamede", "São Miguel de Taipu", "São Sebastião de Lagoa de Roça", "São Sebastião do Umbuzeiro", "Sapé", "Seridó", "Serra Branca", "Serra da Raiz", "Serra Grande", "Serra Redonda", "Serraria", "Sertãozinho", "Sobrado", "Solânea", "Soledade", "Sossêgo", "Sousa", "Sumé", "Taperoá", "Tavares", "Teixeira", "Tenório", "Triunfo", "Uiraúna", "Umbuzeiro", "Várzea", "Vieirópolis", "Vista Serrana", "Zabelê"] }, { "sigla": "PE", "nome": "Pernambuco", "cidades": ["Abreu e Lima", "Afogados da Ingazeira", "Afrânio", "Agrestina", "Água Preta", "Águas Belas", "Alagoinha", "Aliança", "Altinho", "Amaraji", "Angelim", "Araçoiaba", "Araripina", "Arcoverde", "Barra de Guabiraba", "Barreiros", "Belém de Maria", "Belém de São Francisco", "Belo Jardim", "Betânia", "Bezerros", "Bodocó", "Bom Conselho", "Bom Jardim", "Bonito", "Brejão", "Brejinho", "Brejo da Madre de Deus", "Buenos Aires", "Buíque", "Cabo de Santo Agostinho", "Cabrobó", "Cachoeirinha", "Caetés", "Calçado", "Calumbi", "Camaragibe", "Camocim de São Félix", "Camutanga", "Canhotinho", "Capoeiras", "Carnaíba", "Carnaubeira da Penha", "Carpina", "Caruaru", "Casinhas", "Catende", "Cedro", "Chã de Alegria", "Chã Grande", "Condado", "Correntes", "Cortês", "Cumaru", "Cupira", "Custódia", "Dormentes", "Escada", "Exu", "Feira Nova", "Fernando de Noronha", "Ferreiros", "Flores", "Floresta", "Frei Miguelinho", "Gameleira", "Garanhuns", "Glória do Goitá", "Goiana", "Granito", "Gravatá", "Iati", "Ibimirim", "Ibirajuba", "Igarassu", "Iguaraci", "Inajá", "Ingazeira", "Ipojuca", "Ipubi", "Itacuruba", "Itaíba", "Itamaracá", "Itambé", "Itapetim", "Itapissuma", "Itaquitinga", "Jaboatão dos Guararapes", "Jaqueira", "Jataúba", "Jatobá", "João Alfredo", "Joaquim Nabuco", "Jucati", "Jupi", "Jurema", "Lagoa do Carro", "Lagoa do Itaenga", "Lagoa do Ouro", "Lagoa dos Gatos", "Lagoa Grande", "Lajedo", "Limoeiro", "Macaparana", "Machados", "Manari", "Maraial", "Mirandiba", "Moreilândia", "Moreno", "Nazaré da Mata", "Olinda", "Orobó", "Orocó", "Ouricuri", "Palmares", "Palmeirina", "Panelas", "Paranatama", "Parnamirim", "Passira", "Paudalho", "Paulista", "Pedra", "Pesqueira", "Petrolândia", "Petrolina", "Poção", "Pombos", "Primavera", "Quipapá", "Quixaba", "Recife", "Riacho das Almas", "Ribeirão", "Rio Formoso", "Sairé", "Salgadinho", "Salgueiro", "Saloá", "Sanharó", "Santa Cruz", "Santa Cruz da Baixa Verde", "Santa Cruz do Capibaribe", "Santa Filomena", "Santa Maria da Boa Vista", "Santa Maria do Cambucá", "Santa Terezinha", "São Benedito do Sul", "São Bento do Una", "São Caitano", "São João", "São Joaquim do Monte", "São José da Coroa Grande", "São José do Belmonte", "São José do Egito", "São Lourenço da Mata", "São Vicente Ferrer", "Serra Talhada", "Serrita", "Sertânia", "Sirinhaém", "Solidão", "Surubim", "Tabira", "Tacaimbó", "Tacaratu", "Tamandaré", "Taquaritinga do Norte", "Terezinha", "Terra Nova", "Timbaúba", "Toritama", "Tracunhaém", "Trindade", "Triunfo", "Tupanatinga", "Tuparetama", "Venturosa", "Verdejante", "Vertente do Lério", "Vertentes", "Vicência", "Vitória de Santo Antão", "Xexéu"] }, { "sigla": "PI", "nome": "Piauí", "cidades": ["Acauã", "Agricolândia", "Água Branca", "Alagoinha do Piauí", "Alegrete do Piauí", "Alto Longá", "Altos", "Alvorada do Gurguéia", "Amarante", "Angical do Piauí", "Anísio de Abreu", "Antônio Almeida", "Aroazes", "Arraial", "Assunção do Piauí", "Avelino Lopes", "Baixa Grande do Ribeiro", "Barra d'Alcântara", "Barras", "Barreiras do Piauí", "Barro Duro", "Batalha", "Bela Vista do Piauí", "Belém do Piauí", "Beneditinos", "Bertolínia", "Betânia do Piauí", "Boa Hora", "Bocaina", "Bom Jesus", "Bom Princípio do Piauí", "Bonfim do Piauí", "Boqueirão do Piauí", "Brasileira", "Brejo do Piauí", "Buriti dos Lopes", "Buriti dos Montes", "Cabeceiras do Piauí", "Cajazeiras do Piauí", "Cajueiro da Praia", "Caldeirão Grande do Piauí", "Campinas do Piauí", "Campo Alegre do Fidalgo", "Campo Grande do Piauí", "Campo Largo do Piauí", "Campo Maior", "Canavieira", "Canto do Buriti", "Capitão de Campos", "Capitão Gervásio Oliveira", "Caracol", "Caraúbas do Piauí", "Caridade do Piauí", "Castelo do Piauí", "Caxingó", "Cocal", "Cocal de Telha", "Cocal dos Alves", "Coivaras", "Colônia do Gurguéia", "Colônia do Piauí", "Conceição do Canindé", "Coronel José Dias", "Corrente", "Cristalândia do Piauí", "Cristino Castro", "Curimatá", "Currais", "Curral Novo do Piauí", "Curralinhos", "Demerval Lobão", "Dirceu Arcoverde", "Dom Expedito Lopes", "Dom Inocêncio", "Domingos Mourão", "Elesbão Veloso", "Eliseu Martins", "Esperantina", "Fartura do Piauí", "Flores do Piauí", "Floresta do Piauí", "Floriano", "Francinópolis", "Francisco Ayres", "Francisco Macedo", "Francisco Santos", "Fronteiras", "Geminiano", "Gilbués", "Guadalupe", "Guaribas", "Hugo Napoleão", "Ilha Grande", "Inhuma", "Ipiranga do Piauí", "Isaías Coelho", "Itainópolis", "Itaueira", "Jacobina do Piauí", "Jaicós", "Jardim do Mulato", "Jatobá do Piauí", "Jerumenha", "João Costa", "Joaquim Pires", "Joca Marques", "José de Freitas", "Juazeiro do Piauí", "Júlio Borges", "Jurema", "Lagoa Alegre", "Lagoa de São Francisco", "Lagoa do Barro do Piauí", "Lagoa do Piauí", "Lagoa do Sítio", "Lagoinha do Piauí", "Landri Sales", "Luís Correia", "Luzilândia", "Madeiro", "Manoel Emídio", "Marcolândia", "Marcos Parente", "Massapê do Piauí", "Matias Olímpio", "Miguel Alves", "Miguel Leão", "Milton Brandão", "Monsenhor Gil", "Monsenhor Hipólito", "Monte Alegre do Piauí", "Morro Cabeça no Tempo", "Morro do Chapéu do Piauí", "Murici dos Portelas", "Nazaré do Piauí", "Nossa Senhora de Nazaré", "Nossa Senhora dos Remédios", "Nova Santa Rita", "Novo Oriente do Piauí", "Novo Santo Antônio", "Oeiras", "Olho d'Água do Piauí", "Padre Marcos", "Paes Landim", "Pajeú do Piauí", "Palmeira do Piauí", "Palmeirais", "Paquetá", "Parnaguá", "Parnaíba", "Passagem Franca do Piauí", "Patos do Piauí", "Pau d'Arco do Piauí", "Paulistana", "Pavussu", "Pedro II", "Pedro Laurentino", "Picos", "Pimenteiras", "Pio IX", "Piracuruca", "Piripiri", "Porto", "Porto Alegre do Piauí", "Prata do Piauí", "Queimada Nova", "Redenção do Gurguéia", "Regeneração", "Riacho Frio", "Ribeira do Piauí", "Ribeiro Gonçalves", "Rio Grande do Piauí", "Santa Cruz do Piauí", "Santa Cruz dos Milagres", "Santa Filomena", "Santa Luz", "Santa Rosa do Piauí", "Santana do Piauí", "Santo Antônio de Lisboa", "Santo Antônio dos Milagres", "Santo Inácio do Piauí", "São Braz do Piauí", "São Félix do Piauí", "São Francisco de Assis do Piauí", "São Francisco do Piauí", "São Gonçalo do Gurguéia", "São Gonçalo do Piauí", "São João da Canabrava", "São João da Fronteira", "São João da Serra", "São João da Varjota", "São João do Arraial", "São João do Piauí", "São José do Divino", "São José do Peixe", "São José do Piauí", "São Julião", "São Lourenço do Piauí", "São Luis do Piauí", "São Miguel da Baixa Grande", "São Miguel do Fidalgo", "São Miguel do Tapuio", "São Pedro do Piauí", "São Raimundo Nonato", "Sebastião Barros", "Sebastião Leal", "Sigefredo Pacheco", "Simões", "Simplício Mendes", "Socorro do Piauí", "Sussuapara", "Tamboril do Piauí", "Tanque do Piauí", "Teresina", "União", "Uruçuí", "Valença do Piauí", "Várzea Branca", "Várzea Grande", "Vera Mendes", "Vila Nova do Piauí", "Wall Ferraz"] }, { "sigla": "PR", "nome": "Paraná", "cidades": ["Abatiá", "Adrianópolis", "Agudos do Sul", "Almirante Tamandaré", "Altamira do Paraná", "Alto Paraná", "Alto Piquiri", "Altônia", "Alvorada do Sul", "Amaporã", "Ampére", "Anahy", "Andirá", "Ângulo", "Antonina", "Antônio Olinto", "Apucarana", "Arapongas", "Arapoti", "Arapuã", "Araruna", "Araucária", "Ariranha do Ivaí", "Assaí", "Assis Chateaubriand", "Astorga", "Atalaia", "Balsa Nova", "Bandeirantes", "Barbosa Ferraz", "Barra do Jacaré", "Barracão", "Bela Vista da Caroba", "Bela Vista do Paraíso", "Bituruna", "Boa Esperança", "Boa Esperança do Iguaçu", "Boa Ventura de São Roque", "Boa Vista da Aparecida", "Bocaiúva do Sul", "Bom Jesus do Sul", "Bom Sucesso", "Bom Sucesso do Sul", "Borrazópolis", "Braganey", "Brasilândia do Sul", "Cafeara", "Cafelândia", "Cafezal do Sul", "Califórnia", "Cambará", "Cambé", "Cambira", "Campina da Lagoa", "Campina do Simão", "Campina Grande do Sul", "Campo Bonito", "Campo do Tenente", "Campo Largo", "Campo Magro", "Campo Mourão", "Cândido de Abreu", "Candói", "Cantagalo", "Capanema", "Capitão Leônidas Marques", "Carambeí", "Carlópolis", "Cascavel", "Castro", "Catanduvas", "Centenário do Sul", "Cerro Azul", "Céu Azul", "Chopinzinho", "Cianorte", "Cidade Gaúcha", "Clevelândia", "Colombo", "Colorado", "Congonhinhas", "Conselheiro Mairinck", "Contenda", "Corbélia", "Cornélio Procópio", "Coronel Domingos Soares", "Coronel Vivida", "Corumbataí do Sul", "Cruz Machado", "Cruzeiro do Iguaçu", "Cruzeiro do Oeste", "Cruzeiro do Sul", "Cruzmaltina", "Curitiba", "Curiúva", "Diamante d'Oeste", "Diamante do Norte", "Diamante do Sul", "Dois Vizinhos", "Douradina", "Doutor Camargo", "Doutor Ulysses", "Enéas Marques", "Engenheiro Beltrão", "Entre Rios do Oeste", "Esperança Nova", "Espigão Alto do Iguaçu", "Farol", "Faxinal", "Fazenda Rio Grande", "Fênix", "Fernandes Pinheiro", "Figueira", "Flor da Serra do Sul", "Floraí", "Floresta", "Florestópolis", "Flórida", "Formosa do Oeste", "Foz do Iguaçu", "Foz do Jordão", "Francisco Alves", "Francisco Beltrão", "General Carneiro", "Godoy Moreira", "Goioerê", "Goioxim", "Grandes Rios", "Guaíra", "Guairaçá", "Guamiranga", "Guapirama", "Guaporema", "Guaraci", "Guaraniaçu", "Guarapuava", "Guaraqueçaba", "Guaratuba", "Honório Serpa", "Ibaiti", "Ibema", "Ibiporã", "Icaraíma", "Iguaraçu", "Iguatu", "Imbaú", "Imbituva", "Inácio Martins", "Inajá", "Indianópolis", "Ipiranga", "Iporã", "Iracema do Oeste", "Irati", "Iretama", "Itaguajé", "Itaipulândia", "Itambaracá", "Itambé", "Itapejara d'Oeste", "Itaperuçu", "Itaúna do Sul", "Ivaí", "Ivaiporã", "Ivaté", "Ivatuba", "Jaboti", "Jacarezinho", "Jaguapitã", "Jaguariaíva", "Jandaia do Sul", "Janiópolis", "Japira", "Japurá", "Jardim Alegre", "Jardim Olinda", "Jataizinho", "Jesuítas", "Joaquim Távora", "Jundiaí do Sul", "Juranda", "Jussara", "Kaloré", "Lapa", "Laranjal", "Laranjeiras do Sul", "Leópolis", "Lidianópolis", "Lindoeste", "Loanda", "Lobato", "Londrina", "Luiziana", "Lunardelli", "Lupionópolis", "Mallet", "Mamborê", "Mandaguaçu", "Mandaguari", "Mandirituba", "Manfrinópolis", "Mangueirinha", "Manoel Ribas", "Marechal Cândido Rondon", "Maria Helena", "Marialva", "Marilândia do Sul", "Marilena", "Mariluz", "Maringá", "Mariópolis", "Maripá", "Marmeleiro", "Marquinho", "Marumbi", "Matelândia", "Matinhos", "Mato Rico", "Mauá da Serra", "Medianeira", "Mercedes", "Mirador", "Miraselva", "Missal", "Moreira Sales", "Morretes", "Munhoz de Melo", "Nossa Senhora das Graças", "Nova Aliança do Ivaí", "Nova América da Colina", "Nova Aurora", "Nova Cantu", "Nova Esperança", "Nova Esperança do Sudoeste", "Nova Fátima", "Nova Laranjeiras", "Nova Londrina", "Nova Olímpia", "Nova Prata do Iguaçu", "Nova Santa Bárbara", "Nova Santa Rosa", "Nova Tebas", "Novo Itacolomi", "Ortigueira", "Ourizona", "Ouro Verde do Oeste", "Paiçandu", "Palmas", "Palmeira", "Palmital", "Palotina", "Paraíso do Norte", "Paranacity", "Paranaguá", "Paranapoema", "Paranavaí", "Pato Bragado", "Pato Branco", "Paula Freitas", "Paulo Frontin", "Peabiru", "Perobal", "Pérola", "Pérola d'Oeste", "Piên", "Pinhais", "Pinhal de São Bento", "Pinhalão", "Pinhão", "Piraí do Sul", "Piraquara", "Pitanga", "Pitangueiras", "Planaltina do Paraná", "Planalto", "Ponta Grossa", "Pontal do Paraná", "Porecatu", "Porto Amazonas", "Porto Barreiro", "Porto Rico", "Porto Vitória", "Prado Ferreira", "Pranchita", "Presidente Castelo Branco", "Primeiro de Maio", "Prudentópolis", "Quarto Centenário", "Quatiguá", "Quatro Barras", "Quatro Pontes", "Quedas do Iguaçu", "Querência do Norte", "Quinta do Sol", "Quitandinha", "Ramilândia", "Rancho Alegre", "Rancho Alegre d'Oeste", "Realeza", "Rebouças", "Renascença", "Reserva", "Reserva do Iguaçu", "Ribeirão Claro", "Ribeirão do Pinhal", "Rio Azul", "Rio Bom", "Rio Bonito do Iguaçu", "Rio Branco do Ivaí", "Rio Branco do Sul", "Rio Negro", "Rolândia", "Roncador", "Rondon", "Rosário do Ivaí", "Sabáudia", "Salgado Filho", "Salto do Itararé", "Salto do Lontra", "Santa Amélia", "Santa Cecília do Pavão", "Santa Cruz Monte Castelo", "Santa Fé", "Santa Helena", "Santa Inês", "Santa Isabel do Ivaí", "Santa Izabel do Oeste", "Santa Lúcia", "Santa Maria do Oeste", "Santa Mariana", "Santa Mônica", "Santa Tereza do Oeste", "Santa Terezinha de Itaipu", "Santana do Itararé", "Santo Antônio da Platina", "Santo Antônio do Caiuá", "Santo Antônio do Paraíso", "Santo Antônio do Sudoeste", "Santo Inácio", "São Carlos do Ivaí", "São Jerônimo da Serra", "São João", "São João do Caiuá", "São João do Ivaí", "São João do Triunfo", "São Jorge d'Oeste", "São Jorge do Ivaí", "São Jorge do Patrocínio", "São José da Boa Vista", "São José das Palmeiras", "São José dos Pinhais", "São Manoel do Paraná", "São Mateus do Sul", "São Miguel do Iguaçu", "São Pedro do Iguaçu", "São Pedro do Ivaí", "São Pedro do Paraná", "São Sebastião da Amoreira", "São Tomé", "Sapopema", "Sarandi", "Saudade do Iguaçu", "Sengés", "Serranópolis do Iguaçu", "Sertaneja", "Sertanópolis", "Siqueira Campos", "Sulina", "Tamarana", "Tamboara", "Tapejara", "Tapira", "Teixeira Soares", "Telêmaco Borba", "Terra Boa", "Terra Rica", "Terra Roxa", "Tibagi", "Tijucas do Sul", "Toledo", "Tomazina", "Três Barras do Paraná", "Tunas do Paraná", "Tuneiras do Oeste", "Tupãssi", "Turvo", "Ubiratã", "Umuarama", "União da Vitória", "Uniflor", "Uraí", "Ventania", "Vera Cruz do Oeste", "Verê", "Vila Alta", "Virmond", "Vitorino", "Wenceslau Braz", "Xambrê"] }, { "sigla": "RJ", "nome": "Rio de Janeiro", "cidades": ["Angra dos Reis", "Aperibé", "Araruama", "Areal", "Armação de Búzios", "Arraial do Cabo", "Barra do Piraí", "Barra Mansa", "Belford Roxo", "Bom Jardim", "Bom Jesus do Itabapoana", "Cabo Frio", "Cachoeiras de Macacu", "Cambuci", "Campos dos Goytacazes", "Cantagalo", "Carapebus", "Cardoso Moreira", "Carmo", "Casimiro de Abreu", "Comendador Levy Gasparian", "Conceição de Macabu", "Cordeiro", "Duas Barras", "Duque de Caxias", "Engenheiro Paulo de Frontin", "Guapimirim", "Iguaba Grande", "Itaboraí", "Itaguaí", "Italva", "Itaocara", "Itaperuna", "Itatiaia", "Japeri", "Laje do Muriaé", "Macaé", "Macuco", "Magé", "Mangaratiba", "Maricá", "Mendes", "Mesquita", "Miguel Pereira", "Miracema", "Natividade", "Nilópolis", "Niterói", "Nova Friburgo", "Nova Iguaçu", "Paracambi", "Paraíba do Sul", "Parati", "Paty do Alferes", "Petrópolis", "Pinheiral", "Piraí", "Porciúncula", "Porto Real", "Quatis", "Queimados", "Quissamã", "Resende", "Rio Bonito", "Rio Claro", "Rio das Flores", "Rio das Ostras", "Rio de Janeiro", "Santa Maria Madalena", "Santo Antônio de Pádua", "São Fidélis", "São Francisco de Itabapoana", "São Gonçalo", "São João da Barra", "São João de Meriti", "São José de Ubá", "São José do Vale do Rio Preto", "São Pedro da Aldeia", "São Sebastião do Alto", "Sapucaia", "Saquarema", "Seropédica", "Silva Jardim", "Sumidouro", "Tanguá", "Teresópolis", "Trajano de Morais", "Três Rios", "Valença", "Varre-Sai", "Vassouras", "Volta Redonda"] }, { "sigla": "RN", "nome": "Rio Grande do Norte", "cidades": ["Acari", "Açu", "Afonso Bezerra", "Água Nova", "Alexandria", "Almino Afonso", "Alto do Rodrigues", "Angicos", "Antônio Martins", "Apodi", "Areia Branca", "Arês", "Augusto Severo", "Baía Formosa", "Baraúna", "Barcelona", "Bento Fernandes", "Bodó", "Bom Jesus", "Brejinho", "Caiçara do Norte", "Caiçara do Rio do Vento", "Caicó", "Campo Redondo", "Canguaretama", "Caraúbas", "Carnaúba dos Dantas", "Carnaubais", "Ceará-Mirim", "Cerro Corá", "Coronel Ezequiel", "Coronel João Pessoa", "Cruzeta", "Currais Novos", "Doutor Severiano", "Encanto", "Equador", "Espírito Santo", "Extremoz", "Felipe Guerra", "Fernando Pedroza", "Florânia", "Francisco Dantas", "Frutuoso Gomes", "Galinhos", "Goianinha", "Governador Dix-Sept Rosado", "Grossos", "Guamaré", "Ielmo Marinho", "Ipanguaçu", "Ipueira", "Itajá", "Itaú", "Jaçanã", "Jandaíra", "Janduís", "Januário Cicco", "Japi", "Jardim de Angicos", "Jardim de Piranhas", "Jardim do Seridó", "João Câmara", "João Dias", "José da Penha", "Jucurutu", "Jundiá", "Lagoa d'Anta", "Lagoa de Pedras", "Lagoa de Velhos", "Lagoa Nova", "Lagoa Salgada", "Lajes", "Lajes Pintadas", "Lucrécia", "Luís Gomes", "Macaíba", "Macau", "Major Sales", "Marcelino Vieira", "Martins", "Maxaranguape", "Messias Targino", "Montanhas", "Monte Alegre", "Monte das Gameleiras", "Mossoró", "Natal", "Nísia Floresta", "Nova Cruz", "Olho-d'Água do Borges", "Ouro Branco", "Paraná", "Paraú", "Parazinho", "Parelhas", "Parnamirim", "Passa e Fica", "Passagem", "Patu", "Pau dos Ferros", "Pedra Grande", "Pedra Preta", "Pedro Avelino", "Pedro Velho", "Pendências", "Pilões", "Poço Branco", "Portalegre", "Porto do Mangue", "Presidente Juscelino", "Pureza", "Rafael Fernandes", "Rafael Godeiro", "Riacho da Cruz", "Riacho de Santana", "Riachuelo", "Rio do Fogo", "Rodolfo Fernandes", "Ruy Barbosa", "Santa Cruz", "Santa Maria", "Santana do Matos", "Santana do Seridó", "Santo Antônio", "São Bento do Norte", "São Bento do Trairí", "São Fernando", "São Francisco do Oeste", "São Gonçalo do Amarante", "São João do Sabugi", "São José de Mipibu", "São José do Campestre", "São José do Seridó", "São Miguel", "São Miguel de Touros", "São Paulo do Potengi", "São Pedro", "São Rafael", "São Tomé", "São Vicente", "Senador Elói de Souza", "Senador Georgino Avelino", "Serra de São Bento", "Serra do Mel", "Serra Negra do Norte", "Serrinha", "Serrinha dos Pintos", "Severiano Melo", "Sítio Novo", "Taboleiro Grande", "Taipu", "Tangará", "Tenente Ananias", "Tenente Laurentino Cruz", "Tibau", "Tibau do Sul", "Timbaúba dos Batistas", "Touros", "Triunfo Potiguar", "Umarizal", "Upanema", "Várzea", "Venha-Ver", "Vera Cruz", "Viçosa", "Vila Flor"] }, { "sigla": "RO", "nome": "Rondônia", "cidades": ["Alta Floresta d'Oeste", "Alto Alegre do Parecis", "Alto Paraíso", "Alvorada d'Oeste", "Ariquemes", "Buritis", "Cabixi", "Cacaulândia", "Cacoal", "Campo Novo de Rondônia", "Candeias do Jamari", "Castanheiras", "Cerejeiras", "Chupinguaia", "Colorado do Oeste", "Corumbiara", "Costa Marques", "Cujubim", "Espigão d'Oeste", "Governador Jorge Teixeira", "Guajará-Mirim", "Itapuã do Oeste", "Jaru", "Ji-Paraná", "Machadinho d'Oeste", "Ministro Andreazza", "Mirante da Serra", "Monte Negro", "Nova Brasilândia d'Oeste", "Nova Mamoré", "Nova União", "Novo Horizonte do Oeste", "Ouro Preto do Oeste", "Parecis", "Pimenta Bueno", "Pimenteiras do Oeste", "Porto Velho", "Presidente Médici", "Primavera de Rondônia", "Rio Crespo", "Rolim de Moura", "Santa Luzia d'Oeste", "São Felipe d'Oeste", "São Francisco do Guaporé", "São Miguel do Guaporé", "Seringueiras", "Teixeirópolis", "Theobroma", "Urupá", "Vale do Anari", "Vale do Paraíso", "Vilhena"] }, { "sigla": "RR", "nome": "Roraima", "cidades": ["Alto Alegre", "Amajari", "Boa Vista", "Bonfim", "Cantá", "Caracaraí", "Caroebe", "Iracema", "Mucajaí", "Normandia", "Pacaraima", "Rorainópolis", "São João da Baliza", "São Luiz", "Uiramutã"] }, { "sigla": "RS", "nome": "Rio Grande do Sul", "cidades": ["Aceguá", "Água Santa", "Agudo", "Ajuricaba", "Alecrim", "Alegrete", "Alegria", "Almirante Tamandaré do Sul", "Alpestre", "Alto Alegre", "Alto Feliz", "Alvorada", "Amaral Ferrador", "Ametista do Sul", "André da Rocha", "Anta Gorda", "Antônio Prado", "Arambaré", "Araricá", "Aratiba", "Arroio do Meio", "Arroio do Padre", "Arroio do Sal", "Arroio do Tigre", "Arroio dos Ratos", "Arroio Grande", "Arvorezinha", "Augusto Pestana", "Áurea", "Bagé", "Balneário Pinhal", "Barão", "Barão de Cotegipe", "Barão do Triunfo", "Barra do Guarita", "Barra do Quaraí", "Barra do Ribeiro", "Barra do Rio Azul", "Barra Funda", "Barracão", "Barros Cassal", "Benjamin Constan do Sul", "Bento Gonçalves", "Boa Vista das Missões", "Boa Vista do Buricá", "Boa Vista do Cadeado", "Boa Vista do Incra", "Boa Vista do Sul", "Bom Jesus", "Bom Princípio", "Bom Progresso", "Bom Retiro do Sul", "Boqueirão do Leão", "Bossoroca", "Bozano", "Braga", "Brochier", "Butiá", "Caçapava do Sul", "Cacequi", "Cachoeira do Sul", "Cachoeirinha", "Cacique Doble", "Caibaté", "Caiçara", "Camaquã", "Camargo", "Cambará do Sul", "Campestre da Serra", "Campina das Missões", "Campinas do Sul", "Campo Bom", "Campo Novo", "Campos Borges", "Candelária", "Cândido Godói", "Candiota", "Canela", "Canguçu", "Canoas", "Canudos do Vale", "Capão Bonito do Sul", "Capão da Canoa", "Capão do Cipó", "Capão do Leão", "Capela de Santana", "Capitão", "Capivari do Sul", "Caraá", "Carazinho", "Carlos Barbosa", "Carlos Gomes", "Casca", "Caseiros", "Catuípe", "Caxias do Sul", "Centenário", "Cerrito", "Cerro Branco", "Cerro Grande", "Cerro Grande do Sul", "Cerro Largo", "Chapada", "Charqueadas", "Charrua", "Chiapeta", "Chuí", "Chuvisca", "Cidreira", "Ciríaco", "Colinas", "Colorado", "Condor", "Constantina", "Coqueiro Baixo", "Coqueiros do Sul", "Coronel Barros", "Coronel Bicaco", "Coronel Pilar", "Cotiporã", "Coxilha", "Crissiumal", "Cristal", "Cristal do Sul", "Cruz Alta", "Cruzaltense", "Cruzeiro do Sul", "David Canabarro", "Derrubadas", "Dezesseis de Novembro", "Dilermando de Aguiar", "Dois Irmãos", "Dois Irmãos das Missões", "Dois Lajeados", "Dom Feliciano", "Dom Pedrito", "Dom Pedro de Alcântara", "Dona Francisca", "Doutor Maurício Cardoso", "Doutor Ricardo", "Eldorado do Sul", "Encantado", "Encruzilhada do Sul", "Engenho Velho", "Entre Rios do Sul", "Entre-Ijuís", "Erebango", "Erechim", "Ernestina", "Erval Grande", "Erval Seco", "Esmeralda", "Esperança do Sul", "Espumoso", "Estação", "Estância Velha", "Esteio", "Estrela", "Estrela Velha", "Eugênio de Castro", "Fagundes Varela", "Farroupilha", "Faxinal do Soturno", "Faxinalzinho", "Fazenda Vilanova", "Feliz", "Flores da Cunha", "Floriano Peixoto", "Fontoura Xavier", "Formigueiro", "Forquetinha", "Fortaleza dos Valos", "Frederico Westphalen", "Garibaldi", "Garruchos", "Gaurama", "General Câmara", "Gentil", "Getúlio Vargas", "Giruá", "Glorinha", "Gramado", "Gramado dos Loureiros", "Gramado Xavier", "Gravataí", "Guabiju", "Guaíba", "Guaporé", "Guarani das Missões", "Harmonia", "Herval", "Herveiras", "Horizontina", "Hulha Negra", "Humaitá", "Ibarama", "Ibiaçá", "Ibiraiaras", "Ibirapuitã", "Ibirubá", "Igrejinha", "Ijuí", "Ilópolis", "Imbé", "Imigrante", "Independência", "Inhacorá", "Ipê", "Ipiranga do Sul", "Iraí", "Itaara", "Itacurubi", "Itapuca", "Itaqui", "Itati", "Itatiba do Sul", "Ivorá", "Ivoti", "Jaboticaba", "Jacuizinho", "Jacutinga", "Jaguarão", "Jaguari", "Jaquirana", "Jari", "Jóia", "Júlio de Castilhos", "Lagoa Bonita do Sul", "Lagoa dos Três Cantos", "Lagoa Vermelha", "Lagoão", "Lajeado", "Lajeado do Bugre", "Lavras do Sul", "Liberato Salzano", "Lindolfo Collor", "Linha Nova", "Maçambara", "Machadinho", "Mampituba", "Manoel Viana", "Maquiné", "Maratá", "Marau", "Marcelino Ramos", "Mariana Pimentel", "Mariano Moro", "Marques de Souza", "Mata", "Mato Castelhano", "Mato Leitão", "Mato Queimado", "Maximiliano de Almeida", "Minas do Leão", "Miraguaí", "Montauri", "Monte Alegre dos Campos", "Monte Belo do Sul", "Montenegro", "Mormaço", "Morrinhos do Sul", "Morro Redondo", "Morro Reuter", "Mostardas", "Muçum", "Muitos Capões", "Muliterno", "Não-Me-Toque", "Nicolau Vergueiro", "Nonoai", "Nova Alvorada", "Nova Araçá", "Nova Bassano", "Nova Boa Vista", "Nova Bréscia", "Nova Candelária", "Nova Esperança do Sul", "Nova Hartz", "Nova Pádua", "Nova Palma", "Nova Petrópolis", "Nova Prata", "Nova Ramada", "Nova Roma do Sul", "Nova Santa Rita", "Novo Barreiro", "Novo Cabrais", "Novo Hamburgo", "Novo Machado", "Novo Tiradentes", "Novo Xingu", "Osório", "Paim Filho", "Palmares do Sul", "Palmeira das Missões", "Palmitinho", "Panambi", "Pântano Grande", "Paraí", "Paraíso do Sul", "Pareci Novo", "Parobé", "Passa Sete", "Passo do Sobrado", "Passo Fundo", "Paulo Bento", "Paverama", "Pedras Altas", "Pedro Osório", "Pejuçara", "Pelotas", "Picada Café", "Pinhal", "Pinhal da Serra", "Pinhal Grande", "Pinheirinho do Vale", "Pinheiro Machado", "Pirapó", "Piratini", "Planalto", "Poço das Antas", "Pontão", "Ponte Preta", "Portão", "Porto Alegre", "Porto Lucena", "Porto Mauá", "Porto Vera Cruz", "Porto Xavier", "Pouso Novo", "Presidente Lucena", "Progresso", "Protásio Alves", "Putinga", "Quaraí", "Quatro Irmãos", "Quevedos", "Quinze de Novembro", "Redentora", "Relvado", "Restinga Seca", "Rio dos Índios", "Rio Grande", "Rio Pardo", "Riozinho", "Roca Sales", "Rodeio Bonito", "Rolador", "Rolante", "Ronda Alta", "Rondinha", "Roque Gonzales", "Rosário do Sul", "Sagrada Família", "Saldanha Marinho", "Salto do Jacuí", "Salvador das Missões", "Salvador do Sul", "Sananduva", "Santa Bárbara do Sul", "Santa Cecília do Sul", "Santa Clara do Sul", "Santa Cruz do Sul", "Santa Margarida do Sul", "Santa Maria", "Santa Maria do Herval", "Santa Rosa", "Santa Tereza", "Santa Vitória do Palmar", "Santana da Boa Vista", "Santana do Livramento", "Santiago", "Santo Ângelo", "Santo Antônio da Patrulha", "Santo Antônio das Missões", "Santo Antônio do Palma", "Santo Antônio do Planalto", "Santo Augusto", "Santo Cristo", "Santo Expedito do Sul", "São Borja", "São Domingos do Sul", "São Francisco de Assis", "São Francisco de Paula", "São Gabriel", "São Jerônimo", "São João da Urtiga", "São João do Polêsine", "São Jorge", "São José das Missões", "São José do Herval", "São José do Hortêncio", "São José do Inhacorá", "São José do Norte", "São José do Ouro", "São José do Sul", "São José dos Ausentes", "São Leopoldo", "São Lourenço do Sul", "São Luiz Gonzaga", "São Marcos", "São Martinho", "São Martinho da Serra", "São Miguel das Missões", "São Nicolau", "São Paulo das Missões", "São Pedro da Serra", "São Pedro das Missões", "São Pedro do Butiá", "São Pedro do Sul", "São Sebastião do Caí", "São Sepé", "São Valentim", "São Valentim do Sul", "São Valério do Sul", "São Vendelino", "São Vicente do Sul", "Sapiranga", "Sapucaia do Sul", "Sarandi", "Seberi", "Sede Nova", "Segredo", "Selbach", "Senador Salgado Filho", "Sentinela do Sul", "Serafina Corrêa", "Sério", "Sertão", "Sertão Santana", "Sete de Setembro", "Severiano de Almeida", "Silveira Martins", "Sinimbu", "Sobradinho", "Soledade", "Tabaí", "Tapejara", "Tapera", "Tapes", "Taquara", "Taquari", "Taquaruçu do Sul", "Tavares", "Tenente Portela", "Terra de Areia", "Teutônia", "Tio Hugo", "Tiradentes do Sul", "Toropi", "Torres", "Tramandaí", "Travesseiro", "Três Arroios", "Três Cachoeiras", "Três Coroas", "Três de Maio", "Três Forquilhas", "Três Palmeiras", "Três Passos", "Trindade do Sul", "Triunfo", "Tucunduva", "Tunas", "Tupanci do Sul", "Tupanciretã", "Tupandi", "Tuparendi", "Turuçu", "Ubiretama", "União da Serra", "Unistalda", "Uruguaiana", "Vacaria", "Vale do Sol", "Vale Real", "Vale Verde", "Vanini", "Venâncio Aires", "Vera Cruz", "Veranópolis", "Vespasiano Correa", "Viadutos", "Viamão", "Vicente Dutra", "Victor Graeff", "Vila Flores", "Vila Lângaro", "Vila Maria", "Vila Nova do Sul", "Vista Alegre", "Vista Alegre do Prata", "Vista Gaúcha", "Vitória das Missões", "Westfália", "Xangri-lá"] }, { "sigla": "SC", "nome": "Santa Catarina", "cidades": ["Abdon Batista", "Abelardo Luz", "Agrolândia", "Agronômica", "Água Doce", "Águas de Chapecó", "Águas Frias", "Águas Mornas", "Alfredo Wagner", "Alto Bela Vista", "Anchieta", "Angelina", "Anita Garibaldi", "Anitápolis", "Antônio Carlos", "Apiúna", "Arabutã", "Araquari", "Araranguá", "Armazém", "Arroio Trinta", "Arvoredo", "Ascurra", "Atalanta", "Aurora", "Balneário Arroio do Silva", "Balneário Barra do Sul", "Balneário Camboriú", "Balneário Gaivota", "Bandeirante", "Barra Bonita", "Barra Velha", "Bela Vista do Toldo", "Belmonte", "Benedito Novo", "Biguaçu", "Blumenau", "Bocaina do Sul", "Bom Jardim da Serra", "Bom Jesus", "Bom Jesus do Oeste", "Bom Retiro", "Bombinhas", "Botuverá", "Braço do Norte", "Braço do Trombudo", "Brunópolis", "Brusque", "Caçador", "Caibi", "Calmon", "Camboriú", "Campo Alegre", "Campo Belo do Sul", "Campo Erê", "Campos Novos", "Canelinha", "Canoinhas", "Capão Alto", "Capinzal", "Capivari de Baixo", "Catanduvas", "Caxambu do Sul", "Celso Ramos", "Cerro Negro", "Chapadão do Lageado", "Chapecó", "Cocal do Sul", "Concórdia", "Cordilheira Alta", "Coronel Freitas", "Coronel Martins", "Correia Pinto", "Corupá", "Criciúma", "Cunha Porã", "Cunhataí", "Curitibanos", "Descanso", "Dionísio Cerqueira", "Dona Emma", "Doutor Pedrinho", "Entre Rios", "Ermo", "Erval Velho", "Faxinal dos Guedes", "Flor do Sertão", "Florianópolis", "Formosa do Sul", "Forquilhinha", "Fraiburgo", "Frei Rogério", "Galvão", "Garopaba", "Garuva", "Gaspar", "Governador Celso Ramos", "Grão Pará", "Gravatal", "Guabiruba", "Guaraciaba", "Guaramirim", "Guarujá do Sul", "Guatambú", "Herval d'Oeste", "Ibiam", "Ibicaré", "Ibirama", "Içara", "Ilhota", "Imaruí", "Imbituba", "Imbuia", "Indaial", "Iomerê", "Ipira", "Iporã do Oeste", "Ipuaçu", "Ipumirim", "Iraceminha", "Irani", "Irati", "Irineópolis", "Itá", "Itaiópolis", "Itajaí", "Itapema", "Itapiranga", "Itapoá", "Ituporanga", "Jaborá", "Jacinto Machado", "Jaguaruna", "Jaraguá do Sul", "Jardinópolis", "Joaçaba", "Joinville", "José Boiteux", "Jupiá", "Lacerdópolis", "Lages", "Laguna", "Lajeado Grande", "Laurentino", "Lauro Muller", "Lebon Régis", "Leoberto Leal", "Lindóia do Sul", "Lontras", "Luiz Alves", "Luzerna", "Macieira", "Mafra", "Major Gercino", "Major Vieira", "Maracajá", "Maravilha", "Marema", "Massaranduba", "Matos Costa", "Meleiro", "Mirim Doce", "Modelo", "Mondaí", "Monte Carlo", "Monte Castelo", "Morro da Fumaça", "Morro Grande", "Navegantes", "Nova Erechim", "Nova Itaberaba", "Nova Trento", "Nova Veneza", "Novo Horizonte", "Orleans", "Otacílio Costa", "Ouro", "Ouro Verde", "Paial", "Painel", "Palhoça", "Palma Sola", "Palmeira", "Palmitos", "Papanduva", "Paraíso", "Passo de Torres", "Passos Maia", "Paulo Lopes", "Pedras Grandes", "Penha", "Peritiba", "Petrolândia", "Piçarras", "Pinhalzinho", "Pinheiro Preto", "Piratuba", "Planalto Alegre", "Pomerode", "Ponte Alta", "Ponte Alta do Norte", "Ponte Serrada", "Porto Belo", "Porto União", "Pouso Redondo", "Praia Grande", "Presidente Castelo Branco", "Presidente Getúlio", "Presidente Nereu", "Princesa", "Quilombo", "Rancho Queimado", "Rio das Antas", "Rio do Campo", "Rio do Oeste", "Rio do Sul", "Rio dos Cedros", "Rio Fortuna", "Rio Negrinho", "Rio Rufino", "Riqueza", "Rodeio", "Romelândia", "Salete", "Saltinho", "Salto Veloso", "Sangão", "Santa Cecília", "Santa Helena", "Santa Rosa de Lima", "Santa Rosa do Sul", "Santa Terezinha", "Santa Terezinha do Progresso", "Santiago do Sul", "Santo Amaro da Imperatriz", "São Bento do Sul", "São Bernardino", "São Bonifácio", "São Carlos", "São Cristovão do Sul", "São Domingos", "São Francisco do Sul", "São João Batista", "São João do Itaperiú", "São João do Oeste", "São João do Sul", "São Joaquim", "São José", "São José do Cedro", "São José do Cerrito", "São Lourenço do Oeste", "São Ludgero", "São Martinho", "São Miguel da Boa Vista", "São Miguel do Oeste", "São Pedro de Alcântara", "Saudades", "Schroeder", "Seara", "Serra Alta", "Siderópolis", "Sombrio", "Sul Brasil", "Taió", "Tangará", "Tigrinhos", "Tijucas", "Timbé do Sul", "Timbó", "Timbó Grande", "Três Barras", "Treviso", "Treze de Maio", "Treze Tílias", "Trombudo Central", "Tubarão", "Tunápolis", "Turvo", "União do Oeste", "Urubici", "Urupema", "Urussanga", "Vargeão", "Vargem", "Vargem Bonita", "Vidal Ramos", "Videira", "Vitor Meireles", "Witmarsum", "Xanxerê", "Xavantina", "Xaxim", "Zortéa"] }, { "sigla": "SE", "nome": "Sergipe", "cidades": ["Amparo de São Francisco", "Aquidabã", "Aracaju", "Arauá", "Areia Branca", "Barra dos Coqueiros", "Boquim", "Brejo Grande", "Campo do Brito", "Canhoba", "Canindé de São Francisco", "Capela", "Carira", "Carmópolis", "Cedro de São João", "Cristinápolis", "Cumbe", "Divina Pastora", "Estância", "Feira Nova", "Frei Paulo", "Gararu", "General Maynard", "Gracho Cardoso", "Ilha das Flores", "Indiaroba", "Itabaiana", "Itabaianinha", "Itabi", "Itaporanga d'Ajuda", "Japaratuba", "Japoatã", "Lagarto", "Laranjeiras", "Macambira", "Malhada dos Bois", "Malhador", "Maruim", "Moita Bonita", "Monte Alegre de Sergipe", "Muribeca", "Neópolis", "Nossa Senhora Aparecida", "Nossa Senhora da Glória", "Nossa Senhora das Dores", "Nossa Senhora de Lourdes", "Nossa Senhora do Socorro", "Pacatuba", "Pedra Mole", "Pedrinhas", "Pinhão", "Pirambu", "Poço Redondo", "Poço Verde", "Porto da Folha", "Propriá", "Riachão do Dantas", "Riachuelo", "Ribeirópolis", "Rosário do Catete", "Salgado", "Santa Luzia do Itanhy", "Santa Rosa de Lima", "Santana do São Francisco", "Santo Amaro das Brotas", "São Cristóvão", "São Domingos", "São Francisco", "São Miguel do Aleixo", "Simão Dias", "Siriri", "Telha", "Tobias Barreto", "Tomar do Geru", "Umbaúba"] }, { "sigla": "SP", "nome": "São Paulo", "cidades": ["Adamantina", "Adolfo", "Aguaí", "Águas da Prata", "Águas de Lindóia", "Águas de Santa Bárbara", "Águas de São Pedro", "Agudos", "Alambari", "Alfredo Marcondes", "Altair", "Altinópolis", "Alto Alegre", "Alumínio", "Álvares Florence", "Álvares Machado", "Álvaro de Carvalho", "Alvinlândia", "Americana", "Américo Brasiliense", "Américo de Campos", "Amparo", "Analândia", "Andradina", "Angatuba", "Anhembi", "Anhumas", "Aparecida", "Aparecida d'Oeste", "Apiaí", "Araçariguama", "Araçatuba", "Araçoiaba da Serra", "Aramina", "Arandu", "Arapeí", "Araraquara", "Araras", "Arco-Íris", "Arealva", "Areias", "Areiópolis", "Ariranha", "Artur Nogueira", "Arujá", "Aspásia", "Assis", "Atibaia", "Auriflama", "Avaí", "Avanhandava", "Avaré", "Bady Bassitt", "Balbinos", "Bálsamo", "Bananal", "Barão de Antonina", "Barbosa", "Bariri", "Barra Bonita", "Barra do Chapéu", "Barra do Turvo", "Barretos", "Barrinha", "Barueri", "Bastos", "Batatais", "Bauru", "Bebedouro", "Bento de Abreu", "Bernardino de Campos", "Bertioga", "Bilac", "Birigui", "Biritiba-Mirim", "Boa Esperança do Sul", "Bocaina", "Bofete", "Boituva", "Bom Jesus dos Perdões", "Bom Sucesso de Itararé", "Borá", "Boracéia", "Borborema", "Borebi", "Botucatu", "Bragança Paulista", "Braúna", "Brejo Alegre", "Brodowski", "Brotas", "Buri", "Buritama", "Buritizal", "Cabrália Paulista", "Cabreúva", "Caçapava", "Cachoeira Paulista", "Caconde", "Cafelândia", "Caiabu", "Caieiras", "Caiuá", "Cajamar", "Cajati", "Cajobi", "Cajuru", "Campina do Monte Alegre", "Campinas", "Campo Limpo Paulista", "Campos do Jordão", "Campos Novos Paulista", "Cananéia", "Canas", "Cândido Mota", "Cândido Rodrigues", "Canitar", "Capão Bonito", "Capela do Alto", "Capivari", "Caraguatatuba", "Carapicuíba", "Cardoso", "Casa Branca", "Cássia dos Coqueiros", "Castilho", "Catanduva", "Catiguá", "Cedral", "Cerqueira César", "Cerquilho", "Cesário Lange", "Charqueada", "Chavantes", "Clementina", "Colina", "Colômbia", "Conchal", "Conchas", "Cordeirópolis", "Coroados", "Coronel Macedo", "Corumbataí", "Cosmópolis", "Cosmorama", "Cotia", "Cravinhos", "Cristais Paulista", "Cruzália", "Cruzeiro", "Cubatão", "Cunha", "Descalvado", "Diadema", "Dirce Reis", "Divinolândia", "Dobrada", "Dois Córregos", "Dolcinópolis", "Dourado", "Dracena", "Duartina", "Dumont", "Echaporã", "Eldorado", "Elias Fausto", "Elisiário", "Embaúba", "Embu", "Embu-Guaçu", "Emilianópolis", "Engenheiro Coelho", "Espírito Santo do Pinhal", "Espírito Santo do Turvo", "Estiva Gerbi", "Estrela d'Oeste", "Estrela do Norte", "Euclides da Cunha Paulista", "Fartura", "Fernando Prestes", "Fernandópolis", "Fernão", "Ferraz de Vasconcelos", "Flora Rica", "Floreal", "Florínia", "Flórida Paulista", "Franca", "Francisco Morato", "Franco da Rocha", "Gabriel Monteiro", "Gália", "Garça", "Gastão Vidigal", "Gavião Peixoto", "General Salgado", "Getulina", "Glicério", "Guaiçara", "Guaimbê", "Guaíra", "Guapiaçu", "Guapiara", "Guará", "Guaraçaí", "Guaraci", "Guarani d'Oeste", "Guarantã", "Guararapes", "Guararema", "Guaratinguetá", "Guareí", "Guariba", "Guarujá", "Guarulhos", "Guatapará", "Guzolândia", "Herculândia", "Holambra", "Hortolândia", "Iacanga", "Iacri", "Iaras", "Ibaté", "Ibirá", "Ibirarema", "Ibitinga", "Ibiúna", "Icém", "Iepê", "Igaraçu do Tietê", "Igarapava", "Igaratá", "Iguape", "Ilha Comprida", "Ilha Solteira", "Ilhabela", "Indaiatuba", "Indiana", "Indiaporã", "Inúbia Paulista", "Ipauçu", "Iperó", "Ipeúna", "Ipiguá", "Iporanga", "Ipuã", "Iracemápolis", "Irapuã", "Irapuru", "Itaberá", "Itaí", "Itajobi", "Itaju", "Itanhaém", "Itaóca", "Itapecerica da Serra", "Itapetininga", "Itapeva", "Itapevi", "Itapira", "Itapirapuã Paulista", "Itápolis", "Itaporanga", "Itapuí", "Itapura", "Itaquaquecetuba", "Itararé", "Itariri", "Itatiba", "Itatinga", "Itirapina", "Itirapuã", "Itobi", "Itu", "Itupeva", "Ituverava", "Jaborandi", "Jaboticabal", "Jacareí", "Jaci", "Jacupiranga", "Jaguariúna", "Jales", "Jambeiro", "Jandira", "Jardinópolis", "Jarinu", "Jaú", "Jeriquara", "Joanópolis", "João Ramalho", "José Bonifácio", "Júlio Mesquita", "Jumirim", "Jundiaí", "Junqueirópolis", "Juquiá", "Juquitiba", "Lagoinha", "Laranjal Paulista", "Lavínia", "Lavrinhas", "Leme", "Lençóis Paulista", "Limeira", "Lindóia", "Lins", "Lorena", "Lourdes", "Louveira", "Lucélia", "Lucianópolis", "Luís Antônio", "Luiziânia", "Lupércio", "Lutécia", "Macatuba", "Macaubal", "Macedônia", "Magda", "Mairinque", "Mairiporã", "Manduri", "Marabá Paulista", "Maracaí", "Marapoama", "Mariápolis", "Marília", "Marinópolis", "Martinópolis", "Matão", "Mauá", "Mendonça", "Meridiano", "Mesópolis", "Miguelópolis", "Mineiros do Tietê", "Mira Estrela", "Miracatu", "Mirandópolis", "Mirante do Paranapanema", "Mirassol", "Mirassolândia", "Mococa", "Mogi das Cruzes", "Mogi-Guaçu", "Mogi-Mirim", "Mombuca", "Monções", "Mongaguá", "Monte Alegre do Sul", "Monte Alto", "Monte Aprazível", "Monte Azul Paulista", "Monte Castelo", "Monte Mor", "Monteiro Lobato", "Morro Agudo", "Morungaba", "Motuca", "Murutinga do Sul", "Nantes", "Narandiba", "Natividade da Serra", "Nazaré Paulista", "Neves Paulista", "Nhandeara", "Nipoã", "Nova Aliança", "Nova Campina", "Nova Canaã Paulista", "Nova Castilho", "Nova Europa", "Nova Granada", "Nova Guataporanga", "Nova Independência", "Nova Luzitânia", "Nova Odessa", "Novais", "Novo Horizonte", "Nuporanga", "Ocauçu", "Óleo", "Olímpia", "Onda Verde", "Oriente", "Orindiúva", "Orlândia", "Osasco", "Oscar Bressane", "Osvaldo Cruz", "Ourinhos", "Ouro Verde", "Ouroeste", "Pacaembu", "Palestina", "Palmares Paulista", "Palmeira d'Oeste", "Palmital", "Panorama", "Paraguaçu Paulista", "Paraibuna", "Paraíso", "Paranapanema", "Paranapuã", "Parapuã", "Pardinho", "Pariquera-Açu", "Parisi", "Patrocínio Paulista", "Paulicéia", "Paulínia", "Paulistânia", "Paulo de Faria", "Pederneiras", "Pedra Bela", "Pedranópolis", "Pedregulho", "Pedreira", "Pedrinhas Paulista", "Pedro de Toledo", "Penápolis", "Pereira Barreto", "Pereiras", "Peruíbe", "Piacatu", "Piedade", "Pilar do Sul", "Pindamonhangaba", "Pindorama", "Pinhalzinho", "Piquerobi", "Piquete", "Piracaia", "Piracicaba", "Piraju", "Pirajuí", "Pirangi", "Pirapora do Bom Jesus", "Pirapozinho", "Pirassununga", "Piratininga", "Pitangueiras", "Planalto", "Platina", "Poá", "Poloni", "Pompéia", "Pongaí", "Pontal", "Pontalinda", "Pontes Gestal", "Populina", "Porangaba", "Porto Feliz", "Porto Ferreira", "Potim", "Potirendaba", "Pracinha", "Pradópolis", "Praia Grande", "Pratânia", "Presidente Alves", "Presidente Bernardes", "Presidente Epitácio", "Presidente Prudente", "Presidente Venceslau", "Promissão", "Quadra", "Quatá", "Queiroz", "Queluz", "Quintana", "Rafard", "Rancharia", "Redenção da Serra", "Regente Feijó", "Reginópolis", "Registro", "Restinga", "Ribeira", "Ribeirão Bonito", "Ribeirão Branco", "Ribeirão Corrente", "Ribeirão do Sul", "Ribeirão dos Índios", "Ribeirão Grande", "Ribeirão Pires", "Ribeirão Preto", "Rifaina", "Rincão", "Rinópolis", "Rio Claro", "Rio das Pedras", "Rio Grande da Serra", "Riolândia", "Riversul", "Rosana", "Roseira", "Rubiácea", "Rubinéia", "Sabino", "Sagres", "Sales", "Sales Oliveira", "Salesópolis", "Salmourão", "Saltinho", "Salto", "Salto de Pirapora", "Salto Grande", "Sandovalina", "Santa Adélia", "Santa Albertina", "Santa Bárbara d'Oeste", "Santa Branca", "Santa Clara d'Oeste", "Santa Cruz da Conceição", "Santa Cruz da Esperança", "Santa Cruz das Palmeiras", "Santa Cruz do Rio Pardo", "Santa Ernestina", "Santa Fé do Sul", "Santa Gertrudes", "Santa Isabel", "Santa Lúcia", "Santa Maria da Serra", "Santa Mercedes", "Santa Rita d'Oeste", "Santa Rita do Passa Quatro", "Santa Rosa de Viterbo", "Santa Salete", "Santana da Ponte Pensa", "Santana de Parnaíba", "Santo Anastácio", "Santo André", "Santo Antônio da Alegria", "Santo Antônio de Posse", "Santo Antônio do Aracanguá", "Santo Antônio do Jardim", "Santo Antônio do Pinhal", "Santo Expedito", "Santópolis do Aguapeí", "Santos", "São Bento do Sapucaí", "São Bernardo do Campo", "São Caetano do Sul", "São Carlos", "São Francisco", "São João da Boa Vista", "São João das Duas Pontes", "São João de Iracema", "São João do Pau d'Alho", "São Joaquim da Barra", "São José da Bela Vista", "São José do Barreiro", "São José do Rio Pardo", "São José do Rio Preto", "São José dos Campos", "São Lourenço da Serra", "São Luís do Paraitinga", "São Manuel", "São Miguel Arcanjo", "São Paulo", "São Pedro", "São Pedro do Turvo", "São Roque", "São Sebastião", "São Sebastião da Grama", "São Simão", "São Vicente", "Sarapuí", "Sarutaiá", "Sebastianópolis do Sul", "Serra Azul", "Serra Negra", "Serrana", "Sertãozinho", "Sete Barras", "Severínia", "Silveiras", "Socorro", "Sorocaba", "Sud Mennucci", "Sumaré", "Suzanápolis", "Suzano", "Tabapuã", "Tabatinga", "Taboão da Serra", "Taciba", "Taguaí", "Taiaçu", "Taiúva", "Tambaú", "Tanabi", "Tapiraí", "Tapiratiba", "Taquaral", "Taquaritinga", "Taquarituba", "Taquarivaí", "Tarabai", "Tarumã", "Tatuí", "Taubaté", "Tejupá", "Teodoro Sampaio", "Terra Roxa", "Tietê", "Timburi", "Torre de Pedra", "Torrinha", "Trabiju", "Tremembé", "Três Fronteiras", "Tuiuti", "Tupã", "Tupi Paulista", "Turiúba", "Turmalina", "Ubarana", "Ubatuba", "Ubirajara", "Uchoa", "União Paulista", "Urânia", "Uru", "Urupês", "Valentim Gentil", "Valinhos", "Valparaíso", "Vargem", "Vargem Grande do Sul", "Vargem Grande Paulista", "Várzea Paulista", "Vera Cruz", "Vinhedo", "Viradouro", "Vista Alegre do Alto", "Vitória Brasil", "Votorantim", "Votuporanga", "Zacarias"] }, { "sigla": "TO", "nome": "Tocantins", "cidades": ["Abreulândia", "Aguiarnópolis", "Aliança do Tocantins", "Almas", "Alvorada", "Ananás", "Angico", "Aparecida do Rio Negro", "Aragominas", "Araguacema", "Araguaçu", "Araguaína", "Araguanã", "Araguatins", "Arapoema", "Arraias", "Augustinópolis", "Aurora do Tocantins", "Axixá do Tocantins", "Babaçulândia", "Bandeirantes do Tocantins", "Barra do Ouro", "Barrolândia", "Bernardo Sayão", "Bom Jesus do Tocantins", "Brasilândia do Tocantins", "Brejinho de Nazaré", "Buriti do Tocantins", "Cachoeirinha", "Campos Lindos", "Cariri do Tocantins", "Carmolândia", "Carrasco Bonito", "Caseara", "Centenário", "Chapada da Natividade", "Chapada de Areia", "Colinas do Tocantins", "Colméia", "Combinado", "Conceição do Tocantins", "Couto Magalhães", "Cristalândia", "Crixás do Tocantins", "Darcinópolis", "Dianópolis", "Divinópolis do Tocantins", "Dois Irmãos do Tocantins", "Dueré", "Esperantina", "Fátima", "Figueirópolis", "Filadélfia", "Formoso do Araguaia", "Fortaleza do Tabocão", "Goianorte", "Goiatins", "Guaraí", "Gurupi", "Ipueiras", "Itacajá", "Itaguatins", "Itapiratins", "Itaporã do Tocantins", "Jaú do Tocantins", "Juarina", "Lagoa da Confusão", "Lagoa do Tocantins", "Lajeado", "Lavandeira", "Lizarda", "Luzinópolis", "Marianópolis do Tocantins", "Mateiros", "Maurilândia do Tocantins", "Miracema do Tocantins", "Miranorte", "Monte do Carmo", "Monte Santo do Tocantins", "Muricilândia", "Natividade", "Nazaré", "Nova Olinda", "Nova Rosalândia", "Novo Acordo", "Novo Alegre", "Novo Jardim", "Oliveira de Fátima", "Palmas", "Palmeirante", "Palmeiras do Tocantins", "Palmeirópolis", "Paraíso do Tocantins", "Paranã", "Pau d'Arco", "Pedro Afonso", "Peixe", "Pequizeiro", "Pindorama do Tocantins", "Piraquê", "Pium", "Ponte Alta do Bom Jesus", "Ponte Alta do Tocantins", "Porto Alegre do Tocantins", "Porto Nacional", "Praia Norte", "Presidente Kennedy", "Pugmil", "Recursolândia", "Riachinho", "Rio da Conceição", "Rio dos Bois", "Rio Sono", "Sampaio", "Sandolândia", "Santa Fé do Araguaia", "Santa Maria do Tocantins", "Santa Rita do Tocantins", "Santa Rosa do Tocantins", "Santa Tereza do Tocantins", "Santa Terezinha do Tocantins", "São Bento do Tocantins", "São Félix do Tocantins", "São Miguel do Tocantins", "São Salvador do Tocantins", "São Sebastião do Tocantins", "São Valério", "Silvanópolis", "Sítio Novo do Tocantins", "Sucupira", "Taguatinga", "Taipas do Tocantins", "Talismã", "Tocantínia", "Tocantinópolis", "Tupirama", "Tupiratins", "Wanderlândia", "Xambioá"] }] }
export { estados_cidades }

type LeadResumo = {
  id: string
  cnpj: string
  razaoSocial: string
  nomeCondominio: string
  nomeSindico?: string | null
  telefoneSindico?: string | null
  endereco: string
  bairro?: string
  cidade?: string
  estado?: string
  categoria: "ativo" | "agendado" | "explorado"
  administradora: {
    id?: string
    nome: string
  }
  responsavel: string
  vendedor?: string
  diasComVendedor?: number | null
  isContratoVigente: boolean
}

type CategoriaResumo = {
  explorado: number
  ativo: number
  agendado: number
}

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0

type CategoriaFiltro = "explorado" | "ativo" | "agendado"

type FetchFilters = {
  search?: string
  estado?: string
  cidade?: string
  bairro?: string
  telefone?: string
  categoria?: CategoriaFiltro
  temPedido?: string
  vendedorId?: string
  semVendedor?: string
  limit?: number
  contratoVigente?: string
  historyMode?: "com" | "sem"
  historyValue?: string
  historyUnit?: "h" | "d" | "m"
  orcamentoMode?: "com" | "sem"
  orcamentoMonths?: string
  orcamentoDays?: string
  orcamentoUnit?: "d" | "m"
  orcamentoMinItems?: string
  pedidoMode?: "com" | "sem"
  pedidoMonths?: string
  pedidoDays?: string
  pedidoUnit?: "d" | "m"
  pedidoMinItems?: string
}

export function LeadsGeral() {
  const [clientes, setClientes] = useState<LeadResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [paginationInfo, setPaginationInfo] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    pageSize: 30,
    hasNextPage: false,
  })
  const [submittedGeneralSearch, setSubmittedGeneralSearch] = useState("")
  const [selectedEstado, setSelectedEstado] = useState("all")
  const [selectedCidade, setSelectedCidade] = useState("all")
  const [submittedEstado, setSubmittedEstado] = useState("all")
  const [submittedCidade, setSubmittedCidade] = useState("all")
  const [submittedBairro, setSubmittedBairro] = useState("")
  const [submittedTelefone, setSubmittedTelefone] = useState("")
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)
  const [showCadastro, setShowCadastro] = useState(false)
  const [orcamentoCliente, setOrcamentoCliente] = useState<{ id: string; nome: string } | null>(null)
  const [selectedCategoria, setSelectedCategoria] = useState<"all" | CategoriaFiltro>("all")
  const [submittedCategoria, setSubmittedCategoria] = useState<"all" | CategoriaFiltro>("all")
  const [categoriaResumo, setCategoriaResumo] = useState<CategoriaResumo>({
    explorado: 0,
    ativo: 0,
    agendado: 0,
  })
  const [exporting, setExporting] = useState(false)
  const [distributionType, setDistributionType] = useState<"none" | "state" | "vendor">("none")
  const [vendedores, setVendedores] = useState<{ id: string; name: string }[]>([])
  const [selectedVendedor, setSelectedVendedor] = useState("all")
  const [submittedVendedor, setSubmittedVendedor] = useState("all")
  const [submittedLimit, setSubmittedLimit] = useState<number | null>(null)


  // Filtros de Orçamento e Pedido
  const [filterOrcamentoMode, setFilterOrcamentoMode] = useState<'com' | 'sem' | null>(null)
  const [filterOrcamentoValue, setFilterOrcamentoValue] = useState(4)
  const [filterOrcamentoUnit, setFilterOrcamentoUnit] = useState<'d' | 'm'>('m')
  const [filterOrcamentoCustomInput, setFilterOrcamentoCustomInput] = useState("4")
  const [filterOrcamentoItemId, setFilterOrcamentoItemId] = useState<string>("")
  const [orcamentoContextMenu, setOrcamentoContextMenu] = useState<{ x: number; y: number } | null>(null)

  const [filterPedidoMode, setFilterPedidoMode] = useState<'com' | 'sem' | null>(null)
  const [filterPedidoValue, setFilterPedidoValue] = useState(4)
  const [filterPedidoUnit, setFilterPedidoUnit] = useState<'d' | 'm'>('m')
  const [filterPedidoCustomInput, setFilterPedidoCustomInput] = useState("4")
  const [filterPedidoItemId, setFilterPedidoItemId] = useState<string>("")
  const [pedidoContextMenu, setPedidoContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Catálogo de itens para filtros
  const [catalogItems, setCatalogItems] = useState<{ id: string; nome: string }[]>([])

  // Filtro de histórico com vendedor
  const [filterHistoryValue, setFilterHistoryValue] = useState(1)
  const [filterHistoryUnit, setFilterHistoryUnit] = useState<'h' | 'd' | 'm'>('m')
  const [filterHistoryMode, setFilterHistoryMode] = useState<'com' | 'sem' | null>(null)
  const [historyContextMenu, setHistoryContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [historyCustomInput, setHistoryCustomInput] = useState("1")

  // Vendor assignment states
  const [selectAll, setSelectAll] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [excludedIds, setExcludedIds] = useState<string[]>([])
  const [vendedorAtribuicao, setVendedorAtribuicao] = useState<string>("")
  const [vendedorAtribuicaoOpen, setVendedorAtribuicaoOpen] = useState(false)
  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const { toast } = useToast()

  const generalSearchRef = useRef<HTMLInputElement>(null)

  const bairroInputRef = useRef<HTMLInputElement>(null)
  const telefoneInputRef = useRef<HTMLInputElement>(null)
  const limiteInputRef = useRef<HTMLInputElement>(null)
  const latestRequestRef = useRef(0)
  const previousFiltersRef = useRef<FetchFilters | null>(null)
  const skipNextFetchRef = useRef(false)

  const openCriarOrcamento = (lead: LeadResumo) => {
    setOrcamentoCliente({
      id: lead.id,
      nome: lead.nomeCondominio || lead.razaoSocial,
    })
  }

  const activeFilters = useMemo<FetchFilters>(() => {
    const filters: FetchFilters = {}
    const normalizedSearch = submittedGeneralSearch.trim()

    if (normalizedSearch.length > 0) {
      filters.search = normalizedSearch
    }

    if (submittedEstado !== "all") {
      filters.estado = submittedEstado
    }

    if (submittedCidade !== "all") {
      filters.cidade = submittedCidade
    }

    const normalizedBairro = submittedBairro.trim()
    if (normalizedBairro.length > 0) {
      filters.bairro = normalizedBairro
    }

    const normalizedTelefone = submittedTelefone.replace(/\D/g, "")
    if (normalizedTelefone.length >= 3) {
      filters.telefone = normalizedTelefone
    }

    if (submittedCategoria !== "all") {
      filters.categoria = submittedCategoria
    }

    if (submittedVendedor === "sem") {
      filters.semVendedor = "true"
    } else if (submittedVendedor !== "all") {
      filters.vendedorId = submittedVendedor
    }

    if (submittedLimit && submittedLimit > 0) {
      filters.limit = submittedLimit
    }

    if (filterHistoryMode !== null) {
      filters.historyMode = filterHistoryMode
      filters.historyValue = filterHistoryValue.toString()
      filters.historyUnit = filterHistoryUnit
    }

    if (filterOrcamentoMode !== null) {
      filters.orcamentoMode = filterOrcamentoMode
      filters.orcamentoUnit = filterOrcamentoUnit
      if (filterOrcamentoUnit === 'd') {
        filters.orcamentoDays = filterOrcamentoValue.toString()
      } else {
        filters.orcamentoMonths = filterOrcamentoValue.toString()
      }
      if (filterOrcamentoMinItems !== null) {
        filters.orcamentoMinItems = filterOrcamentoMinItems.toString()
      }
    }

    if (filterPedidoMode !== null) {
      filters.pedidoMode = filterPedidoMode
      filters.pedidoUnit = filterPedidoUnit
      if (filterPedidoUnit === 'd') {
        filters.pedidoDays = filterPedidoValue.toString()
      } else {
        filters.pedidoMonths = filterPedidoValue.toString()
      }
      if (filterPedidoMinItems !== null) {
        filters.pedidoMinItems = filterPedidoMinItems.toString()
      }
    }

    return filters
  }, [
    submittedGeneralSearch,
    submittedBairro,
    submittedTelefone,
    submittedEstado,
    submittedCidade,
    submittedCategoria,
    submittedLimit,
    submittedVendedor,
    filterHistoryMode,
    filterHistoryValue,
    filterHistoryUnit,
    filterOrcamentoMode,
    filterOrcamentoValue,
    filterOrcamentoUnit,
    filterOrcamentoMinItems,
    filterPedidoMode,
    filterPedidoValue,
    filterPedidoUnit,
    filterPedidoMinItems,
  ])
  const hasActiveFilters = Object.keys(activeFilters).length > 0

  const estadoOptions = useMemo(
    () =>
      estados_cidades.estados
        .map((estado) => ({
          sigla: estado.sigla,
          nome: estado.nome,
          cidades: [...estado.cidades].sort((a, b) => a.localeCompare(b, "pt-BR")),
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    []
  )

  const selectedEstadoInfo =
    selectedEstado === "all"
      ? null
      : estadoOptions.find((estado) => estado.sigla === selectedEstado) ?? null

  const cidadeOptions = selectedEstadoInfo?.cidades ?? []

  // Função para buscar clientes da API
  const fetchClientes = useCallback(
    async (requestedPage: number, filters: FetchFilters) => {
      const requestId = latestRequestRef.current + 1
      latestRequestRef.current = requestId

      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        params.set("page", requestedPage.toString())
        Object.entries(filters).forEach(([key, value]) => {
          if (value) {
            params.set(key, String(value))
          }
        })

        const response = await fetch(`/api/clients?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Erro ao buscar clientes")
        }
        const payload = await response.json()

        if (requestId !== latestRequestRef.current) {
          return
        }

        const pagination = payload.pagination
        if (!pagination) {
          throw new Error("Resposta da API incompleta")
        }

        const rawClientes = (payload.data as RawClientSummary[]) ?? []

        const mappedClientes: LeadResumo[] = rawClientes.map((client) => {
          const formattedRazao = formatRazaoSocial(client.razaoSocial)
          const endereco = [client.logradouro, client.numero, client.complemento]
            .filter((part): part is string => Boolean(part && part.trim().length))
            .join(", ")

          const role = client.vendedor?.role ?? null
          const vendedorNome = client.vendedor?.name?.trim() || ""
          const responsavel =
            role === "CHATBOT"
              ? "Chatbot"
              : vendedorNome || "Não informado"

          const categoriaValue: LeadResumo["categoria"] =
            client.categoria === "ativo" || client.categoria === "agendado"
              ? client.categoria
              : "explorado"

          // Calculate days with vendor
          let diasComVendedor: number | null = null
          if (client.vendedorAlocadoEm) {
            const alocadoEm = new Date(client.vendedorAlocadoEm)
            const agora = new Date()
            const diffMs = agora.getTime() - alocadoEm.getTime()
            diasComVendedor = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          }

          const nomeDisplay = client.nomeSindico?.trim() || formattedRazao

          return {
            id: client.id.toString(),
            cnpj: client.cnpj,
            razaoSocial: formattedRazao,
            nomeCondominio: nomeDisplay,
            nomeSindico: client.nomeSindico ?? null,
            telefoneSindico: client.telefoneSindico ?? null,
            endereco,
            bairro: client.bairro ?? undefined,
            cidade: client.cidade ?? undefined,
            estado: client.estado ?? undefined,
            categoria: categoriaValue,
            administradora: {
              id: client.administradora?.id ?? undefined,
              nome:
                client.administradora?.nome ??
                client.administradoraStringAntigo ??
                "Não informado",
            },
            responsavel,
            vendedor: vendedorNome || undefined,
            diasComVendedor,
            isContratoVigente: client.isContratoVigente,
          }
        })

        const resumoPagina = mappedClientes.reduce<CategoriaResumo>(
          (acc, lead) => {
            acc[lead.categoria] += 1
            return acc
          },
          { explorado: 0, ativo: 0, agendado: 0 }
        )

        const resumoApi = (payload.summary ?? null) as Partial<CategoriaResumo> | null
        setCategoriaResumo(resumoApi ? { ...resumoPagina, ...resumoApi } : resumoPagina)

        setClientes(mappedClientes)
        setHasLoadedOnce(true)
        if (pagination.page && pagination.page !== requestedPage) {
          skipNextFetchRef.current = true
          setPage(pagination.page)
        }
        setPaginationInfo(pagination)
      } catch (err) {
        if (requestId !== latestRequestRef.current) {
          return
        }
        setError(err instanceof Error ? err.message : "Erro desconhecido")
        console.error("Erro ao buscar clientes:", err)
      } finally {
        if (requestId === latestRequestRef.current) {
          setLoading(false)
        }
      }
    },
    []
  )

  // Carregar catálogo de itens para filtros
  useEffect(() => {
    fetch("/api/items?limit=200&select=id,nome")
      .then(r => r.json())
      .then(data => {
        const items = (data.data ?? data ?? []) as { id: string | number; nome: string }[]
        setCatalogItems(items.map(i => ({ id: String(i.id), nome: i.nome })))
      })
      .catch(() => { })
  }, [])

  useEffect(() => {
    const filtersChanged = previousFiltersRef.current !== activeFilters
    previousFiltersRef.current = activeFilters

    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false
      return
    }

    if (filtersChanged && page !== 1) {
      setPage(1)
      return
    }

    fetchClientes(page, activeFilters).catch((err) => console.error(err))
  }, [activeFilters, fetchClientes, page])

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > paginationInfo.totalPages || newPage === page) return
    setPage(newPage)
  }

  const startItem =
    clientes.length > 0 ? (paginationInfo.page - 1) * paginationInfo.pageSize + 1 : 0
  const endItem = clientes.length > 0 ? startItem + clientes.length - 1 : 0

  const handleEstadoChange = useCallback((value: string) => {
    setSelectedEstado(value)
    setSelectedCidade("all")
    // Auto-submit: update submitted state immediately
    setSubmittedEstado(value)
    setSubmittedCidade("all")
  }, [])

  const handleCidadeChange = useCallback((value: string) => {
    setSelectedCidade(value)
    // Auto-submit
    setSubmittedCidade(value)
  }, [])

  const handleCategoriaChange = useCallback((value: "all" | CategoriaFiltro) => {
    setSelectedCategoria(value)
    // Auto-submit
    setSubmittedCategoria(value)
  }, [])

  const handleVendedorChange = useCallback((value: string) => {
    setSelectedVendedor(value)
    // Auto-submit
    setSubmittedVendedor(value)
  }, [])

  const handleApplyHistoryFilter = (mode: 'com' | 'sem' | null, value: number, unit: 'h' | 'd' | 'm') => {
    setFilterHistoryMode(mode)
    setFilterHistoryValue(value)
    setFilterHistoryUnit(unit)
    setHistoryContextMenu(null)
  }

  // Fetch vendedores on mount
  useEffect(() => {
    const fetchVendedores = async () => {
      try {
        const res = await fetch("/api/vendedores")
        if (!res.ok) return
        const data = await res.json()
        setVendedores(
          (data?.data ?? data?.users ?? []).map((u: { id: string; name: string }) => ({
            id: u.id,
            name: u.name,
          }))
        )
      } catch (err) {
        console.error("Erro ao buscar vendedores:", err)
      }
    }
    fetchVendedores()
  }, [])

  const handleSearchSubmit = useCallback(() => {
    const generalValue = generalSearchRef.current?.value ?? ""
    const bairroValue = bairroInputRef.current?.value ?? ""
    const telefoneValue = telefoneInputRef.current?.value ?? ""
    const limiteValue = limiteInputRef.current?.value ?? ""

    setSubmittedGeneralSearch(generalValue.trim())
    setSubmittedBairro(bairroValue.trim())
    setSubmittedTelefone(telefoneValue.trim())
    setSubmittedEstado(selectedEstado)
    setSubmittedCidade(selectedCidade)
    setSubmittedCategoria(selectedCategoria)
    setSubmittedLimit(limiteValue ? parseInt(limiteValue, 10) : null)
  }, [selectedEstado, selectedCidade, selectedCategoria])

  // Selection handlers
  const totalSelecionados = useMemo(
    () => (selectAll ? Math.max(paginationInfo.total - excludedIds.length, 0) : selectedIds.length),
    [selectAll, paginationInfo.total, excludedIds.length, selectedIds.length],
  )

  const toggleLead = (id: string) => {
    if (selectAll) {
      if (excludedIds.includes(id)) {
        setExcludedIds(excludedIds.filter((i) => i !== id))
      } else {
        setExcludedIds([...excludedIds, id])
      }
    } else {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter((i) => i !== id))
      } else {
        setSelectedIds([...selectedIds, id])
      }
    }
  }

  const handleSelectAllChange = (checked: boolean) => {
    setSelectAll(checked)
    setSelectedIds([])
    setExcludedIds([])
  }

  const resetSelection = () => {
    setSelectAll(false)
    setSelectedIds([])
    setExcludedIds([])
  }

  const handleAtribuirVendedor = async () => {
    if (!vendedorAtribuicao) {
      toast({ title: "Selecione um vendedor", variant: "destructive" })
      return
    }
    if (totalSelecionados === 0) {
      toast({ title: "Nenhum cliente selecionado", variant: "destructive" })
      return
    }

    try {
      setAssigning(true)
      setConfirmAssignOpen(false)

      let idsToAssign: string[]
      if (selectAll) {
        // Fetch all IDs based on current filters
        const params = new URLSearchParams()
        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.set(key, String(value))
          }
        })

        const res = await fetch(`/api/clients/ids?${params.toString()}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error || "Erro ao buscar clientes")
        }

        const allIds = await res.json() as number[]
        idsToAssign = allIds
          .map((id) => String(id))
          .filter((id) => !excludedIds.includes(id))
      } else {
        idsToAssign = selectedIds
      }

      if (idsToAssign.length === 0) {
        toast({ title: "Nenhum cliente para atribuir", variant: "destructive" })
        return
      }

      // Convert string IDs to numbers for the API
      const payload = {
        vendedorId: vendedorAtribuicao,
        ids: idsToAssign.map((id) => parseInt(id, 10)),
      }

      const response = await fetch("/api/clients/atribuir-vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Erro ao atribuir vendedor")
      }

      toast({
        title: "Atribuição concluída",
        description: `${data?.updated ?? idsToAssign.length} cliente(s) atribuído(s).`,
      })

      resetSelection()
      setVendedorAtribuicao("")
      fetchClientes(page, activeFilters)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erro ao atribuir vendedor",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setAssigning(false)
    }
  }

  const displayedLeads = clientes

  const exportLista = useCallback(
    async (tipo: "csv" | "papel") => {
      try {
        setExporting(true)
        const params = new URLSearchParams()
        Object.entries(activeFilters).forEach(([key, value]) => {
          if (value) params.set(key, String(value))
        })
        params.set("type", tipo)
        const res = await fetch(`/api/clients/export?${params.toString()}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Erro ao exportar lista.")
        }

        if (tipo === "papel") {
          const html = await res.text()
          const blob = new Blob([html], { type: "text/html" })
          const url = URL.createObjectURL(blob)
          window.open(url, "_blank", "noopener,noreferrer")
          return
        }

        const blob = await res.blob()
        const dispo = res.headers.get("Content-Disposition") || ""
        const match = dispo.match(/filename="(.+)"/)
        const filename = match?.[1] ?? `clientes-${new Date().toISOString().split("T")[0]}.csv`
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        a.click()
        window.URL.revokeObjectURL(url)
      } catch (error) {
        console.error(error)
        window.alert("Não foi possível exportar a lista.")
      } finally {
        setExporting(false)
      }
    },
    [activeFilters],
  )

  if (loading && !hasLoadedOnce) {

    return (
      <DashboardLayout>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="border-2 border-border/80 bg-card">
                <CardHeader className="pb-3">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <TableHead key={index}>
                        <Skeleton className="h-4 w-24" />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index} className="border-border">
                      <TableCell className="w-12">
                        <Skeleton className="h-5 w-5 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-24" />
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border px-6 py-4">
              <Skeleton className="h-4 w-48" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Database className="h-10 w-10 text-primary" />
              Banco de Dados Geral
            </h1>
            <p className="text-lg text-muted-foreground">Todos os leads cadastrados no sistema</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/unused_clients">
              <Button className="bg-white text-black">
                <Ban className="mr-2 h-4 w-4" />
                CNPJs bloqueados
              </Button>
            </Link>

            <Button onClick={() => setShowCadastro(true)} className="bg-primary">
              <Plus className="mr-2 h-4 w-4" />
              Novo Lead
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-border bg-transparent" disabled={exporting}>
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? "Exportando..." : "Exportar Lista"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportLista("csv")}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLista("papel")}>Para impressão</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-2">
          <Card className="py-0 border border-black/30 bg-card">
            <CardContent className="px-3 py-2">
              <div className="text-[11px] font-medium text-muted-foreground leading-tight">Total Leads</div>
              <div className="text-lg font-bold text-foreground leading-tight">{paginationInfo.total}</div>
            </CardContent>
          </Card>

          <Card className="py-0 border border-black/30 bg-card">
            <CardContent className="px-3 py-2">
              <div className="text-[11px] font-medium text-muted-foreground leading-tight">Clientes Livres</div>
              <div className="text-lg font-bold text-blue-500 leading-tight">{categoriaResumo.explorado}</div>
            </CardContent>
          </Card>

          <Card className="py-0 border border-black/30 bg-card">
            <CardContent className="px-3 py-2">
              <div className="text-[11px] font-medium text-muted-foreground leading-tight">Ativos</div>
              <div className="text-lg font-bold text-green-500 leading-tight">{categoriaResumo.ativo}</div>
            </CardContent>
          </Card>

          <Card className="py-0 border border-black/30 bg-card">
            <CardContent className="px-3 py-2">
              <div className="text-[11px] font-medium text-muted-foreground leading-tight">Livres com Data</div>
              <div className="text-lg font-bold text-yellow-500 leading-tight">{categoriaResumo.agendado}</div>
            </CardContent>
          </Card>
        </div>


        <LeadsFilterCard
          totalCount={paginationInfo.total}
          totalLabel="leads encontrados"
          loading={loading}
          generalSearchRef={generalSearchRef}
          bairroInputRef={bairroInputRef}
          telefoneInputRef={telefoneInputRef}
          estadoOptions={estadoOptions}
          cidadeOptions={cidadeOptions}
          selectedEstado={selectedEstado}
          selectedCidade={selectedCidade}
          onEstadoChange={handleEstadoChange}
          onCidadeChange={handleCidadeChange}
          onSearchSubmit={handleSearchSubmit}
          onClearFilters={() => {
            if (generalSearchRef.current) generalSearchRef.current.value = ""
            if (bairroInputRef.current) bairroInputRef.current.value = ""
            if (telefoneInputRef.current) telefoneInputRef.current.value = ""
            setSubmittedGeneralSearch("")
            setSubmittedBairro("")
            setSubmittedTelefone("")
            setSelectedEstado("all")
            setSelectedCidade("all")
            setSubmittedEstado("all")
            setSubmittedCidade("all")
            setSelectedCategoria("all")
            setSubmittedCategoria("all")
            setSelectedVendedor("all")
            setSubmittedVendedor("all")
            if (limiteInputRef.current) limiteInputRef.current.value = ""
            setSubmittedLimit(null)
            setFilterHistoryMode(null)
            setFilterHistoryValue(1)
            setFilterHistoryUnit('m')
            setFilterOrcamentoMode(null)
            setFilterOrcamentoValue(4)
            setFilterPedidoMode(null)
            setFilterPedidoValue(4)
            resetSelection()
          }}
          activeFilters={{
            search: submittedGeneralSearch !== "",
            estado: submittedEstado !== "all",
            cidade: submittedCidade !== "all",
            bairro: submittedBairro !== "",
            telefone: submittedTelefone !== "",
          }}
          autoSubmitOnSelectChange={true}
          extraFilters={
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <Select value={selectedCategoria} onValueChange={(value) => handleCategoriaChange(value as "all" | CategoriaFiltro)}>
                  <SelectTrigger className={`h-8 w-[130px] text-sm bg-background border-border ${submittedCategoria !== "all" ? "ring-2 ring-blue-500 border-blue-500" : ""}`}>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="explorado">Livre sem Data</SelectItem>
                    <SelectItem value="ativo">Ativos</SelectItem>
                    <SelectItem value="agendado">Livre com Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Vendedor</label>
                <Select value={selectedVendedor} onValueChange={handleVendedorChange}>
                  <SelectTrigger className={`h-8 w-[140px] text-sm bg-background border-border ${submittedVendedor !== "all" ? "ring-2 ring-blue-500 border-blue-500" : ""}`}>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sem">Sem Vendedor</SelectItem>
                    {vendedores.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 self-end pb-1">
                <Checkbox
                  id="sem-vendedor"
                  checked={selectedVendedor === "sem"}
                  onCheckedChange={(checked) => handleVendedorChange(checked ? "sem" : "all")}
                  className="h-4 w-4 border-2 border-slate-400"
                />
                <label htmlFor="sem-vendedor" className="text-xs font-medium text-foreground cursor-pointer">Sem vendedor</label>
              </div>

              {/* Filtro Orçamento */}
              <div className="space-y-1 relative">
                <div className="text-xs font-medium text-muted-foreground">Orçamento</div>
                <Button
                  type="button"
                  variant={filterOrcamentoMode !== null ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={() => {
                    if (filterOrcamentoMode === null) {
                      setFilterOrcamentoMode("sem")
                    } else {
                      setFilterOrcamentoMode(null)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setOrcamentoContextMenu({ x: e.clientX, y: e.clientY })
                  }}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  {filterOrcamentoMode === null
                    ? "Filtrar"
                    : `${filterOrcamentoMode === "sem" ? "Sem" : "Com"} orc. ${filterOrcamentoValue}${filterOrcamentoUnit}${filterOrcamentoMinItems ? ` ≥${filterOrcamentoMinItems}it` : ""}`}
                </Button>
                {orcamentoContextMenu && (() => {
                  const popupW = 240
                  const left = orcamentoContextMenu.x + popupW > window.innerWidth
                    ? orcamentoContextMenu.x - popupW
                    : orcamentoContextMenu.x
                  return (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setOrcamentoContextMenu(null)} />
                      <div
                        className="fixed z-[70] bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2.5 w-60"
                        style={{ left, top: orcamentoContextMenu.y }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Orçamento</p>
                        {/* SEM / COM */}
                        <div className="flex gap-1">
                          <Button type="button" variant={filterOrcamentoMode === "sem" ? "default" : "outline"} size="sm" className="h-7 flex-1 text-[10px]" onClick={() => setFilterOrcamentoMode("sem")}>SEM</Button>
                          <Button type="button" variant={filterOrcamentoMode === "com" ? "default" : "outline"} size="sm" className="h-7 flex-1 text-[10px]" onClick={() => setFilterOrcamentoMode("com")}>COM</Button>
                        </div>
                        {/* Presets meses */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Período (meses)</p>
                          <div className="flex flex-wrap gap-1">
                            {[1, 2, 3, 4, 6, 12].map((m) => (
                              <Button key={m} type="button" variant={filterOrcamentoValue === m && filterOrcamentoUnit === 'm' ? "default" : "outline"} size="sm" className="h-6 text-[10px] px-2"
                                onClick={() => { setFilterOrcamentoValue(m); setFilterOrcamentoUnit('m'); setFilterOrcamentoCustomInput(String(m)); setOrcamentoContextMenu(null); if (filterOrcamentoMode === null) setFilterOrcamentoMode("sem") }}
                              >{m}m</Button>
                            ))}
                          </div>
                        </div>
                        {/* Período personalizado */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Período personalizado</p>
                          <div className="flex gap-1">
                            <input
                              type="number" min="1" value={filterOrcamentoCustomInput}
                              onChange={(e) => setFilterOrcamentoCustomInput(e.target.value)}
                              className="w-14 h-7 rounded border border-border bg-background text-xs px-2 text-foreground"
                              placeholder="N"
                            />
                            <Button type="button" variant={filterOrcamentoUnit === 'd' ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => setFilterOrcamentoUnit('d')}>Dias</Button>
                            <Button type="button" variant={filterOrcamentoUnit === 'm' ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => setFilterOrcamentoUnit('m')}>Meses</Button>
                          </div>
                          <Button type="button" size="sm" className="h-6 text-[10px] mt-1 w-full" variant="secondary"
                            onClick={() => {
                              const v = parseInt(filterOrcamentoCustomInput, 10)
                              if (v > 0) { setFilterOrcamentoValue(v); setOrcamentoContextMenu(null); if (filterOrcamentoMode === null) setFilterOrcamentoMode("sem") }
                            }}
                          >Aplicar</Button>
                        </div>
                        {/* Mínimo de itens */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Mín. itens no orçamento</p>
                          <div className="flex gap-1">
                            <input
                              type="number" min="1" value={filterOrcamentoMinItemsInput}
                              onChange={(e) => setFilterOrcamentoMinItemsInput(e.target.value)}
                              className="w-14 h-7 rounded border border-border bg-background text-xs px-2 text-foreground"
                              placeholder="N"
                            />
                            <Button type="button" size="sm" className="h-7 text-[10px] flex-1" variant="secondary"
                              onClick={() => {
                                const v = parseInt(filterOrcamentoMinItemsInput, 10)
                                setFilterOrcamentoMinItems(v > 0 ? v : null)
                              }}
                            >Aplicar</Button>
                            {filterOrcamentoMinItems !== null && (
                              <Button type="button" size="sm" className="h-7 text-[10px] px-2" variant="ghost"
                                onClick={() => { setFilterOrcamentoMinItems(null); setFilterOrcamentoMinItemsInput("") }}
                              >✕</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Filtro Pedido */}
              <div className="space-y-1 relative">
                <div className="text-xs font-medium text-muted-foreground">Pedido</div>
                <Button
                  type="button"
                  variant={filterPedidoMode !== null ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={() => {
                    if (filterPedidoMode === null) {
                      setFilterPedidoMode("sem")
                    } else {
                      setFilterPedidoMode(null)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setPedidoContextMenu({ x: e.clientX, y: e.clientY })
                  }}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  {filterPedidoMode === null
                    ? "Filtrar"
                    : `${filterPedidoMode === "sem" ? "Sem" : "Com"} ped. ${filterPedidoValue}${filterPedidoUnit}${filterPedidoMinItems ? ` ≥${filterPedidoMinItems}it` : ""}`}
                </Button>
                {pedidoContextMenu && (() => {
                  const popupW = 240
                  const left = pedidoContextMenu.x + popupW > window.innerWidth
                    ? pedidoContextMenu.x - popupW
                    : pedidoContextMenu.x
                  return (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setPedidoContextMenu(null)} />
                      <div
                        className="fixed z-[70] bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2.5 w-60"
                        style={{ left, top: pedidoContextMenu.y }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pedido</p>
                        {/* SEM / COM */}
                        <div className="flex gap-1">
                          <Button type="button" variant={filterPedidoMode === "sem" ? "default" : "outline"} size="sm" className="h-7 flex-1 text-[10px]" onClick={() => setFilterPedidoMode("sem")}>SEM</Button>
                          <Button type="button" variant={filterPedidoMode === "com" ? "default" : "outline"} size="sm" className="h-7 flex-1 text-[10px]" onClick={() => setFilterPedidoMode("com")}>COM</Button>
                        </div>
                        {/* Presets meses */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Período (meses)</p>
                          <div className="flex flex-wrap gap-1">
                            {[1, 2, 3, 4, 6, 12].map((m) => (
                              <Button key={m} type="button" variant={filterPedidoValue === m && filterPedidoUnit === 'm' ? "default" : "outline"} size="sm" className="h-6 text-[10px] px-2"
                                onClick={() => { setFilterPedidoValue(m); setFilterPedidoUnit('m'); setFilterPedidoCustomInput(String(m)); setPedidoContextMenu(null); if (filterPedidoMode === null) setFilterPedidoMode("sem") }}
                              >{m}m</Button>
                            ))}
                          </div>
                        </div>
                        {/* Período personalizado */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Período personalizado</p>
                          <div className="flex gap-1">
                            <input
                              type="number" min="1" value={filterPedidoCustomInput}
                              onChange={(e) => setFilterPedidoCustomInput(e.target.value)}
                              className="w-14 h-7 rounded border border-border bg-background text-xs px-2 text-foreground"
                              placeholder="N"
                            />
                            <Button type="button" variant={filterPedidoUnit === 'd' ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => setFilterPedidoUnit('d')}>Dias</Button>
                            <Button type="button" variant={filterPedidoUnit === 'm' ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => setFilterPedidoUnit('m')}>Meses</Button>
                          </div>
                          <Button type="button" size="sm" className="h-6 text-[10px] mt-1 w-full" variant="secondary"
                            onClick={() => {
                              const v = parseInt(filterPedidoCustomInput, 10)
                              if (v > 0) { setFilterPedidoValue(v); setPedidoContextMenu(null); if (filterPedidoMode === null) setFilterPedidoMode("sem") }
                            }}
                          >Aplicar</Button>
                        </div>
                        {/* Mínimo de itens */}
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1">Mín. itens no pedido</p>
                          <div className="flex gap-1">
                            <input
                              type="number" min="1" value={filterPedidoMinItemsInput}
                              onChange={(e) => setFilterPedidoMinItemsInput(e.target.value)}
                              className="w-14 h-7 rounded border border-border bg-background text-xs px-2 text-foreground"
                              placeholder="N"
                            />
                            <Button type="button" size="sm" className="h-7 text-[10px] flex-1" variant="secondary"
                              onClick={() => {
                                const v = parseInt(filterPedidoMinItemsInput, 10)
                                setFilterPedidoMinItems(v > 0 ? v : null)
                              }}
                            >Aplicar</Button>
                            {filterPedidoMinItems !== null && (
                              <Button type="button" size="sm" className="h-7 text-[10px] px-2" variant="ghost"
                                onClick={() => { setFilterPedidoMinItems(null); setFilterPedidoMinItemsInput("") }}
                              >✕</Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
                <Button
                  type="button"
                  variant={filterHistoryMode !== null ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-2 text-xs"
                  onClick={() => {
                    if (filterHistoryMode === null) {
                      setFilterHistoryMode("sem")
                      setFilterHistoryValue(Number(historyCustomInput) || 1)
                    } else {
                      setFilterHistoryMode(null)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setHistoryContextMenu({ x: e.clientX, y: e.clientY })
                  }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {filterHistoryMode === null
                    ? "Filtrar"
                    : `${filterHistoryMode === "sem" ? "Sem" : "Com"} hist. ${filterHistoryValue}${filterHistoryUnit}`}
                </Button>

                {historyContextMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-[60]"
                      onClick={() => setHistoryContextMenu(null)}
                    />
                    <div
                      className="fixed z-[70] bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2 min-w-[170px]"
                      style={{ left: historyContextMenu.x, top: historyContextMenu.y }}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Configurar Histórico</p>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant={filterHistoryMode === "sem" ? "default" : "outline"}
                          size="sm"
                          className="h-7 flex-1 text-[10px]"
                          onClick={() => {
                            setFilterHistoryMode("sem")
                            if (filterHistoryMode === null) setFilterHistoryValue(Number(historyCustomInput) || 1)
                          }}
                        >
                          SEM
                        </Button>
                        <Button
                          type="button"
                          variant={filterHistoryMode === "com" ? "default" : "outline"}
                          size="sm"
                          className="h-7 flex-1 text-[10px]"
                          onClick={() => {
                            setFilterHistoryMode("com")
                            if (filterHistoryMode === null) setFilterHistoryValue(Number(historyCustomInput) || 1)
                          }}
                        >
                          COM
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          value={historyCustomInput}
                          onChange={(e) => setHistoryCustomInput(e.target.value)}
                          className="h-8 w-14 text-xs"
                          autoFocus
                        />
                        {(['h', 'd', 'm'] as const).map((u) => (
                          <Button
                            key={u}
                            type="button"
                            variant={filterHistoryUnit === u ? "default" : "outline"}
                            size="sm"
                            className="h-7 w-7 p-0 text-[10px]"
                            onClick={() => setFilterHistoryUnit(u)}
                          >
                            {u}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs font-bold"
                          onClick={() => {
                            setFilterHistoryValue(Number(historyCustomInput) || 1)
                            setHistoryContextMenu(null)
                            if (filterHistoryMode === null) setFilterHistoryMode("sem")
                          }}
                        >
                          OK
                        </Button>
                      </div>
                      <div className="flex gap-1 flex-wrap max-w-[200px] justify-center">
                        {[
                          { v: 1, u: 'h', l: '1h' }, { v: 12, u: 'h', l: '12h' },
                          { v: 1, u: 'd', l: '1d' }, { v: 7, u: 'd', l: '7d' },
                          { v: 1, u: 'm', l: '1m' }, { v: 3, u: 'm', l: '3m' }, { v: 6, u: 'm', l: '6m' }
                        ].map(({ v, u, l }) => (
                          <Button
                            key={l}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2"
                            onClick={() => {
                              setHistoryCustomInput(String(v))
                              setFilterHistoryValue(v)
                              setFilterHistoryUnit(u as any)
                              setHistoryContextMenu(null)
                              if (filterHistoryMode === null) setFilterHistoryMode("sem")
                            }}
                          >
                            {l}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Limite</div>
                <Input placeholder="25" type="number" min={1} max={CLIENTS_MAX_LIMIT} ref={limiteInputRef} className={cn("h-8 w-[70px] text-sm bg-background border-border", submittedLimit !== null && "ring-2 ring-blue-500 border-blue-500")} />
              </div>
            </>
          }
        />

        <div>
          <div className="flex items-center justify-end gap-2 mb-5">
            <Button
              variant={distributionType === "state" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (distributionType === "state") {
                  setDistributionType("none")
                  // Reset state filter if it was set via distribution click
                  if (submittedEstado !== "all") {
                    setSelectedEstado("all")
                    setSubmittedEstado("all")
                    setSelectedCidade("all")
                    setSubmittedCidade("all")
                  }
                } else {
                  setDistributionType("state")
                }
              }}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              {distributionType === "state" ? "Ocultar Estados" : "Por Estado"}
            </Button>
            <Button
              variant={distributionType === "vendor" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (distributionType === "vendor") {
                  setDistributionType("none")
                } else {
                  setDistributionType("vendor")
                  // Reset state filter if switching
                  if (submittedEstado !== "all") {
                    setSelectedEstado("all")
                    setSubmittedEstado("all")
                    setSelectedCidade("all")
                    setSubmittedCidade("all")
                  }
                }
              }}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              {distributionType === "vendor" ? "Ocultar Vendedores" : "Por Vendedor"}
            </Button>
          </div>

          {distributionType === "state" && (
            <LeadsStateDistribution
              filters={Object.entries(activeFilters).reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {})}
              selectedState={submittedEstado !== "all" ? submittedEstado : null}
              onStateClick={(estado) => {
                if (estado === "N/I") return
                // Toggle behavior: if already selected, deselect
                if (submittedEstado === estado) {
                  setSelectedEstado("all")
                  setSubmittedEstado("all")
                  setSelectedCidade("all")
                  setSubmittedCidade("all")
                } else {
                  setSelectedEstado(estado)
                  setSubmittedEstado(estado)
                  setSelectedCidade("all")
                  setSubmittedCidade("all")
                }
              }}
            />
          )}

          {distributionType === "vendor" && (
            <LeadsVendorDistribution
              filters={Object.entries(activeFilters).reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {})}
              selectedVendorId={submittedVendedor === "all" ? null : submittedVendedor}
              onVendorClick={(vendedorId, vendorName) => {
                // Toggle behavior: se já está filtrado por esse vendedor, limpa o filtro
                const filterValue = vendedorId === null ? "sem" : vendedorId
                if (submittedVendedor === filterValue) {
                  // Desfiltrar
                  setSelectedVendedor("all")
                  setSubmittedVendedor("all")
                } else {
                  // Filtrar por este vendedor
                  setSelectedVendedor(filterValue)
                  setSubmittedVendedor(filterValue)
                }
              }}
            />
          )}

        </div>
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={(checked) => handleSelectAllChange(checked === true)}
                      className="h-4 w-4"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Condomínio</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">CNPJ</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Categoria</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground min-w-[180px]">Localização</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Vendedor</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {paginationInfo.total === 0 && !hasActiveFilters
                        ? "Nenhum cliente cadastrado ainda. Clique em 'Novo Lead' para começar."
                        : "Nenhum cliente encontrado com os filtros selecionados."}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedLeads.map((lead) => {
                    const isSelected = selectAll ? !excludedIds.includes(lead.id) : selectedIds.includes(lead.id)
                    return (
                      <TableRow key={lead.id} className="border-b border-black/30 hover:bg-accent/5">
                        <TableCell className="w-[40px] py-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleLead(lead.id)}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 bg-blue-500/10 rounded flex items-center justify-center border border-blue-500/20">
                              <Building2 className="h-3 w-3 text-blue-600" />
                            </div>
                            <div>
                              <button
                                onClick={() => setSelectedCliente(lead.id)}
                                className="font-medium text-xs text-foreground leading-tight hover:text-blue-600 hover:underline transition-colors text-left"
                              >
                                {lead.nomeCondominio}
                              </button>
                              <p className="text-[10px] text-muted-foreground leading-tight">{lead.administradora.nome}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground font-mono text-xs py-2 flex items-center gap-2">
                          {lead.telefoneSindico
                            ? formatPhone(lead.telefoneSindico)
                            : <span className="text-muted-foreground text-[10px]">—</span>
                          }
                          {lead.isContratoVigente && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 h-4 py-0 px-1.5 text-[9px] font-bold">
                              CONTRATO ATIVO
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            className={
                              lead.categoria === "ativo"
                                ? "bg-green-500/10 text-green-500 text-[10px] px-1.5 py-0.5"
                                : lead.categoria === "agendado"
                                  ? "bg-yellow-500/10 text-yellow-500 text-[10px] px-1.5 py-0.5"
                                  : lead.categoria === "explorado"
                                    ? "bg-orange-500/10 text-orange-500 text-[10px] px-1.5 py-0.5"
                                    : "bg-blue-500/10 text-blue-500 text-[10px] px-1.5 py-0.5"
                            }
                          >
                            {lead.categoria === "explorado" ? "Livre sem Data" : lead.categoria === "agendado" ? "Livre com Data" : "Ativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 w-[180px] min-w-[180px] max-w-[180px]">
                          <div className="space-y-0.5 w-full">
                            {lead.bairro || lead.cidade || lead.estado ? (
                              <div className="flex items-start gap-1 text-[10px] text-muted-foreground leading-tight">
                                <MapPin className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                                <span className="whitespace-normal break-words">{[lead.bairro, lead.cidade, lead.estado].filter(Boolean).join(", ")}</span>
                              </div>
                            ) : null}
                            {lead.endereco && (
                              <p className="text-[9px] text-muted-foreground/70 whitespace-normal break-words leading-tight pl-4">{lead.endereco}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-foreground py-2">{lead.vendedor ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2 tabular-nums">
                          {lead.diasComVendedor !== null && lead.diasComVendedor !== undefined
                            ? `${lead.diasComVendedor}d`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>


          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border px-6 py-4">
            <p className="text-base text-muted-foreground">
              Mostrando{" "}
              {clientes.length === 0
                ? "0"
                : `${startItem}-${endItem}`}{" "}
              de {paginationInfo.total} leads
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-border"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
              >
                Anterior
              </Button>
              <span className="text-base text-muted-foreground">
                Página {paginationInfo.page} de {paginationInfo.totalPages}
              </span>
              <Button
                variant="outline"
                className="border-border"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= paginationInfo.totalPages || loading}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {selectedCliente && (
        <ClienteDetailDialog
          clienteId={selectedCliente}
          open={!!selectedCliente}
          onClose={() => setSelectedCliente(null)}
        />
      )}

      {orcamentoCliente && (
        <CriarOrcamentoDialog
          open
          clienteId={orcamentoCliente.id}
          clienteNome={orcamentoCliente.nome}
          onClose={() => setOrcamentoCliente(null)}
        />
      )}

      <CadastroClienteDialog
        open={showCadastro}
        onClose={() => setShowCadastro(false)}
        onSuccess={() => fetchClientes(page, activeFilters)}
      />

      {/* Mass assignment floating bar */}
      {totalSelecionados > 0 && (
        <Card className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 shadow-lg border-blue-200 bg-blue-50">
          <CardContent className="py-3 px-6 flex items-center gap-4">
            <span className="text-sm font-medium text-blue-800">
              {totalSelecionados} cliente(s) selecionado(s)
            </span>
            <div className="h-4 w-px bg-blue-200" />
            <Popover open={vendedorAtribuicaoOpen} onOpenChange={setVendedorAtribuicaoOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-blue-300">
                  {vendedorAtribuicao
                    ? vendedores.find((v) => v.id === vendedorAtribuicao)?.name ?? "Vendedor"
                    : "Selecionar Vendedor"}
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Buscar vendedor..." />
                  <CommandList>
                    <CommandEmpty>Nenhum vendedor encontrado.</CommandEmpty>
                    <CommandGroup>
                      {vendedores.map((vendedor) => (
                        <CommandItem
                          key={vendedor.id}
                          value={vendedor.name}
                          onSelect={() => {
                            setVendedorAtribuicao(vendedor.id)
                            setVendedorAtribuicaoOpen(false)
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", vendedorAtribuicao === vendedor.id ? "opacity-100" : "opacity-0")} />
                          {vendedor.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!vendedorAtribuicao}
              onClick={() => setConfirmAssignOpen(true)}
            >
              Atribuir Vendedor
            </Button>
            <Button size="sm" variant="ghost" onClick={resetSelection} className="text-foreground hover:text-foreground hover:bg-muted">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog de confirmação de atribuição */}
      <Dialog open={confirmAssignOpen} onOpenChange={setConfirmAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Atribuição</DialogTitle>
            <DialogDescription>
              Você está prestes a atribuir {totalSelecionados} cliente(s) para{" "}
              <strong>{vendedores.find((v) => v.id === vendedorAtribuicao)?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmAssignOpen(false)} disabled={assigning}>
              Cancelar
            </Button>
            <Button onClick={handleAtribuirVendedor} disabled={assigning}>
              {assigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atribuindo...
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
