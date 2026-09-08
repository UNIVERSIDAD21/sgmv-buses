import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const allowedLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'ISC',
  'MIT',
  'MIT-0',
  'MPL-2.0',
])
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function runJson(command, args) {
  return JSON.parse(
    execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      shell: process.platform === 'win32',
    }),
  )
}

function runText(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === 'win32',
  })
}

const audit = runJson(npmCommand, ['audit', '--audit-level=high', '--json'])
const vulnerabilities = audit.metadata?.vulnerabilities ?? {}
const highOrCritical = Number(vulnerabilities.high ?? 0) + Number(vulnerabilities.critical ?? 0)
if (highOrCritical > 0) {
  throw new Error(`npm audit reporta ${highOrCritical} vulnerabilidades altas/criticas`)
}

const licenses = new Map()
const unlicensedPackages = []
const packagePaths = [
  ...new Set(runText(npmCommand, ['ls', '--parseable', '--all']).split(/\r?\n/).filter(Boolean)),
]
for (const packagePath of packagePaths) {
  try {
    const packageJson = JSON.parse(readFileSync(`${packagePath}/package.json`, 'utf8'))
    if (packageJson.private === true) continue
    const license =
      typeof packageJson.license === 'string'
        ? packageJson.license
        : typeof packageJson.license?.type === 'string'
          ? packageJson.license.type
          : Array.isArray(packageJson.licenses)
            ? packageJson.licenses.map((item) => item.type ?? item).join(' OR ')
            : null
    if (!license) {
      unlicensedPackages.push(packageJson.name ?? packagePath)
      continue
    }
    licenses.set(license, (licenses.get(license) ?? 0) + 1)
  } catch {
    unlicensedPackages.push(packagePath)
  }
}
const unknownLicenses = [...licenses.keys()].filter((license) => !allowedLicenses.has(license))
if (unknownLicenses.length > 0 || unlicensedPackages.length > 0) {
  throw new Error(
    `Licencias no verificables: ${[...unknownLicenses, ...unlicensedPackages].join(', ')}`,
  )
}

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
const changed = execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).trim())
const files = [...new Set([...tracked, ...changed])].filter(
  (file) => !file.startsWith('node_modules/') && !file.startsWith('dist/'),
)
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
]
const secretHits = []
for (const file of files) {
  try {
    const content = readFileSync(file, 'utf8')
    if (secretPatterns.some((pattern) => pattern.test(content))) secretHits.push(file)
  } catch {
    // Deleted or non-text files are not secret evidence for this source scan.
  }
}
if (secretHits.length > 0) throw new Error(`Posibles secretos detectados en: ${secretHits.join(', ')}`)

console.log(
  JSON.stringify({
    p12Audit: {
      npmAuditHighCritical: highOrCritical,
      packagesWithLicense: licenses.size,
      unknownLicenses: unknownLicenses.length + unlicensedPackages.length,
      secretFiles: secretHits.length,
      status: 'PASS',
    },
  }),
)
