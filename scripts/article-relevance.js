// Conservative article-level rules. Source names and source-wide tags are never evidence.
// Tags below already exist in Stack Scout's routed taxonomy; scores are editorial
// rule weights, independent of the downstream site's minimum score.
// Wrangler is the named CLI already present in tools-source.json; matching its
// name is a relevance cue, not a new catalogue/version claim.
const MCP_ARTIFACT = '(?:servers?|clients?|catalog(?:ue)?s?|directories|registr(?:y|ies)|gateways?|bridges?|adapters?|toolkits?)'
const TOOL = `(?:apis?(?: endpoints?)?|sdks?|mcps?(?: ${MCP_ARTIFACT})?|model context protocol(?: ${MCP_ARTIFACT})?|clis?(?: (?:tools?|utilit(?:y|ies)))?|command[- ]line(?: (?:tools?|utilit(?:y|ies)))?|developer tools?|devtools?|developer platforms?|code editors?|coding assistants?|software frameworks?|package managers?|(?:model|inference) endpoints?|wrangler)`
const VERSION = '(?:\\s+v?\\d+(?:\\.[\\w-]+)*)?'
const LIFECYCLE = '(?:deprecat(?:e[ds]?|ing|ion)|sunset(?:s|ted|ting)?|retir(?:e[ds]?|ing|ement)|end[- ]of[- ]life|reach(?:ed|es|ing)? (?:its )?end[- ]of[- ]life)'
const CHANGE = `(?:launch(?:ed|es|ing)?|releas(?:e[ds]?|ing)|introduc(?:e[ds]?|ing)|adds?|added|updates?|updat(?:ed|ing)|upgrad(?:e[ds]?|ing)|ship(?:s|ped|ping)?|(?:now\\s+)?(?:generally\\s+)?available|${LIFECYCLE})`
// Product names, common-noun modifiers and numeric versions share a general
// lexical rule. Their capitalisation is neither necessary nor sufficient.
const MODIFIER = /^(?:[\p{L}][\p{L}\p{N}_.+-]*|v?\d+(?:\.\d+)*|\.[\p{L}][\p{L}\p{N}-]*)$/u
const NON_MODIFIER = /^(?:for|to|of|about|over|against|after|before|during|using|featuring|with|in|on|and|or|that|which|campaigns?|bills?|exploits?|rounds?|funding)$/i

function toolPrefix(text) {
  const tool = new RegExp(`\\b${TOOL}\\b`, 'i').exec(text)
  if (!tool) return null
  const prefix = text.slice(0, tool.index).trim().split(/\s+/).filter(Boolean)
  if (prefix.length > 6 || prefix.some(word => !MODIFIER.test(word) || NON_MODIFIER.test(word))) return null
  return tool
}

function directToolObject(text) {
  const tool = toolPrefix(text)
  if (!tool) return ''
  const tail = text.slice(tool.index + tool[0].length)
  if (tail && !/^(?:\s*$|\s*[,.:;!?)]|\s+(?:for|with|to|that|which|offering|featuring|including|supporting|enabling|and|in|on|from|by|starting|effective|next|this|v?\d)\b)/i.test(tail)) return ''
  return tool[0]
}

function toolChanges(value) {
  const evidence = []
  for (const clause of String(value || '').split(/[;\n]|(?<=[.!?])\s+(?=[A-Z])/)) {
    // A tool is the grammatical subject of the change, including release/update
    // headings such as "SDK release" and "MCP Server reached 1.0".
    const subject = new RegExp(`\\b(${TOOL})${VERSION}(?:\\s+(?:is|are|was|were|will be|to be|has been|have been))?\\s+(${CHANGE}|reached\\s+v?\\d)\\b`, 'gi')
    for (const match of clause.matchAll(subject)) {
      if (/^\s+(?:delayed|cancelled|canceled|blocked)\b/i.test(clause.slice(match.index + match[0].length))) continue
      evidence.push(match[1])
    }
    // Or the change verb takes an explicit tool as its direct object. Evidence
    // is kept local; an API mentioned in another sentence cannot acquire a tag.
    for (const match of clause.matchAll(new RegExp(`\\b${CHANGE}\\s+`, 'gi'))) {
      if (/\b(?:not|never|without|won't|might|may|plans? to)\s+(?:\w+\s+){0,2}$/i.test(clause.slice(0, match.index))) continue
      const tool = directToolObject(clause.slice(match.index + match[0].length))
      if (tool) evidence.push(tool)
    }
    for (const match of clause.matchAll(new RegExp(`\\b${LIFECYCLE}\\s+(?:of|for)\\s+`, 'gi'))) {
      const tool = directToolObject(clause.slice(match.index + match[0].length))
      if (tool) evidence.push(tool)
    }
  }
  return evidence
}

function classifyArticle(entry) {
  const metadata = [...(entry.metadata || []), ...(entry.articleTags || [])].join(' ')
  const text = `${entry.title || ''} ${entry.summary || ''} ${metadata}`.toLowerCase()
  const builder = new RegExp(`\\b${TOOL}\\b`, 'i').test(text)
  if (!builder) return { tags: [], importance: 0 }
  // Finance, executives and geopolitical stories are not tool updates merely
  // because a platform is named in the description.
  const headline = String(entry.title || '')
  const excluded = /\b(?:funding|valuation|raises? \$|acquisition|ceo|petition|lawmakers|geopolitic|export.ban|courts?|rulings?|lawsuits?|antitrust|judges?|fines?(?!-)|campaigns?|hiring|hires?|complain\w*|rumou?rs?|exaggerated|vulnerabilit(?:y|ies)|exploits?|burnout)\b/i.test(headline)
    || /^\s*(?:report|podcast|opinion|analysis)\s*:/i.test(headline)
    || /^\s*(?:is|are|does|do|will|should|can|could)\b[^?]*\?/i.test(headline)
  // These words also name legitimate tool functions/products. Exclude the
  // unrelated story only when the word is not part of a tool noun phrase.
  const ambiguousTopic = [...headline.matchAll(/\b(?:ads?|advertising|offices?|settlements?)\b/gi)]
    .some(match => !toolPrefix(headline.slice(match.index)))
  if (excluded || ambiguousTopic) {
    return { tags: [], importance: 0 }
  }
  const tags = []
  const changes = [...toolChanges(entry.title), ...toolChanges(entry.summary)]
  const released = changes.length > 0
  const openTool = [entry.title, entry.summary].some(value => {
    const match = /\bopen[ -]source\s+/i.exec(String(value || ''))
    return match && directToolObject(String(value).slice(match.index + match[0].length))
  })
  if (!released && !openTool) return { tags: [], importance: 0 }
  if (released) tags.push('product_launch')
  if (openTool) tags.push('open_source')
  if (changes.some(tool => /^apis?\b/i.test(tool))) tags.push('api_update')
  if (changes.some(tool => /\bmcp|model context protocol/i.test(tool))) tags.push('mcp')
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
