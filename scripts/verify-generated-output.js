const childProcess = require('child_process')
const path = require('path')

const ROOT_DIR = path.resolve(__dirname, '..')
const GENERATED_OUTPUT_PATHS = [
  'data',
  'updates',
  'tools',
  'categories',
  'collections',
  'catalog',
  'radar',
  'method',
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'service-worker.js',
  'llms.txt',
]

function normaliseStatusPath(line) {
  const statusPath = line.slice(3).trim()
  const destinationPath = statusPath.includes(' -> ')
    ? statusPath.split(' -> ').at(-1)
    : statusPath
  return destinationPath.replaceAll('\\', '/').replace(/^"|"$/g, '')
}

function isGeneratedOutputPath(filePath) {
  return GENERATED_OUTPUT_PATHS.some(
    (entry) => filePath === entry || filePath.startsWith(`${entry}/`),
  )
}

function findGeneratedOutputChanges(statusOutput) {
  return String(statusOutput || '')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => isGeneratedOutputPath(normaliseStatusPath(line)))
}

function readGeneratedOutputStatus(rootDir = ROOT_DIR) {
  return childProcess.execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all', '--', ...GENERATED_OUTPUT_PATHS],
    {
      cwd: rootDir,
      encoding: 'utf8',
    },
  )
}

function main() {
  const changes = findGeneratedOutputChanges(readGeneratedOutputStatus())
  if (changes.length > 0) {
    throw new Error(
      `Generated public output differs from the commit:\n${changes.join('\n')}`,
    )
  }

  console.log('Stack Scout generated-output proof passed: tracked and untracked public routes match the commit.')
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`Stack Scout generated-output proof failed: ${error.message}`)
    process.exit(1)
  }
}

module.exports = {
  GENERATED_OUTPUT_PATHS,
  findGeneratedOutputChanges,
  isGeneratedOutputPath,
  normaliseStatusPath,
  readGeneratedOutputStatus,
}
