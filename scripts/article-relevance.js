// Conservative article-level rules. Source names and source-wide tags are never evidence.
// Tags below already exist in Stack Scout's routed taxonomy; scores are editorial
// rule weights, independent of the downstream site's minimum score.
// Wrangler is the named CLI already present in tools-source.json; matching its
// name is a relevance cue, not a new catalogue/version claim.
const MCP_ARTIFACT = '(?:servers?|clients?|catalog(?:ue)?s?|directories|registr(?:y|ies)|gateways?|bridges?|adapters?|toolkits?)'
const CORE_TOOL = `(?:apis?(?: endpoints?)?|sdks?|mcps?(?: ${MCP_ARTIFACT})?|model context protocol(?: ${MCP_ARTIFACT})?|clis?(?: (?:tools?|utilit(?:y|ies)))?|command[- ]line(?: (?:tools?|utilit(?:y|ies)))?|developer tools?|devtools?|developer platforms?|code editors?|coding assistants?|software frameworks?|package managers?|(?:model|inference) endpoints?|wrangler)`
// A generic toolkit needs an explicit builder qualifier in its own noun phrase.
// This does not make an unqualified marketing/photography toolkit builder news.
const TOOL = `(?:${CORE_TOOL}|toolkits?(?=\\s+for\\s+(?:the\\s+)?${CORE_TOOL}\\b))`
const VERSION = '(?:\\s+v?\\d+(?:\\.[\\w-]+)*)?'
const LIFECYCLE = '(?:deprecat(?:e[ds]?|ing|ion)|sunset(?:s|ted|ting)?|retir(?:e[ds]?|ing|ement)|end[- ]of[- ]life|reach(?:ed|es|ing)? (?:its )?end[- ]of[- ]life)'
const CHANGE = `(?:launch(?:ed|es|ing)?|releas(?:e[ds]?|ing)|introduc(?:e[ds]?|ing)|adds?|added|updates?|updat(?:ed|ing)|upgrad(?:e[ds]?|ing)|ship(?:s|ped|ping)?|(?:now\\s+)?(?:generally\\s+)?available|${LIFECYCLE})`
// Common function/quality words are explicit. Other names need capitalisation,
// a numeric version, or a lowercase product token containing a hyphen/digit.
// Arbitrary lowercase prose cannot bridge a release verb and a later tool noun.
const COMMON = /^(?:a|an|the|its|their|our|new|updated|improved|first|latest|official|open-source|typed|streaming|native|public|beta|stable|payments?|billing|search|authentication|embeddings?|vector|speech|audio|vision|video|browser|inference|fine-tuning|settlement|reports?|functions?)$/i
const MODIFIER = { test: word => COMMON.test(word) || /^(?:[\p{Lu}\p{N}][\p{L}\p{N}_.+-]*|\.[\p{Lu}][\p{L}\p{N}.-]*|\p{Ll}\p{L}*[-\d][\p{L}\p{N}.-]*)$/u.test(word) }
const NON_MODIFIER = /^(?:for|to|of|about|over|against|after|before|during|using|featuring|with|in|into|from|on|and|or|that|which|not|never|without|whether|if|unless|because|while|when)$/i

function validToolModifiers(text, tool) {
  const prefix = text.trim().split(/\s+/).filter(Boolean)
  // Executable labels conventionally use one lowercase token before CLI.
  // Keep that bounded shape without allowing an arbitrary prose prefix.
  if (/^clis?\b/i.test(tool) && prefix.length === 1 && /^[a-z][a-z0-9-]*$/.test(prefix[0]) && !NON_MODIFIER.test(prefix[0])) return true
  return prefix.length <= 6 && prefix.every(word => MODIFIER.test(word) && !NON_MODIFIER.test(word))
}

function toolPrefix(text) {
  const tool = new RegExp(`\\b${TOOL}\\b`, 'i').exec(text)
  if (!tool || !validToolModifiers(text.slice(0, tool.index), tool[0])) return null
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
    // A question is not an asserted release. A separate affirmative sentence
    // can still provide evidence; no list of question auxiliaries is needed.
    if (clause.includes('?')) continue
    // A tool is the grammatical subject of the change, including release/update
    // headings such as "SDK release" and "MCP Server reached 1.0".
    const subject = new RegExp(`\\b(${TOOL})${VERSION}(?:\\s+(?:is|are|was|were|will be|to be|has been|have been))?\\s+(${CHANGE}|reached\\s+v?\\d)\\b`, 'gi')
    for (const match of clause.matchAll(subject)) {
      if (!validToolModifiers(clause.slice(0, match.index), match[1])) continue
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
  const excluded = /\b(?:funding|valuation|raises? \$|acquisition|ceo|petition|lawmakers|geopolitic|export.ban|courts?|rulings?|lawsuits?|antitrust|judges?|fines?(?!-)|campaigns?|hiring|hires?)\b/i.test(headline)
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
