import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import prisma from '../lib/prisma.js'
import { jsonRequest, startTestServer } from './helpers.js'

describe('contenido público', () => {
  let previous

  after(async () => {
    if (previous) {
      await prisma.setting.update({ where: { key: 'mobile.cooperadora' }, data: { value: previous } })
    } else {
      await prisma.setting.deleteMany({ where: { key: 'mobile.cooperadora' } })
    }
  })

  test('el CBU público sale de mobile.cooperadora', async () => {
    const ctx = await startTestServer()
    try {
      const existing = await prisma.setting.findUnique({ where: { key: 'mobile.cooperadora' } })
      previous = existing?.value || null
      const value = JSON.stringify({
        banco: 'Banco de prueba',
        alias: 'alias.prueba',
        cbu: '0000000000000000000001',
        cuit: '30-00000000-0',
        monthlyAmount: 4500,
      })
      await prisma.setting.upsert({
        where: { key: 'mobile.cooperadora' },
        update: { value },
        create: { key: 'mobile.cooperadora', value, name: 'Cooperadora de la app' },
      })
      const web = await jsonRequest(ctx.base, '/api/mobile/cooperadora-publica')
      const contact = await jsonRequest(ctx.base, '/api/mobile/contacto-publico')
      assert.equal(web.status, 200)
      assert.equal(web.json.bank.cbu, '0000000000000000000001')
      assert.equal(web.json.bank.alias, 'alias.prueba')
      assert.equal(web.json.monthlyAmount, 4500)
      assert.equal(contact.status, 200)
      assert.equal(typeof contact.json.email, 'string')
      assert.equal(typeof contact.json.address, 'string')
    } finally {
      await ctx.close()
    }
  })
})
