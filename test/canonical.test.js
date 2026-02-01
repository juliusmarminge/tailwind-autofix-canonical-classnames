const test = require("node:test");
const assert = require("node:assert/strict");
const {
  extractCanonicalSuggestion,
  getCanonicalFixes,
  getDiagnosticCode,
  isSuggestCanonicalDiagnostic,
} = require("../src/canonical");

test("extractCanonicalSuggestion returns parsed canonical suggestion", () => {
  const message = "The class `!h-dvh` can be written as `h-dvh!`";
  assert.deepEqual(extractCanonicalSuggestion(message), {
    from: "!h-dvh",
    to: "h-dvh!",
  });
});

test("extractCanonicalSuggestion returns null for non-matching messages", () => {
  assert.equal(extractCanonicalSuggestion("Nope"), null);
});

test("getDiagnosticCode handles structured codes", () => {
  assert.equal(getDiagnosticCode({ code: "suggestCanonicalClasses" }), "suggestCanonicalClasses");
  assert.equal(getDiagnosticCode({ code: 123 }), "123");
  assert.equal(
    getDiagnosticCode({
      code: { value: "suggestCanonicalClasses", target: "https://example.com" },
    }),
    "suggestCanonicalClasses",
  );
});

test("isSuggestCanonicalDiagnostic matches by code or message", () => {
  assert.equal(
    isSuggestCanonicalDiagnostic({ source: "tailwindcss", code: "suggestCanonicalClasses" }),
    true,
  );
  assert.equal(
    isSuggestCanonicalDiagnostic({
      source: "eslint",
      message: "The class `a` can be written as `b`",
    }),
    true,
  );
  assert.equal(isSuggestCanonicalDiagnostic({ source: "tailwindcss", code: "other" }), false);
});

test("getCanonicalFixes returns canonical edits in descending order", () => {
  const diagnostics = [
    {
      source: "tailwindcss",
      code: "suggestCanonicalClasses",
      message: "The class `a` can be written as `b`",
      range: { start: { line: 0, character: 5 }, end: { line: 0, character: 6 } },
    },
    {
      source: "tailwindcss",
      code: { value: "suggestCanonicalClasses" },
      message: "The class `c` can be written as `d`",
      range: { start: { line: 2, character: 1 }, end: { line: 2, character: 2 } },
    },
  ];

  const fixes = getCanonicalFixes(diagnostics);

  assert.equal(fixes.length, 2);
  assert.deepEqual(fixes[0], {
    range: diagnostics[1].range,
    newText: "d",
  });
  assert.deepEqual(fixes[1], {
    range: diagnostics[0].range,
    newText: "b",
  });
});
