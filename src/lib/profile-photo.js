import fs from 'node:fs/promises'
import path from 'node:path'
import { assertAllowedPhotoUrl } from './photo-url.js'

const DEFAULT_ROOT = path.resolve(process.cwd(), 'uploads', 'avatars')
const MAX_BYTES = 1_200_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SIGNATURES = [
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    test: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    ext: 'png',
    mime: 'image/png',
    test: (buffer) => buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47,
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (buffer) => buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP',
  },
]

function fail(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

export async function storeProfilePhoto(userId, value, { root = DEFAULT_ROOT } = {}) {
  if (value == null || String(value).trim() === '') return null
  const text = String(value).trim()
  if (!text.toLowerCase().startsWith('data:')) {
    assertAllowedPhotoUrl(text)
    return text
  }
  return writeDataImage(userId, text, root)
}

async function writeDataImage(userId, text, root) {
  if (!UUID.test(String(userId || ''))) throw fail('Usuario inválido')

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(text)
  if (!match) throw fail('La foto tiene que ser JPG, PNG o WebP')

  const encoded = match[2].replace(/\s/g, '')
  if (encoded.length > 1_700_000) throw fail('La foto supera el tamaño permitido')

  const buffer = Buffer.from(encoded, 'base64')
  if (!buffer.length || buffer.length > MAX_BYTES) throw fail('La foto supera el tamaño permitido')

  const declared = match[1].toLowerCase()
  const signature = SIGNATURES.find((item) => item.test(buffer))
  if (!signature || signature.mime !== declared) throw fail('El archivo no es una imagen válida')

  const directory = path.resolve(root)
  const filename = `${userId}.${signature.ext}`
  const filePath = path.resolve(directory, filename)
  if (!filePath.startsWith(`${directory}${path.sep}`)) throw fail('La foto no es válida')

  await fs.mkdir(directory, { recursive: true })
  await Promise.all(SIGNATURES.map(async (item) => {
    if (item.ext === signature.ext) return
    await fs.rm(path.resolve(directory, `${userId}.${item.ext}`), { force: true })
  }))
  await fs.writeFile(filePath, buffer)
  return `/uploads/avatars/${filename}?v=${Date.now()}`
}
