import 'dotenv/config'
import express from 'express'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { fileURLToPath } from 'url'
import path from 'path'
import dns from 'dns/promises'
import net from 'net'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

const BASE = 'https://advdinamico.com.br'
const SCRAPE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
}

app.use(express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'prospector.html'))
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchHtml(url) {
    const { data } = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 20000 })
    return data
}

function getJsonLd($, type) {
    let result = {}
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).html() || '')
            const items = Array.isArray(data) ? data : [data]
            for (const item of items) {
                if (item['@type'] === type) { result = item; return false }
            }
        } catch {}
    })
    return result
}

function decodeCfEmail(encoded) {
    const key = parseInt(encoded.slice(0, 2), 16)
    let result = ''
    for (let i = 2; i < encoded.length; i += 2) {
        result += String.fromCharCode(parseInt(encoded.slice(i, i + 2), 16) ^ key)
    }
    return result
}

function extractContact($) {
    const org = getJsonLd($, 'Organization')
    let phone = (org.telephone || '').trim()
    let email = (org.email || '').trim().toLowerCase()

    if (!phone) phone = $('[itemprop="telephone"]').first().text().trim()
    if (!email) email = $('[itemprop="email"]').first().text().trim().toLowerCase()
    if (!email) {
        const cfEl = $('a[data-cfemail]').first()
        if (cfEl.length) {
            try { email = decodeCfEmail(cfEl.attr('data-cfemail')) } catch {}
        }
    }
    return { phone, email }
}

function extractSocios($) {
    const org = getJsonLd($, 'Organization')
    const jsonldNames = (org.member || []).map(m => (m.name || '').trim()).filter(Boolean)

    const seen = new Map()
    $('a[href*="/socios/"]').each((_, el) => {
        const href = $(el).attr('href') || ''
        if (!href) return
        const url = href.startsWith('http') ? href : BASE + href
        if (seen.has(url)) return

        let name = $(el).text().trim()
        if (!name && jsonldNames.length) {
            const slug = url.split('/').pop().toLowerCase()
            for (const n of jsonldNames) {
                const candidate = n.toLowerCase().replace(/[^a-z0-9]/g, '-')
                if (slug.includes(candidate.slice(0, 15))) { name = n; break }
            }
        }
        if (!name) name = url.split('/').pop()
        seen.set(url, name)
    })

    return Array.from(seen.entries()).map(([url, name]) => ({ url, name }))
}

function extractEmpresas($) {
    const seen = new Map()
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const match = href.match(/\/empresas\/(\d{14})/)
        if (match) {
            const url = href.startsWith('http') ? href : BASE + href
            if (!seen.has(url)) seen.set(url, match[1])
        }
    })
    return Array.from(seen.entries()).map(([url, cnpj]) => ({ url, cnpj }))
}

function extractCompanyName($, fallback) {
    const org = getJsonLd($, 'Organization')
    if (org.name) return org.name
    const h1 = $('h1').first().text().trim()
    if (h1) return h1
    return $('title').text().trim().split('|')[0].trim() || fallback
}

function fmtCnpj(d) {
    d = (d || '').replace(/\D/g, '')
    return d.length === 14
        ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
        : d
}

async function searchGoogle(query) {
    if (!process.env.SERPER_API_KEY) return []
    try {
        const { data } = await axios.post('https://google.serper.dev/search', {
            q: query, num: 10, hl: 'pt-br', gl: 'br'
        }, {
            headers: {
                'X-API-KEY': process.env.SERPER_API_KEY,
                'Content-Type': 'application/json'
            }
        })
        return data.organic || []
    } catch (e) {
        console.error('Serper error:', e.message)
        return []
    }
}

async function fetchPorte(cnpj) {
    try {
        const { data } = await axios.get(`https://publica.cnpj.ws/cnpj/${cnpj}`, { timeout: 8000 })
        const p = data.porte
        return (typeof p === 'string' ? p : p?.descricao) || null
    } catch { return null }
}

async function findInstagram(name) {
    try {
        const results = await searchGoogle(`${name} instagram`)
        for (const r of results) {
            const link = r.link || ''
            if (
                link.toLowerCase().includes('instagram.com') &&
                !/\/(p|reel|tv|explore|tags|stories)\//i.test(link)
            ) {
                return link
            }
        }
    } catch (e) { console.error('Instagram search error:', e.message) }
    return null
}

async function findSite(name) {
    const exclude = [
        'facebook.com', 'instagram.com', 'maps.google', 'google.com',
        'linkedin.com', 'twitter.com', 'youtube.com', 'mercadolivre.com',
        'olx.com', 'blogspot', 'cnpj', 'advdinamico', 'receitafederal',
        'jucesp', 'jucemg', 'tiktok.com', 'linktree', 'linktr.ee',
        'apontador.com', 'classificados'
    ]
    try {
        const results = await searchGoogle(`${name} site oficial`)
        for (const r of results) {
            const link = (r.link || '').toLowerCase()
            if (!exclude.some(t => link.includes(t))) return r.link
        }
    } catch (e) { console.error('Site search error:', e.message) }
    return null
}

// SSE streaming endpoint
app.get('/api/cnpj/:cnpj', async (req, res) => {
    const cnpjRaw = req.params.cnpj.replace(/\D/g, '')
    if (cnpjRaw.length !== 14) {
        res.status(400).json({ error: 'CNPJ inválido (esperado 14 dígitos)' })
        return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const send = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
    }

    const empresaUrl = `${BASE}/empresas/${cnpjRaw}`

    try {
        send('status', { message: 'Buscando empresa no Adv Dinâmico...' })

        const html0 = await fetchHtml(empresaUrl)
        const $0 = cheerio.load(html0)
        const companyName = extractCompanyName($0, cnpjRaw)
        const socios = extractSocios($0)
        const { phone, email } = extractContact($0)

        const portePromise = fetchPorte(cnpjRaw)

        send('main', {
            cnpj: fmtCnpj(cnpjRaw),
            cnpjRaw,
            companyName,
            url: empresaUrl,
            socios,
            phone,
            email
        })

        send('status', { message: 'Buscando Instagram, site e porte...' })
        Promise.all([findInstagram(companyName), findSite(companyName), portePromise]).then(([instagram, site, porte]) => {
            send('links', { instagram, site })
            if (porte) send('porte', { porte })
        }).catch(() => send('links', { instagram: null, site: null }))

        const empresaParaSocios = new Map()

        for (const socio of socios) {
            send('status', { message: `Buscando empresas de ${socio.name}...` })
            await sleep(700)
            try {
                const htmlS = await fetchHtml(socio.url)
                const $S = cheerio.load(htmlS)
                const empresas = extractEmpresas($S)
                for (const emp of empresas) {
                    if (!empresaParaSocios.has(emp.url)) empresaParaSocios.set(emp.url, [])
                    empresaParaSocios.get(emp.url).push(socio.name)
                }
            } catch (e) {
                send('warn', { message: `Erro ao buscar sócio ${socio.name}: ${e.message}` })
            }
        }

        const total = empresaParaSocios.size
        let count = 0
        for (const [empUrl, sociosOrigem] of empresaParaSocios) {
            count++
            const cnpjEmp = empUrl.split('/').pop()
            send('status', { message: `Buscando empresa ${count}/${total}...` })
            await sleep(500)
            try {
                const htmlE = await fetchHtml(empUrl)
                const $E = cheerio.load(htmlE)
                const nome = extractCompanyName($E, cnpjEmp)
                const { phone: p, email: e } = extractContact($E)
                send('company', {
                    cnpj: fmtCnpj(cnpjEmp),
                    cnpjRaw: cnpjEmp,
                    nome,
                    url: empUrl,
                    phone: p,
                    email: e,
                    socios: [...new Set(sociosOrigem)],
                    isMain: cnpjEmp === cnpjRaw,
                    progress: `${count}/${total}`
                })
            } catch (e) {
                send('warn', { message: `Erro ao buscar empresa ${cnpjEmp}: ${e.message}` })
            }
        }

        send('done', { total })
    } catch (e) {
        console.error(e)
        send('error', { message: e.message })
    } finally {
        res.end()
    }
})

// Email check: SMTP RCPT TO probe
async function smtpCheck(mxHost, email) {
    for (const port of [25, 587]) {
        const result = await new Promise((resolve) => {
            const sock = net.createConnection(port, mxHost)
            sock.setTimeout(5000)
            let buf = '', step = 0, connected = false
            const send = (cmd) => sock.write(cmd + '\r\n')
            sock.on('connect', () => { connected = true })
            sock.on('timeout', () => { sock.destroy(); resolve({ status: connected ? 'timeout_mid' : 'timeout_connect' }) })
            sock.on('error', (e) => resolve({ status: 'refused', code: e.code }))
            sock.on('data', (d) => {
                buf += d.toString()
                if (!buf.includes('\n')) return
                const lines = buf.split('\n'); buf = lines.pop()
                for (const line of lines) {
                    const code = parseInt(line)
                    if (step === 0 && code === 220) { step=1; send('EHLO prospector.local') }
                    else if (step === 1 && (code === 250 || code === 220)) { step=2; send('MAIL FROM:<check@prospector.local>') }
                    else if (step === 2 && code === 250) { step=3; send(`RCPT TO:<${email}>`) }
                    else if (step === 3) {
                        send('QUIT'); sock.destroy()
                        if (code === 250 || code === 251)                        resolve({ status: 'exists' })
                        else if ([550,551,552,553,554,450,550].includes(code))   resolve({ status: 'not_found', smtpCode: code })
                        else                                                      resolve({ status: 'inconclusive', smtpCode: code })
                    }
                }
            })
        })
        if (result.status !== 'refused' && result.status !== 'timeout_connect') return result
    }
    return { status: 'blocked' }
}

app.get('/api/check-email', async (req, res) => {
    const email = (req.query.email || '').trim().toLowerCase()
    if (!email.includes('@')) return res.json({ ok: false, reason: 'invalid' })
    const domain = email.split('@')[1]
    try {
        const mx = await dns.resolveMx(domain).catch(() => null)
        if (!mx || mx.length === 0) return res.json({ ok: false, reason: 'no_mx' })
        const sorted = mx.sort((a,b) => a.priority - b.priority)
        const mxHost = sorted[0].exchange

        const knownBlocked = ['google.com','googlemail.com','outlook.com','hotmail.com','microsoft.com',
            'yahoo.com','yahoodns.net','protonmail.ch','proton.me','icloud.com']
        const isKnownBlocked = knownBlocked.some(h => mxHost.toLowerCase().includes(h))

        if (isKnownBlocked) {
            return res.json({ ok: null, reason: 'provider_blocks', mx: mxHost, provider: mxHost.split('.').slice(-2).join('.') })
        }

        const r = await smtpCheck(mxHost, email)
        if (r.status === 'exists')      return res.json({ ok: true,  reason: 'exists',      mx: mxHost })
        if (r.status === 'not_found')   return res.json({ ok: false, reason: 'not_found',   mx: mxHost })
        if (r.status === 'blocked')     return res.json({ ok: null,  reason: 'port_blocked', mx: mxHost })
        return res.json({ ok: null, reason: 'inconclusive', mx: mxHost, detail: r.status })
    } catch (e) {
        return res.json({ ok: null, reason: 'error', detail: e.message })
    }
})

app.listen(PORT, () => {
    console.log(`\n  Prospector CNPJ rodando em http://localhost:${PORT}\n`)
})
