import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
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
      '--check',
      'scripts/lib/env-file.mjs',
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
  npmRun('build'),
  {
    command: process.execPath,
    args: [
      join(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      'tests/e2e/mobile-layout.spec.ts',
      'tests/e2e/lab-crud.spec.ts',
      'tests/e2e/upload-ia.spec.ts',
    ],
  },
]

for (const { command, args } of commands) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...placeholderEnv,
    },
    shell: false,
    stdio: 'inherit',
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

rmSync(join(process.cwd(), 'test-results'), { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
console.log('\nPredeploy check completed.')
