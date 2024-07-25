import { commands, type ExtensionContext } from 'vscode';
import {
  insertTable,
  onEnterKey,
  onShiftTabKey,
  onTabKey,
  toggleEmphasis,
} from './document';
import { logMessage } from './debug';

export function activate(context: ExtensionContext) {
  logMessage('✍🏼 Mini Markdown starting...');

  context.subscriptions.push(
    commands.registerCommand('miniMarkdown.toggleEmphasis', () => {
      toggleEmphasis('_');
    }),
    commands.registerCommand('miniMarkdown.toggleStrongEmphasis', () => {
      toggleEmphasis('**');
    }),
    commands.registerCommand('miniMarkdown.insertTable', insertTable),
    commands.registerCommand('miniMarkdown.onEnterKey', onEnterKey),
    commands.registerCommand('miniMarkdown.onTabKey', onTabKey),
    commands.registerCommand('miniMarkdown.onShiftTabKey', onShiftTabKey),
  );
}
