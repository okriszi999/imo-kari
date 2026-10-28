import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import {
  getDrawStore,
  type ParticipantPortal,
  type PinVerification,
  type WishlistItem,
} from '../data/draw-store.ts'
import { getNeonDrawStore } from '../data/neon-draw-store.ts'
import { routes } from '../routes.ts'
import { createLoginCookie, readLoginEmail } from '../session.ts'
import { HomePage } from './home-page.tsx'

type Awaitable<T> = T | Promise<T>

export interface RootControllerServices {
  readonly findPortal?: (email: string) => Awaitable<ParticipantPortal | null>
  readonly saveWishlist?: (
    email: string,
    items: readonly WishlistItem[],
  ) => Awaitable<boolean>
  readonly requestHint?: (email: string) => Awaitable<{
      readonly recipientEmail: string
      readonly recipientName: string
      readonly created: boolean
      readonly requestedAt: number
    } | null>
  readonly hasPin?: (email: string) => Awaitable<boolean>
  readonly verifyPin?: (email: string, pin: string) => Awaitable<PinVerification>
  readonly setPin?: (email: string, pin: string) => Awaitable<boolean>
}

export function createRootController(services: RootControllerServices = {}) {
  let findPortal = services.findPortal ?? ((email: string) => getRuntimeStore().getPortal(email))
  let saveWishlist =
    services.saveWishlist ??
    ((email: string, items: readonly WishlistItem[]) =>
      getRuntimeStore().saveWishlist(email, items))
  let requestHint =
    services.requestHint ?? ((email: string) => getRuntimeStore().requestHint(email))
  let hasPin = services.hasPin ?? ((email: string) => getRuntimeStore().hasPin(email))
  let verifyPin =
    services.verifyPin ?? ((email: string, pin: string) => getRuntimeStore().verifyPin(email, pin))
  let setPin =
    services.setPin ?? ((email: string, pin: string) => getRuntimeStore().setPin(email, pin))

  return createController(routes, {
    actions: {
      async assets(context) {
        return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      },
      async home(context) {
        let email = await readLoginEmail(context.request)
        let portal = email && (await hasPin(email)) ? await findPortal(email) : null
        if (portal) {
          return context.render(
            <HomePage
              state={{
                kind: 'assigned',
                ...portal,
                countdownDate: readCountdownDate(),
                needsPinSetup: false,
                skipIntro: true,
              }}
            />,
          )
        }
        return context.render(<HomePage />)
      },
      async draw(context) {
        let value = context.formData.get('email')
        let email = typeof value === 'string' ? value.trim() : ''
        let portal = email ? await findPortal(email) : null

        if (!portal) {
          return context.render(<HomePage state={{ kind: 'denied', email }} />, { status: 403 })
        }

        let pinRequired = await hasPin(email)
        if (pinRequired) {
          let pin = readString(context.formData, 'pin')
          let result = pin ? await verifyPin(email, pin) : 'invalid'
          if (result !== 'valid') {
            return context.render(
              <HomePage
                state={{
                  kind: 'pin-required',
                  email,
                  error: pin ? (result === 'locked' ? 'locked' : 'invalid') : undefined,
                }}
              />,
              { status: pin ? 403 : 200 },
            )
          }
        }

        return context.render(
          <HomePage
            state={{
              kind: 'assigned',
              ...portal,
              countdownDate: readCountdownDate(),
              needsPinSetup: !pinRequired,
              skipIntro: pinRequired,
            }}
          />,
          pinRequired
            ? { headers: { 'Set-Cookie': await createLoginCookie(portal.giverEmail) } }
            : undefined,
        )
      },
      async setPin(context) {
        let email = readString(context.formData, 'email')
        let pin = readString(context.formData, 'pin')
        if (!email || !(await setPin(email, pin))) {
          return Response.json({ ok: false }, { status: 400 })
        }
        return Response.json(
          { ok: true },
          { headers: { 'Set-Cookie': await createLoginCookie(email) } },
        )
      },
      async wishlist(context) {
        let email = readString(context.formData, 'email')
        let items = parseWishlist(readString(context.formData, 'items'))
        if (!email || !items || !(await saveWishlist(email, items))) {
          return Response.json({ ok: false }, { status: 400 })
        }
        return Response.json({ ok: true, items })
      },
      async hintRequest(context) {
        let email = readString(context.formData, 'email')
        let request = email ? await requestHint(email) : null
        if (!request) return Response.json({ ok: false }, { status: 403 })

        return Response.json({ ok: true, created: request.created })
      },
    },
  })
}

export default createRootController()

function getRuntimeStore() {
  return process.env.DATABASE_URL ? getNeonDrawStore() : getDrawStore()
}

function readString(formData: FormData, key: string): string {
  let value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function parseWishlist(value: string): readonly WishlistItem[] | null {
  try {
    let parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.length > 10) return null

    let items: WishlistItem[] = []
    for (let item of parsed) {
      if (typeof item !== 'object' || item === null) return null
      let name = Reflect.get(item, 'name')
      let url = Reflect.get(item, 'url')
      if (typeof name !== 'string' || typeof url !== 'string') return null

      name = name.trim()
      url = url.trim()
      if (!name || name.length > 120 || url.length > 500 || !isOptionalWebUrl(url)) return null
      items.push({ name, url })
    }
    return items
  } catch {
    return null
  }
}

function isOptionalWebUrl(value: string): boolean {
  if (!value) return true
  try {
    let url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function readCountdownDate(): string {
  return process.env.CHRISTMAS_DRAW_DATE?.trim() || `${new Date().getFullYear()}-12-20`
}
