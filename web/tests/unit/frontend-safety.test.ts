import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'
import {
  getMutationErrorCopy,
  isMutationOutcomeAmbiguous,
  requestJsonMutation,
} from '../../src/lib/client-mutation.ts'
import {
  ApiPayloadTooLargeError,
  ApiUnsupportedMediaTypeError,
  ApiValidationError,
  assertAllowedKeys,
  readJsonObject,
  requiredText,
  safeErrorSummary,
} from '../../src/lib/api-validation.ts'
import { serializeJsonLd } from '../../src/lib/json-ld.ts'
import {
  deletePatient,
  EXAMS_KEY,
  FREE_LAB_STATE_KEY,
  FreeLabStorageError,
  getFreeLabSnapshot,
  getPatients,
  parseExamsStorage,
  parsePatientsStorage,
  PATIENTS_KEY,
  saveExam,
  savePatient,
} from '../../src/lib/lab-free/storage.ts'
import { FREE_LAB_LIMITS } from '../../src/lib/lab-free/types.ts'
import {
  getLabReferenceStatus,
  parseLabNumber,
} from '../../src/lib/lab-free/reference-status.ts'
import { isUuid } from '../../src/lib/identifiers.ts'
import {
  boundedTotalPages,
  listPageRange,
  MAX_LIST_PAGE,
  parseListPage,
} from '../../src/lib/list-pagination.ts'
import {
  resolveTutorSelection,
  TUTOR_SELECTION_LIMIT,
} from '../../src/lib/lab/tutor-selection.ts'
import {
  getAnalyticsConsent,
  isAnalyticsAllowedPath,
  setAnalyticsConsent,
} from '../../src/lib/analytics-consent.ts'
import { isSafeSupabasePublicKey } from '../../src/lib/env.ts'
import {
  assertCivilDate,
  compareCivilDatesDescending,
  formatCivilDate,
} from '../../src/lib/civil-date.ts'
import { resolveLaudoFunctionFailure } from '../../src/lib/lab/function-error.ts'

function installMockLocalStorage(
  initial: Record<string, string> = {},
  options: {
    failGet?: boolean
    failGetCalls?: number[]
    failSetCalls?: number[]
    beforeSet?: (call: number, key: string, values: Map<string, string>) => void
    afterSet?: (call: number, key: string, values: Map<string, string>) => void
  } = {},
) {
  const values = new Map(Object.entries(initial))
  let setCalls = 0
  let getCalls = 0
  const storage = {
    get length() { return values.size },
    clear() { values.clear() },
    getItem(key: string) {
      getCalls += 1
      if (options.failGet || options.failGetCalls?.includes(getCalls)) {
        throw new DOMException('Blocked', 'SecurityError')
      }
      return values.get(key) ?? null
    },
    key(index: number) { return [...values.keys()][index] ?? null },
    removeItem(key: string) { values.delete(key) },
    setItem(key: string, value: string) {
      setCalls += 1
      options.beforeSet?.(setCalls, key, values)
      if (options.failSetCalls?.includes(setCalls)) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      values.set(key, value)
      options.afterSet?.(setCalls, key, values)
    },
  } satisfies Storage
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  let lockTail = Promise.resolve()
  const locks = {
    async request(...args: unknown[]) {
      const callback = args.at(-1) as () => unknown | Promise<unknown>
      const previous = lockTail
      let release!: () => void
      lockTail = new Promise<void>((resolve) => { release = resolve })
      await previous
      try {
        return await callback()
      } finally {
        release()
      }
    },
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } })

  return {
    values,
    get setCalls() { return setCalls },
    get getCalls() { return getCalls },
    restore() {
      if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
      else Reflect.deleteProperty(globalThis, 'window')
      if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
      else Reflect.deleteProperty(globalThis, 'localStorage')
      if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
      else Reflect.deleteProperty(globalThis, 'navigator')
    },
  }
}

test('analytics consent fails closed when browser storage is unavailable', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  let dispatchedEvents = 0

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => { throw new DOMException('blocked', 'SecurityError') },
        setItem: () => { throw new DOMException('blocked', 'SecurityError') },
        removeItem: () => { throw new DOMException('blocked', 'SecurityError') },
      },
      dispatchEvent: () => {
        dispatchedEvents += 1
        return true
      },
    },
  })

  try {
    assert.equal(getAnalyticsConsent(), 'declined')
    assert.doesNotThrow(() => setAnalyticsConsent('accepted'))
    assert.equal(getAnalyticsConsent(), 'declined')
    assert.equal(dispatchedEvents, 1)
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  }
})

test('civil dates remain stable across time zones and reject impossible dates', () => {
  assert.equal(
    formatCivilDate('2026-01-15', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    '15/01/2026',
  )
  assert.equal(compareCivilDatesDescending('2026-01-01', '2026-02-01'), 1)
  assert.doesNotThrow(() => assertCivilDate('2024-02-29'))
  assert.throws(() => assertCivilDate('2026-02-29'), /Invalid civil date/)
  assert.throws(() => assertCivilDate('15/01/2026'), /Invalid civil date/)
})

test('Edge Function failures support legacy and non-2xx Supabase responses', async () => {
  const legacy = await resolveLaudoFunctionFailure(null, {
    success: false,
    error: 'Este laudo já foi processado anteriormente.',
  })
  assert.equal(legacy.serviceError, 'Este laudo já foi processado anteriormente.')
  assert.equal(legacy.outcomeUnknown, false)

  const forbidden = await resolveLaudoFunctionFailure(
    new FunctionsHttpError(new Response(JSON.stringify({
      success: false,
      error: 'Acesso negado.',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })),
    null,
  )
  assert.equal(forbidden.serviceError, 'Acesso negado.')
  assert.equal(forbidden.status, 403)
  assert.equal(forbidden.outcomeUnknown, false)

  const unavailable = await resolveLaudoFunctionFailure(
    new FunctionsHttpError(new Response('not-json', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })),
    null,
  )
  assert.equal(unavailable.serviceError, undefined)
  assert.equal(unavailable.outcomeUnknown, true)

  assert.equal(
    (await resolveLaudoFunctionFailure(new FunctionsFetchError(new Error('private')), null)).outcomeUnknown,
    true,
  )
  assert.equal(
    (await resolveLaudoFunctionFailure(new FunctionsRelayError(new Response()), null)).outcomeUnknown,
    true,
  )
})

test('root errors, private-route contact controls and animation timers fail safely', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const rootError = readFileSync(resolve(webRoot, 'src/app/global-error.tsx'), 'utf8')
  const whatsapp = readFileSync(resolve(webRoot, 'src/components/marketing/WhatsAppFloat.tsx'), 'utf8')
  const demo = readFileSync(resolve(webRoot, 'src/components/marketing/ProductDemo.tsx'), 'utf8')
  const motionActivity = readFileSync(resolve(webRoot, 'src/hooks/useMotionActivity.ts'), 'utf8')
  const motionProvider = readFileSync(resolve(webRoot, 'src/components/providers/MotionPreferencesProvider.tsx'), 'utf8')

  assert.match(rootError, /<html lang="pt-BR">/)
  assert.match(rootError, /<body/)
  assert.doesNotMatch(rootError, /error\.message|error\.stack/)
  for (const prefix of ['/auth', '/lab', '/portal', '/admin', '/dashboard']) {
    assert.match(whatsapp, new RegExp(prefix.replace('/', '\\/')))
  }
  assert.match(demo, /if \(interval\) clearInterval\(interval\)/)
  assert.match(demo, /performance\.now\(\)/)
  assert.match(demo, /playing && canAnimate/)
  assert.match(motionActivity, /useSyncExternalStore/)
  assert.match(motionActivity, /visibilitychange/)
  assert.match(motionActivity, /IntersectionObserver/)
  assert.match(motionActivity, /window\.addEventListener\('blur'/)
  assert.match(motionActivity, /media\.removeEventListener\('change'/)
  assert.match(motionProvider, /<MotionConfig reducedMotion="user">/)
})

test('public marketing excludes unverified metrics and nominal clinical testimonials', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const home = readFileSync(resolve(webRoot, 'src/app/page.tsx'), 'utf8')
  const principles = readFileSync(resolve(webRoot, 'src/components/marketing/AnimatedStats.tsx'), 'utf8')
  const evidencePolicy = readFileSync(resolve(webRoot, 'src/components/marketing/TestimonialsCarousel.tsx'), 'utf8')
  const demo = readFileSync(resolve(webRoot, 'src/components/marketing/ProductDemo.tsx'), 'utf8')
  const publicMarketing = [home, principles, evidencePolicy].join('\n')

  assert.doesNotMatch(publicMarketing, /500\+|98%|Histórias reais|Ana Paula S\.|Carlos Menezes|Rodrigo Almeida/)
  assert.doesNotMatch(publicMarketing, /conseguimos estabilizar|reduziu drasticamente as crises|recuperação foi muito além/i)
  assert.match(home, /Compromissos públicos verificáveis/)
  assert.match(principles, /Decisão clínica humana/)
  assert.match(evidencePolicy, /Indicadores com metodologia/)
  assert.match(demo, /Demonstração ilustrativa com dados fictícios/)
})

test('analytics and public Supabase configuration fail closed around sensitive data', () => {
  assert.equal(isAnalyticsAllowedPath('/ferramentas/estadiamento-iris'), true)
  assert.equal(isAnalyticsAllowedPath('/auth/login'), false)
  assert.equal(isAnalyticsAllowedPath('/lab/pacientes?q=Rex'), false)
  assert.equal(isAnalyticsAllowedPath('/portal'), false)

  const jwtHeader = 'eyJhbGciOiJIUzI1NiJ9'
  const anonPayload = globalThis.btoa(JSON.stringify({ role: 'anon' })).replaceAll('=', '')
  const servicePayload = globalThis.btoa(JSON.stringify({ role: 'service_role' })).replaceAll('=', '')
  assert.equal(isSafeSupabasePublicKey(`${jwtHeader}.header.${anonPayload}`), false)
  assert.equal(isSafeSupabasePublicKey(`${jwtHeader}.${anonPayload}.signature`), true)
  assert.equal(isSafeSupabasePublicKey(`${jwtHeader}.${servicePayload}.signature`), false)
  assert.equal(isSafeSupabasePublicKey(`sb_secret_${'a'.repeat(24)}`), false)
  assert.equal(isSafeSupabasePublicKey(`sb_publishable_${'a'.repeat(24)}`), true)
})

test('server error summaries omit provider messages and PII', () => {
  const summary = safeErrorSummary(new Error('private SQL detail for tutor@example.test'))
  assert.deepEqual(summary, { name: 'Error' })
  assert.doesNotMatch(JSON.stringify(summary), /private|tutor@example\.test|SQL/i)
})

test('client mutation accepts a valid success response', async () => {
  const createdId = '9b91b5d8-9337-4e8f-9f4a-a8f337df9920'
  const result = await requestJsonMutation('/api/test', { nome: 'Thor' }, {
    fetcher: (async () => new Response(
      JSON.stringify({ ok: true, id: createdId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch,
  })

  assert.deepEqual(result, {
    ok: true,
    id: createdId,
    code: 'OK',
    status: 200,
  })
})

test('client mutation forwards an explicit PATCH without changing the safe default', async () => {
  const createdId = '9b91b5d8-9337-4e8f-9f4a-a8f337df9920'
  const methods: Array<string | undefined> = []
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    methods.push(init?.method)
    return new Response(
      JSON.stringify({ ok: true, id: createdId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof fetch

  await requestJsonMutation('/api/test', {}, { fetcher })
  await requestJsonMutation('/api/test', {}, { fetcher, method: 'PATCH' })

  assert.deepEqual(methods, ['POST', 'PATCH'])
})

test('client mutation rejects a false success response without a created ID', async () => {
  const result = await requestJsonMutation('/api/test', { nome: 'Thor' }, {
    fetcher: (async () => new Response(
      JSON.stringify({ ok: true }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch,
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'INVALID_RESPONSE',
    status: 201,
  })
})

test('client mutation rejects malformed created identifiers', async () => {
  for (const id of [' ', '../route', 'record-id', '00000000-0000-0000-0000-000000000000']) {
    const result = await requestJsonMutation('/api/test', { nome: 'Thor' }, {
      fetcher: (async () => new Response(
        JSON.stringify({ ok: true, id }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch,
    })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'INVALID_RESPONSE')
  }
})

test('client mutation fails closed on a non-JSON response', async () => {
  const result = await requestJsonMutation('/api/test', {}, {
    fetcher: (async () => new Response('<html>gateway error</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    })) as typeof fetch,
  })

  assert.deepEqual(result, {
    ok: false,
    code: 'INVALID_RESPONSE',
    status: 502,
  })
})

test('client mutation distinguishes timeout from a network failure', async () => {
  const timeoutResult = await requestJsonMutation('/api/test', {}, {
    timeoutMs: 5,
    fetcher: ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })) as typeof fetch,
  })
  assert.equal(timeoutResult.code, 'TIMEOUT')

  const networkResult = await requestJsonMutation('/api/test', {}, {
    fetcher: (async () => { throw new TypeError('network detail') }) as typeof fetch,
  })
  assert.equal(networkResult.code, 'NETWORK')
  assert.equal(networkResult.error, undefined)
})

test('client mutation identifies outcomes that are unsafe to resend blindly', () => {
  for (const result of [
    { ok: false, code: 'TIMEOUT' },
    { ok: false, code: 'NETWORK' },
    { ok: false, code: 'INVALID_RESPONSE', status: 201 },
    { ok: false, code: 'REQUEST_FAILED', status: 503 },
  ]) {
    assert.equal(isMutationOutcomeAmbiguous(result), true)
  }

  for (const result of [
    { ok: true, code: 'OK', status: 201 },
    { ok: false, code: 'VALIDATION', status: 400 },
    { ok: false, code: 'FORBIDDEN', status: 403 },
    { ok: false, code: 'DATABASE_CONFLICT', status: 409 },
  ]) {
    assert.equal(isMutationOutcomeAmbiguous(result), false)
  }
})

test('ambiguous mutation feedback requires verification instead of a blind retry', () => {
  const copy = getMutationErrorCopy({
    ok: false,
    code: 'TIMEOUT',
  }, 'tutor')

  assert.equal(copy.title, 'Confirmação pendente')
  assert.match(copy.message, /confira a lista de tutores/i)
  assert.doesNotMatch(copy.message, /tente novamente/i)
})

test('authorization feedback never exposes infrastructure instructions', () => {
  const copy = getMutationErrorCopy({
    ok: false,
    code: 'RLS_DENIED',
    error: 'Supabase Dashboard -> Policies',
  }, 'paciente')

  assert.equal(copy.title, 'Acesso não autorizado')
  assert.match(copy.message, /não tem permissão/i)
  assert.doesNotMatch(copy.message, /supabase|polic/i)

  const forbiddenCopy = getMutationErrorCopy({
    ok: false,
    code: 'FORBIDDEN',
  }, 'tutor')
  assert.equal(forbiddenCopy.title, copy.title)

  const unavailableCopy = getMutationErrorCopy({
    ok: false,
    code: 'AUTHORIZATION_UNAVAILABLE',
  }, 'paciente')
  assert.match(unavailableCopy.message, /permiss[aã]o n[aã]o p[oô]de ser confirmada/i)
  assert.doesNotMatch(unavailableCopy.message, /database|supabase|rls/i)
})

test('API JSON validation rejects null, arrays and oversized text', async () => {
  for (const payload of ['null', '[]']) {
    await assert.rejects(
      readJsonObject(new Request('https://example.test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })),
      ApiValidationError,
    )
  }

  assert.throws(() => requiredText('x'.repeat(121), 'Nome', 120), ApiValidationError)
})

test('API JSON validation cancels an oversized streamed body before buffering it all', async () => {
  let pulls = 0
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1
      if (pulls > 20) {
        controller.close()
        return
      }
      controller.enqueue(new Uint8Array(8 * 1024).fill(65))
    },
    cancel() {
      cancelled = true
    },
  })
  const request = new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })

  await assert.rejects(readJsonObject(request), ApiPayloadTooLargeError)
  assert.equal(cancelled, true)
  assert.ok(pulls < 20)
})

test('API JSON validation enforces a JSON media type', async () => {
  await assert.rejects(
    readJsonObject(new Request('https://example.test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{"nome":"Thor"}',
    })),
    ApiUnsupportedMediaTypeError,
  )

  const parsed = await readJsonObject(new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
    body: '{"nome":"Thor"}',
  }))
  assert.deepEqual(parsed, { nome: 'Thor' })
})

test('API payload contracts reject unknown fields instead of ignoring typos', () => {
  assert.doesNotThrow(() => assertAllowedKeys({ nome: 'Thor' }, ['nome']))
  assert.throws(
    () => assertAllowedKeys({ nome: 'Thor', nomme: 'typo' }, ['nome']),
    ApiValidationError,
  )
})

test('JSON-LD serialization cannot terminate its script element', () => {
  const serialized = serializeJsonLd({ title: '</script><script>alert(1)</script>' })
  assert.doesNotMatch(serialized, /<|>|&/)
  assert.match(serialized, /\\u003c\/script\\u003e/)
  assert.deepEqual(JSON.parse(serialized), { title: '</script><script>alert(1)</script>' })
})

test('production CSP excludes eval and direct browser access to the AI provider', () => {
  const config = JSON.parse(readFileSync(
    resolve(import.meta.dirname, '../../vercel.json'),
    'utf8',
  )) as {
    headers: Array<{ headers: Array<{ key: string; value: string }> }>
  }
  const csp = config.headers
    .flatMap((entry) => entry.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value

  assert.ok(csp)
  assert.doesNotMatch(csp, /'unsafe-eval'|api\.openai\.com/)
  assert.match(csp, /object-src 'none'/)
})

test('rendered logos use bounded optimized derivatives', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const sources = [
    'src/components/ui/VetDoRimLogo.tsx',
    'src/components/marketing/Header.tsx',
    'src/components/marketing/Footer.tsx',
    'src/app/page.tsx',
  ].map((path) => readFileSync(resolve(webRoot, path), 'utf8')).join('\n')

  for (const legacyAsset of [
    '/logo/5.png',
    '/logo/Monocromática - Dourada.png',
    '/logo/Monocromática - Fundo Escuro.png',
  ]) {
    assert.doesNotMatch(sources, new RegExp(legacyAsset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const optimizedAsset of [
    'public/logo/symbol-gold.webp',
    'public/logo/logo-gold-vertical.webp',
    'public/logo/logo-dark-vertical.webp',
  ]) {
    assert.ok(statSync(resolve(webRoot, optimizedAsset)).size <= 100_000)
  }

  const footer = readFileSync(
    resolve(webRoot, 'src/components/marketing/Footer.tsx'),
    'utf8',
  )
  assert.match(footer, /symbol-gold\.webp[\s\S]*?loading="eager"/)
})

test('authenticated forms fail closed on session, cleanup and quota errors', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const resetForm = readFileSync(
    resolve(webRoot, 'src/app/auth/redefinir-senha/ResetForm.tsx'),
    'utf8',
  )
  const profileForm = readFileSync(
    resolve(webRoot, 'src/app/lab/perfil/ProfileForm.tsx'),
    'utf8',
  )
  const uploader = readFileSync(
    resolve(webRoot, 'src/components/lab/LaudoUploader.tsx'),
    'utf8',
  )
  const labLayout = readFileSync(
    resolve(webRoot, 'src/app/lab/layout.tsx'),
    'utf8',
  )
  const labShell = readFileSync(
    resolve(webRoot, 'src/components/lab/LabShell.tsx'),
    'utf8',
  )
  const tutorActions = readFileSync(
    resolve(webRoot, 'src/app/lab/tutores/[id]/TutorPetActions.tsx'),
    'utf8',
  )
  const laudosPage = readFileSync(
    resolve(webRoot, 'src/app/lab/pacientes/[petId]/laudos/page.tsx'),
    'utf8',
  )

  assert.match(resetForm, /recoveryAuthorized/)
  assert.match(resetForm, /if \(!recoveryAuthorized\)/)
  assert.match(resetForm, /setStatus\('no-session'\)/)
  assert.doesNotMatch(resetForm, /event === 'SIGNED_IN'/)
  assert.match(profileForm, /error: authError/)
  assert.match(profileForm, /lastRequestedEmail/)
  assert.match(profileForm, /role="alert"/)
  assert.equal((profileForm.match(/\.select\('id'\)\s*\.maybeSingle\(\)/g) ?? []).length, 2)
  assert.match(profileForm, /router\.refresh\(\)/)
  assert.match(uploader, /aiQuotaStatus !== 'ready'/)
  assert.match(uploader, /setAiQuotaStatus\('error'\)/)
  assert.match(uploader, /\}, \[pdfUrl\]\)/)
  assert.match(uploader, /removedFiles\?\.length !== 1/)
  assert.match(uploader, /setCleanupBlocked\(true\)/)
  assert.match(uploader, /status === 'error' && !laudoId && !cleanupBlocked/)
  assert.match(uploader, /if \(!pdfFile \|\| laudoId \|\| cleanupBlocked \|\| operationInFlightRef\.current\) return/)
  assert.match(uploader, /laudoId && !result && \(status === 'done' \|\| status === 'error'\)/)
  assert.match(uploader, /Tentar análise novamente/)
  assert.match(uploader, /disabled=\{isPending \|\| cleanupBlocked\}/)
  assert.doesNotMatch(labLayout, /userEmail=|user\.email/)
  assert.doesNotMatch(labLayout, /<LabShell user=\{user\}/)
  assert.doesNotMatch(labShell, /import type \{ User \}/)
  assert.doesNotMatch(labShell, /userEmail/)
  assert.match(labShell, /const \{ error \} = await supabase\.auth\.signOut\(\)/)
  assert.match(labShell, /logoutError/)
  assert.match(labShell, /md:translate-x-0/)
  assert.match(labShell, /md:ml-64/)
  assert.match(labShell, /inert=\{!sidebarInteractive\}/)
  assert.match(uploader, /grid grid-cols-1 lg:grid-cols-2/)
  assert.match(tutorActions, /max-h-\[calc\(100dvh-1\.5rem\)\] overflow-y-auto/)
  assert.match(tutorActions, /Óbito em revisão/)
  assert.match(tutorActions, /requestJsonMutation\(/)
  assert.match(tutorActions, /method: 'PATCH'/)
  assert.match(tutorActions, /isMutationOutcomeAmbiguous\(result\)/)
  assert.doesNotMatch(tutorActions, /createClient|\.from\('(?:pets|triagens|follow_ups)'\)/)
  assert.doesNotMatch(tutorActions, /status_paciente:\s*'obito'/)
  assert.match(laudosPage, /min-w-0 truncate/)
})

test('authenticated UI prevents duplicate mutations and false clinical references', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const sources = [
    'src/components/auth/CadastroForm.tsx',
    'src/components/auth/LoginForm.tsx',
    'src/app/auth/recuperar-senha/RecoverForm.tsx',
    'src/app/auth/redefinir-senha/ResetForm.tsx',
    'src/app/lab/pacientes/novo/PacienteForm.tsx',
    'src/app/lab/tutores/novo/TutorForm.tsx',
    'src/app/lab/perfil/ProfileForm.tsx',
    'src/app/lab/tutores/[id]/TutorPetActions.tsx',
    'src/components/lab/LaudoUploader.tsx',
    'src/components/lab/LabShell.tsx',
    'src/app/portal/PortalLogoutButton.tsx',
  ].map((path) => readFileSync(resolve(webRoot, path), 'utf8'))

  for (const source of sources) {
    assert.match(source, /InFlightRef\.current/)
  }

  for (const formPath of [
    'src/app/lab/pacientes/novo/PacienteForm.tsx',
    'src/app/lab/tutores/novo/TutorForm.tsx',
  ]) {
    const createForm = readFileSync(resolve(webRoot, formPath), 'utf8')
    assert.match(createForm, /isMutationOutcomeAmbiguous\(result\)/)
    assert.match(createForm, /setSubmissionLocked\(true\)/)
    assert.match(createForm, /if \(releaseSubmission\)/)
    assert.match(createForm, /Confira a lista antes de reenviar/)
  }

  const evolutionTable = readFileSync(
    resolve(webRoot, 'src/components/lab/LabEvolutionTable.tsx'),
    'utf8',
  )
  assert.match(evolutionTable, /resolveReferenceSpecies\(especie\)/)
  assert.match(evolutionTable, /referenceSpecies \? getRefForSpecies\(especie\) : \{\}/)
  assert.match(evolutionTable, /Referência indisponível para esta espécie/)
  assert.match(evolutionTable, /aria-expanded=\{!isCollapsed\}/)

  const patientPage = readFileSync(
    resolve(webRoot, 'src/app/lab/pacientes/[petId]/page.tsx'),
    'utf8',
  )
  assert.match(patientPage, /pendente: \{ label: 'Aguardando análise'/)
  assert.match(patientPage, /processando: \{ label: 'Processando'/)
})

test('registration and theme controls remain visible in light and dark modes', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const registrationPage = readFileSync(
    resolve(webRoot, 'src/app/auth/cadastro/page.tsx'),
    'utf8',
  )
  const registrationForm = readFileSync(
    resolve(webRoot, 'src/components/auth/CadastroForm.tsx'),
    'utf8',
  )
  const themeToggle = readFileSync(
    resolve(webRoot, 'src/components/ui/ThemeToggle.tsx'),
    'utf8',
  )
  const loginForm = readFileSync(
    resolve(webRoot, 'src/components/auth/LoginForm.tsx'),
    'utf8',
  )
  const recoverPage = readFileSync(
    resolve(webRoot, 'src/app/auth/recuperar-senha/page.tsx'),
    'utf8',
  )
  const resetPage = readFileSync(
    resolve(webRoot, 'src/app/auth/redefinir-senha/page.tsx'),
    'utf8',
  )

  assert.match(registrationPage, /<ThemeToggle \/>/)
  assert.match(registrationPage, /dark:bg-\[#0A0A0C\]/)
  assert.match(registrationPage, /dark:text-white/)
  assert.match(registrationForm, /dark:bg-\[#111827\]/)
  assert.match(registrationForm, /dark:text-science-100/)
  assert.match(themeToggle, /text-slate-500/)
  assert.match(themeToggle, /dark:text-white\/60/)
  assert.match(themeToggle, /resolvedTheme/)
  assert.match(themeToggle, /type="button"/)
  assert.match(themeToggle, /aria-label=\{toggleLabel\}/)
  assert.match(themeToggle, /min-h-11 min-w-11/)
  assert.match(themeToggle, /inverted/)
  assert.match(loginForm, /dark:bg-white\/5/)
  assert.match(loginForm, /dark:text-white/)
  assert.match(recoverPage, /<ThemeToggle \/>/)
  assert.match(recoverPage, /dark:from-\[#0C1E3D\]/)
  assert.match(resetPage, /<ThemeToggle \/>/)
  assert.match(resetPage, /dark:from-\[#0C1E3D\]/)
})

test('route identifiers and list pages reject malformed or unsafe values', () => {
  assert.equal(isUuid('9b91b5d8-9337-4e8f-9f4a-a8f337df9920'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  assert.equal(isUuid('00000000-0000-0000-0000-000000000000'), false)

  assert.equal(parseListPage(undefined, 25), 1)
  assert.equal(parseListPage(['2', '3'], 25), 1)
  assert.equal(parseListPage('2suffix', 25), 1)
  assert.equal(parseListPage('1e3', 25), 1)
  assert.equal(parseListPage('0', 25), 1)
  assert.equal(parseListPage(String(MAX_LIST_PAGE), 25), MAX_LIST_PAGE)
  assert.equal(parseListPage(String(MAX_LIST_PAGE + 1), 25), 1)
  assert.equal(parseListPage(String(Number.MAX_SAFE_INTEGER), 25), 1)
  assert.deepEqual(listPageRange(3, 25), { firstRow: 50, lastRow: 74 })
  assert.deepEqual(listPageRange(Number.MAX_SAFE_INTEGER, 25), { firstRow: 0, lastRow: 24 })
  assert.deepEqual(listPageRange(1, 0), { firstRow: 0, lastRow: 0 })
  assert.equal(boundedTotalPages((MAX_LIST_PAGE + 1) * 25, 25), MAX_LIST_PAGE)
  assert.equal(parseListPage(String(boundedTotalPages((MAX_LIST_PAGE + 1) * 25, 25) + 1), 25), 1)
})

test('tutor selection proves the 201-record boundary without guessing an owner', () => {
  const tutors = Array.from({ length: TUTOR_SELECTION_LIMIT + 1 }, (_, index) => ({
    id: `tutor-${index + 1}`,
    nome: `Tutor ${index + 1}`,
  }))

  const withoutSelection = resolveTutorSelection(tutors)
  assert.equal(withoutSelection.selectionRequiresTutorFlow, true)
  assert.equal(withoutSelection.tutores.length, TUTOR_SELECTION_LIMIT)

  const requestedTutor = { id: 'tutor-outside-window', nome: 'Tutor selecionado' }
  const withExactSelection = resolveTutorSelection(
    tutors,
    requestedTutor.id,
    requestedTutor,
  )
  assert.equal(withExactSelection.selectionRequiresTutorFlow, false)
  assert.equal(withExactSelection.safeDefaultTutorId, requestedTutor.id)
  assert.deepEqual(withExactSelection.tutores, [requestedTutor])

  const unknownSelection = resolveTutorSelection(tutors, 'unknown-tutor', null)
  assert.equal(unknownSelection.selectionRequiresTutorFlow, true)
  assert.equal(unknownSelection.safeDefaultTutorId, undefined)

  const boundaryTutor = tutors[TUTOR_SELECTION_LIMIT]
  const boundarySelection = resolveTutorSelection(tutors, boundaryTutor.id, null)
  assert.equal(boundarySelection.selectionRequiresTutorFlow, false)
  assert.equal(boundarySelection.safeDefaultTutorId, boundaryTutor.id)
  assert.deepEqual(boundarySelection.tutores, [boundaryTutor])
})

test('clinical lists expose search, totals and bounded pagination without silent truncation', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const patientsPage = readFileSync(
    resolve(webRoot, 'src/app/lab/pacientes/page.tsx'),
    'utf8',
  )
  const tutorsPage = readFileSync(
    resolve(webRoot, 'src/app/lab/tutores/page.tsx'),
    'utf8',
  )
  const newPatientPage = readFileSync(
    resolve(webRoot, 'src/app/lab/pacientes/novo/page.tsx'),
    'utf8',
  )
  const tutorDetailPage = readFileSync(
    resolve(webRoot, 'src/app/lab/tutores/[id]/page.tsx'),
    'utf8',
  )
  const reportHistoryPage = readFileSync(
    resolve(webRoot, 'src/app/lab/pacientes/[petId]/laudos/page.tsx'),
    'utf8',
  )

  for (const source of [patientsPage, tutorsPage, tutorDetailPage, reportHistoryPage]) {
    assert.match(source, /\{ count: 'exact' \}/)
    assert.match(source, /\.range\(/)
    assert.match(source, /<ListPagination/)
  }
  assert.match(patientsPage, /role="search"/)
  assert.match(tutorsPage, /role="search"/)
  assert.doesNotMatch(patientsPage, /\.limit\(50\)/)
  assert.doesNotMatch(tutorsPage, /\.limit\(50\)/)
  assert.match(newPatientPage, /\.limit\(TUTOR_SELECTION_LIMIT \+ 1\)/)
  assert.match(newPatientPage, /selectionRequiresTutorFlow/)
  assert.match(newPatientPage, /resolveTutorSelection\(/)
  assert.match(newPatientPage, /\.eq\('id', requestedTutorId\)/)
  assert.match(reportHistoryPage, /Histórico de laudos/)
})

test('password recovery delegates recovery intent to the PKCE verifier state', () => {
  const source = readFileSync(
    resolve(import.meta.dirname, '../../src/app/auth/recuperar-senha/RecoverForm.tsx'),
    'utf8',
  )

  assert.match(source, /new URL\('\/auth\/callback', window\.location\.origin\)/)
  assert.doesNotMatch(source, /searchParams\.set\('next'/)
  assert.doesNotMatch(source, /[?&]type=recovery/)
})

test('free laboratory dashboard keeps mobile icon controls accessible', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const dashboard = readFileSync(
    resolve(webRoot, 'src/components/ferramentas/lab-free/FreeDashboard.tsx'),
    'utf8',
  )

  assert.match(dashboard, /aria-label="Voltar para pacientes"/)
  assert.match(dashboard, /role="tablist"/)
  assert.match(dashboard, /aria-selected=\{tab === t\.id\}/)
  assert.match(dashboard, /aria-label=\{t\.label\}/)
  assert.match(dashboard, /sr-only sm:not-sr-only/)
  assert.match(dashboard, /flex flex-wrap items-center/)
})

test('public legal pages do not claim unverified compliance or operational guarantees', () => {
  const webRoot = resolve(import.meta.dirname, '../..')
  const privacy = readFileSync(
    resolve(webRoot, 'src/app/legal/privacidade/page.tsx'),
    'utf8',
  )
  const terms = readFileSync(
    resolve(webRoot, 'src/app/legal/termos/page.tsx'),
    'utf8',
  )
  const cookieBanner = readFileSync(
    resolve(webRoot, 'src/components/ui/CookieBanner.tsx'),
    'utf8',
  )

  assert.doesNotMatch(privacy, /em conformidade com a LGPD/i)
  assert.doesNotMatch(privacy, /TLS 1\.3|DPO \(|controle de acesso por Row Level Security/i)
  assert.doesNotMatch(terms, /usuários serão notificados por e-mail/i)
  assert.doesNotMatch(cookieBanner, /conforme (a )?Lei Geral|conforme (a )?LGPD/i)

  for (const source of [privacy, terms]) {
    assert.match(source, /Versão preliminar/)
    assert.match(source, /revisão jurídica/i)
    assert.match(source, /localStorage/)
    assert.match(source, /dispositivo compartilhado/i)
    assert.match(source, /dados do site Vet do Rim/i)
    assert.match(source, /\[&_h2\]:mt-10/)
    assert.match(source, /\[&_ul\]:list-disc/)
    assert.match(source, /dark:text-slate-100/)
  }
})

test('free lab storage accepts only complete patient and exam records', () => {
  const patient = {
    id: 'patient-1',
    petName: 'Rex',
    species: 'Canino',
    breed: '',
    sex: 'Macho',
    birthDate: '',
    tutorName: 'Maria',
    createdAt: '2026-07-17T12:00:00.000Z',
  }
  const exam = {
    id: 'exam-1',
    patientId: patient.id,
    examDate: '2026-07-17',
    labName: 'Laboratório',
    parameters: [{ name: 'Creatinina', value: '1.2', unit: 'mg/dL' }],
    createdAt: '2026-07-17T12:30:00.000Z',
  }

  assert.deepEqual(parsePatientsStorage(JSON.stringify([patient])), [patient])
  assert.deepEqual(parseExamsStorage(JSON.stringify([exam])), [exam])
})

test('free lab storage fails closed on malformed or structurally invalid records', () => {
  const originalWarn = console.warn
  const warnings: string[] = []
  console.warn = (message?: unknown) => warnings.push(String(message))

  try {
    assert.deepEqual(parsePatientsStorage('{invalid-json'), [])
    assert.deepEqual(parsePatientsStorage(JSON.stringify({ id: 'not-an-array' })), [])
    assert.deepEqual(parsePatientsStorage(JSON.stringify([{ id: 'incomplete' }])), [])
    assert.deepEqual(parseExamsStorage(JSON.stringify([{
      id: 'exam-1',
      patientId: 'patient-1',
      examDate: '2026-07-17',
      labName: 'Laboratório',
      parameters: [{ name: 'Creatinina', value: 1.2, unit: 'mg/dL' }],
      createdAt: '2026-07-17T12:30:00.000Z',
    }])), [])
  } finally {
    console.warn = originalWarn
  }

  assert.equal(warnings.length, 4)
  assert.ok(warnings.every((warning) => !warning.includes('invalid-json')))
})

test('free lab snapshot rejects duplicates, orphan exams and oversized fields', async () => {
  const patient = {
    id: 'patient-1',
    petName: 'Rex',
    species: 'Canino',
    breed: '',
    sex: 'Macho' as const,
    birthDate: '',
    tutorName: 'Maria',
    createdAt: '2026-07-17T12:00:00.000Z',
  }
  const exam = {
    id: 'exam-1',
    patientId: patient.id,
    examDate: '2026-07-17',
    labName: 'Laboratory',
    parameters: [{ name: 'Creatinina', value: '1.2', unit: 'mg/dL' }],
    createdAt: '2026-07-17T12:30:00.000Z',
  }

  const duplicateStorage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([patient, patient]),
    [EXAMS_KEY]: JSON.stringify([]),
  })
  try {
    await assert.rejects(
      () => getFreeLabSnapshot(),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'CORRUPT',
    )
  } finally {
    duplicateStorage.restore()
  }

  const orphanStorage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([patient]),
    [EXAMS_KEY]: JSON.stringify([{ ...exam, patientId: 'missing-patient' }]),
  })
  try {
    await assert.rejects(
      () => getFreeLabSnapshot(),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'CORRUPT',
    )
  } finally {
    orphanStorage.restore()
  }

  assert.deepEqual(parsePatientsStorage(JSON.stringify([{
    ...patient,
    petName: 'R'.repeat(FREE_LAB_LIMITS.patientName + 1),
  }])), [])
})

test('free lab refuses exams for unknown patients without writing storage', async () => {
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([]),
    [EXAMS_KEY]: JSON.stringify([]),
  })
  try {
    await assert.rejects(
      () => saveExam({
        id: 'exam-1',
        patientId: 'missing-patient',
        examDate: '2026-07-17',
        labName: '',
        parameters: [{ name: 'Creatinina', value: '1.2', unit: 'mg/dL' }],
        createdAt: '2026-07-17T12:30:00.000Z',
      }, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'PARENT_NOT_FOUND',
    )
    assert.equal(storage.setCalls, 0)
  } finally {
    storage.restore()
  }
})

test('every free lab mutation validates both storage collections before writing', async () => {
  const patient = {
    id: 'patient-1',
    petName: 'Rex',
    species: 'Canino',
    breed: '',
    sex: 'Macho' as const,
    birthDate: '',
    tutorName: 'Maria',
    createdAt: '2026-07-17T12:00:00.000Z',
  }
  const corruptExams = '{corrupt-exams'
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([patient]),
    [EXAMS_KEY]: corruptExams,
  })
  const originalWarn = console.warn
  console.warn = () => undefined
  try {
    await assert.rejects(
      () => savePatient({ ...patient, petName: 'Rex updated' }, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'CORRUPT',
    )
    assert.equal(storage.setCalls, 0)
    assert.equal(storage.values.get(EXAMS_KEY), corruptExams)
  } finally {
    console.warn = originalWarn
    storage.restore()
  }
})

test('free lab collection limit rejects a new patient but permits an existing update', async () => {
  const patients = Array.from({ length: FREE_LAB_LIMITS.patients }, (_, index) => ({
    id: `patient-${index}`,
    petName: `Pet ${index}`,
    species: 'Canino',
    breed: '',
    sex: 'Macho' as const,
    birthDate: '',
    tutorName: 'Maria',
    createdAt: '2026-07-17T12:00:00.000Z',
  }))
  const originalRaw = JSON.stringify(patients)
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: originalRaw,
    [EXAMS_KEY]: JSON.stringify([]),
  })
  try {
    await assert.rejects(
      () => savePatient({ ...patients[0], id: 'new-patient' }, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'WRITE_FAILED',
    )
    assert.equal(storage.setCalls, 0)
    assert.equal(storage.values.get(PATIENTS_KEY), originalRaw)

    await savePatient({ ...patients[0], petName: 'Updated pet' }, 0)
    assert.equal(storage.setCalls, 1)
    assert.equal(JSON.parse(storage.values.get(FREE_LAB_STATE_KEY) ?? '{}').patients.length, FREE_LAB_LIMITS.patients)
    assert.equal(storage.values.get(PATIENTS_KEY), originalRaw)
  } finally {
    storage.restore()
  }
})

test('free lab mutations never overwrite corrupt or unavailable storage', async () => {
  const patient = {
    id: 'patient-1',
    petName: 'Rex',
    species: 'Canino',
    breed: '',
    sex: 'Macho' as const,
    birthDate: '',
    tutorName: 'Maria',
    createdAt: '2026-07-17T12:00:00.000Z',
  }
  const corruptRaw = '{invalid-json'
  const corruptStorage = installMockLocalStorage({ [PATIENTS_KEY]: corruptRaw })
  const originalWarn = console.warn
  console.warn = () => undefined
  try {
    await assert.rejects(
      () => getPatients(),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'CORRUPT',
    )
    await assert.rejects(
      () => savePatient(patient, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'CORRUPT',
    )
    assert.equal(corruptStorage.setCalls, 0)
    assert.equal(corruptStorage.values.get(PATIENTS_KEY), corruptRaw)
  } finally {
    console.warn = originalWarn
    corruptStorage.restore()
  }

  const unavailableStorage = installMockLocalStorage({}, { failGet: true })
  try {
    await assert.rejects(
      () => getPatients(),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'UNAVAILABLE',
    )
  } finally {
    unavailableStorage.restore()
  }
})

test('free lab v2 migration is atomic and preserves the legacy snapshot on quota failure', async () => {
  const patient = {
    id: 'patient-1',
    petName: 'Rex',
    species: 'Canino',
    breed: '',
    sex: 'Macho' as const,
    birthDate: '',
    tutorName: 'Maria',
    createdAt: '2026-07-17T12:00:00.000Z',
  }
  const exam = {
    id: 'exam-1',
    patientId: patient.id,
    examDate: '2026-07-17',
    labName: 'Laboratório',
    parameters: [{ name: 'Creatinina', value: '1.2', unit: 'mg/dL' }],
    createdAt: '2026-07-17T12:30:00.000Z',
  }
  const originalPatients = JSON.stringify([patient])
  const originalExams = JSON.stringify([exam])
  const storage = installMockLocalStorage(
    { [PATIENTS_KEY]: originalPatients, [EXAMS_KEY]: originalExams },
    { failSetCalls: [1] },
  )

  try {
    await assert.rejects(
      () => deletePatient(patient.id, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'WRITE_FAILED',
    )
    assert.equal(storage.values.get(PATIENTS_KEY), originalPatients)
    assert.equal(storage.values.get(EXAMS_KEY), originalExams)
    assert.equal(storage.values.has(FREE_LAB_STATE_KEY), false)
    assert.equal(storage.setCalls, 1)
  } finally {
    storage.restore()
  }
})

test('free lab migrates legacy data into one verified v2 document without deleting the backup', async () => {
  const patient = {
    id: 'patient-1', petName: 'Rex', species: 'Canino', breed: '', sex: 'Macho' as const,
    birthDate: '', tutorName: 'Maria', createdAt: '2026-07-17T12:00:00.000Z',
  }
  const exam = {
    id: 'exam-1', patientId: patient.id, examDate: '2026-07-17', labName: 'Laboratório',
    parameters: [{ name: 'Creatinina', value: '1.2', unit: 'mg/dL' }],
    createdAt: '2026-07-17T12:30:00.000Z',
  }
  const originalPatients = JSON.stringify([patient])
  const originalExams = JSON.stringify([exam])
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: originalPatients,
    [EXAMS_KEY]: originalExams,
  })

  try {
    const committed = await savePatient({ ...patient, petName: 'Rex atualizado' }, 0)
    assert.equal(committed.revision, 1)
    assert.equal(committed.patients[0].petName, 'Rex atualizado')
    assert.deepEqual(committed.exams, [exam])
    assert.equal(storage.values.get(PATIENTS_KEY), originalPatients)
    assert.equal(storage.values.get(EXAMS_KEY), originalExams)
    const persisted = JSON.parse(storage.values.get(FREE_LAB_STATE_KEY) ?? '{}')
    assert.equal(persisted.schemaVersion, 2)
    assert.equal(persisted.revision, 1)
    assert.equal(persisted.patients[0].petName, 'Rex atualizado')
    assert.equal(storage.setCalls, 1)
  } finally {
    storage.restore()
  }
})

test('two tabs starting from one revision produce one commit and one explicit conflict', async () => {
  const base = {
    species: 'Canino', breed: '', sex: 'Macho' as const, birthDate: '', tutorName: 'Maria',
    createdAt: '2026-07-17T12:00:00.000Z',
  }
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([]),
    [EXAMS_KEY]: JSON.stringify([]),
  })

  try {
    const results = await Promise.allSettled([
      savePatient({ ...base, id: 'patient-a', petName: 'A' }, 0),
      savePatient({ ...base, id: 'patient-b', petName: 'B' }, 0),
    ])
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    const rejected = results.find((result) => result.status === 'rejected')
    assert.ok(rejected?.status === 'rejected')
    assert.ok(rejected.reason instanceof FreeLabStorageError)
    assert.equal(rejected.reason.code, 'CONFLICT')
    const snapshot = await getFreeLabSnapshot()
    assert.equal(snapshot.revision, 1)
    assert.equal(snapshot.patients.length, 1)
    assert.equal(storage.setCalls, 1)
  } finally {
    storage.restore()
  }
})

test('stale destructive intent never deletes data added after confirmation', async () => {
  const patient = {
    id: 'patient-1', petName: 'Rex', species: 'Canino', breed: '', sex: 'Macho' as const,
    birthDate: '', tutorName: 'Maria', createdAt: '2026-07-17T12:00:00.000Z',
  }
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([patient]),
    [EXAMS_KEY]: JSON.stringify([]),
  })

  try {
    await saveExam({
      id: 'exam-1', patientId: patient.id, examDate: '2026-07-17', labName: '',
      parameters: [{ name: 'Creatinina', value: '1.2', unit: 'mg/dL' }],
      createdAt: '2026-07-17T12:30:00.000Z',
    }, 0)
    await assert.rejects(
      () => deletePatient(patient.id, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'CONFLICT',
    )
    const snapshot = await getFreeLabSnapshot()
    assert.equal(snapshot.patients.length, 1)
    assert.equal(snapshot.exams.length, 1)
    assert.equal(storage.setCalls, 1)
  } finally {
    storage.restore()
  }
})

test('patient deletion and exam creation cannot produce an orphan record', async () => {
  const patient = {
    id: 'patient-1', petName: 'Rex', species: 'Canino', breed: '', sex: 'Macho' as const,
    birthDate: '', tutorName: 'Maria', createdAt: '2026-07-17T12:00:00.000Z',
  }
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([patient]),
    [EXAMS_KEY]: JSON.stringify([]),
  })

  try {
    await deletePatient(patient.id, 0)
    await assert.rejects(
      () => saveExam({
        id: 'exam-1', patientId: patient.id, examDate: '2026-07-17', labName: '',
        parameters: [{ name: 'Creatinina', value: '1.2', unit: 'mg/dL' }],
        createdAt: '2026-07-17T12:30:00.000Z',
      }, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'PARENT_NOT_FOUND',
    )
    const snapshot = await getFreeLabSnapshot()
    assert.deepEqual(snapshot.patients, [])
    assert.deepEqual(snapshot.exams, [])
    assert.equal(storage.setCalls, 1)
  } finally {
    storage.restore()
  }
})

test('post-write verification failure is reported as ambiguous and never rolled back blindly', async () => {
  const patient = {
    id: 'patient-1', petName: 'Rex', species: 'Canino', breed: '', sex: 'Macho' as const,
    birthDate: '', tutorName: 'Maria', createdAt: '2026-07-17T12:00:00.000Z',
  }
  const originalPatients = JSON.stringify([patient])
  const originalExams = JSON.stringify([])
  const storage = installMockLocalStorage(
    { [PATIENTS_KEY]: originalPatients, [EXAMS_KEY]: originalExams },
    {
      afterSet: (_call, key, values) => {
        if (key === FREE_LAB_STATE_KEY) values.set(key, '{"interleaved":true}')
      },
    },
  )

  try {
    await assert.rejects(
      () => savePatient({ ...patient, petName: 'Novo nome' }, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'OUTCOME_UNKNOWN',
    )
    assert.equal(storage.values.get(PATIENTS_KEY), originalPatients)
    assert.equal(storage.values.get(EXAMS_KEY), originalExams)
    assert.equal(storage.values.get(FREE_LAB_STATE_KEY), '{"interleaved":true}')
    assert.equal(storage.setCalls, 1)
  } finally {
    storage.restore()
  }
})

test('legacy writes after v2 cutover are detected without changing the canonical document', async () => {
  const patient = {
    id: 'patient-1', petName: 'Rex', species: 'Canino', breed: '', sex: 'Macho' as const,
    birthDate: '', tutorName: 'Maria', createdAt: '2026-07-17T12:00:00.000Z',
  }
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([patient]),
    [EXAMS_KEY]: JSON.stringify([]),
  })

  try {
    await savePatient({ ...patient, petName: 'Rex v2' }, 0)
    const canonical = storage.values.get(FREE_LAB_STATE_KEY)
    storage.values.set(PATIENTS_KEY, JSON.stringify([{ ...patient, petName: 'Aba antiga' }]))
    await assert.rejects(
      () => getFreeLabSnapshot(),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'LEGACY_CONFLICT',
    )
    assert.equal(storage.values.get(FREE_LAB_STATE_KEY), canonical)
    assert.equal(storage.setCalls, 1)
  } finally {
    storage.restore()
  }
})

test('free lab mutations fail closed when cross-tab locking is unavailable', async () => {
  const patient = {
    id: 'patient-1', petName: 'Rex', species: 'Canino', breed: '', sex: 'Macho' as const,
    birthDate: '', tutorName: 'Maria', createdAt: '2026-07-17T12:00:00.000Z',
  }
  const storage = installMockLocalStorage({
    [PATIENTS_KEY]: JSON.stringify([]),
    [EXAMS_KEY]: JSON.stringify([]),
  })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })

  try {
    await assert.rejects(
      () => savePatient(patient, 0),
      (error: unknown) => error instanceof FreeLabStorageError && error.code === 'LOCK_UNAVAILABLE',
    )
    assert.equal(storage.setCalls, 0)
  } finally {
    storage.restore()
  }
})

test('free laboratory screens preserve an explicit dark-mode surface', () => {
  const sources = [
    '../../src/app/ferramentas/planilha-laboratorial/page.tsx',
    '../../src/components/ferramentas/lab-free/FreeLabApp.tsx',
    '../../src/components/ferramentas/lab-free/FreePatientList.tsx',
    '../../src/components/ferramentas/lab-free/FreePatientForm.tsx',
    '../../src/components/ferramentas/lab-free/FreeDashboard.tsx',
    '../../src/components/ferramentas/lab-free/FreeExamForm.tsx',
    '../../src/components/ferramentas/lab-free/FreeEvolutionTable.tsx',
    '../../src/components/ferramentas/lab-free/FreeChartsView.tsx',
    '../../src/components/ferramentas/lab-free/LeadGate.tsx',
  ]

  for (const source of sources) {
    const contents = readFileSync(resolve(import.meta.dirname, source), 'utf8')
    assert.match(contents, /dark:/, `${source} must define an explicit dark-mode state`)
  }
})

test('laboratory references classify only complete numeric evidence', () => {
  assert.equal(parseLabNumber('1,8'), 1.8)
  assert.equal(parseLabNumber('-2.5e-2'), -0.025)
  assert.equal(parseLabNumber('1.8 mg/dL'), null)
  assert.equal(parseLabNumber('1,2.3'), null)

  assert.equal(getLabReferenceStatus({ name: 'Creatinina', value: '1,8', unit: 'mg/dL' }), 'unavailable')
  assert.equal(getLabReferenceStatus({ name: 'Creatinina', value: '1,8', unit: 'mg/dL', refMin: '0,5', refMax: '1,4' }), 'abnormal')
  assert.equal(getLabReferenceStatus({ name: 'Creatinina', value: '1,2', unit: 'mg/dL', refMin: '0,5', refMax: '1,4' }), 'normal')
  assert.equal(getLabReferenceStatus({ name: 'Creatinina', value: '1,2', unit: 'mg/dL', refMin: '2', refMax: '1' }), 'unavailable')
})
