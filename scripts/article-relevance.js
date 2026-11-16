// Conservative article-level rules. Source names and source-wide tags are never evidence.
// Tags below already exist in Stack Scout's routed taxonomy; scores are editorial
// rule weights, independent of the downstream site's minimum score.
// Wrangler is the named CLI already present in tools-source.json; matching its
// name is a relevance cue, not a new catalogue/version claim.
const MCP_ARTIFACT = '(?:servers?|clients?|catalog(?:ue)?s?|directories|registr(?:y|ies)|gateways?|bridges?|adapters?|toolkits?)'
// Builder nouns describe software used to develop, test, run or inspect code.
// Generic frameworks/toolkits need a software, testing or developer qualifier.
const COMMAND_TOOL = '(?:tools?|utilit(?:y|ies)|compilers?|debuggers?|profilers?)'
const CORE_TOOL = `(?:apis?(?: (?:endpoints?|tiers?|versions?|clients?))?|sdks?|mcps?(?: ${MCP_ARTIFACT})?|model context protocol(?: ${MCP_ARTIFACT})?|clis?(?: (?:tools?|utilit(?:y|ies)))?|command[- ]line(?: (?:[a-z]+(?:-[a-z]+)? ){0,2}${COMMAND_TOOL})?|developer (?:tools?|toolkits?|platforms?|profilers?)|devtools?|code[- ]editors?|coding assistants?|(?:software|testing) frameworks?|package managers?|build tools?|compilers?|debuggers?|databases?|profilers?|(?:model|inference) endpoints?|wrangler)`
// A generic toolkit needs an explicit builder qualifier in its own noun phrase.
// This does not make an unqualified marketing/photography toolkit builder news.
const TOOL = `(?:${CORE_TOOL}|toolkits?(?=\\s+for\\s+(?:the\\s+)?${CORE_TOOL}\\b))`
const VERSION = '(?:\\s+v?\\d+(?:\\.[\\w-]+)*)?'
const RELEASE_VERSION = '(?:(?:version|release)\\s+v?\\d+(?:\\.[\\w-]+)*|v\\d+(?:\\.[\\w-]+)*)'
const LIFECYCLE = '(?:deprecat(?:e[ds]?|ing|ion)|sunset(?:s|ted|ting)?|retir(?:e[ds]?|ing|ement)|end[- ]of[- ]life|reach(?:ed|es|ing)? (?:its )?end[- ]of[- ]life)'
const CHANGE = `(?:launch(?:ed|es|ing)?|releas(?:e[ds]?|ing)|introduc(?:e[ds]?|ing)|announc(?:e[ds]?|ing)|unveil(?:s|ed|ing)?|roll(?:s|ed|ing)? out|adds?|added|updates?|updat(?:ed|ing)|upgrad(?:e[ds]?|ing)|ship(?:s|ped|ping)?|(?:now\\s+)?(?:generally\\s+)?available|${LIFECYCLE})`
// Common function/quality words are explicit. Other names need capitalisation,
// a numeric version, or a lowercase product token containing a hyphen/digit.
// Arbitrary lowercase prose cannot bridge a release verb and a later tool noun.
const COMMON = /^(?:a|an|the|its|their|our|new|updated|improved|first|latest|official|open-source|typed|streaming|native|public|beta|stable|payments?|billing|search|authentication|embeddings?|vector|speech|audio|vision|video|browser|inference|fine-tuning|settlement|reports?|functions?)$/i
const NON_MODIFIER = /^(?:for|to|of|about|over|against|after|before|during|using|featuring|with|in|into|from|on|and|or|that|which|not|never|without|whether|if|unless|because|while|when)$/i

function isTitleCase(clause) {
  const words = clause.split(/\s+/).filter(word => /^\p{L}/u.test(word))
  return words.length >= 4 && words.filter(word => /^\p{Lu}/u.test(word)).length / words.length >= 0.8
}

function validToolModifiers(text, tool, { object = false, titleCase = false } = {}) {
  if (/^command[- ]line /i.test(tool) && tool.split(/\s+/).slice(1, -1).some(word => NON_MODIFIER.test(word))) return false
  const prefix = text.trim().split(/\s+/).filter(Boolean)
  // Executable labels conventionally use one lowercase token before CLI.
  // Keep that bounded shape without allowing an arbitrary prose prefix.
  if (/^clis?\b/i.test(tool) && prefix.length === 1 && /^[a-z][a-z0-9-]*$/.test(prefix[0]) && !NON_MODIFIER.test(prefix[0])) return true
  if (prefix.length > 6 || prefix.some(word => NON_MODIFIER.test(word))) return false
  const versionish = word => /^(?:\p{N}[\p{L}\p{N}_.+-]*|\p{Ll}\p{L}*[-\d][\p{L}\p{N}.-]*|\.[\p{Lu}][\p{L}\p{N}.-]*)$/u.test(word)
  const named = word => /^\p{Lu}[\p{L}\p{N}_.+-]*(?:['’]s)?$/u.test(word) && !(titleCase && object)
  const known = word => COMMON.test(word) || versionish(word) || named(word)
  // Only the immediate object suffix may supply up to two free descriptors.
  // Subjects keep strict modifiers, and -ing prose cannot bridge to the tool.
  let free = 0
  for (let i = prefix.length - 1; i >= 0 && object && free < 2 && !known(prefix[i]); i--, free++) {
    if (!/^\p{L}[\p{L}-]*$/u.test(prefix[i]) || /ing$/i.test(prefix[i])) return false
  }
  return prefix.slice(0, prefix.length - free).every(known)
}

function toolPrefix(text, titleCase = false) {
  const tool = new RegExp(`\\b${TOOL}\\b`, 'i').exec(text)
  if (!tool || !validToolModifiers(text.slice(0, tool.index), tool[0], { object: true, titleCase })) return null
  return tool
}

function directToolObject(text, titleCase = false) {
  // A numbered release/version is the head of the same tool noun phrase.
  // Never skip arbitrary objects such as a report or a guide "of" a tool.
  text = text.replace(new RegExp(`^(?:(?:a|an|the|its|our|their|new|updated|latest)\\s+){0,2}${RELEASE_VERSION}\\s+of\\s+`, 'i'), '')
  const tool = toolPrefix(text, titleCase)
  if (!tool) return ''
  const tail = text.slice(tool.index + tool[0].length)
  if (tail && !/^(?:\s*$|\s*[,.:;!?)]|\s+(?:for|with|to|that|which|offering|featuring|including|supporting|enabling|and|in|on|from|by|starting|effective|next|this|today|yesterday|tomorrow|v?\d)\b)/i.test(tail)) return ''
  return tool[0]
}

const QUESTION_START = /^(?:who|what|when|where|why|how|which|is|are|was|were|do|does|did|can|could|should|would|will|has|have|had|may|might)\b/i
function assertionClause(value) {
  let clause = value.trim()
  // Strip only an explicit version qualifier, not arbitrary reporting prose.
  clause = clause.replace(/^(?:with|in|since|from|as of)\s+(?:(?:version|release|build)\s+v?|v)\d+(?:\.[\da-z-]+)*(?:-[a-z0-9]+)?\s*,\s*/i, '')
  if (!clause.includes('?')) return clause
  // Preserve an affirmative left clause before a separately marked question.
  // Never turn an interrogative left clause into an assertion by truncating it.
  const trailer = /(?::\s+|,\s+(?:but|and)\s+)([\s\S]+)/i.exec(clause)
  if (!trailer || !QUESTION_START.test(trailer[1]) || !trailer[1].includes('?')) return ''
  const left = clause.slice(0, trailer.index).trim()
  return left.includes('?') || QUESTION_START.test(left) ? '' : left
}

function toolChanges(value) {
  const evidence = []
  for (const source of String(value || '').split(/[;\n]|(?<=[.!?])\s+(?=[A-Z])/)) {
    const clause = assertionClause(source)
    if (!clause) continue
    const titleCase = isTitleCase(clause)
    // A tool is the grammatical subject of the change, including release/update
    // headings such as "SDK release" and "MCP Server reached 1.0".
    const subject = new RegExp(`\\b(${TOOL})${VERSION}(?:\\s+(?:is|are|was|were|will be|to be|has been|have been|becomes?|became))?\\s+(?:now\\s+)?(${CHANGE}|gains?|gained|supports?|supported|reached\\s+v?\\d)\\b`, 'gi')
    for (const match of clause.matchAll(subject)) {
      if (!validToolModifiers(clause.slice(0, match.index), match[1])) continue
      const tail = clause.slice(match.index + match[0].length)
      if (/^\s+(?:delayed|cancelled|canceled|blocked)\b/i.test(tail)) continue
      // "Gains" can describe popularity rather than a software change. Require
      // a functional feature head; descriptors cannot cross a preposition.
      if (/^(?:gains?|gained)$/i.test(match[2])) {
        const feature = /^\s+((?:[\p{L}\p{N}-]+\s+){0,4})(?:support|features?|capabilities|execution|compilation|debugging|profiling|caching|completion|tracing|diagnostics?|integrations?|bindings?)\b/iu.exec(tail)
        if (!feature || feature[1].trim().split(/\s+/).some(word => NON_MODIFIER.test(word))) continue
      }
      evidence.push(match[1])
    }
    // Or the change verb takes an explicit tool as its direct object. Evidence
    // is kept local; an API mentioned in another sentence cannot acquire a tag.
    for (const match of clause.matchAll(new RegExp(`\\b${CHANGE}\\s+`, 'gi'))) {
      if (/\b(?:not|never|without|won't|might|may|plans? to)\s+(?:\w+\s+){0,2}$/i.test(clause.slice(0, match.index))) continue
      const tool = directToolObject(clause.slice(match.index + match[0].length), titleCase)
      if (tool) evidence.push(tool)
    }
    for (const match of clause.matchAll(new RegExp(`\\b${LIFECYCLE}\\s+(?:of|for)\\s+`, 'gi'))) {
      const tool = directToolObject(clause.slice(match.index + match[0].length), titleCase)
      if (tool) evidence.push(tool)
    }
    // A feature is added to a particular tool, or that tool is made available.
    // Both constructions must still end in a complete, bounded tool object.
    const qualified = [
      /\b(?:adds?|added)\s+(?:[\p{L}\p{N}][\p{L}\p{N}-]*\s+){1,6}to\s+((?:its|their|our|the)\s+.+)$/giu,
      /\bmak(?:e[sd]?|ing)\s+(.+?)\s+(?:(?:generally|publicly|widely|now)\s+)?available\b/gi,
    ]
    for (const pattern of qualified) for (const match of clause.matchAll(pattern)) {
      if (/\b(?:not|never|without|won't|might|may|plans? to)\s+(?:\w+\s+){0,2}$/i.test(clause.slice(0, match.index))) continue
      const tool = directToolObject(match[1], titleCase)
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
    .some(match => !toolPrefix(headline.slice(match.index), isTitleCase(headline)))
  if (excluded || ambiguousTopic) {
    return { tags: [], importance: 0 }
  }
  const tags = []
  const changes = [...toolChanges(entry.title), ...toolChanges(entry.summary)]
  const released = changes.length > 0
  const openTool = [entry.title, entry.summary].some(value => {
    const match = /\bopen[ -]source\s+/i.exec(String(value || ''))
    return match && directToolObject(String(value).slice(match.index + match[0].length), isTitleCase(String(value)))
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
