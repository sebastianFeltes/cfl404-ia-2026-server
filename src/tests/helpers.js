import 'dotenv/config'
import { createServer } from 'node:http'
import prisma from '../lib/prisma.js'
import { signAccessToken } from '../lib/auth-tokens.js'

export async function startTestServer() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test'
  const { default: app } = await import('../app.js')
  const server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    server,
    base: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
    },
  }
}

export async function tokenForEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, status: true },
  })
  if (!user) throw new Error(`No hay usuario seed ${email}`)
  const type = ['ALUMNO', 'POSTULANTE'].includes(user.role.name) ? 'STUDENT' : 'STAFF'
  return { token: signAccessToken(user, type), user }
}

export async function jsonRequest(base, path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json, text, headers: res.headers }
}

export { prisma }
