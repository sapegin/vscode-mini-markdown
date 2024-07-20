import { window, Position, Range, Selection, commands } from 'vscode';

// The commands here are only bound to keys with `when` clause containing
// `editorTextFocus && !editorReadonly` (see package.json), so we don't need to
// check whether `activeTextEditor` returns `undefined` in most cases.
/* eslint-disable @typescript-eslint/no-non-null-assertion */

/** Checks that a line starts with an unordered or ordered list bullet */
const lineStartsWithListBulletRegExp = /^(\s*)([-*]|\d+\.)(\s+)(\[[ x]\])?/i;

/**
 * Return the range for the:
 * - selection
 * - word + tags under cursor
 * - word under cursor
 */
function getWordRange(wordPattern: RegExp) {
  const editor = window.activeTextEditor!;

  // If something is selected, return the range of selection
  if (editor.selection.isEmpty === false) {
    return editor.selection;
  }

  // Word is already wrapped in the tags: _tacocat_
  const taggedRange = editor.document.getWordRangeAtPosition(
    editor.selection.start,
    wordPattern,
  );
  if (taggedRange) {
    return taggedRange;
  }

  // Otherwise, return the default range for the word: tacocat
  return editor.document.getWordRangeAtPosition(editor.selection.start);
}

/**
 * Adjust cursor position so it stays the same after adding/removing the tags
 */
function adjustCursorPosition(delta: number) {
  const editor = window.activeTextEditor!;

  const { start, end } = editor.selection;

  if (editor.selection.isEmpty) {
    // If nothing is selected, just move the cursor
    const newStart = new Position(start.line, start.character + delta);
    const newEnd = new Position(end.line, end.character + delta);
    editor.selection = new Selection(newStart, newEnd);
  } else {
    // Otherwise move both edges of the selection
    const newStart = new Position(start.line, start.character + delta);
    const newEnd = new Position(end.line, end.character - delta);
    editor.selection = new Selection(newStart, newEnd);
  }
}

/**
 * Add emphasis (bold, italic, etc.) around a word or selection
 */
async function addEmphasis(tag: string, range: Range) {
  const editor = window.activeTextEditor!;

  // Wrap the text in the tags
  const text = editor.document.getText(range);
  const newText = `${tag}${text}${tag}`;
  await editor.edit((textEdit) => {
    textEdit.replace(range, newText);
  });

  adjustCursorPosition(tag.length);
}

/**
 * Remove emphasis (bold, italic, etc.) around a word or selection
 */
async function removeEmphasis(tag: string, range: Range) {
  const editor = window.activeTextEditor!;

  // Remove the tags
  const text = editor.document.getText(range);
  const newText = text.substring(tag.length, text.length - tag.length);
  await editor.edit((textEdit) => {
    textEdit.replace(range, newText);
  });

  adjustCursorPosition(-tag.length);
}

/**
 * Toggle emphasis (bold, italic, etc.) around a word or selection
 */
export async function toggleEmphasis(tag: string) {
  const editor = window.activeTextEditor!;

  const tagEscaped = tag.replaceAll('*', '\\*');

  const range = getWordRange(new RegExp(`${tagEscaped}[-\\w]*${tagEscaped}`));
  if (range === undefined) {
    return;
  }

  const text = editor.document.getText(range);

  const isWrappedInTag = text.startsWith(tag) && text.endsWith(tag);

  if (isWrappedInTag) {
    await removeEmphasis(tag, range);
  } else {
    await addEmphasis(tag, range);
  }
}

/**
 * Insert a table of a given dimensions
 *
 * | Col 1 | Col 2 | Col 3 |
 * | ----- | ----- | ----- |
 * | x | x | x |
 * | x | x | x |
 * | x | x | x |
 */
export async function insertTable() {
  const result = await window.showInputBox({
    value: '2x3',
    placeHolder: 'Choose table size: COLUMNSxROWS',
    validateInput: (text) => {
      const isValid = text.match(/^\d+x\d+$/i) !== null;
      return isValid
        ? null
        : `Incorrect table size, expected format: COLUMNSxROWS`;
    },
  });

  if (result === undefined) {
    return;
  }

  const [columnsRaw, rowsRaw] = result.split(/x/i);
  const columns = Number(columnsRaw);
  const rows = Number(rowsRaw);

  const header = [...Array(columns)]
    .map((_column, columnIndex) => `Col ${columnIndex + 1}`)
    .join(' | ');

  const headerLine = [...Array(columns)].map(() => `-----`).join(' | ');

  const body = [...Array(rows - 1)].map(() => {
    return [...Array(columns)].map(() => 'x').join(' | ');
  });

  const table = `| ${[header, headerLine, ...body].join(' |\n| ')} |`;

  const editor = window.activeTextEditor!;
  const line = editor.document.lineAt(editor.selection.active.line);

  // Insert table after the current line
  await editor.edit((textEdit) => {
    textEdit.replace(line.range.end, `\n${table}\n`);
  });
}

/**
 * Insert a list bullet on Enter press at the end of a list item line
 */
export async function onEnterKey() {
  const editor = window.activeTextEditor!;
  const line = editor.document.lineAt(editor.selection.active.line);

  // The cursor is at the end of line
  if (line.range.end.character === editor.selection.end.character) {
    // The current line starts with a list bullet
    const match = line.text.match(lineStartsWithListBulletRegExp);
    if (match) {
      // The current line has ONLY list bullet
      if (line.text.length === match[0].length) {
        // Clear the current line
        await editor.edit((textEdit) => {
          textEdit.replace(line.range, '');
        });
      } else {
        const number = parseInt(match[2]);
        if (isNaN(number)) {
          // Insert a new line with the same bullet as the current line
          await editor.edit((textEdit) => {
            textEdit.replace(line.range.end, `\n${match[0]}`);
          });
        } else {
          // Insert a new line with the next number
          const nextNumber = number + 1;
          await editor.edit((textEdit) => {
            textEdit.replace(
              line.range.end,
              `\n${match[1]}${nextNumber}.${match[3]}${match[4] ?? ''}`,
            );
          });
        }
      }
      return;
    }
  }

  // Trigger the default Enter behavior
  commands.executeCommand('type', { source: 'keyboard', text: '\n' });
}

/**
 * Indent the current line if it's a list bullet without content
 */
export function onTabKey() {
  const editor = window.activeTextEditor!;
  const line = editor.document.lineAt(editor.selection.active.line);

  // The current line starts with a list bullet
  const match = line.text.match(lineStartsWithListBulletRegExp);
  if (match) {
    // Indent the current line
    // TODO: Ideally, we should also update the number for ordered lists
    commands.executeCommand('editor.action.indentLines');
    return;
  }

  // Trigger the default Tab behavior
  commands.executeCommand('tab');
}

/**
 * Outdent the current line if it's a list bullet without content
 */
export function onShiftTabKey() {
  const editor = window.activeTextEditor!;
  const line = editor.document.lineAt(editor.selection.active.line);

  // The current line starts with a list bullet
  const match = line.text.match(lineStartsWithListBulletRegExp);
  if (match) {
    // Outdent the current line
    // TODO: Ideally, we should also update the number for ordered lists
    commands.executeCommand('editor.action.outdentLines');
    return;
  }

  // Trigger the default Shift+Tab behavior
  commands.executeCommand('editor.action.outdentLines');
}
