import { getPrivateObject, getPrivateObjectUrl, parseKeyFromUrl, uploadPrivateObject, uploadPublicObject } from "./s3"

type UploadInput = {
  key: string
  contentType: string
  body: Buffer
}

export const storage = {
  uploadPublicObject: async (input: UploadInput) => uploadPublicObject(input),
  uploadPrivateObject: async (input: UploadInput) => uploadPrivateObject(input),
  getPrivateObject: async (key: string) => getPrivateObject(key),
  getPrivateObjectUrl: async (key: string, expiresIn?: number) => getPrivateObjectUrl(key, expiresIn),
  parseKeyFromUrl: (url?: string | null) => parseKeyFromUrl(url),
  getDownloadUrlFromStoredUrl: async (url?: string | null, expiresIn?: number) => {
    if (!url) return null
    const key = parseKeyFromUrl(url)
    if (!key) return url
    try {
      return await getPrivateObjectUrl(key, expiresIn)
    } catch (error) {
      console.error("[storage] failed to sign url", error)
      return url
    }
  },
  isInternalUrl: (url?: string | null) => {
    if (!url) return false
    return !!parseKeyFromUrl(url)
  },
}


