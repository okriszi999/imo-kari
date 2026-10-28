import type { Handle } from 'remix/component'
import { css } from 'remix/component'

import { routes } from '../routes.ts'
import { ChristmasMusic } from './public/christmas-music.tsx'
import { ChristmasExperience } from './public/christmas-experience.tsx'
import { PinInput } from './public/pin-input.tsx'
import { Document } from './document.tsx'

export type HomePageState =
  | { readonly kind: 'welcome' }
  | { readonly kind: 'denied'; readonly email: string }
  | {
      readonly kind: 'pin-required'
      readonly email: string
      readonly error?: 'invalid' | 'locked'
    }
  | {
      readonly kind: 'assigned'
      readonly giverEmail: string
      readonly giverName: string
      readonly recipientName: string
      readonly ownWishlist: readonly { readonly name: string; readonly url: string }[]
      readonly recipientWishlist: readonly { readonly name: string; readonly url: string }[]
      readonly hasHintRequest: boolean
      readonly hintRequested: boolean
      readonly countdownDate: string
      readonly needsPinSetup: boolean
      readonly skipIntro: boolean
    }

interface HomePageProps {
  readonly state?: HomePageState
}

const flakes = [
  [4, -3, 13, 12],
  [11, -9, 18, 18],
  [19, -5, 15, 10],
  [27, -13, 20, 14],
  [36, -7, 16, 20],
  [45, -15, 19, 12],
  [55, -2, 14, 16],
  [63, -11, 21, 10],
  [72, -6, 17, 18],
  [81, -16, 22, 13],
  [89, -8, 16, 20],
  [96, -12, 19, 11],
] as const

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let state = handle.props.state ?? { kind: 'welcome' }

    return (
      <Document
        title={
          state.kind === 'assigned'
            ? `${state.giverName} karácsonyi rejtélye`
            : 'A karácsonyi rejtély'
        }
        head={<HomeHead />}
      >
        <main mix={pageStyle}>
          <Snowfall />
          <div aria-hidden="true" mix={glowStyle} />
          <ChristmasMusic />
          {state.kind === 'assigned' ? (
            <ChristmasExperience
              giverEmail={state.giverEmail}
              giverName={state.giverName}
              recipientName={state.recipientName}
              ownWishlist={state.ownWishlist}
              recipientWishlist={state.recipientWishlist}
              hasHintRequest={state.hasHintRequest}
              hintRequested={state.hintRequested}
              countdownDate={state.countdownDate}
              needsPinSetup={state.needsPinSetup}
              skipIntro={state.skipIntro}
              setPinHref={routes.setPin.href()}
              revealEmailHref={routes.revealEmail.href()}
              wishlistHref={routes.wishlist.href()}
              hintRequestHref={routes.hintRequest.href()}
            />
          ) : (
            <>
              <section mix={cardStyle} aria-labelledby="page-title">
                <div aria-hidden="true" mix={ornamentStyle}><span>✦</span></div>
                <header mix={headerStyle}>
                  <p mix={eyebrowStyle}>Egy apró karácsonyi titok</p>
                  <h1 id="page-title" mix={titleStyle}>
                    Karácsonyi
                    <span mix={titleAccentStyle}>Rejtély</span>
                  </h1>
                  <div aria-hidden="true" mix={dividerStyle}><span /><b>❦</b><span /></div>
                </header>
              <DrawForm state={state} />
                <footer mix={footerStyle}>
                  <p>Szeretettel, csodával és egy csipetnyi varázslattal</p>
                </footer>
              </section>
              <p mix={privacyStyle}>A titkod közted és a karácsonyi manók között marad.</p>
            </>
          )}
        </main>
      </Document>
    )
  }
}

function HomeHead() {
  return () => (
    <>
      <meta
        name="description"
        content="Privát karácsonyi ajándékozás családnak és barátoknak."
      />
      <meta name="theme-color" content="#173f35" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap"
      />
      <style>{`
        @keyframes christmas-snowfall {
          from { transform: translate3d(0, -12vh, 0) rotate(0deg); }
          to { transform: translate3d(24px, 112vh, 0) rotate(360deg); }
        }
        @keyframes christmas-reveal {
          0%, 18% { opacity: 0; transform: translateY(18px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes christmas-name-card {
          0%, 22% { opacity: 0; transform: perspective(700px) rotateX(-75deg) scale(.55); filter: blur(8px); }
          58% { opacity: 1; transform: perspective(700px) rotateX(8deg) scale(1.06); filter: blur(0); }
          76% { transform: perspective(700px) rotateX(-3deg) scale(.98); }
          100% { opacity: 1; transform: perspective(700px) rotateX(0) scale(1); filter: blur(0); }
        }
        @keyframes christmas-name {
          0%, 48% { opacity: 0; transform: scale(.35); letter-spacing: .18em; }
          72% { opacity: 1; transform: scale(1.12); letter-spacing: .02em; }
          100% { opacity: 1; transform: scale(1); letter-spacing: normal; }
        }
        @keyframes christmas-aura {
          0%, 25% { opacity: 0; transform: translate(-50%, -50%) scale(.2) rotate(0deg); }
          62% { opacity: .85; }
          100% { opacity: .3; transform: translate(-50%, -50%) scale(1.25) rotate(25deg); }
        }
        @keyframes christmas-confetti {
          0%, 42% { opacity: 0; transform: translate3d(0, -25px, 0) rotate(0deg) scale(.4); }
          52% { opacity: 1; }
          100% { opacity: 0; transform: translate3d(var(--drift), 190px, 0) rotate(520deg) scale(1); }
        }
        @keyframes christmas-aurora {
          from { transform: translate3d(-2%, -1%, 0) scale(.92); opacity: .45; }
          to { transform: translate3d(3%, 2%, 0) scale(1.08); opacity: .8; }
        }
        @keyframes christmas-cursor {
          0%, 48% { opacity: 1; }
          49%, 100% { opacity: 0; }
        }
        @keyframes christmas-button-glow {
          from { transform: translateY(0); box-shadow: 0 0 18px rgba(234,211,154,.35), 0 12px 34px rgba(0,0,0,.3); }
          to { transform: translateY(-2px); box-shadow: 0 0 42px rgba(234,211,154,.7), 0 16px 38px rgba(0,0,0,.34); }
        }
        @keyframes christmas-envelope-open {
          0% { transform: scale(1); opacity: 1; }
          55% { transform: scale(1.08) rotateX(8deg); opacity: 1; }
          100% { transform: scale(.75) translateY(-40px); opacity: 0; }
        }
        @keyframes christmas-countdown-near {
          from { transform: scale(1); }
          to { transform: scale(1.012); }
        }
        @keyframes christmas-final-magic {
          0% { opacity: 0; transform: translate3d(0, -30px, 0) rotate(0deg) scale(.7); }
          12% { opacity: 1; }
          88% { opacity: .8; }
          100% { opacity: 0; transform: translate3d(26px, 105vh, 0) rotate(420deg) scale(1.1); }
        }
        @keyframes christmas-snow-settle {
          0% { opacity: 0; transform: translateY(-18px) scale(.7); }
          65% { opacity: 1; transform: translateY(2px) scale(1.06); }
          100% { opacity: .9; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .christmas-snowflake { animation: none !important; display: none; }
          .christmas-reveal, .christmas-name-card, .christmas-name, .christmas-aura,
          .christmas-confetti { animation: none !important; }
          .christmas-confetti, .christmas-aura { display: none; }
        }
        @media print {
          body { background: white !important; }
          body * { visibility: hidden !important; }
          .christmas-print-card, .christmas-print-card * { visibility: visible !important; }
          .christmas-print-card { position: absolute !important; inset: 30px !important; box-shadow: none !important; }
          .christmas-print-hide { display: none !important; }
        }
      `}</style>
    </>
  )
}

function Snowfall() {
  return () => (
    <div aria-hidden="true" mix={snowStyle}>
      {flakes.map(([left, delay, duration, size], index) => (
        <span
          key={index}
          className="christmas-snowflake"
          mix={flakeStyle}
          style={{
            left: `${left}%`,
            fontSize: `${size}px`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
          }}
        >
          {index % 3 === 0 ? '✦' : '❄'}
        </span>
      ))}
    </div>
  )
}

function DrawForm(
  handle: Handle<{
    state: Extract<HomePageState, { kind: 'welcome' | 'denied' | 'pin-required' }>
  }>,
) {
  return () => {
    let { state } = handle.props
    let denied = state.kind === 'denied'
    let pinRequired = state.kind === 'pin-required'

    return (
      <div mix={contentStyle}>
        <p mix={introStyle}>
          Hét név. Hét meglepetés. Egy csodás karácsonyi titok.
          <br />
          Add meg a meghívott e-mail-címedet, hogy megtudd, kit lephetsz meg idén.
        </p>

        {denied && (
          <div role="alert" id="email-error" mix={errorStyle}>
            <span aria-hidden="true">✧</span>
            Ez az e-mail-cím nincs a vendéglistán. Ellenőrizd, és próbáld újra.
          </div>
        )}
        <form method="post" action={routes.draw.href()} mix={formStyle}>
          <label htmlFor="email" mix={labelStyle}>
            E-mail-címed
          </label>
          <div mix={inputWrapStyle}>
            <span aria-hidden="true" mix={mailIconStyle}>
              ✉
            </span>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={'email' in state ? state.email : ''}
              aria-invalid={denied ? true : undefined}
              aria-describedby={denied ? 'email-error email-hint' : 'email-hint'}
              placeholder="te@pelda.hu"
              mix={inputStyle}
            />
          </div>
          <p id="email-hint" mix={hintStyle}>
            A meghívóban szereplő címet használd.
          </p>
          {pinRequired && (
            <div mix={pinModalBackdropStyle}>
              <div role="dialog" aria-modal="true" aria-labelledby="pin-title" mix={pinModalStyle}>
                <p mix={eyebrowStyle}>Már van PIN-kódod</p>
                <h2 id="pin-title" mix={pinTitleStyle}>Add meg a meglévő PIN-kódodat</h2>
                <p mix={pinCopyStyle}>
                  Ehhez az e-mail-címhez már tartozik PIN-kód. Írd be a négy számjegyet a vonalak
                  fölé.
                </p>
                <small></small>
                {state.kind === 'pin-required' && state.error && (
                  <div role="alert" id="pin-error" mix={errorStyle}>
                    <span aria-hidden="true">✧</span>
                    {state.error === 'locked'
                      ? 'Túl sok hibás próbálkozás. Próbáld újra 15 perc múlva.'
                      : 'A PIN-kód nem megfelelő.'}
                  </div>
                )}
                <PinInput name="pin" label="Négyjegyű PIN-kód" />
                <button type="submit" mix={[buttonStyle, css({ marginTop: '24px', width: '100%' })]}>
                  <span>Belépés</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
          {!pinRequired && (
            <button type="submit" mix={buttonStyle}>
              <span>A titkos név felfedése</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </form>
      </div>
    )
  }
}

const pageStyle = css({
  '--pine': '#173f35',
  '--pine-deep': '#0c2b25',
  '--berry': '#8f2f3a',
  '--berry-dark': '#6f202b',
  '--gold': '#d4a84f',
  '--gold-soft': '#ead39a',
  '--cream': '#fff8e8',
  '--ink': '#24372f',
  position: 'relative',
  isolation: 'isolate',
  minHeight: '100svh',
  overflowX: 'hidden',
  padding: '56px 20px 28px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink)',
  fontFamily: "'Nunito Sans', ui-sans-serif, system-ui, sans-serif",
  background:
    'radial-gradient(circle at 50% 10%, rgba(212,168,79,.18), transparent 32%), linear-gradient(145deg, var(--pine-deep), var(--pine) 52%, #255647)',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: -2,
    opacity: 0.22,
    backgroundImage:
      'repeating-linear-gradient(115deg, transparent 0 28px, rgba(255,255,255,.025) 29px 30px)',
  },
  '@media (max-width: 560px)': {
    padding:
      'max(28px, env(safe-area-inset-top)) 12px max(88px, calc(env(safe-area-inset-bottom) + 70px))',
    justifyContent: 'flex-start',
  },
})

const glowStyle = css({
  position: 'absolute',
  zIndex: -1,
  width: '680px',
  height: '680px',
  borderRadius: '50%',
  background: 'rgba(255, 213, 132, .08)',
  filter: 'blur(60px)',
})

const cardStyle = css({
  position: 'relative',
  width: 'min(100%, 660px)',
  padding: '58px 64px 30px',
  border: '1px solid rgba(234, 211, 154, .75)',
  borderRadius: '4px 4px 28px 28px',
  background:
    'linear-gradient(rgba(255,248,232,.97), rgba(255,248,232,.97)), repeating-linear-gradient(45deg, transparent 0 8px, rgba(143,47,58,.04) 8px 9px)',
  boxShadow: '0 28px 80px rgba(0, 15, 10, .42), inset 0 0 0 7px rgba(212, 168, 79, .08)',
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    top: '12px',
    width: '58px',
    height: '2px',
    background: 'var(--gold)',
  },
  '&::before': { left: '16px' },
  '&::after': { right: '16px' },
  '@media (max-width: 560px)': {
    padding: '48px 18px 22px',
    borderRadius: '4px 4px 20px 20px',
  },
})

const ornamentStyle = css({
  position: 'absolute',
  top: '-29px',
  left: '50%',
  width: '58px',
  height: '58px',
  transform: 'translateX(-50%) rotate(45deg)',
  border: '2px solid var(--gold-soft)',
  background: 'var(--berry)',
  boxShadow: '0 8px 24px rgba(51,10,16,.3), inset 0 0 0 5px rgba(255,255,255,.08)',
  display: 'grid',
  placeItems: 'center',
  '& span': {
    color: 'var(--gold-soft)',
    fontSize: '25px',
    transform: 'rotate(-45deg)',
  },
})

const headerStyle = css({ textAlign: 'center' })
const eyebrowStyle = css({
  margin: '0 0 12px',
  color: 'var(--berry)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.2em',
  textTransform: 'uppercase',
})
const titleStyle = css({
  margin: 0,
  color: 'var(--pine)',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 'clamp(42px, 8vw, 64px)',
  fontWeight: 600,
  lineHeight: 0.86,
  letterSpacing: '-.035em',
  '@media (max-width: 380px)': {
    fontSize: '38px',
  },
})
const titleAccentStyle = css({
  display: 'block',
  color: 'var(--berry)',
  fontSize: '.83em',
  fontStyle: 'italic',
  fontWeight: 500,
})
const dividerStyle = css({
  margin: '24px auto 25px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  color: 'var(--gold)',
  '& span': { width: '52px', height: '1px', background: 'currentColor', opacity: 0.65 },
  '& b': { fontFamily: 'Georgia, serif', fontSize: '17px', fontWeight: 400 },
})
const contentStyle = css({ maxWidth: '470px', margin: '0 auto', textAlign: 'center' })
const introStyle = css({
  margin: '0 auto 27px',
  color: '#53665e',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '18px',
  fontWeight: 600,
  lineHeight: 1.48,
  '@media (max-width: 420px)': {
    fontSize: '16px',
  },
})
const errorStyle = css({
  margin: '0 0 16px',
  padding: '10px 13px',
  border: '1px solid rgba(143,47,58,.25)',
  borderRadius: '8px',
  color: 'var(--berry-dark)',
  background: 'rgba(143,47,58,.07)',
  fontSize: '13px',
  fontWeight: 700,
})
const formStyle = css({ display: 'flex', flexDirection: 'column', alignItems: 'stretch' })
const labelStyle = css({
  marginBottom: '7px',
  color: 'var(--pine)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.12em',
  textAlign: 'left',
  textTransform: 'uppercase',
})
const inputWrapStyle = css({ position: 'relative' })
const mailIconStyle = css({
  position: 'absolute',
  top: '50%',
  left: '17px',
  transform: 'translateY(-52%)',
  color: 'var(--gold)',
  fontFamily: 'Georgia, serif',
  fontSize: '18px',
  pointerEvents: 'none',
})
const inputStyle = css({
  width: '100%',
  height: '53px',
  padding: '0 17px 0 48px',
  border: '1px solid #d8caa8',
  borderRadius: '7px',
  outline: 'none',
  color: 'var(--ink)',
  background: 'rgba(255,255,255,.64)',
  font: 'inherit',
  fontSize: '15px',
  transition: 'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
  '&::placeholder': { color: '#9b9d91' },
  '&:focus': {
    borderColor: 'var(--gold)',
    background: '#fffdf7',
    boxShadow: '0 0 0 3px rgba(212,168,79,.18)',
  },
  '&[aria-invalid="true"]': { borderColor: 'var(--berry)' },
  '@media (max-width: 560px)': {
    fontSize: '16px',
  },
})
const hintStyle = css({
  margin: '7px 2px 17px',
  color: '#7c847e',
  fontSize: '11px',
  textAlign: 'left',
})
const pinModalBackdropStyle = css({
  position: 'fixed',
  inset: 0,
  zIndex: 20,
  padding: '20px',
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(6, 28, 23, .78)',
  backdropFilter: 'blur(9px)',
  overflowY: 'auto',
  '@media (max-width: 560px)': {
    padding:
      'max(16px, env(safe-area-inset-top)) 12px max(16px, env(safe-area-inset-bottom))',
  },
})
const pinModalStyle = css({
  width: 'min(100%, 420px)',
  maxHeight: 'calc(100svh - 32px)',
  overflowY: 'auto',
  padding: '38px 34px',
  border: '1px solid var(--gold-soft)',
  borderRadius: '18px',
  textAlign: 'center',
  background: 'var(--cream)',
  boxShadow: '0 30px 90px rgba(0,0,0,.48), 0 0 35px rgba(212,168,79,.2)',
  '@media (max-width: 560px)': {
    padding: '28px 18px',
    borderRadius: '14px',
  },
})
const pinTitleStyle = css({
  margin: '0 0 8px',
  color: 'var(--pine)',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '31px',
  '@media (max-width: 420px)': {
    fontSize: '27px',
  },
})
const pinCopyStyle = css({
  margin: '0 0 22px',
  color: '#68746e',
  fontSize: '12px',
})
const buttonStyle = css({
  appearance: 'none',
  minHeight: '52px',
  padding: '0 21px',
  border: '1px solid #6e1d27',
  borderRadius: '7px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '14px',
  color: '#fffaf0',
  background: 'linear-gradient(135deg, var(--berry), var(--berry-dark))',
  boxShadow: '0 8px 20px rgba(111,32,43,.22), inset 0 1px rgba(255,255,255,.16)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '.045em',
  transition: 'transform 150ms ease, box-shadow 150ms ease',
  '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 11px 24px rgba(111,32,43,.29)' },
  '&:focus-visible': { outline: '3px solid var(--gold-soft)', outlineOffset: '3px' },
  '&:active': { transform: 'translateY(0)' },
  '@media (max-width: 560px)': {
    minHeight: '50px',
    padding: '0 15px',
  },
})
const footerStyle = css({
  marginTop: '30px',
  paddingTop: '18px',
  borderTop: '1px solid rgba(212,168,79,.27)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '9px',
  color: '#8a8679',
  fontSize: '10px',
  '& p': { margin: 0 },
  '@media (max-width: 420px)': {
    flexWrap: 'wrap',
    '& p': { flexBasis: '100%' },
  },
})
const privacyStyle = css({
  margin: '17px 0 0',
  color: 'rgba(255,248,232,.66)',
  fontSize: '10px',
  letterSpacing: '.035em',
  textAlign: 'center',
})
const snowStyle = css({
  position: 'fixed',
  inset: 0,
  zIndex: -1,
  overflow: 'hidden',
  pointerEvents: 'none',
})
const flakeStyle = css({
  position: 'absolute',
  top: '-12vh',
  color: 'rgba(255,255,255,.72)',
  filter: 'drop-shadow(0 0 4px rgba(255,255,255,.3))',
  animationName: 'christmas-snowfall',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
})
