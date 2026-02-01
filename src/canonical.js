const CANONICAL_MESSAGE_REGEX = /The class `([^`]+)` can be written as `([^`]+)`/;

function getDiagnosticCode(diagnostic) {
  const code = diagnostic?.code;
  if (typeof code === "string" || typeof code === "number") {
    return String(code);
  }
  if (code && typeof code === "object" && "value" in code) {
    return String(code.value);
  }
  return "";
}

function extractCanonicalSuggestion(message) {
  if (typeof message !== "string") return null;
  const match = message.match(CANONICAL_MESSAGE_REGEX);
  if (!match) return null;
  return {
    from: match[1],
    to: match[2],
  };
}

function isSuggestCanonicalDiagnostic(diagnostic) {
  if (!diagnostic) return false;
  if (getDiagnosticCode(diagnostic) === "suggestCanonicalClasses") return true;
  return extractCanonicalSuggestion(diagnostic.message) !== null;
}

function getCanonicalFixes(diagnostics) {
  if (!Array.isArray(diagnostics)) return [];

  const seen = new Set();
  const fixes = [];

  for (const diagnostic of diagnostics) {
    if (!isSuggestCanonicalDiagnostic(diagnostic)) continue;
    const suggestion = extractCanonicalSuggestion(diagnostic.message);
    if (!suggestion) continue;

    const range = diagnostic.range;
    if (!range || !range.start || !range.end) continue;

    const key = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}:${suggestion.to}`;
    if (seen.has(key)) continue;

    seen.add(key);
    fixes.push({ range, newText: suggestion.to });
  }

  fixes.sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    if (a.range.start.character !== b.range.start.character) {
      return b.range.start.character - a.range.start.character;
    }
    if (a.range.end.line !== b.range.end.line) {
      return b.range.end.line - a.range.end.line;
    }
    return b.range.end.character - a.range.end.character;
  });

  return fixes;
}

module.exports = {
  CANONICAL_MESSAGE_REGEX,
  extractCanonicalSuggestion,
  getCanonicalFixes,
  getDiagnosticCode,
  isSuggestCanonicalDiagnostic,
};
