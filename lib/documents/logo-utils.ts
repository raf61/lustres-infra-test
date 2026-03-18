import fs from "node:fs"
import path from "node:path"

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
}

const toDataUrl = (buffer: Buffer, mimeType: string) =>
  `data:${mimeType};base64,${buffer.toString("base64")}`

const inferMime = (filePath: string) => MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "image/png"

const normalizePublicPath = (p: string): string => {
  const clean = p.startsWith("/") ? p.slice(1) : p
  if (clean.startsWith("public/") || clean.startsWith("public\\")) {
    return path.resolve(clean)
  }
  return path.resolve(path.join("./public", clean))
}

async function fetchToDataUrl(remoteUrl: string): Promise<string | null> {
  const response = await fetch(remoteUrl)
  if (!response.ok) return null
  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get("content-type") || "image/png"
  return toDataUrl(Buffer.from(arrayBuffer), contentType)
}

export async function resolveEmpresaLogoDataUrl(params: {
  logoUrl: string | null
  empresaId?: number | null
}): Promise<string | null> {
  const { logoUrl, empresaId } = params
  if (!logoUrl) {
    if (empresaId === 1) {
      const fallbackPath = path.resolve("./public/logo_ebr.png")
      try {
        return toDataUrl(fs.readFileSync(fallbackPath), inferMime(fallbackPath))
      } catch {
        return null
      }
    }
    return null
  }

  if (logoUrl.startsWith("data:")) {
    return logoUrl
  }

  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    try {
      return await fetchToDataUrl(logoUrl)
    } catch {
      return null
    }
  }

  const publicPath = normalizePublicPath(logoUrl)
  try {
    return toDataUrl(fs.readFileSync(publicPath), inferMime(publicPath))
  } catch {
    return null
  }
}


