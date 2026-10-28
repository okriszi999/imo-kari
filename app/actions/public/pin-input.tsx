import { clientEntry, css, on, type Handle } from 'remix/component'

interface PinInputProps {
  readonly name: string
  readonly label: string
}

export const PinInput = clientEntry(
  import.meta.url,
  function PinInput(handle: Handle<PinInputProps>) {
    function syncPin(input: HTMLInputElement): void {
      let group = input.closest('[data-pin-group]')
      if (!group) return

      let digits = [...group.querySelectorAll<HTMLInputElement>('[data-pin-digit]')]
      let hidden = group.querySelector<HTMLInputElement>(`input[name="${handle.props.name}"]`)
      if (hidden) hidden.value = digits.map((digit) => digit.value).join('')
    }

    return () => (
      <fieldset data-pin-group mix={groupStyle}>
        <legend mix={legendStyle}>{handle.props.label}</legend>
        <input type="hidden" name={handle.props.name} value="" />
        <div mix={digitsStyle}>
          {[0, 1, 2, 3].map((index) => (
            <input
              key={index}
              data-pin-digit
              type="text"
              inputMode="numeric"
              autoFocus={index === 0}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              required
              pattern="[0-9]"
              aria-label={`${index + 1}. PIN-számjegy`}
              mix={[
                digitStyle,
                on<HTMLInputElement, 'input'>('input', (event) => {
                  let input = event.currentTarget
                  input.value = input.value.replace(/\D/g, '').slice(-1)
                  syncPin(input)
                  if (input.value) {
                    input.nextElementSibling instanceof HTMLInputElement &&
                      input.nextElementSibling.focus()
                  }
                }),
                on<HTMLInputElement, 'keydown'>('keydown', (event) => {
                  if (
                    event.key === 'Backspace' &&
                    !event.currentTarget.value &&
                    event.currentTarget.previousElementSibling instanceof HTMLInputElement
                  ) {
                    event.currentTarget.previousElementSibling.focus()
                  }
                }),
                on<HTMLInputElement, 'paste'>('paste', (event) => {
                  let pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 4)
                  if (!pasted) return
                  event.preventDefault()

                  let group = event.currentTarget.closest('[data-pin-group]')
                  let digits = group?.querySelectorAll<HTMLInputElement>('[data-pin-digit]')
                  digits?.forEach((digit, digitIndex) => {
                    digit.value = pasted[digitIndex] ?? ''
                  })
                  syncPin(event.currentTarget)
                  digits?.[Math.min(pasted.length, 4) - 1]?.focus()
                }),
              ]}
            />
          ))}
        </div>
      </fieldset>
    )
  },
)

const groupStyle = css({
  margin: 0,
  padding: 0,
  border: 0,
})
const legendStyle = css({
  width: '100%',
  marginBottom: '18px',
  color: 'var(--pine)',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textAlign: 'center',
  textTransform: 'uppercase',
})
const digitsStyle = css({
  display: 'flex',
  justifyContent: 'center',
  gap: '14px',
  '@media (max-width: 420px)': {
    gap: '8px',
  },
})
const digitStyle = css({
  appearance: 'none',
  width: '48px',
  height: '58px',
  padding: 0,
  border: 0,
  borderBottom: '3px solid var(--gold)',
  borderRadius: 0,
  outline: 'none',
  color: 'var(--berry)',
  background: 'transparent',
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '38px',
  fontWeight: 700,
  lineHeight: 1,
  textAlign: 'center',
  transition: 'border-color 150ms ease, transform 150ms ease',
  '&:focus': {
    borderColor: 'var(--berry)',
    transform: 'translateY(-3px)',
  },
  '@media (max-width: 420px)': {
    width: '42px',
    height: '54px',
    fontSize: '34px',
  },
})
