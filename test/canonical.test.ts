import type { Position, Range, Uri } from "vscode";

import { expect, test } from "bun:test";

import {
  extractCanonicalSuggestion,
  getCanonicalFixes,
  getDiagnosticCode,
  isSuggestCanonicalDiagnostic,
  type CanonicalDiagnostic,
} from "../src/canonical";

class TestPosition implements Position {
  readonly line: number;
  readonly character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  isBefore(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isBeforeOrEqual(other: Position): boolean {
    return this.isBefore(other) || this.isEqual(other);
  }

  isAfter(other: Position): boolean {
    return this.line > other.line || (this.line === other.line && this.character > other.character);
  }

  isAfterOrEqual(other: Position): boolean {
    return this.isAfter(other) || this.isEqual(other);
  }

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  compareTo(other: Position): number {
    if (this.isBefore(other)) return -1;
    if (this.isAfter(other)) return 1;
    return 0;
  }

  translate(
    lineDeltaOrChange?: number | { lineDelta?: number; characterDelta?: number },
    characterDelta = 0,
  ): Position {
    if (typeof lineDeltaOrChange === "number" || lineDeltaOrChange === undefined) {
      const lineDelta = lineDeltaOrChange ?? 0;
      return new TestPosition(this.line + lineDelta, this.character + characterDelta);
    }

    return new TestPosition(
      this.line + (lineDeltaOrChange.lineDelta ?? 0),
      this.character + (lineDeltaOrChange.characterDelta ?? 0),
    );
  }

  with(
    lineOrChange?: number | { line?: number; character?: number },
    character?: number,
  ): Position {
    if (typeof lineOrChange === "number" || lineOrChange === undefined) {
      return new TestPosition(lineOrChange ?? this.line, character ?? this.character);
    }
    return new TestPosition(
      lineOrChange.line ?? this.line,
      lineOrChange.character ?? this.character,
    );
  }
}

class TestRange implements Range {
  readonly start: Position;
  readonly end: Position;

  constructor(start: Position, end: Position) {
    this.start = start;
    this.end = end;
  }

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }

  get isSingleLine(): boolean {
    return this.start.line === this.end.line;
  }

  contains(positionOrRange: Position | Range): boolean {
    if ("start" in positionOrRange && "end" in positionOrRange) {
      return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
    }
    return (
      (this.start.isBeforeOrEqual(positionOrRange) || this.start.isEqual(positionOrRange)) &&
      (this.end.isAfterOrEqual(positionOrRange) || this.end.isEqual(positionOrRange))
    );
  }

  isEqual(other: Range): boolean {
    return this.start.isEqual(other.start) && this.end.isEqual(other.end);
  }

  intersection(range: Range): Range | undefined {
    if (!this.contains(range.start) && !this.contains(range.end) && !range.contains(this.start)) {
      return undefined;
    }
    const start = this.start.isAfter(range.start) ? this.start : range.start;
    const end = this.end.isBefore(range.end) ? this.end : range.end;
    return new TestRange(start, end);
  }

  union(other: Range): Range {
    const start = this.start.isBefore(other.start) ? this.start : other.start;
    const end = this.end.isAfter(other.end) ? this.end : other.end;
    return new TestRange(start, end);
  }

  with(startOrChange?: Position | { start?: Position; end?: Position }, end?: Position): Range {
    if (!startOrChange) return this;
    if (isRangeChange(startOrChange)) {
      return new TestRange(startOrChange.start ?? this.start, startOrChange.end ?? this.end);
    }
    return new TestRange(startOrChange, end ?? this.end);
  }
}

class TestUri implements Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly query: string;
  readonly fragment: string;
  readonly fsPath: string;

  constructor(
    options?: Partial<Pick<Uri, "scheme" | "authority" | "path" | "query" | "fragment" | "fsPath">>,
  ) {
    this.scheme = options?.scheme ?? "https";
    this.authority = options?.authority ?? "example.com";
    this.path = options?.path ?? "/";
    this.query = options?.query ?? "";
    this.fragment = options?.fragment ?? "";
    this.fsPath = options?.fsPath ?? this.path;
  }

  with(change: {
    scheme?: string;
    authority?: string;
    path?: string;
    query?: string;
    fragment?: string;
  }): Uri {
    return new TestUri({
      scheme: change.scheme ?? this.scheme,
      authority: change.authority ?? this.authority,
      path: change.path ?? this.path,
      query: change.query ?? this.query,
      fragment: change.fragment ?? this.fragment,
      fsPath: this.fsPath,
    });
  }

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}`;
  }

  toJSON(): any {
    return {
      scheme: this.scheme,
      authority: this.authority,
      path: this.path,
      query: this.query,
      fragment: this.fragment,
      fsPath: this.fsPath,
    };
  }
}

const makeRange = (
  startLine: number,
  startCharacter: number,
  endLine: number,
  endCharacter: number,
): Range =>
  new TestRange(
    new TestPosition(startLine, startCharacter),
    new TestPosition(endLine, endCharacter),
  );

const isRangeChange = (
  value: Position | { start?: Position; end?: Position },
): value is { start?: Position; end?: Position } =>
  typeof value === "object" && ("start" in value || "end" in value);

const makeDiagnostic = (
  overrides: Partial<CanonicalDiagnostic> & { range?: Range },
): CanonicalDiagnostic => ({
  source: "tailwindcss",
  message: "",
  range: makeRange(0, 0, 0, 0),
  ...overrides,
});

test("extractCanonicalSuggestion returns parsed canonical suggestion", () => {
  const message = "The class `!h-dvh` can be written as `h-dvh!`";
  expect(extractCanonicalSuggestion(message)).toEqual({
    from: "!h-dvh",
    to: "h-dvh!",
  });
});

test("extractCanonicalSuggestion returns null for non-matching messages", () => {
  expect(extractCanonicalSuggestion("Nope")).toBeNull();
});

test("getDiagnosticCode handles structured codes", () => {
  expect(getDiagnosticCode({ code: "suggestCanonicalClasses" })).toBe("suggestCanonicalClasses");
  expect(getDiagnosticCode({ code: 123 })).toBe("123");
  expect(
    getDiagnosticCode({
      code: {
        value: "suggestCanonicalClasses",
        target: new TestUri(),
      },
    }),
  ).toBe("suggestCanonicalClasses");
});

test("isSuggestCanonicalDiagnostic matches by code or message", () => {
  expect(
    isSuggestCanonicalDiagnostic(
      makeDiagnostic({ source: "tailwindcss", code: "suggestCanonicalClasses" }),
    ),
  ).toBe(true);
  expect(
    isSuggestCanonicalDiagnostic({
      ...makeDiagnostic({
        source: "eslint",
        message: "The class `a` can be written as `b`",
      }),
    }),
  ).toBe(true);
  expect(
    isSuggestCanonicalDiagnostic(makeDiagnostic({ source: "tailwindcss", code: "other" })),
  ).toBe(false);
});

test("getCanonicalFixes returns canonical edits in descending order", () => {
  const diagnostics: CanonicalDiagnostic[] = [
    makeDiagnostic({
      source: "tailwindcss",
      code: "suggestCanonicalClasses",
      message: "The class `a` can be written as `b`",
      range: makeRange(0, 5, 0, 6),
    }),
    makeDiagnostic({
      source: "tailwindcss",
      code: { value: "suggestCanonicalClasses", target: new TestUri() },
      message: "The class `c` can be written as `d`",
      range: makeRange(2, 1, 2, 2),
    }),
  ];

  const fixes = getCanonicalFixes(diagnostics);

  expect(fixes.length).toBe(2);
  expect(fixes[0]).toEqual({
    range: diagnostics[1].range,
    newText: "d",
  });
  expect(fixes[1]).toEqual({
    range: diagnostics[0].range,
    newText: "b",
  });
});
