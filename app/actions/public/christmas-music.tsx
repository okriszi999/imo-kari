import { clientEntry, css, on, type Handle } from 'remix/component'

const MUSIC_URL = '/assets/app/actions/public/christmas-music.mp3'
const PLAYING_KEY = 'imochristmas-music-playing'
const POSITION_KEY = 'imochristmas-music-position'

const lyrics = [
  [0, '♪'],
  [9.5, 'Yeah. Okay. Lil’ CC on the beat. Yeah, yeah.'],
  [15.68, "I mean where should I really even start?"],
  [21.44, "I got my people cross the street livin' large"],
  [25.36, 'Thinkin’ back to the fact that they heard all my raps'],
  [30.72, 'I got two phones, one need a charge'],
  [36.24, 'I got big stacks comin’ out the safe'],
  [42.32, "In the next life, I'm tryna stay paid"],
  [47.44, 'When I die, put my money in the grave'],
  [52.16, 'I really gotta put a couple people in their place'],
  [57.68, 'Lil’ CC, let it slap with the bass'],
  [63.04, 'I used to save them with a mask and a cape'],
  [68.24, "Still on top like I'm scared of the drop"],
  [73.2, 'I don’t wanna change, ’cause I’m good where I’m at'],
  [78.08, 'Mom taught me, so I’m always good where I’m at'],
  [83.28, 'Tell ’em when I die, put my money in the grave'],
  [87.6, 'She moves on, then she’s on to the next'],
  [92.56, 'Roll with it — you really wanna get it'],
  [97.2, 'Phone ringin’, they know a big tipper'],
  [101.76, 'They’re brothers in the DNA'],
  [108.72, 'Got a count on my allowance'],
  [113.12, 'So I gotta reroute it'],
  [117.44, 'Got the truck drippin’ like paint'],
  [122.4, 'Then I never talk about it'],
  [127.2, 'Rich people in the middle bein’ modest'],
  [132.88, 'Six figures and I’m countin’'],
  [139.28, 'When I die, put my money in the grave'],
  [143.6, 'I really gotta put a couple people in their place'],
  [148.16, 'Lil’ CC, let it slap with the bass'],
  [152.8, 'Now I’m like, “Nah, love, I’m good — go away”'],
  [183.12, '♪'],
] as const

function lyricIndexAt(time: number) {
  let index = 0
  for (let next = 1; next < lyrics.length; next++) {
    if (lyrics[next][0] > time) break
    index = next
  }
  return index
}

export const ChristmasMusic = clientEntry(
  import.meta.url,
  function ChristmasMusic(handle: Handle) {
    let playing = false
    let currentLyric = 0
    let audioId = `${handle.id}-audio`

    handle.queueTask(() => {
      if (typeof window === 'undefined') return
      let audio = document.getElementById(audioId)
      if (!(audio instanceof HTMLAudioElement)) return

      let savedPosition = Number.parseFloat(window.sessionStorage.getItem(POSITION_KEY) ?? '0')
      if (Number.isFinite(savedPosition)) {
        audio.currentTime = savedPosition
        currentLyric = lyricIndexAt(savedPosition)
      }
      if (window.sessionStorage.getItem(PLAYING_KEY) === 'true') {
        void audio
          .play()
          .then(() => {
            playing = true
            void handle.update()
          })
          .catch(() => {
            playing = false
          })
      }
    })

    return () => {
      let firstVisibleLyric = Math.max(0, Math.min(currentLyric - 2, lyrics.length - 5))

      return (
        <div mix={playerStyle}>
        {playing ? (
          <div aria-hidden="true" mix={lyricsBackdropStyle}>
            <div mix={lyricsStyle}>
              {lyrics.slice(firstVisibleLyric, firstVisibleLyric + 5).map(([time, line], index) => {
                let lyricIndex = firstVisibleLyric + index
                let distance = Math.abs(lyricIndex - currentLyric)

                return (
                  <p
                    key={time}
                    data-active={distance === 0 ? 'true' : undefined}
                    mix={lyricLineStyle}
                    style={{
                      opacity: distance === 0 ? 1 : distance === 1 ? 0.34 : 0.14,
                      transform: `translateX(${distance === 0 ? '-10px' : '0'})`,
                      color: distance === 0 ? 'var(--gold-soft)' : 'var(--cream)',
                      background: distance === 0 ? 'rgba(212,168,79,.12)' : 'transparent',
                      borderLeftColor: distance === 0 ? 'var(--gold)' : 'transparent',
                      textShadow: distance === 0 ? '0 2px 18px rgba(234,211,154,.28)' : 'none',
                    }}
                  >
                    {line}
                  </p>
                )
              })}
            </div>
          </div>
        ) : null}
        <audio
          id={audioId}
          src={MUSIC_URL}
          loop
          preload="auto"
          mix={[
            on<HTMLAudioElement, 'timeupdate'>('timeupdate', (event) => {
              let time = event.currentTarget.currentTime
              window.sessionStorage.setItem(POSITION_KEY, String(time))
              let nextLyric = lyricIndexAt(time)
              if (nextLyric !== currentLyric) {
                currentLyric = nextLyric
                void handle.update()
              }
            }),
          ]}
        />
        <button
          type="button"
          aria-pressed={playing}
          aria-label={playing ? 'Karácsonyi zene némítása' : 'Karácsonyi zene lejátszása'}
          title={playing ? 'Karácsonyi zene némítása' : 'Karácsonyi zene lejátszása'}
          mix={[
            musicButtonStyle,
            on<HTMLButtonElement, 'click'>('click', async () => {
              let audio = document.getElementById(audioId)
              if (!(audio instanceof HTMLAudioElement)) return

              if (playing) {
                audio.pause()
                playing = false
              } else {
                await audio.play()
                playing = true
              }
              window.sessionStorage.setItem(PLAYING_KEY, String(playing))
              await handle.update()
            }),
          ]}
        >
          <span aria-hidden="true" mix={speakerStyle}>{playing ? '♪' : '♫'}</span>
          <span>{playing ? 'Zene némítása' : 'Zene lejátszása'}</span>
        </button>
      </div>
      )
    }
  },
)

const playerStyle = css({
  display: 'contents',
})
const lyricsBackdropStyle = css({
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  zIndex: 5,
  width: 'min(280px, max(160px, calc((100vw - 800px) / 2)))',
  padding: '56px 16px 80px 10px',
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  pointerEvents: 'none',
  background: 'linear-gradient(270deg, rgba(12,43,37,.42), transparent)',
  maskImage: 'linear-gradient(transparent 3%, black 24% 76%, transparent 97%)',
  '@media (max-width: 900px)': {
    width: '150px',
    paddingRight: '10px',
    paddingLeft: '8px',
  },
  '@media (max-width: 600px)': {
    top: 'auto',
    right: '12px',
    bottom: 'calc(env(safe-area-inset-bottom) + 66px)',
    left: '12px',
    width: 'auto',
    height: '66px',
    padding: '8px 12px',
    border: '1px solid rgba(234,211,154,.28)',
    borderRadius: '14px',
    background: 'rgba(12,43,37,.88)',
    boxShadow: '0 8px 28px rgba(0,0,0,.25)',
    backdropFilter: 'blur(10px)',
    maskImage: 'none',
  },
})
const lyricsStyle = css({
  width: '100%',
  display: 'grid',
  gap: 'clamp(10px, 1.8vh, 20px)',
  color: 'var(--cream)',
  textAlign: 'left',
  '@media (max-width: 600px)': {
    display: 'block',
    '& p:not([data-active="true"])': {
      display: 'none',
    },
  },
})
const lyricLineStyle = css({
  margin: 0,
  padding: '8px 12px',
  borderLeft: '3px solid transparent',
  borderRadius: '0 12px 12px 0',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: 'clamp(16px, 1.65vw, 25px)',
  fontWeight: 700,
  lineHeight: 1.02,
  textWrap: 'balance',
  transition:
    'opacity 500ms ease, transform 500ms ease, color 500ms ease, background 500ms ease, border-color 500ms ease',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
  '@media (max-width: 600px)': {
    padding: '4px 8px',
    borderLeft: 0,
    fontSize: '18px',
    lineHeight: 1.15,
    textAlign: 'center',
    transform: 'none !important',
  },
})
const musicButtonStyle = css({
  position: 'fixed',
  right: 'max(16px, env(safe-area-inset-right))',
  bottom: 'max(16px, env(safe-area-inset-bottom))',
  zIndex: 50,
  appearance: 'none',
  minHeight: '44px',
  padding: '0 12px',
  border: '1px solid rgba(234,211,154,.55)',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  color: 'var(--cream)',
  background: 'rgba(12,43,37,.86)',
  boxShadow: '0 7px 22px rgba(0,0,0,.24)',
  backdropFilter: 'blur(8px)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '10px',
  fontWeight: 700,
  '&:hover': { background: 'rgba(143,47,58,.92)' },
  '&:focus-visible': { outline: '2px solid var(--gold)', outlineOffset: '4px' },
})

const speakerStyle = css({
  width: '17px',
  height: '17px',
  border: '1px solid currentColor',
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontFamily: 'Georgia, serif',
  fontSize: '10px',
})
