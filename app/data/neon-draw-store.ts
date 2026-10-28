import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

import {
  normalizeEmail,
  participants,
  type Assignment,
  type Participant,
  type ParticipantPortal,
  type PinVerification,
  type WishlistItem,
} from './draw-store.ts'

interface HintRequest {
  readonly recipientEmail: string
  readonly recipientName: string
  readonly created: boolean
  readonly requestedAt: number
}

export class NeonDrawStore {
  readonly #participants: readonly Participant[]
  readonly #sql: NeonQueryFunction<false, false>
  readonly #ready: Promise<void>

  constructor(
    databaseUrl: string,
    drawParticipants: readonly Participant[] = participants,
    random: () => number = Math.random,
  ) {
    this.#participants = drawParticipants.map(({ email, name }) => ({
      email: normalizeEmail(email),
      name,
    }))
    this.#sql = neon(databaseUrl)
    this.#ready = this.#initialize(random)
  }

  async findByEmail(email: string): Promise<Assignment | null> {
    await this.#ready
    let giverEmail = normalizeEmail(email)
    let rows = await this.#sql`
      SELECT giver_name, recipient_name
      FROM assignments
      WHERE giver_email = ${giverEmail}
    `
    let row = rows[0] as { giver_name: string; recipient_name: string } | undefined
    if (!row) return null

    let recipient = this.#participants.find(({ name }) => name === row.recipient_name)
    if (!recipient) throw new Error(`Unknown draw recipient: ${row.recipient_name}`)

    return {
      giverName: row.giver_name,
      recipientName: row.recipient_name,
      recipientEmail: recipient.email,
    }
  }

  async getPortal(email: string): Promise<ParticipantPortal | null> {
    let giverEmail = normalizeEmail(email)
    let assignment = await this.findByEmail(giverEmail)
    if (!assignment) return null

    let [ownWishlist, recipientWishlist, hasHintRequest, hintRequested] = await Promise.all([
      this.getWishlist(giverEmail),
      this.getWishlist(assignment.recipientEmail),
      this.#hasHintRequest(giverEmail),
      this.#hasHintRequest(assignment.recipientEmail),
    ])

    return {
      giverEmail,
      ...assignment,
      ownWishlist,
      recipientWishlist,
      hasHintRequest,
      hintRequested,
    }
  }

  async getWishlist(email: string): Promise<readonly WishlistItem[]> {
    await this.#ready
    let rows = await this.#sql`
      SELECT items_json
      FROM wishlists
      WHERE participant_email = ${normalizeEmail(email)}
    `
    let row = rows[0] as { items_json: unknown } | undefined
    if (!row || !Array.isArray(row.items_json)) return []

    return row.items_json.flatMap((item): WishlistItem[] => {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof Reflect.get(item, 'name') === 'string' &&
        typeof Reflect.get(item, 'url') === 'string'
      ) {
        return [{ name: Reflect.get(item, 'name'), url: Reflect.get(item, 'url') }]
      }
      return []
    })
  }

  async saveWishlist(email: string, items: readonly WishlistItem[]): Promise<boolean> {
    await this.#ready
    let participantEmail = normalizeEmail(email)
    if (!this.#isParticipant(participantEmail)) return false

    await this.#sql.transaction([
      this.#sql`
        INSERT INTO wishlists (participant_email, items_json, updated_at)
        VALUES (${participantEmail}, ${JSON.stringify(items)}::jsonb, ${Date.now()})
        ON CONFLICT (participant_email) DO UPDATE
        SET items_json = excluded.items_json, updated_at = excluded.updated_at
      `,
      this.#sql`
        DELETE FROM hint_requests
        WHERE recipient_email = ${participantEmail}
      `,
    ])
    return true
  }

  async requestHint(giverEmail: string): Promise<HintRequest | null> {
    let assignment = await this.findByEmail(giverEmail)
    if (!assignment) return null

    let requestedAt = Date.now()
    let rows = await this.#sql`
      INSERT INTO hint_requests (recipient_email, requested_at)
      VALUES (${assignment.recipientEmail}, ${requestedAt})
      ON CONFLICT (recipient_email) DO NOTHING
      RETURNING recipient_email
    `

    return {
      recipientEmail: assignment.recipientEmail,
      recipientName: assignment.recipientName,
      created: rows.length === 1,
      requestedAt,
    }
  }

  async hasPin(email: string): Promise<boolean> {
    await this.#ready
    let rows = await this.#sql`
      SELECT 1
      FROM participant_pins
      WHERE participant_email = ${normalizeEmail(email)}
    `
    return rows.length > 0
  }

  async setPin(email: string, pin: string): Promise<boolean> {
    await this.#ready
    let participantEmail = normalizeEmail(email)
    if (!/^\d{4}$/.test(pin) || !this.#isParticipant(participantEmail)) return false

    let salt = randomBytes(16)
    let hash = scryptSync(pin, salt, 32)
    let rows = await this.#sql`
      INSERT INTO participant_pins (participant_email, pin_hash, pin_salt)
      VALUES (${participantEmail}, ${hash.toString('hex')}, ${salt.toString('hex')})
      ON CONFLICT (participant_email) DO NOTHING
      RETURNING participant_email
    `
    return rows.length === 1
  }

  async verifyPin(email: string, pin: string): Promise<PinVerification> {
    await this.#ready
    let participantEmail = normalizeEmail(email)
    let rows = await this.#sql`
      SELECT pin_hash, pin_salt, failed_attempts, locked_until
      FROM participant_pins
      WHERE participant_email = ${participantEmail}
    `
    let row = rows[0] as
      | {
          pin_hash: string
          pin_salt: string
          failed_attempts: number
          locked_until: number
        }
      | undefined

    if (!row) return 'not-set'
    if (Number(row.locked_until) > Date.now()) return 'locked'

    let candidate = scryptSync(pin, Buffer.from(row.pin_salt, 'hex'), 32)
    let valid = timingSafeEqual(candidate, Buffer.from(row.pin_hash, 'hex'))
    if (valid) {
      await this.#sql`
        UPDATE participant_pins
        SET failed_attempts = 0, locked_until = 0
        WHERE participant_email = ${participantEmail}
      `
      return 'valid'
    }

    let lockUntil = Date.now() + 15 * 60_000
    let updates = await this.#sql`
      UPDATE participant_pins
      SET
        failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END,
        locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN ${lockUntil} ELSE 0 END
      WHERE participant_email = ${participantEmail}
      RETURNING locked_until
    `
    let update = updates[0] as { locked_until: number } | undefined
    return update && Number(update.locked_until) > 0 ? 'locked' : 'invalid'
  }

  async #initialize(random: () => number): Promise<void> {
    await this.#sql.transaction([
      this.#sql`
        CREATE TABLE IF NOT EXISTS assignments (
          giver_email TEXT PRIMARY KEY,
          giver_name TEXT NOT NULL UNIQUE,
          recipient_name TEXT NOT NULL UNIQUE
        )
      `,
      this.#sql`
        CREATE TABLE IF NOT EXISTS wishlists (
          participant_email TEXT PRIMARY KEY,
          items_json JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        )
      `,
      this.#sql`
        CREATE TABLE IF NOT EXISTS hint_requests (
          recipient_email TEXT PRIMARY KEY,
          requested_at BIGINT NOT NULL
        )
      `,
      this.#sql`
        CREATE TABLE IF NOT EXISTS participant_pins (
          participant_email TEXT PRIMARY KEY,
          pin_hash TEXT NOT NULL,
          pin_salt TEXT NOT NULL,
          failed_attempts INTEGER NOT NULL DEFAULT 0,
          locked_until BIGINT NOT NULL DEFAULT 0
        )
      `,
    ])

    let rows = await this.#sql`SELECT giver_name FROM assignments`
    if (rows.length === 0) {
      let shuffled = shuffle(this.#participants, random)
      await this.#sql.transaction(
        shuffled.map((giver, index) => {
          let recipient = shuffled[(index + 1) % shuffled.length]
          return this.#sql`
            INSERT INTO assignments (giver_email, giver_name, recipient_name)
            VALUES (${giver.email}, ${giver.name}, ${recipient.name})
            ON CONFLICT DO NOTHING
          `
        }),
      )
      return
    }

    if (rows.length !== this.#participants.length) {
      throw new Error(
        `The draw database contains ${rows.length} of ${this.#participants.length} assignments`,
      )
    }

    let savedNames = rows.map((row) => (row as { giver_name: string }).giver_name)
    if (savedNames.some((name) => !this.#participants.some((person) => person.name === name))) {
      throw new Error('Participant names changed after the draw was created')
    }

    await this.#sql.transaction([
      ...this.#participants.map(
        (participant, index) =>
          this.#sql`
            UPDATE assignments
            SET giver_email = ${`pending-email-${index}`}
            WHERE giver_name = ${participant.name}
          `,
      ),
      ...this.#participants.map(
        (participant) =>
          this.#sql`
            UPDATE assignments
            SET giver_email = ${participant.email}
            WHERE giver_name = ${participant.name}
          `,
      ),
    ])
  }

  async #hasHintRequest(email: string): Promise<boolean> {
    await this.#ready
    let rows = await this.#sql`
      SELECT 1
      FROM hint_requests
      WHERE recipient_email = ${normalizeEmail(email)}
    `
    return rows.length > 0
  }

  #isParticipant(email: string): boolean {
    return this.#participants.some((participant) => participant.email === email)
  }
}

let appStore: NeonDrawStore | undefined

export function getNeonDrawStore(): NeonDrawStore {
  let databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL must be configured for Neon')
  appStore ??= new NeonDrawStore(databaseUrl)
  return appStore
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  let shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index--) {
    let swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}
