import { createHash } from 'node:crypto'

interface AssignmentEmail {
  readonly email: string
  readonly giverName: string
  readonly recipientName: string
}

interface HintNudgeEmail {
  readonly email: string
  readonly recipientName: string
  readonly requestedAt: number
}

export async function sendAssignmentEmail({
  email,
  giverName,
  recipientName,
}: AssignmentEmail): Promise<void> {
  await sendEmail(
    {
      to: email,
      subject: `${giverName}, felfedtük a karácsonyi titkodat!`,
      text: [
        `Kedves ${giverName}!`,
        '',
        `A karácsonyi titkod: ${recipientName}!`,
        '',
        'Tartsd titokban! Válassz valami szívhez szólót, és csomagold szeretettel.',
        '',
        'Boldog karácsonyt!',
      ].join('\n'),
      html: assignmentEmailHtml(giverName, recipientName),
    },
    assignmentEmailKey(email, recipientName),
  )
}

export async function sendHintNudgeEmail({
  email,
  recipientName,
  requestedAt,
}: HintNudgeEmail): Promise<void> {
  let safeName = escapeHtml(recipientName)

  await sendEmail(
    {
      to: email,
      subject: 'A titkos ajándékozód örülne egy kis ötletnek',
      text: [
        `Kedves ${recipientName}!`,
        '',
        'A titkos ajándékozód örülne egy kis inspirációnak.',
        'Látogass vissza a Karácsonyi Rejtélyhez, és írj valamit a kívánságlistádra — vagy hagyd üresen, ha szereted a meglepetéseket.',
        '',
        'A kérés természetesen névtelen.',
      ].join('\n'),
      html: `
        <div style="margin:0;padding:36px 16px;background:#173f35;font-family:Arial,sans-serif;color:#24372f">
          <div style="max-width:560px;margin:auto;padding:42px 32px;text-align:center;background:#fff8e8;border:2px solid #d4a84f;border-radius:18px">
            <p style="margin:0 0 10px;color:#8f2f3a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">
              Egy apró névtelen emlékeztető
            </p>
            <h1 style="margin:0 0 22px;color:#173f35;font-family:Georgia,serif;font-size:34px">
              Kedves ${safeName}&hellip;
            </h1>
            <p style="margin:0 auto;max-width:420px;color:#5d6a64;font-size:15px;line-height:1.7">
              A titkos ajándékozód örülne egy kis inspirációnak. Látogass vissza, és írj valamit a kívánságlistádra — vagy maradj titokzatos.
            </p>
          </div>
        </div>
      `.trim(),
    },
    `christmas-hint-${createHash('sha256').update(`${email}:${requestedAt}`).digest('hex')}`,
  )
}

function assignmentEmailKey(email: string, recipientName: string): string {
  let assignment = `${email.trim().toLowerCase()}:${recipientName}`
  return `christmas-draw-${createHash('sha256').update(assignment).digest('hex')}`
}

async function sendEmail(
  message: {
    readonly to: string
    readonly subject: string
    readonly text: string
    readonly html: string
  },
  idempotencyKey: string,
): Promise<void> {
  let apiKey = process.env.RESEND_API_KEY
  let from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be configured')
  }

  let { to, ...content } = message
  let response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from, to: [to], ...content }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    let detail = await response.text()
    throw new Error(`Resend rejected the email (${response.status}): ${detail}`)
  }
}

function assignmentEmailHtml(giverName: string, recipientName: string): string {
  let safeGiverName = escapeHtml(giverName)
  let safeRecipientName = escapeHtml(recipientName)

  return `
    <div style="margin:0;padding:36px 16px;background:#173f35;font-family:Arial,sans-serif;color:#24372f">
      <div style="max-width:560px;margin:auto;padding:42px 32px;text-align:center;background:#fff8e8;border:2px solid #d4a84f;border-radius:18px">
        <p style="margin:0 0 10px;color:#8f2f3a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">
          Egy apró karácsonyi titok
        </p>
        <h1 style="margin:0 0 26px;color:#173f35;font-family:Georgia,serif;font-size:38px">
          A Karácsonyi Rejtély
        </h1>
        <p style="margin:0 0 18px;font-family:Georgia,serif;font-size:20px">
          Kedves ${safeGiverName}, a te titkod&hellip;
        </p>
        <div style="padding:24px 16px;border:1px solid #d4a84f;border-radius:10px;background:#fff">
          <strong style="color:#8f2f3a;font-family:Georgia,serif;font-size:42px">
            ${safeRecipientName}
          </strong>
        </div>
        <p style="margin:24px auto 0;max-width:420px;color:#5d6a64;font-size:14px;line-height:1.6">
          Tartsd titokban! Válassz valami szívhez szólót, csomagold szeretettel, és kezdődhet a találgatás.
        </p>
      </div>
    </div>
  `.trim()
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  )
}
