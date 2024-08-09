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
    commands.registerTextEditorCommand(
      'miniMarkdown.toggleEmphasis',
      (textEditor, edit) => {
        toggleEmphasis(textEditor, edit, '_');
      },
    ),
    commands.registerTextEditorCommand(
      'miniMarkdown.toggleStrongEmphasis',
      (textEditor, edit) => {
        toggleEmphasis(textEditor, edit, '**');
      },
    ),
    commands.registerTextEditorCommand('miniMarkdown.insertTable', insertTable),
    commands.registerTextEditorCommand('miniMarkdown.onEnterKey', onEnterKey),
    commands.registerTextEditorCommand('miniMarkdown.onTabKey', onTabKey),
    commands.registerTextEditorCommand(
      'miniMarkdown.onShiftTabKey',
      onShiftTabKey,
    ),
  );
}
