import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export interface Participant {
  readonly email: string
  readonly name: string
}

export interface Assignment {
  readonly giverName: string
  readonly recipientName: string
  readonly recipientEmail: string
}

export interface WishlistItem {
  readonly name: string
  readonly url: string
}

export interface ParticipantPortal extends Assignment {
  readonly giverEmail: string
  readonly ownWishlist: readonly WishlistItem[]
  readonly recipientWishlist: readonly WishlistItem[]
  readonly hasHintRequest: boolean
  readonly hintRequested: boolean
}

export type PinVerification = 'valid' | 'invalid' | 'locked' | 'not-set'

export const participants = [
  { name: 'Jucus', email: 'vitusjudith1974@gmail.com' },
  { name: 'Dinka', email: 'denkrisztina18@gmail.com' },
  { name: 'Dzsubi', email: 'kozmak0813@gmail.com' },
  { name: 'Kicsi Dzsubi', email: 'kozmarebeka0813@gmail.com' },
  { name: 'Apko Valentina', email: 'valentinaapko@gmail.com' },
  { name: 'Mimo', email: 'imolaandriko@gmail.com' },
  { name: 'Viki', email: 'verviki73@gmail.com' },
] as const satisfies readonly Participant[]

export class DrawStore {
  readonly #database: DatabaseSync
  readonly #participants: readonly Participant[]

  constructor(
    databasePath: string,
    drawParticipants: readonly Participant[] = participants,
    random: () => number = Math.random,
  ) {
    if (drawParticipants.length < 2) {
      throw new Error('A mystery draw needs at least two participants')
    }

    let emails = new Set(drawParticipants.map(({ email }) => normalizeEmail(email)))
    if (emails.size !== drawParticipants.length) {
      throw new Error('Participant emails must be unique')
    }
    let names = new Set(drawParticipants.map(({ name }) => name))
    if (names.size !== drawParticipants.length) {
      throw new Error('Participant names must be unique')
    }

    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true })
    }

    this.#participants = drawParticipants.map(({ email, name }) => ({
      email: normalizeEmail(email),
      name,
    }))
    this.#database = new DatabaseSync(databasePath)
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS assignments (
        giver_email TEXT PRIMARY KEY,
        giver_name TEXT NOT NULL,
        recipient_name TEXT NOT NULL UNIQUE
      ) STRICT;
      CREATE TABLE IF NOT EXISTS wishlists (
        participant_email TEXT PRIMARY KEY,
        items_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS hint_requests (
        recipient_email TEXT PRIMARY KEY,
        requested_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS participant_pins (
        participant_email TEXT PRIMARY KEY,
        pin_hash TEXT NOT NULL,
        pin_salt TEXT NOT NULL,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER NOT NULL DEFAULT 0
      ) STRICT;
    `)

    this.#ensureAssignments(random)
  }

  findByEmail(email: string): Assignment | null {
    let normalizedEmail = normalizeEmail(email)
    let participant = this.#participants.find((candidate) => candidate.email === normalizedEmail)
    if (!participant) return null

    let row = this.#database
      .prepare(
        `SELECT giver_name AS giverName, recipient_name AS recipientName
         FROM assignments
         WHERE giver_email = ?`,
      )
      .get(normalizedEmail) as { giverName: string; recipientName: string } | undefined

    if (!row) return null

    let recipient = this.#participants.find(({ name }) => name === row.recipientName)
    if (!recipient) {
      throw new Error(`Unknown draw recipient: ${row.recipientName}`)
    }

    return { ...row, recipientEmail: recipient.email }
  }

  getPortal(email: string): ParticipantPortal | null {
    let giverEmail = normalizeEmail(email)
    let assignment = this.findByEmail(giverEmail)
    if (!assignment) return null

    return {
      giverEmail,
      ...assignment,
      ownWishlist: this.getWishlist(giverEmail),
      recipientWishlist: this.getWishlist(assignment.recipientEmail),
      hasHintRequest: this.#hasHintRequest(giverEmail),
      hintRequested: this.#hasHintRequest(assignment.recipientEmail),
    }
  }

  getWishlist(email: string): readonly WishlistItem[] {
    let row = this.#database
      .prepare('SELECT items_json AS itemsJson FROM wishlists WHERE participant_email = ?')
      .get(normalizeEmail(email)) as { itemsJson: string } | undefined

    if (!row) return []

    let value: unknown = JSON.parse(row.itemsJson)
    if (!Array.isArray(value)) return []

    return value.flatMap((item): WishlistItem[] => {
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

  saveWishlist(email: string, items: readonly WishlistItem[]): boolean {
    let participantEmail = normalizeEmail(email)
    if (!this.#participants.some((participant) => participant.email === participantEmail)) {
      return false
    }

    this.#database
      .prepare(
        `INSERT INTO wishlists (participant_email, items_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT (participant_email) DO UPDATE
         SET items_json = excluded.items_json, updated_at = excluded.updated_at`,
      )
      .run(participantEmail, JSON.stringify(items), Date.now())
    this.#database
      .prepare('DELETE FROM hint_requests WHERE recipient_email = ?')
      .run(participantEmail)
    return true
  }

  requestHint(giverEmail: string): {
    readonly recipientEmail: string
    readonly recipientName: string
    readonly created: boolean
    readonly requestedAt: number
  } | null {
    let assignment = this.findByEmail(giverEmail)
    if (!assignment) return null

    let requestedAt = Date.now()
    let result = this.#database
      .prepare(
        `INSERT INTO hint_requests (recipient_email, requested_at)
         VALUES (?, ?)
         ON CONFLICT (recipient_email) DO NOTHING`,
      )
      .run(assignment.recipientEmail, requestedAt)

    return {
      recipientEmail: assignment.recipientEmail,
      recipientName: assignment.recipientName,
      created: result.changes === 1,
      requestedAt,
    }
  }

  hasPin(email: string): boolean {
    return (
      this.#database
        .prepare('SELECT 1 FROM participant_pins WHERE participant_email = ?')
        .get(normalizeEmail(email)) !== undefined
    )
  }

  setPin(email: string, pin: string): boolean {
    let participantEmail = normalizeEmail(email)
    if (
      !/^\d{4}$/.test(pin) ||
      !this.#participants.some((participant) => participant.email === participantEmail) ||
      this.hasPin(participantEmail)
    ) {
      return false
    }

    let salt = randomBytes(16)
    let hash = scryptSync(pin, salt, 32)
    this.#database
      .prepare(
        `INSERT INTO participant_pins (participant_email, pin_hash, pin_salt)
         VALUES (?, ?, ?)`,
      )
      .run(participantEmail, hash.toString('hex'), salt.toString('hex'))
    return true
  }

  verifyPin(email: string, pin: string): PinVerification {
    let participantEmail = normalizeEmail(email)
    let row = this.#database
      .prepare(
        `SELECT pin_hash AS pinHash, pin_salt AS pinSalt,
                failed_attempts AS failedAttempts, locked_until AS lockedUntil
         FROM participant_pins WHERE participant_email = ?`,
      )
      .get(participantEmail) as
      | { pinHash: string; pinSalt: string; failedAttempts: number; lockedUntil: number }
      | undefined

    if (!row) return 'not-set'
    if (row.lockedUntil > Date.now()) return 'locked'

    let candidate = scryptSync(pin, Buffer.from(row.pinSalt, 'hex'), 32)
    let valid = timingSafeEqual(candidate, Buffer.from(row.pinHash, 'hex'))
    if (valid) {
      this.#database
        .prepare(
          'UPDATE participant_pins SET failed_attempts = 0, locked_until = 0 WHERE participant_email = ?',
        )
        .run(participantEmail)
      return 'valid'
    }

    let failedAttempts = row.failedAttempts + 1
    let lockedUntil = failedAttempts >= 5 ? Date.now() + 15 * 60_000 : 0
    this.#database
      .prepare(
        `UPDATE participant_pins SET failed_attempts = ?, locked_until = ?
         WHERE participant_email = ?`,
      )
      .run(failedAttempts >= 5 ? 0 : failedAttempts, lockedUntil, participantEmail)
    return lockedUntil ? 'locked' : 'invalid'
  }

  close(): void {
    this.#database.close()
  }

  #ensureAssignments(random: () => number): void {
    this.#database.exec('BEGIN IMMEDIATE')

    try {
      let row = this.#database.prepare('SELECT COUNT(*) AS count FROM assignments').get() as {
        count: number
      }

      if (row.count === 0) {
        let shuffled = shuffle(this.#participants, random)
        let insert = this.#database.prepare(
          `INSERT INTO assignments (giver_email, giver_name, recipient_name)
           VALUES (?, ?, ?)`,
        )

        for (let index = 0; index < shuffled.length; index++) {
          let giver = shuffled[index]
          let recipient = shuffled[(index + 1) % shuffled.length]
          insert.run(giver.email, giver.name, recipient.name)
        }
      } else if (row.count !== this.#participants.length) {
        throw new Error(
          `The draw database contains ${row.count} of ${this.#participants.length} assignments`,
        )
      } else {
        let savedNames = this.#database
          .prepare('SELECT giver_name AS name FROM assignments')
          .all() as { name: string }[]
        if (
          savedNames.some(({ name }) => !this.#participants.some((person) => person.name === name))
        ) {
          throw new Error('Participant names changed after the draw was created')
        }

        let setEmail = this.#database.prepare(
          'UPDATE assignments SET giver_email = ? WHERE giver_name = ?',
        )
        for (let [index, participant] of this.#participants.entries()) {
          setEmail.run(`pending-email-${index}`, participant.name)
        }
        for (let participant of this.#participants) {
          setEmail.run(participant.email, participant.name)
        }
      }

      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
  }

  #hasHintRequest(email: string): boolean {
    let row = this.#database
      .prepare('SELECT 1 FROM hint_requests WHERE recipient_email = ?')
      .get(normalizeEmail(email))
    return row !== undefined  }
}

let appStore: DrawStore | undefined

export function getDrawStore(): DrawStore {
  appStore ??= new DrawStore(process.env.DATABASE_PATH ?? 'db/imochristmas.sqlite')
  return appStore
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  let shuffled = [...values]

  for (let index = shuffled.length - 1; index > 0; index--) {
    let swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}
