import { clientEntry, css, on, type Handle } from 'remix/component'

import type { WishlistItem } from '../../data/draw-store.ts'
import { PinInput } from './pin-input.tsx'
import { RevealNameCard } from './reveal-name-card.tsx'

interface ChristmasExperienceProps {
  readonly giverEmail: string
  readonly giverName: string
  readonly recipientName: string
  readonly ownWishlist: readonly WishlistItem[]
  readonly recipientWishlist: readonly WishlistItem[]
  readonly hasHintRequest: boolean
  readonly hintRequested: boolean
  readonly countdownDate: string
  readonly revealEmailHref: string
  readonly wishlistHref: string
  readonly hintRequestHref: string
  readonly needsPinSetup: boolean
  readonly setPinHref: string
  readonly skipIntro: boolean
}

type Phase = 'story' | 'opening' | 'revealed' | 'hidden'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export const ChristmasExperience = clientEntry(
  import.meta.url,
  function ChristmasExperience(handle: Handle<ChristmasExperienceProps>) {
    let story = createPersonalStory(handle.props.giverName, 0)
    let visibleCharacters = 0
    let storyDone = false
    let phase: Phase = handle.props.skipIntro ? 'revealed' : 'story'
    let wishlist = handle.props.ownWishlist.map((item) => ({ ...item }))
    let saveStatus: SaveStatus = 'idle'
    let hasHintRequest = handle.props.hasHintRequest
    let hintRequested = handle.props.hintRequested
    let hintStatus = ''
    let emailStatus = ''
    let needsPinSetup = handle.props.needsPinSetup
    let pinStatus = ''
    let audioContext: AudioContext | undefined
    let typingTimer: number | undefined
    let openingTimer: number | undefined

    function startStory(): void {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        visibleCharacters = story.length
        storyDone = true
        void handle.update()
        return
      }

      let typeNextCharacter = () => {
        visibleCharacters++
        storyDone = visibleCharacters >= story.length
        void handle.update()
        if (!storyDone) {
          let character = story[visibleCharacters - 1]
          let delay = character === '\n' ? 420 : /[.!?…]/.test(character) ? 520 : 38
          typingTimer = window.setTimeout(typeNextCharacter, delay)
        }
      }
      typingTimer = window.setTimeout(typeNextCharacter, 500)
    }

    async function openMystery(sendEmail: boolean): Promise<void> {
      phase = 'opening'
      playRevealChime()
      await handle.update()
      if (sendEmail) void emailAssignment()
      openingTimer = window.setTimeout(() => {
        phase = 'revealed'
        void handle.update()
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1050)
    }

    async function emailAssignment(): Promise<void> {
      let formData = new FormData()
      formData.set('email', handle.props.giverEmail)
      try {
        let response = await fetch(handle.props.revealEmailHref, { method: 'POST', body: formData })
        emailStatus = response.ok
          ? 'A titkot elküldtük az e-mail-címedre is.'
          : 'A név megjelent, de az e-mailt nem sikerült elküldeni.'
      } catch {
        emailStatus = 'A név megjelent, de az e-mailt nem sikerült elküldeni.'
      }
      void handle.update()
    }

    function playRevealChime(): void {
      audioContext ??= new AudioContext()
      void audioContext.resume().then(() => {
        scheduleRevealChime(audioContext!)
        if (getCountdown(handle.props.countdownDate, Date.now()).totalDays <= 3) {
          scheduleSleighBells(audioContext!)
        }
      })
    }

    function readWishlist(source: HTMLElement): { name: string; url: string }[] {
      let section = source.closest('section')
      if (!section) return wishlist

      return [...section.querySelectorAll<HTMLElement>('[data-wish-row]')].map((row) => ({
        name: row.querySelector<HTMLInputElement>('[data-wish-name]')?.value ?? '',
        url: row.querySelector<HTMLInputElement>('[data-wish-url]')?.value ?? '',
      }))
    }

    handle.queueTask(() => {
      if (typeof window === 'undefined') return
      let storyVisit = Number.parseInt(
        window.sessionStorage.getItem('christmas-story-visit') ?? '0',
        10,
      )
      story = createPersonalStory(handle.props.giverName, storyVisit)
      window.sessionStorage.setItem('christmas-story-visit', String(storyVisit + 1))
      if (phase === 'story') startStory()
    })

    handle.signal.addEventListener(
      'abort',
      () => {
        if (typingTimer !== undefined) window.clearTimeout(typingTimer)
        if (openingTimer !== undefined) window.clearTimeout(openingTimer)
        if (audioContext) void audioContext.close()
      },
      { once: true },
    )

    return () => {
      if (phase === 'story') {
        return (
          <section mix={storyScreenStyle} aria-label="A karácsonyi történeted">
            <div aria-hidden="true" mix={auroraStyle} />
            <p aria-live="polite" mix={storyStyle}>
              {story.slice(0, visibleCharacters)}
              {!storyDone && <span aria-hidden="true" mix={cursorStyle} />}
            </p>
            {storyDone && (
              <button
                type="button"
                mix={[
                  glowingButtonStyle,
                  on<HTMLButtonElement, 'click'>('click', () => openMystery(true)),
                ]}
              >
                <span aria-hidden="true">✦</span>
                Felfedem a karácsonyi titkomat
                <span aria-hidden="true">✦</span>
              </button>
            )}
          </section>
        )
      }

      if (phase === 'opening' || phase === 'hidden') {
        return (
          <section mix={envelopeScreenStyle} aria-label="Lepecsételt karácsonyi rejtély">
            <button
              type="button"
              aria-label={phase === 'hidden' ? 'A titkos név újbóli felfedése' : undefined}
              disabled={phase === 'opening'}
              mix={[
                envelopeButtonStyle,
                phase === 'opening' && openingEnvelopeStyle,
                on<HTMLButtonElement, 'click'>('click', () => {
                  if (phase === 'hidden') void openMystery(false)
                }),
              ]}
            >
              <span aria-hidden="true" mix={envelopeFlapStyle} />
              <span aria-hidden="true" mix={waxSealStyle}>❦</span>
            </button>
            <p mix={envelopeCopyStyle}>
              {phase === 'opening' ? 'A pecsét feltörik…' : 'A titkod újra biztonságban van.'}
            </p>
          </section>
        )
      }

      let finalDays = getCountdown(handle.props.countdownDate, Date.now()).totalDays <= 3

      return (
        <main mix={portalStyle}>
          {finalDays && (
            <div aria-hidden="true" mix={closeMagicStyle}>
              {Array.from({ length: 16 }, (_, index) => (
                <span key={index} style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 8) * 0.22}s` }}>
                  {index % 3 === 0 ? '✦' : '❄'}
                </span>
              ))}
            </div>
          )}
          <div className="christmas-print-card" mix={revealPanelStyle}>
            <p mix={revealEyebrowStyle}>Kedves {handle.props.giverName}, a te titkod…</p>
            <RevealNameCard recipientName={handle.props.recipientName} />
            <p mix={revealCopyStyle}>
              Tartsd titokban! Válassz valami szívhez szólót, csomagold szeretettel, és kezdődhet a
              találgatás.
            </p>
            {emailStatus && <p role="status" mix={statusTextStyle}>{emailStatus}</p>}
            <div className="christmas-print-hide" mix={actionRowStyle}>
              <button
                type="button"
                mix={[
                  quietButtonStyle,
                  on<HTMLButtonElement, 'click'>('click', () => {
                    phase = 'hidden'
                    void handle.update()
                  }),
                ]}
              >
                Titok elrejtése
              </button>
              <button
                type="button"
                mix={[
                  quietButtonStyle,
                  on<HTMLButtonElement, 'click'>('click', () => window.print()),
                ]}
              >
                Emléklap nyomtatása
              </button>
            </div>
          </div>

          {needsPinSetup && (
            <section mix={pinSetupBackdropStyle}>
              <div role="dialog" aria-modal="true" aria-labelledby="setup-pin-title" mix={pinSetupModalStyle}>
                <p mix={sectionLabelStyle}>Még nincs PIN-kódod</p>
                <h2 id="setup-pin-title" mix={sectionTitleStyle}>
                  A folytatáshoz állíts be egy négyjegyű PIN-kódot
                </h2>
                <p mix={emptyStyle}>
                  Ez az első belépésed, ezért most kötelező PIN-kódot választanod. Ezentúl csak
                  ezzel lehet belépni az e-mail-címeddel. Jegyezd meg jól, mert csak a szervező
                  tudja kézzel törölni.
                </p>
                <PinInput name="pin" label="Válassz négy számjegyet" />
                <button
                  type="button"
                  mix={[
                    saveButtonStyle,
                    css({ width: '100%', marginTop: '25px' }),
                    on<HTMLButtonElement, 'click'>('click', async (event) => {
                      let pin =
                        event.currentTarget
                          .closest('[role="dialog"]')
                          ?.querySelector<HTMLInputElement>('input[name="pin"]')?.value ?? ''
                      if (!/^\d{4}$/.test(pin)) {
                        pinStatus = 'Add meg mind a négy számjegyet.'
                        await handle.update()
                        return
                      }
                      let formData = new FormData()
                      formData.set('email', handle.props.giverEmail)
                      formData.set('pin', pin)
                      let response = await fetch(handle.props.setPinHref, {
                        method: 'POST',
                        body: formData,
                      })
                      if (response.ok) {
                        needsPinSetup = false
                        pinStatus = ''
                      } else {
                        pinStatus = 'A PIN-kódot nem sikerült elmenteni.'
                      }
                      await handle.update()
                    }),
                  ]}
                >
                  PIN mentése
                </button>
                {pinStatus && <p role="alert" mix={errorTextStyle}>{pinStatus}</p>}
              </div>
            </section>
          )}

          {!needsPinSetup && (
            <>
          <Countdown date={handle.props.countdownDate} />

          <section mix={portalSectionStyle}>
            <p mix={sectionLabelStyle}>{handle.props.recipientName} kívánságlistája</p>
            {handle.props.recipientWishlist.length > 0 ? (
              <ul mix={wishListStyle}>
                {handle.props.recipientWishlist.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.name} <span aria-hidden="true">↗</span>
                      </a>
                    ) : item.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p mix={emptyStyle}>Még nincs ötlet — talán szereti a meglepetéseket.</p>
            )}
            <button
              type="button"
              disabled={hintRequested}
              mix={[
                nudgeButtonStyle,
                on<HTMLButtonElement, 'click'>('click', async () => {
                  let formData = new FormData()
                  formData.set('email', handle.props.giverEmail)
                  hintStatus = 'Névtelen emlékeztető küldése…'
                  await handle.update()
                  try {
                    let response = await fetch(handle.props.hintRequestHref, {
                      method: 'POST',
                      body: formData,
                    })
                    hintRequested = response.ok
                    hintStatus = response.ok
                      ? `${handle.props.recipientName} megkapta a névtelen emlékeztetőt.`
                      : 'Az emlékeztetőt nem sikerült elküldeni.'
                  } catch {
                    hintStatus = 'Az emlékeztetőt nem sikerült elküldeni.'
                  }
                  await handle.update()
                }),
              ]}
            >
              {hintRequested ? 'Ötlet kérve' : 'Névtelenül kérek egy ötletet'}
            </button>
            {hintStatus && <p role="status" mix={statusTextStyle}>{hintStatus}</p>}
          </section>

          <section mix={portalSectionStyle}>
            <p mix={sectionLabelStyle}>A kívánságlistád</p>
            <h2 mix={sectionTitleStyle}>Egy kis segítség a titkos ajándékozódnak</h2>
            {hasHintRequest && (
              <div role="status" mix={hintNoticeStyle}>
                ✦ A titkos ajándékozód örülne egy ötletnek. Írj valamit, ha szeretnél — de titokzatos
                is maradhatsz.
              </div>
            )}
            <div mix={wishlistEditorStyle}>
              {wishlist.map((item, index) => (
                <div key={index} data-wish-row mix={wishEditorRowStyle}>
                  <label>
                    <span>Kívánság</span>
                    <input
                      data-wish-name
                      defaultValue={item.name}
                      maxLength={120}
                      placeholder="Puha zokni, egy könyv, egy meglepetés…"
                      mix={editorInputStyle}
                    />
                  </label>
                  <label>
                    <span>Opcionális link</span>
                    <input
                      data-wish-url
                      type="url"
                      defaultValue={item.url}
                      placeholder="https://…"
                      mix={editorInputStyle}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`${item.name || `${index + 1}. kívánság`} törlése`}
                    mix={[
                      removeButtonStyle,
                      on<HTMLButtonElement, 'click'>('click', (event) => {
                        wishlist = readWishlist(event.currentTarget)
                        wishlist.splice(index, 1)
                        saveStatus = 'idle'
                        void handle.update()
                      }),
                    ]}
                  >×</button>
                </div>
              ))}
            </div>
            <div mix={wishlistActionsStyle}>
              <button
                type="button"
                disabled={wishlist.length >= 10}
                mix={[
                  addButtonStyle,
                  on<HTMLButtonElement, 'click'>('click', (event) => {
                    wishlist = readWishlist(event.currentTarget)
                    wishlist.push({ name: '', url: '' })
                    void handle.update()
                  }),
                ]}
              >+ Kívánság hozzáadása</button>
              <button
                type="button"
                disabled={saveStatus === 'saving'}
                mix={[
                  saveButtonStyle,
                  on<HTMLButtonElement, 'click'>('click', async (event) => {
                    wishlist = readWishlist(event.currentTarget)
                    if (wishlist.some((item) => !item.name.trim())) {
                      saveStatus = 'error'
                      await handle.update()
                      return
                    }
                    saveStatus = 'saving'
                    await handle.update()
                    let formData = new FormData()
                    formData.set('email', handle.props.giverEmail)
                    formData.set('items', JSON.stringify(wishlist))
                    try {
                      let response = await fetch(handle.props.wishlistHref, {
                        method: 'POST',
                        body: formData,
                      })
                      saveStatus = response.ok ? 'saved' : 'error'
                      if (response.ok) hasHintRequest = false
                    } catch {
                      saveStatus = 'error'
                    }
                    await handle.update()
                  }),
                ]}
              >{saveStatus === 'saving' ? 'Mentés…' : 'Kívánságlista mentése'}</button>
            </div>
            {saveStatus === 'saved' && <p role="status" mix={statusTextStyle}>A kívánságlista elmentve.</p>}
            {saveStatus === 'error' && <p role="alert" mix={errorTextStyle}>A kívánságlistát nem sikerült elmenteni.</p>}
          </section>
            </>
          )}
        </main>
      )
    }
  },
)

function Countdown(handle: Handle<{ readonly date: string }>) {
  let now = Date.now()
  let timer: number | undefined

  handle.queueTask(() => {
    if (typeof window === 'undefined') return
    timer = window.setInterval(() => {
      now = Date.now()
      void handle.update()
    }, 1000)
  })
  handle.signal.addEventListener(
    'abort',
    () => {
      if (timer !== undefined) window.clearInterval(timer)
    },
    { once: true },
  )

  return () => {
    let countdown = getCountdown(handle.props.date, now)
    let mood =
      countdown.totalDays <= 0
        ? countdownTodayStyle
        : countdown.totalDays <= 3
          ? countdownNearStyle
          : countdown.totalDays <= 12
            ? countdownWarmStyle
            : undefined

    return (
      <section mix={[countdownStyle, mood]} aria-label="Karácsonyi visszaszámlálás">
        <p mix={sectionLabelStyle}>Egyre közelebb a varázslat</p>
        {countdown.totalDays <= 0 ? (
          <strong mix={countdownMessageStyle}>Elérkezett az ünnep!</strong>
        ) : (
          <div mix={countdownGridStyle}>
            <CountdownPart value={countdown.days} label="nap" />
            <CountdownPart value={countdown.hours} label="óra" />
            <CountdownPart value={countdown.minutes} label="perc" />
            <CountdownPart value={countdown.seconds} label="másodperc" />
          </div>
        )}
        <p mix={countdownDateStyle}>{formatDate(handle.props.date)} napjáig</p>
      </section>
    )
  }
}

function CountdownPart(handle: Handle<{ readonly value: number; readonly label: string }>) {
  return () => (
    <div mix={countdownPartStyle}>
      <strong>{String(handle.props.value).padStart(2, '0')}</strong>
      <span>{handle.props.label}</span>
    </div>
  )
}

function getCountdown(date: string, now: number) {
  let remaining = Math.max(0, new Date(`${date}T00:00:00`).getTime() - now)
  return {
    totalDays: Math.ceil(remaining / 86_400_000),
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
    seconds: Math.floor((remaining / 1000) % 60),
  }
}

function createPersonalStory(name: string, visit: number): string {
  let openings = [
    `${name}, ma este a karácsonyi manók külön neked gyújtották meg a legfényesebb csillagot.`,
    `${name}, a havas műhelyben már mindenki tudta, hogy rád egy egészen különleges titok vár.`,
    `${name}, amikor megszólaltak a távoli csengők, egy apró borítékon éppen a te neved ragyogott.`,
    `${name}, a hópelyhek ma egyetlen üzenetet sodortak az ablakodhoz: elérkezett a te pillanatod.`,
  ]
  return [
    `Kedves ${name}!`,
    openings[Math.abs(visit) % openings.length],
    'Hét nevet rejtettek el egy apró karácsonyi rejtélyben. A manók megtartották az ígéretüket, és egy név csak rád várt.',
    `Vegyél egy mély levegőt, ${name}… amikor készen állsz, nyisd ki a karácsonyi titkodat.`,
  ].join('\n\n')
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('hu-HU', { month: 'long', day: 'numeric' }).format(
    new Date(`${date}T00:00:00`),
  )
}

function scheduleRevealChime(context: AudioContext): void {
  let master = context.createGain()
  let start = context.currentTime + 0.02
  master.gain.setValueAtTime(0.1, start)
  master.connect(context.destination)
  for (let [index, frequency] of [659, 784, 988, 1319].entries()) {
    let noteStart = start + index * 0.12
    let oscillator = context.createOscillator()
    let envelope = context.createGain()
    oscillator.type = index === 3 ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(frequency, noteStart)
    envelope.gain.setValueAtTime(0.0001, noteStart)
    envelope.gain.exponentialRampToValueAtTime(0.7, noteStart + 0.015)
    envelope.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.55)
    oscillator.connect(envelope)
    envelope.connect(master)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + 0.56)
  }
}

function scheduleSleighBells(context: AudioContext): void {
  let start = context.currentTime + 0.65
  for (let index = 0; index < 7; index++) {
    let oscillator = context.createOscillator()
    let envelope = context.createGain()
    let noteStart = start + index * 0.085
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(index % 2 ? 2200 : 1760, noteStart)
    envelope.gain.setValueAtTime(0.0001, noteStart)
    envelope.gain.exponentialRampToValueAtTime(0.035, noteStart + 0.005)
    envelope.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.07)
    oscillator.connect(envelope)
    envelope.connect(context.destination)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + 0.08)
  }
}

const storyScreenStyle = css({ position: 'relative', width: 'min(100%, 760px)', minHeight: '72vh', padding: '40px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', '@media (max-width: 600px)': { minHeight: 'calc(100svh - 116px)', padding: '24px 4px' } })
const auroraStyle = css({ position: 'absolute', inset: '8% -12%', zIndex: -1, borderRadius: '50%', opacity: .7, filter: 'blur(70px)', background: 'radial-gradient(circle at 30% 40%, rgba(212,168,79,.34), transparent 35%), radial-gradient(circle at 70% 55%, rgba(143,47,58,.28), transparent 38%)', animation: 'christmas-aurora 7s ease-in-out infinite alternate', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } })
const storyStyle = css({ minHeight: '270px', margin: 0, color: 'var(--cream)', whiteSpace: 'pre-wrap', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 600, lineHeight: 1.55, textShadow: '0 3px 20px rgba(0,0,0,.4)', '@media (max-width: 600px)': { minHeight: '0', fontSize: 'clamp(21px, 6.3vw, 27px)', lineHeight: 1.42 } })
const cursorStyle = css({ display: 'inline-block', width: '2px', height: '1em', marginLeft: '4px', verticalAlign: '-.1em', background: 'var(--gold-soft)', animation: 'christmas-cursor 800ms steps(1) infinite' })
const glowingButtonStyle = css({ minHeight: '58px', padding: '0 27px', border: '1px solid var(--gold-soft)', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '13px', color: '#fff8e8', background: 'rgba(143,47,58,.88)', boxShadow: '0 0 24px rgba(234,211,154,.45), 0 12px 34px rgba(0,0,0,.3)', cursor: 'pointer', font: 'inherit', fontWeight: 700, textAlign: 'center', animation: 'christmas-button-glow 1.8s ease-in-out infinite alternate', '@media (max-width: 600px)': { width: '100%', minHeight: '54px', marginTop: '28px', padding: '10px 18px', fontSize: '13px' }, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } })
const envelopeScreenStyle = css({ minHeight: '72vh', display: 'grid', placeItems: 'center', alignContent: 'center', gap: '28px', '@media (max-width: 600px)': { minHeight: 'calc(100svh - 116px)', gap: '20px' } })
const envelopeButtonStyle = css({ position: 'relative', width: 'min(78vw, 380px)', aspectRatio: '1.55', border: '2px solid var(--gold-soft)', borderRadius: '10px', background: 'linear-gradient(145deg, #fff8e8, #ead39a)', boxShadow: '0 28px 80px rgba(0,0,0,.4)', cursor: 'pointer', transformStyle: 'preserve-3d', '@media (max-width: 600px)': { width: 'min(82vw, 330px)' } })
const openingEnvelopeStyle = css({ animation: 'christmas-envelope-open 1s ease-in-out both', '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0 } })
const envelopeFlapStyle = css({ position: 'absolute', inset: 0, clipPath: 'polygon(0 0, 100% 0, 50% 58%)', background: 'linear-gradient(#ead39a, #fff4d9)', transformOrigin: 'top' })
const waxSealStyle = css({ position: 'absolute', top: '48%', left: '50%', width: '64px', height: '64px', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--gold-soft)', background: 'var(--berry)', boxShadow: '0 8px 20px rgba(60,10,18,.35)', transform: 'translate(-50%, -50%)', fontSize: '25px' })
const envelopeCopyStyle = css({ margin: 0, color: 'var(--cream)', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '22px', textAlign: 'center', '@media (max-width: 600px)': { fontSize: '19px' } })
const portalStyle = css({ width: 'min(100%, 760px)', padding: '48px 20px 70px', display: 'grid', gap: '22px', '@media (max-width: 600px)': { padding: '10px 0 24px', gap: '14px' } })
const revealPanelStyle = css({ minWidth: 0, padding: '38px', border: '1px solid rgba(234,211,154,.7)', borderRadius: '18px', textAlign: 'center', background: 'rgba(255,248,232,.97)', boxShadow: '0 24px 70px rgba(0,0,0,.35)', '@media (max-width: 600px)': { padding: '24px 16px', borderRadius: '14px' } })
const revealEyebrowStyle = css({ margin: '0 0 18px', color: '#53665e', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '20px', fontWeight: 600 })
const revealCopyStyle = css({ maxWidth: '430px', margin: '22px auto 12px', color: '#5d6a64', fontSize: '13px', lineHeight: 1.6 })
const actionRowStyle = css({ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '18px', '@media (max-width: 480px)': { display: 'grid', gridTemplateColumns: '1fr 1fr' } })
const quietButtonStyle = css({ minHeight: '42px', padding: '9px 14px', border: '1px solid rgba(23,63,53,.25)', borderRadius: '999px', color: 'var(--pine)', background: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: '12px', fontWeight: 700, '@media (max-width: 380px)': { padding: '8px', fontSize: '11px' } })
const countdownStyle = css({ padding: '24px', border: '1px solid rgba(234,211,154,.45)', borderRadius: '16px', color: 'var(--cream)', textAlign: 'center', background: 'rgba(12,43,37,.72)', '@media (max-width: 600px)': { padding: '18px 10px', borderRadius: '13px' } })
const countdownWarmStyle = css({ boxShadow: '0 0 28px rgba(212,168,79,.18)' })
const countdownNearStyle = css({ boxShadow: '0 0 42px rgba(212,168,79,.4)', animation: 'christmas-countdown-near 2s ease-in-out infinite alternate', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } })
const countdownTodayStyle = css({ color: '#fff', background: 'linear-gradient(135deg, rgba(143,47,58,.95), rgba(23,63,53,.95))', boxShadow: '0 0 55px rgba(234,211,154,.5)' })
const countdownGridStyle = css({ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', marginTop: '14px', '@media (max-width: 380px)': { gap: '2px' } })
const countdownPartStyle = css({ minWidth: 0, display: 'grid', gap: '2px', '& strong': { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 'clamp(26px, 6vw, 44px)', fontVariantNumeric: 'tabular-nums' }, '& span': { opacity: .7, fontSize: '9px', textTransform: 'uppercase' }, '@media (max-width: 380px)': { '& strong': { fontSize: '25px' }, '& span': { fontSize: '8px' } } })
const countdownMessageStyle = css({ display: 'block', marginTop: '12px', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '32px' })
const countdownDateStyle = css({ margin: '12px 0 0', opacity: .7, fontSize: '11px' })
const portalSectionStyle = css({ minWidth: 0, padding: '28px', borderRadius: '16px', color: 'var(--ink)', background: 'rgba(255,248,232,.97)', boxShadow: '0 16px 45px rgba(0,0,0,.24)', '@media (max-width: 600px)': { padding: '21px 16px', borderRadius: '14px' } })
const sectionLabelStyle = css({ margin: 0, color: 'var(--berry)', fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' })
const sectionTitleStyle = css({ margin: '7px 0 18px', color: 'var(--pine)', fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '27px', lineHeight: 1.08, '@media (max-width: 600px)': { fontSize: '24px' } })
const wishListStyle = css({ margin: '18px 0', padding: 0, display: 'grid', gap: '9px', listStyle: 'none', '& li': { minWidth: 0, padding: '11px 13px', border: '1px solid rgba(212,168,79,.28)', borderRadius: '8px', overflowWrap: 'anywhere', background: '#fffdf7' }, '& a': { color: 'var(--berry-dark)', fontWeight: 700 } })
const emptyStyle = css({ color: '#727c77', fontSize: '13px', fontStyle: 'italic' })
const nudgeButtonStyle = css({ minHeight: '44px', padding: '10px 15px', border: '1px solid var(--gold)', borderRadius: '7px', color: 'var(--pine)', background: 'rgba(212,168,79,.12)', cursor: 'pointer', font: 'inherit', fontSize: '12px', fontWeight: 700, '&:disabled': { opacity: .55 }, '@media (max-width: 600px)': { width: '100%' } })
const hintNoticeStyle = css({ marginBottom: '18px', padding: '12px 14px', border: '1px solid rgba(212,168,79,.45)', borderRadius: '9px', color: 'var(--pine)', background: 'rgba(212,168,79,.12)', fontSize: '12px', lineHeight: 1.5 })
const wishlistEditorStyle = css({ display: 'grid', gap: '12px' })
const wishEditorRowStyle = css({ minWidth: 0, display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', alignItems: 'end', gap: '9px', '& label': { minWidth: 0, display: 'grid', gap: '5px' }, '& label span': { color: '#68746e', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }, '@media (max-width: 600px)': { gridTemplateColumns: '1fr auto', paddingBottom: '4px', '& label': { gridColumn: '1 / -1' } } })
const editorInputStyle = css({ width: '100%', minHeight: '44px', padding: '0 11px', border: '1px solid #d8caa8', borderRadius: '7px', outline: 'none', color: 'var(--ink)', background: '#fffdf7', font: 'inherit', fontSize: '13px', '&:focus': { borderColor: 'var(--gold)' }, '@media (max-width: 600px)': { fontSize: '16px' } })
const removeButtonStyle = css({ width: '44px', height: '44px', border: '1px solid rgba(143,47,58,.25)', borderRadius: '7px', color: 'var(--berry)', background: 'rgba(143,47,58,.06)', cursor: 'pointer', fontSize: '20px', '@media (max-width: 600px)': { gridColumn: 2, justifySelf: 'end' } })
const wishlistActionsStyle = css({ marginTop: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', '@media (max-width: 600px)': { display: 'grid', gridTemplateColumns: '1fr' } })
const addButtonStyle = css({ minHeight: '44px', padding: '10px 14px', border: '1px dashed var(--gold)', borderRadius: '7px', color: 'var(--pine)', background: 'transparent', cursor: 'pointer', font: 'inherit', fontSize: '12px', fontWeight: 700 })
const saveButtonStyle = css({ minHeight: '44px', padding: '10px 17px', border: '1px solid var(--berry-dark)', borderRadius: '7px', color: '#fff', background: 'var(--berry)', cursor: 'pointer', font: 'inherit', fontSize: '12px', fontWeight: 700, '&:disabled': { opacity: .5 } })
const statusTextStyle = css({ margin: '10px 0 0', color: 'var(--pine)', fontSize: '11px', fontWeight: 700 })
const errorTextStyle = css({ margin: '10px 0 0', color: 'var(--berry-dark)', fontSize: '11px', fontWeight: 700 })
const pinSetupBackdropStyle = css({ position: 'fixed', inset: 0, zIndex: 30, padding: '20px', display: 'grid', placeItems: 'center', overflowY: 'auto', background: 'rgba(6,28,23,.8)', backdropFilter: 'blur(10px)', '@media (max-width: 600px)': { padding: 'max(16px, env(safe-area-inset-top)) 12px max(16px, env(safe-area-inset-bottom))' } })
const pinSetupModalStyle = css({ width: 'min(100%, 450px)', maxHeight: 'calc(100svh - 32px)', padding: '38px 34px', border: '1px solid var(--gold-soft)', borderRadius: '18px', overflowY: 'auto', color: 'var(--ink)', textAlign: 'center', background: 'var(--cream)', boxShadow: '0 30px 90px rgba(0,0,0,.5), 0 0 38px rgba(212,168,79,.2)', '@media (max-width: 600px)': { padding: '28px 18px', borderRadius: '14px' } })
const closeMagicStyle = css({
  position: 'fixed',
  inset: 0,
  zIndex: 4,
  overflow: 'hidden',
  pointerEvents: 'none',
  '& span': {
    position: 'absolute',
    top: '-30px',
    color: 'rgba(255,248,232,.88)',
    fontSize: '16px',
    filter: 'drop-shadow(0 0 8px rgba(234,211,154,.8))',
    animation: 'christmas-final-magic 4.8s linear infinite',
  },
  '@media (prefers-reduced-motion: reduce)': { display: 'none' },
})
