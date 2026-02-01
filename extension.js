const vscode = require("vscode");
const { getCanonicalFixes } = require("./src/canonical");

const FIX_ALL_KIND = new vscode.CodeActionKind("source.fixAll.tailwindCanonicalClasses");

class TailwindCanonicalClassesFixAllProvider {
  provideCodeActions(document) {
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

function shouldFixOnSave() {
  const config = vscode.workspace.getConfiguration("tailwindCanonicalClasses");
  return config.get("fixOnSave", true);
}

function activate(context) {
  const documentSelector = [{ scheme: "file" }, { scheme: "untitled" }];

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
    vscode.workspace.onWillSaveTextDocument((event) => {
      if (!shouldFixOnSave()) return;

      const diagnostics = vscode.languages.getDiagnostics(event.document.uri);
      const fixes = getCanonicalFixes(diagnostics);
      if (fixes.length === 0) return;

      const edits = fixes.map((fix) => vscode.TextEdit.replace(fix.range, fix.newText));

      event.waitUntil(Promise.resolve(edits));
    }),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
