import { z } from 'zod'

const commonEmailDomainTypos: Record<string, string> = {
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'hotmal.com': 'hotmail.com',
  'outlook.co': 'outlook.com',
  'yahoo.co': 'yahoo.com',
}

export const emailSchema = z.string().trim().toLowerCase()
  .email('Enter a valid email address')
  .superRefine((value, context) => {
    const domain = value.split('@').at(-1) || ''
    const suggestion = commonEmailDomainTypos[domain]
    if (suggestion) {
      context.addIssue({
        code: 'custom',
        message: `Email domain looks incorrect; did you mean ${suggestion}?`,
      })
    }
  })
export const phoneSchema = z.string().trim().regex(
  /^[0-9]{10}$/,
  'Phone number must contain exactly 10 digits',
)

export function normalizeEmailCase(value: string) {
  return value.toLowerCase()
}

export function lowercaseEmailInput(event: { currentTarget: HTMLInputElement }) {
  event.currentTarget.value = normalizeEmailCase(event.currentTarget.value)
}

export function isValidEmail(value: string) {
  return emailSchema.safeParse(value).success
}

export function isValidPhone(value: string) {
  return phoneSchema.safeParse(value).success
}
