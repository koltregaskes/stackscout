// Conservative article-level rules. Source names and source-wide tags are never evidence.
// Tags below already exist in Stack Scout's routed taxonomy; scores are editorial
// rule weights, independent of the downstream site's minimum score.
// Wrangler is the named CLI already present in tools-source.json; matching its
// name is a relevance cue, not a new catalogue/version claim.
const TOOL = '(?:apis?(?: endpoints?)?|sdks?|mcps?(?: servers?)?|model context protocol(?: servers?)?|clis?(?: (?:tools?|utilit(?:y|ies)))?|command[- ]line(?: (?:tools?|utilit(?:y|ies)))?|developer tools?|devtools?|developer platforms?|code editors?|coding assistants?|software frameworks?|package managers?|(?:model|inference) endpoints?|wrangler)'
const VERSION = '(?:\\s+v?\\d+(?:\\.[\\w-]+)*)?'
const LIFECYCLE = '(?:deprecat(?:e[ds]?|ing|ion)|sunset(?:s|ted|ting)?|retir(?:e[ds]?|ing|ement)|end[- ]of[- ]life|reach(?:ed|es|ing)? (?:its )?end[- ]of[- ]life)'
const CHANGE = `(?:launch(?:ed|es|ing)?|releas(?:e[ds]?|ing)|introduc(?:e[ds]?|ing)|adds?|added|updates?|updat(?:ed|ing)|upgrad(?:e[ds]?|ing)|ship(?:s|ped|ping)?|${LIFECYCLE})`
const MODIFIER = /^(?:a|an|the|its|their|our|new|updated|improved|first|latest|official|open-source|typed|streaming|native|public|beta|stable|python|javascript|typescript|node\.js|rust|go|java|\.net|payments?|billing|search|authentication|embeddings?|vector|speech|audio|vision|video|browser|inference|assistants?|responses?|v?\d+(?:\.\d+)*)$/i

function directToolObject(text) {
  const tool = new RegExp(`\\b${TOOL}\\b`, 'i').exec(text)
  if (!tool) return ''
  const prefix = text.slice(0, tool.index).trim().split(/\s+/).filter(Boolean)
  // Only reviewed modifiers may precede the tool noun. Title Case is not
  // evidence that a word names a product. Never jump
  // across "campaign for", "ruling about" or another unrelated object/clause.
  if (prefix.length > 6 || prefix.some(word => !MODIFIER.test(word))) return ''
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
  const headline = String(entry.title || '').toLowerCase()
  if (/\b(?:funding|valuation|raises? \$|acquisition|ceo|petition|lawmakers|geopolitic|export.ban|courts?|rulings?|lawsuits?|antitrust|judges?|settlements?|fines?|advertising|ads?|campaigns?|offices?|hiring)\b/.test(headline)) {
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
