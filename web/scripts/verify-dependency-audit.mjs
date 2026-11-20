import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(webRoot, '..')

const APPROVED_UPSTREAM_UNPATCHED_DEV_ADVISORIES = new Map([
  [
    'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
    {
      packageName: 'picomatch',
      maxRange: '<=4.0.7',
      reason: 'dev-only lint glob dependency with no patched version >4.0.7 published upstream',
    },
  ],
])

function runNpmAuditJson(cwd, extraArgs) {
  const args = ['audit', '--json', ...extraArgs]
  const command = process.platform === 'win32'
    ? { file: process.env.ComSpec || 'cmd.exe', argv: ['/d', '/s', '/c', `npm ${args.join(' ')}`] }
    : { file: 'npm', argv: args }

  const result = spawnSync(command.file, command.argv, {
    cwd,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 20 * 1024 * 1024,
  })

  if (result.error) throw result.error
  if (!result.stdout?.trim()) {
    throw new Error(`npm ${args.join(' ')} in ${cwd} returned empty output (stderr: ${result.stderr?.trim() || 'none'})`)
  }

  let report
  try {
    report = JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`Failed to parse npm audit JSON output in ${cwd}: ${error.message}`)
  }

  if (report.error) {
    throw new Error(`npm audit error in ${cwd}: ${report.error.summary || report.error.code || 'unknown'}`)
  }

  return report
}

function collectRootAdvisories(packageName, vulnerabilities, visited = new Set()) {
  if (visited.has(packageName)) return []
  visited.add(packageName)

  const entry = vulnerabilities[packageName]
  if (!entry || !Array.isArray(entry.via)) return []

  const advisories = []
  for (const via of entry.via) {
    if (typeof via === 'string') {
      advisories.push(...collectRootAdvisories(via, vulnerabilities, visited))
    } else if (via && typeof via === 'object') {
      advisories.push(via)
    }
  }
  return advisories
}

function assertZeroProductionVulnerabilities(cwd, label, extraArgs = []) {
  const report = runNpmAuditJson(cwd, ['--omit=dev', ...extraArgs])
  const total = report?.metadata?.vulnerabilities?.total ?? 0
  const entries = Object.keys(report?.vulnerabilities ?? {})
  if (total > 0 || entries.length > 0) {
    throw new Error(
      `${label}: production runtime dependencies must have 0 vulnerabilities (found ${total}: ${entries.join(', ')})`,
    )
  }
  console.log(`${label}: production runtime audit PASS (0 vulnerabilities).`)
}

function assertFullTreeAuditWithStrictUpstreamAllowlist(cwd, label, extraArgs = []) {
  const report = runNpmAuditJson(cwd, extraArgs)
  const vulnerabilities = report?.vulnerabilities ?? {}
  const disallowedFindings = []
  const allowlistedWarnings = new Set()

  for (const [pkgName, entry] of Object.entries(vulnerabilities)) {
    const severity = entry?.severity || 'unknown'
    const advisories = collectRootAdvisories(pkgName, vulnerabilities)

    if (advisories.length === 0) {
      disallowedFindings.push(`${pkgName} (${severity}): unresolved advisory chain`)
      continue
    }

    for (const advisory of advisories) {
      const rule = APPROVED_UPSTREAM_UNPATCHED_DEV_ADVISORIES.get(advisory.url)
      const matchesRule = Boolean(
        rule &&
        advisory.name === rule.packageName &&
        advisory.range === rule.maxRange,
      )
      if (!matchesRule) {
        disallowedFindings.push(
          `${pkgName} (${severity}) via ${advisory.name || 'unknown'} [${advisory.url || 'no-url'} ${advisory.range || ''}]`,
        )
      } else {
        allowlistedWarnings.add(
          `[WARN] ${label}: Known unpatched upstream dev-only advisory ${advisory.url} (${advisory.name} ${advisory.range}); production runtime has 0 vulnerabilities.`,
        )
      }
    }
  }

  for (const warning of allowlistedWarnings) {
    console.warn(warning)
  }

  if (disallowedFindings.length > 0) {
    throw new Error(
      `${label}: disallowed vulnerabilities detected:\n- ${disallowedFindings.join('\n- ')}`,
    )
  }

  console.log(`${label}: full-tree dependency audit PASS (0 disallowed vulnerabilities).`)
}

assertZeroProductionVulnerabilities(webRoot, 'web')
assertFullTreeAuditWithStrictUpstreamAllowlist(webRoot, 'web')

if (process.argv.includes('--include-tooling')) {
  assertZeroProductionVulnerabilities(
    join(repoRoot, '.aiox-core'),
    '.aiox-core',
    ['--package-lock-only'],
  )
  assertZeroProductionVulnerabilities(
    join(repoRoot, '.aiox-core', 'scripts', 'diagnostics', 'health-dashboard'),
    '.aiox-core/health-dashboard',
    ['--package-lock-only'],
  )
}
