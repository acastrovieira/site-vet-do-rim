import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const placeholderEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder',
}

function npmRun(script) {
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `npm run ${script}`],
    }
  }

  return {
    command: 'npm',
    args: ['run', script],
  }
}

const commands = [
  {
    command: process.execPath,
    args: [
      'scripts/verify-supply-chain.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      'scripts/verify-migration-integrity.mjs',
      '--check',
    ],
  },
  {
    command: process.execPath,
    args: [
      'scripts/verify-edge-functions.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/lib/env-file.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/lib/readiness-safety.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/lib/supabase-target.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/e2e-auth-rls-cycle.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/e2e-lab-crud-cycle.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/e2e-upload-ia-cycle.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/remote-readiness-check.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/cleanup-e2e-lab-crud.mjs',
    ],
  },
  {
    command: process.execPath,
    args: [
      '--check',
      'scripts/cleanup-e2e-upload-ia.mjs',
    ],
  },
  npmRun('lint'),
  npmRun('typecheck'),
  npmRun('test'),
  npmRun('build'),
  {
    command: process.execPath,
    args: [
      join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      'tests/e2e/api-security.spec.ts',
      'tests/e2e/auth.spec.ts',
      'tests/e2e/public-smoke.spec.ts',
      'tests/e2e/public-flows.spec.ts',
      'tests/e2e/mobile-layout.spec.ts',
      'tests/e2e/tools-functional.spec.ts',
      'tests/e2e/seo-metadata.spec.ts',
      'tests/e2e/accessibility-navigation.spec.ts',
      'tests/e2e/motion-runtime.spec.ts',
      'tests/e2e/weight-history-safety.spec.ts',
      '--workers=1',
    ],
    env: {
      PORT: process.env.PREDEPLOY_E2E_PORT || '3310',
      PLAYWRIGHT_HOST: '127.0.0.1',
      PLAYWRIGHT_REUSE_EXISTING_SERVER: '0',
      PLAYWRIGHT_USE_PRODUCTION_SERVER: '1',
    },
  },
]

for (const { command, args, env = {} } of commands) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...placeholderEnv,
      ...env,
    },
    shell: false,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

console.log('\nPredeploy check completed.')
