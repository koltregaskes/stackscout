function makeCoverage(sources) {
  const attempted = sources.length
  const failed = sources.filter(source => source.outcome === 'failure').length
  const succeeded = attempted - failed
  const lostRequired = sources.some(source => source.required && source.outcome === 'failure')
  const status = !attempted || failed >= Math.ceil(attempted / 2) || lostRequired
    ? 'failed' : failed ? 'degraded' : 'healthy'
  return { status, attempted, succeeded, failed, sources }
}

function validateCoverage(coverage) {
  if (!coverage || !Array.isArray(coverage.sources)) throw new Error('Invalid source coverage metadata.')
  const ids = new Set()
  for (const source of coverage.sources) {
    if (!source || typeof source.id !== 'string' || !source.id || ids.has(source.id)
      || typeof source.name !== 'string' || typeof source.required !== 'boolean'
      || !['success', 'failure'].includes(source.outcome)) throw new Error('Invalid source outcome metadata.')
    ids.add(source.id)
  }
  const expected = makeCoverage(coverage.sources)
  for (const key of ['status', 'attempted', 'succeeded', 'failed']) {
    if (coverage[key] !== expected[key]) throw new Error('Source coverage totals or status do not match outcomes.')
  }
  return expected
}

function coverageMessage(coverage) {
  if (!coverage) return 'Source availability: not recorded for this feed.'
  const checked = validateCoverage(coverage)
  if (checked.status === 'healthy') return ''
  return `Some sources unavailable: ${checked.failed} of ${checked.attempted} sources failed during this feed refresh. Coverage is reduced.`
}

function coverageReport(coverage) {
  const checked = validateCoverage(coverage)
  return { exitCode: checked.status === 'failed' ? 1 : 0,
    level: checked.status === 'failed' ? 'error' : checked.status === 'degraded' ? 'warning' : 'notice',
    text: `Source coverage: ${checked.status}; ${checked.succeeded}/${checked.attempted} succeeded, ${checked.failed} failed.` }
}

module.exports = { makeCoverage, validateCoverage, coverageMessage, coverageReport }
