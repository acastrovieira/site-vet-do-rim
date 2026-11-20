import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const webRoot = resolve(import.meta.dirname, '../..')
const templatesDir = resolve(webRoot, '../supabase/templates')

const expectations = [
  ['recovery.html', 'recovery'],
  ['confirmation.html', 'signup'],
  ['email_change.html', 'email_change'],
  ['magic_link.html', 'magiclink'],
  ['invite.html', 'invite'],
] as const

test('auth email templates are branded Vet do Rim and link only to vetdorim.com.br callback', () => {
  for (const [file, type] of expectations) {
    const html = readFileSync(resolve(templatesDir, file), 'utf8')
    assert.match(html, /Vet do Rim/)
    assert.match(html, /vetdorim\.com\.br/)
    assert.ok(
      html.includes(`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=${type}`),
      `${file} deve usar token_hash com type=${type}`,
    )
    assert.doesNotMatch(html, /supabase\.co/i, `${file} nao pode expor supabase.co`)
    assert.doesNotMatch(html, /ConfirmationURL/, `${file} nao pode usar ConfirmationURL`)
    assert.doesNotMatch(html, /<script/i)
  }
})

test('auth callback verifies allowlisted email token hashes without leaking provider errors', () => {
  const callback = readFileSync(resolve(webRoot, 'src/app/auth/callback/route.ts'), 'utf8')

  for (const type of ['signup', 'email_change', 'magiclink', 'invite', 'email']) {
    assert.match(callback, new RegExp(`'${type}'`))
  }
  assert.match(callback, /ALLOWED_EMAIL_OTP_TYPES\.has\(type\)/)
  assert.match(callback, /verifyOtp\(\{\s*token_hash: tokenHash,\s*type: type as NonRecoveryEmailOtpType/)
  assert.match(callback, /notice=email_confirmado/)
  assert.doesNotMatch(callback, /error\.message|console\.(?:error|warn|log)/)
})

test('password recovery classifies email cooldown and rate limit errors', () => {
  const form = readFileSync(
    resolve(webRoot, 'src/app/auth/recuperar-senha/RecoverForm.tsx'),
    'utf8',
  )

  assert.match(form, /over_email_send_rate_limit/)
  assert.match(form, /only request this after/)
  assert.match(form, /60 segundos/)
})
