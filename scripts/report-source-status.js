const fs = require('node:fs')
const path = require('node:path')
const { coverageReport } = require('./source-coverage')

function reportSourceStatus(coverage) {
  const report = coverageReport(coverage)
  console.log(`::${report.level} title=Routed feed source coverage::${report.text}`)
  return report
}

if (require.main === module) {
  try {
    const status = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname, '../.local/routed-feed-status.json'), 'utf8'))
    const report = reportSourceStatus(status.coverage)
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.text}\n`)
    process.exitCode = report.exitCode
  } catch {
    console.error('::error title=Routed feed source coverage::Source status is missing or invalid; coverage cannot be confirmed.')
    process.exitCode = 1
  }
}

module.exports = { reportSourceStatus }
