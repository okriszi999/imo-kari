import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { DrawStore, participants } from './draw-store.ts'

describe('DrawStore', () => {
  it('assigns every participant a unique person other than themselves', () => {
    let store = new DrawStore(':memory:', participants, () => 0.42)

    try {
      let assignments = participants.map((participant) => {
        let assignment = store.findByEmail(participant.email)
        assert.ok(assignment)
        assert.notEqual(assignment.giverName, assignment.recipientName)
        return assignment
      })

      assert.equal(new Set(assignments.map(({ recipientName }) => recipientName)).size, 7)
    } finally {
      store.close()
    }
  })

  it('normalizes emails and returns the same saved assignment', () => {
    let store = new DrawStore(':memory:', participants, () => 0.75)

    try {
      let first = store.findByEmail('  JUCUS@EXAMPLE.COM ')
      let second = store.findByEmail('jucus@example.com')

      assert.deepEqual(first, second)
      assert.equal(store.findByEmail('stranger@example.com'), null)
    } finally {
      store.close()
    }
  })

  it('keeps assignments when the database is reopened', () => {
    let directory = mkdtempSync(join(tmpdir(), 'imochristmas-'))
    let databasePath = join(directory, 'draw.sqlite')

    try {
      let firstStore = new DrawStore(databasePath, participants, () => 0.1)
      let firstAssignment = firstStore.findByEmail(participants[0].email)
      firstStore.close()

      let reopenedStore = new DrawStore(databasePath, participants, () => 0.9)
      assert.deepEqual(reopenedStore.findByEmail(participants[0].email), firstAssignment)
      reopenedStore.close()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('preserves the draw when participant emails are updated manually', () => {
    let directory = mkdtempSync(join(tmpdir(), 'imochristmas-emails-'))
    let databasePath = join(directory, 'draw.sqlite')

    try {
      let firstStore = new DrawStore(databasePath, participants, () => 0.1)
      let original = firstStore.findByEmail(participants[0].email)
      assert.ok(original)
      firstStore.close()

      let updatedParticipants = participants.map((participant, index) => ({
        ...participant,
        email: `person-${index}@example.com`,
      }))
      let reopenedStore = new DrawStore(databasePath, updatedParticipants, () => 0.9)
      assert.equal(reopenedStore.findByEmail(participants[0].email), null)
      assert.deepEqual(reopenedStore.findByEmail(updatedParticipants[0].email), {
        ...original,
        recipientEmail: updatedParticipants.find(
          ({ name }) => name === original.recipientName,
        )?.email,
      })
      reopenedStore.close()
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('saves wishlist items and exposes them to the assigned giver', () => {
    let store = new DrawStore(':memory:', participants, () => 0.42)

    try {
      let giver = participants[0]
      let assignment = store.findByEmail(giver.email)
      assert.ok(assignment)
      let wishlist = [
        { name: 'A cosy blanket', url: '' },
        { name: 'A favourite book', url: 'https://example.com/book' },
      ]

      assert.equal(store.saveWishlist(assignment.recipientEmail, wishlist), true)
      assert.deepEqual(store.getPortal(giver.email)?.recipientWishlist, wishlist)
      assert.equal(store.saveWishlist('stranger@example.com', wishlist), false)
    } finally {
      store.close()
    }
  })

  it('creates one anonymous hint request and clears it when the wishlist is saved', () => {
    let store = new DrawStore(':memory:', participants, () => 0.42)

    try {
      let giver = participants[0]
      let assignment = store.findByEmail(giver.email)
      assert.ok(assignment)

      assert.equal(store.requestHint(giver.email)?.created, true)
      assert.equal(store.requestHint(giver.email)?.created, false)
      assert.equal(store.getPortal(assignment.recipientEmail)?.hasHintRequest, true)

      store.saveWishlist(assignment.recipientEmail, [])
      assert.equal(store.getPortal(assignment.recipientEmail)?.hasHintRequest, false)
    } finally {
      store.close()
    }
  })

  it('sets and verifies a four-digit PIN without storing it as plain text', () => {
    let store = new DrawStore(':memory:', participants, () => 0.42)
    try {
      let email = participants[0].email
      assert.equal(store.hasPin(email), false)
      assert.equal(store.setPin(email, '1234'), true)
      assert.equal(store.setPin(email, '5678'), false)
      assert.equal(store.hasPin(email), true)
      assert.equal(store.verifyPin(email, '0000'), 'invalid')
      assert.equal(store.verifyPin(email, '1234'), 'valid')
    } finally {
      store.close()
    }
  })

  it('locks PIN verification after five wrong attempts', () => {
    let store = new DrawStore(':memory:', participants, () => 0.42)
    try {
      let email = participants[0].email
      store.setPin(email, '1234')
      for (let attempt = 0; attempt < 4; attempt++) {
        assert.equal(store.verifyPin(email, '9999'), 'invalid')
      }
      assert.equal(store.verifyPin(email, '9999'), 'locked')
      assert.equal(store.verifyPin(email, '1234'), 'locked')
    } finally {
      store.close()
    }
  })
})
