// Conservative article-level rules. Source names and source-wide tags are never evidence.
// Tags below already exist in Stack Scout's routed taxonomy; scores are editorial
// rule weights, independent of the downstream site's minimum score.
function classifyArticle(entry) {
  const metadata = [...(entry.metadata || []), ...(entry.articleTags || [])].join(' ')
  const text = `${entry.title || ''} ${entry.summary || ''} ${metadata}`.toLowerCase()
  const builder = /\b(?:apis?|sdks?|mcps?|model context protocol|clis?|command.line|developer tools?|devtools?|developer platform|software development|programming|code editor|coding assistant|software framework|package manager)\b/.test(text)
  if (!builder) return { tags: [], importance: 0 }
  // Finance, executives and geopolitical stories are not tool updates merely
  // because a platform is named in the description.
  const headline = String(entry.title || '').toLowerCase()
  if (/\b(?:funding|valuation|raises? \$|acquisition|ceo|petition|lawmakers|geopolitic|export.ban)\b/.test(headline)) {
    return { tags: [], importance: 0 }
  }
  const tags = []
  const released = /\b(?:launch(?:ed|es)?|releas(?:e[ds]?|ing)|introduc(?:e[ds]?|ing)|adds?|added|updates?|upgraded?|changelog|reached \d)\b/.test(text)
    || /\bproduct_launch\b/.test(metadata)
  if (released) tags.push('product_launch')
  if (/\bopen[ -]source\b|\bopen_source\b/.test(text)) tags.push('open_source')
  if (/\bapi(?:s)?\b/.test(text) && released) tags.push('api_update')
  if (/\bmcp\b|\bmodel context protocol\b/.test(text)) tags.push('mcp')
  // These exclusions retain their meaning when supplied on the article itself.
  if (/\bcrypto(?:currency)?\b/.test(text)) tags.push('crypto')
  if (/\bresearch paper\b|\bresearch_paper\b/.test(text)) tags.push('research_paper')
  return { tags, importance: tags.length ? (released ? 0.7 : 0.5) : 0 }
}

function tagEntries(entries, source) {
  return entries.map((entry) => ({
    title: entry.title, url: entry.url, source: source.name,
    ...classifyArticle(entry), date: entry.date,
    summary: (entry.summary || entry.title).slice(0, 700),
    category: source.categories?.[0] || source.section || '',
  }))
}

module.exports = { classifyArticle, tagEntries }
