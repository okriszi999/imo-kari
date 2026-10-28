import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createAppRouter } from '../router.ts'
import { routes } from '../routes.ts'

let savedWishlist: readonly { readonly name: string; readonly url: string }[] = []

const portal = {
  giverEmail: 'jucus@example.com',
  giverName: 'Jucus',
  recipientName: 'Mimo',
  recipientEmail: 'mimo@example.com',
  ownWishlist: [],
  recipientWishlist: [],
  hasHintRequest: false,
  hintRequested: false,
} as const

const router = createAppRouter({
  hasPin: () => false,
  findPortal(email) {
    return email.toLowerCase() === portal.giverEmail ? portal : null
  },
  saveWishlist(_email, items) {
    savedWishlist = items
    return true
  },
  requestHint() {
    return {
      recipientEmail: portal.recipientEmail,
      recipientName: portal.recipientName,
      created: true,
      requestedAt: 123,
    }
  },
  setPin: () => true,
})

describe('root controller', () => {
  it('GET / returns the home page', async () => {
    let response = await router.fetch(new URL(routes.home.href(), 'http://localhost'))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    assert.match(await response.text(), /Karácsonyi/)
  })

  it('denies an email that is not on the guest list', async () => {
    let formData = new FormData()
    formData.set('email', 'stranger@example.com')

    let response = await router.fetch(
      new Request(new URL(routes.draw.href(), 'http://localhost'), {
        method: 'POST',
        body: formData,
      }),
    )
    let html = await response.text()

    assert.equal(response.status, 403)
    assert.match(html, /nincs a vendéglistán/)
    assert.match(html, /stranger@example\.com/)
  })

  it('loads the private reveal experience', async () => {
    let formData = new FormData()
    formData.set('email', 'JUCUS@example.com')

    let response = await router.fetch(
      new Request(new URL(routes.draw.href(), 'http://localhost'), {
        method: 'POST',
        body: formData,
      }),
    )
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.match(html, /Jucus/)
    assert.match(html, /Mimo/)
    assert.match(html, /christmas-experience/)
  })

  it('requires and verifies the PIN on repeat visits', async () => {
    let pinRouter = createAppRouter({
      findPortal: () => portal,
      hasPin: () => true,
      verifyPin: (_email, pin) => (pin === '1234' ? 'valid' : 'invalid'),
    })
    let missingPin = new FormData()
    missingPin.set('email', portal.giverEmail)
    let prompt = await pinRouter.fetch(
      new Request(new URL(routes.draw.href(), 'http://localhost'), {
        method: 'POST',
        body: missingPin,
      }),
    )
    assert.match(await prompt.text(), /Négyjegyű PIN-kód/)

    let validPin = new FormData()
    validPin.set('email', portal.giverEmail)
    validPin.set('pin', '1234')
    let response = await pinRouter.fetch(
      new Request(new URL(routes.draw.href(), 'http://localhost'), {
        method: 'POST',
        body: validPin,
      }),
    )
    assert.equal(response.status, 200)
    let cookie = response.headers.get('Set-Cookie')
    assert.ok(cookie)
    assert.match(await response.text(), /christmas-experience/)

    let remembered = await pinRouter.fetch(
      new Request(new URL(routes.home.href(), 'http://localhost'), {
        headers: { Cookie: cookie.split(';')[0] },
      }),
    )
    let rememberedHtml = await remembered.text()
    assert.match(rememberedHtml, /"skipIntro":true/)
    assert.match(rememberedHtml, /Mimo/)
  })

  it('sets a four-digit PIN after the first reveal', async () => {
    let formData = new FormData()
    formData.set('email', portal.giverEmail)
    formData.set('pin', '1234')
    let response = await router.fetch(
      new Request(new URL(routes.setPin.href(), 'http://localhost'), {
        method: 'POST',
        body: formData,
      }),
    )
    assert.equal(response.status, 200)
  })

  it('saves a validated wishlist', async () => {
    savedWishlist = []
    let formData = new FormData()
    formData.set('email', portal.giverEmail)
    formData.set('items', JSON.stringify([{ name: 'Cosy blanket', url: '' }]))

    let response = await router.fetch(
      new Request(new URL(routes.wishlist.href(), 'http://localhost'), {
        method: 'POST',
        body: formData,
      }),
    )

    assert.equal(response.status, 200)
    assert.deepEqual(savedWishlist, [{ name: 'Cosy blanket', url: '' }])
  })

  it('rejects unsafe wishlist links', async () => {
    let formData = new FormData()
    formData.set('email', portal.giverEmail)
    formData.set('items', JSON.stringify([{ name: 'Surprise', url: 'javascript:alert(1)' }]))

    let response = await router.fetch(
      new Request(new URL(routes.wishlist.href(), 'http://localhost'), {
        method: 'POST',
        body: formData,
      }),
    )

    assert.equal(response.status, 400)
  })

  it('records an anonymous hint nudge', async () => {
    let formData = new FormData()
    formData.set('email', portal.giverEmail)

    let response = await router.fetch(
      new Request(new URL(routes.hintRequest.href(), 'http://localhost'), {
        method: 'POST',
        body: formData,
      }),
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, created: true })
  })
})
