import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

type UploadParams = {
  key: string
  contentType: string
  body: Buffer
}

const getEnv = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

const endpointFromHost = (host: string) => (host.startsWith("http") ? host : `https://${host}`)

const getClient = () => {
  const region = getEnv("S3_REGION")
  const host = getEnv("S3_HOST")
  const accessKeyId = getEnv("S3_ACCESS_KEY")
  const secretAccessKey = getEnv("S3_SECRET_KEY")

  return new S3Client({
    region,
    endpoint: endpointFromHost(host),
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

const buildObjectUrl = (key: string) => {
  const bucket = getEnv("S3_BUCKET")
  const endpoint = endpointFromHost(getEnv("S3_HOST")).replace(/\/$/, "")
  return `${endpoint}/${bucket}/${key}`
}

export const uploadPublicObject = async ({ key, contentType, body }: UploadParams) => {
  const bucket = getEnv("S3_BUCKET")
  const client = getClient()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    }),
  )

  return buildObjectUrl(key)
}

export const uploadPrivateObject = async ({ key, contentType, body }: UploadParams) => {
  const bucket = getEnv("S3_BUCKET")
  const client = getClient()

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "private",
    }),
  )

  return {
    key,
    url: buildObjectUrl(key),
  }
}

export const getPrivateObjectUrl = async (key: string, expiresIn = 3600) => {
  const bucket = getEnv("S3_BUCKET")
  const client = getClient()

  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(client, command, { expiresIn })
}

export const getPrivateObject = async (key: string): Promise<Buffer | null> => {
  const bucket = getEnv("S3_BUCKET")
  const client = getClient()

  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await client.send(command)

  if (!response.Body) return null

  const stream = response.Body as any
  const chunks: any[] = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export const parseKeyFromUrl = (url?: string | null) => {
  if (!url) return null
  const bucket = getEnv("S3_BUCKET")
  try {
    const parsed = new URL(url)
    let pathname = decodeURIComponent(parsed.pathname).replace(/^\/+/, "")
    if (pathname.startsWith(`${bucket}/`)) {
      pathname = pathname.slice(bucket.length + 1)
    }
    return pathname || null
  } catch {
    if (url.startsWith("s3://")) {
      // URL no formato s3://key ou s3://bucket/key
      const without = url.replace("s3://", "")
      const parts = without.split("/")
      // Se o primeiro elemento for o bucket, remove-o
      if (parts[0] === bucket) {
        return parts.slice(1).join("/") || null
      }
      // Caso contrário, a URL já é só a key
      return without || null
    }
    return null
  }
}


