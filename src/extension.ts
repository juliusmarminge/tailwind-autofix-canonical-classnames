import * as vscode from "vscode";

import { getCanonicalFixes } from "./canonical";

const FIX_ALL_KIND = vscode.CodeActionKind.SourceFixAll.append("tailwindCanonicalClasses");

class TailwindCanonicalClassesFixAllProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): vscode.CodeAction[] {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const fixes = getCanonicalFixes(diagnostics);
    if (fixes.length === 0) return [];

    const action = new vscode.CodeAction("Fix all Tailwind canonical classes", FIX_ALL_KIND);
    action.edit = new vscode.WorkspaceEdit();
    for (const fix of fixes) {
      action.edit.replace(document.uri, fix.range, fix.newText);
    }
    action.isPreferred = true;

    return [action];
  }
}

function shouldFixOnSave(): boolean {
  const config = vscode.workspace.getConfiguration("tailwindCanonicalClasses");
  return config.get("fixOnSave", true);
}

export function activate(context: vscode.ExtensionContext): void {
  const documentSelector: vscode.DocumentSelector = [{ scheme: "file" }, { scheme: "untitled" }];

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      documentSelector,
      new TailwindCanonicalClassesFixAllProvider(),
      {
        providedCodeActionKinds: [FIX_ALL_KIND],
      },
    ),
  );

  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument((event: vscode.TextDocumentWillSaveEvent) => {
      if (!shouldFixOnSave()) return;

      const diagnostics = vscode.languages.getDiagnostics(event.document.uri);
      const fixes = getCanonicalFixes(diagnostics);
      if (fixes.length === 0) return;

      const edits = fixes.map((fix) => vscode.TextEdit.replace(fix.range, fix.newText));

      event.waitUntil(Promise.resolve(edits));
    }),
  );
}

export function deactivate(): void {}
