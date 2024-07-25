import { window } from 'vscode';

const debug = window.createOutputChannel('Mini Markdown');

export function logMessage(...messages: unknown[]) {
  debug.appendLine(
    messages
      .map((x) =>
        typeof x === 'string' || typeof x === 'number' ? x : JSON.stringify(x),
      )
      .join(' '),
  );
}
