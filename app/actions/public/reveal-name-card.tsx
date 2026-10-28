import { clientEntry, css, on, type Handle } from 'remix/component'

interface RevealNameCardProps {
  readonly recipientName: string
}

export const RevealNameCard = clientEntry(
  import.meta.url,
  function RevealNameCard(handle: Handle<RevealNameCardProps>) {
    return () => (
      <div className="christmas-name-card" mix={entranceStyle}>
        <div
          mix={[
            cardStyle,
            on<HTMLDivElement, 'pointermove'>('pointermove', (event) => {
              if (
                event.pointerType !== 'mouse' ||
                window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ) {
                return
              }

              let card = event.currentTarget
              let bounds = card.getBoundingClientRect()
              let x = (event.clientX - bounds.left) / bounds.width
              let y = (event.clientY - bounds.top) / bounds.height

              card.style.setProperty('--tilt-x', `${(0.5 - y) * 14}deg`)
              card.style.setProperty('--tilt-y', `${(x - 0.5) * 20}deg`)
              card.style.setProperty('--card-scale', '1.025')
              card.style.setProperty('--snow-x', `${(x - 0.5) * 28}px`)
              card.style.setProperty(
                '--snow-y',
                `${(Math.abs(x - 0.5) + Math.abs(y - 0.5)) * 9}px`,
              )
              card.style.setProperty('--snow-rotate', `${(x - 0.5) * 9}deg`)
              card.style.setProperty(
                '--snow-opacity',
                String(0.92 - (Math.abs(x - 0.5) + Math.abs(y - 0.5)) * 0.28),
              )
              card.style.setProperty('--glare-x', `${x * 100}%`)
              card.style.setProperty('--glare-y', `${y * 100}%`)
              card.style.setProperty('--glare-opacity', '1')
            }),
            on<HTMLDivElement, 'pointerleave'>('pointerleave', (event) => {
              let card = event.currentTarget
              card.style.setProperty('--tilt-x', '0deg')
              card.style.setProperty('--tilt-y', '0deg')
              card.style.setProperty('--card-scale', '1')
              card.style.setProperty('--snow-x', '0px')
              card.style.setProperty('--snow-y', '0px')
              card.style.setProperty('--snow-rotate', '0deg')
              card.style.setProperty('--snow-opacity', '.9')
              card.style.setProperty('--glare-opacity', '0')
            }),
          ]}
        >
          <div aria-hidden="true" mix={glareStyle} />
          <div aria-hidden="true" mix={settledSnowStyle}>
            <span>•</span><span>❄</span><span>•</span><span>✦</span><span>•</span>
          </div>
          <span aria-hidden="true" mix={sprigStyle}>
            ❧
          </span>
          <p className="christmas-name" mix={recipientStyle}>
            {handle.props.recipientName}
          </p>
          <span aria-hidden="true" mix={[sprigStyle, css({ transform: 'scaleX(-1)' })]}>
            ❧
          </span>
        </div>
      </div>
    )
  },
)

const entranceStyle = css({
  animation: 'christmas-name-card 1.75s cubic-bezier(.16,.9,.25,1.15) both',
})

const cardStyle = css({
  '--tilt-x': '0deg',
  '--tilt-y': '0deg',
  '--glare-x': '50%',
  '--glare-y': '50%',
  '--glare-opacity': 0,
  '--card-scale': 1,
  '--snow-x': '0px',
  '--snow-y': '0px',
  '--snow-rotate': '0deg',
  '--snow-opacity': .9,
  position: 'relative',
  minHeight: '118px',
  padding: '21px 18px',
  border: '1px solid var(--gold)',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at center, rgba(255,255,255,.95), rgba(234,211,154,.18))',
  boxShadow:
    '0 18px 42px rgba(111,32,43,.18), inset 0 0 0 5px var(--cream), inset 0 0 0 6px rgba(212,168,79,.3)',
  transform:
    'perspective(760px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) scale(var(--card-scale)) translateZ(0)',
  transformStyle: 'preserve-3d',
  transition: 'transform 110ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease',
  willChange: 'transform',
  '&:hover': {
    boxShadow:
      '0 24px 52px rgba(111,32,43,.25), inset 0 0 0 5px var(--cream), inset 0 0 0 6px rgba(212,168,79,.45)',
  },
  '@media (max-width: 480px)': {
    minHeight: '104px',
    padding: '18px 10px',
    gap: '7px',
  },
})

const glareStyle = css({
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  opacity: 'var(--glare-opacity)',
  background:
    'radial-gradient(circle at var(--glare-x) var(--glare-y), rgba(255,255,255,.78), transparent 36%)',
  pointerEvents: 'none',
  transition: 'opacity 180ms ease',
})

const settledSnowStyle = css({
  position: 'absolute',
  top: '5px',
  left: '12%',
  right: '12%',
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  color: 'rgba(255,255,255,.96)',
  opacity: 'var(--snow-opacity)',
  textShadow: '0 2px 5px rgba(23,63,53,.22)',
  pointerEvents: 'none',
  transform:
    'translate3d(var(--snow-x), var(--snow-y), 0) rotate(var(--snow-rotate))',
  transition: 'transform 260ms cubic-bezier(.2,.75,.25,1), opacity 220ms ease',
  '& span': { animation: 'christmas-snow-settle .9s 1.3s ease-out both' },
  '& span:nth-child(2)': { fontSize: '14px', animationDelay: '1.44s' },
  '& span:nth-child(3)': { animationDelay: '1.52s' },
  '& span:nth-child(4)': {
    color: 'var(--gold)',
    fontSize: '10px',
    animationDelay: '1.6s',
  },
  '& span:nth-child(5)': { animationDelay: '1.68s' },
  '@media (prefers-reduced-motion: reduce)': { '& span': { animation: 'none' } },
})

const recipientStyle = css({
  position: 'relative',
  zIndex: 1,
  margin: 0,
  color: 'var(--berry)',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 'clamp(35px, 8vw, 48px)',
  fontWeight: 700,
  lineHeight: 1,
  transform: 'translateZ(28px)',
  animation: 'christmas-name 2.05s cubic-bezier(.16,.9,.25,1.15) both',
  overflowWrap: 'anywhere',
  '@media (max-width: 480px)': {
    fontSize: 'clamp(29px, 10vw, 40px)',
  },
})

const sprigStyle = css({
  position: 'relative',
  zIndex: 1,
  color: 'var(--gold)',
  fontFamily: 'Georgia, serif',
  fontSize: '28px',
  '@media (max-width: 380px)': {
    display: 'none',
  },
})
