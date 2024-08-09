import {
  window,
  Position,
  Range,
  Selection,
  commands,
  type TextEditorEdit,
  type TextEditor,
} from 'vscode';

/** Checks that a line starts with an unordered or ordered list bullet */
const lineStartsWithListBulletRegExp = /^(\s*)([*-]|\d+\.)(\s+)(\[[ x]])?/i;

/**
 * Return the range for the:
 * - selection
 * - selection + tags around
 * - word + tags under cursor
 * - word under cursor
 */
function getWordRange(editor: TextEditor, wordPattern: RegExp) {
  // Word is already wrapped in the tags: _tacocat_
  const taggedRange = editor.document.getWordRangeAtPosition(
    editor.selection.start,
    wordPattern,
  );
  if (taggedRange) {
    return taggedRange;
  }

  // If something is selected, return the range of selection
  if (editor.selection.isEmpty === false) {
    return editor.selection;
  }

  // Otherwise, return the default range for the word: tacocat
  return editor.document.getWordRangeAtPosition(editor.selection.start);
}

/**
 * Adjust cursor position so it stays the same after adding/removing the tags
 */
function adjustCursorPosition(editor: TextEditor, delta: number) {
  const { start, end } = editor.selection;

  if (editor.selection.isEmpty) {
    // If nothing is selected, just move the cursor
    const newStart = new Position(start.line, start.character + delta);
    const newEnd = new Position(end.line, end.character + delta);
    editor.selection = new Selection(newStart, newEnd);
  } else if (delta > 0) {
    // Otherwise move both edges of the selection when adding a tag
    const newStart = new Position(start.line, start.character + delta);
    const newEnd = new Position(end.line, end.character - delta);
    editor.selection = new Selection(newStart, newEnd);
  } else {
    // Or move only the start position when removing a tag
    const newStart = new Position(start.line, start.character + delta);
    const newEnd = new Position(end.line, end.character);
    editor.selection = new Selection(newStart, newEnd);
  }
}

/**
 * Add emphasis (bold, italic, etc.) around a word or selection
 */
function addEmphasis(
  editor: TextEditor,
  edit: TextEditorEdit,
  tag: string,
  range: Range,
) {
  // Wrap the text in the tags
  const text = editor.document.getText(range);
  const newText = `${tag}${text}${tag}`;
  edit.replace(range, newText);

  adjustCursorPosition(editor, tag.length);
}

/**
 * Remove emphasis (bold, italic, etc.) around a word or selection
 */
function removeEmphasis(
  editor: TextEditor,
  edit: TextEditorEdit,
  tag: string,
  range: Range,
) {
  // Remove the tags
  const text = editor.document.getText(range);
  const newText = text.slice(tag.length, -tag.length);
  edit.replace(range, newText);

  adjustCursorPosition(editor, -tag.length);
}

/**
 * Toggle emphasis (bold, italic, etc.) around a word or selection
 */
export function toggleEmphasis(
  editor: TextEditor,
  edit: TextEditorEdit,
  tag: string,
) {
  const tagEscaped = tag.replaceAll('*', `\\*`);

  const range = getWordRange(
    editor,
    new RegExp(`${tagEscaped}[-\\w]*${tagEscaped}`),
  );
  if (range === undefined) {
    return;
  }

  const text = editor.document.getText(range);

  const isWrappedInTag = text.startsWith(tag) && text.endsWith(tag);

  if (isWrappedInTag) {
    removeEmphasis(editor, edit, tag, range);
  } else {
    addEmphasis(editor, edit, tag, range);
  }
}

/**
 * Insert a table of given dimensions
 *
 * | Col 1 | Col 2 | Col 3 |
 * | ----- | ----- | ----- |
 * | x | x | x |
 * | x | x | x |
 * | x | x | x |
 */
export async function insertTable(editor: TextEditor) {
  // TODO: Ask rows and columns separately
  const result = await window.showInputBox({
    value: '2x3',
    placeHolder: 'Choose table size: COLUMNSxROWS',
    validateInput: (text) => {
      const isValid = text.match(/^\d+x\d+$/i) !== null;
      return isValid
        ? undefined // Correct value
        : `Incorrect table size, expected format: COLUMNSxROWS`;
    },
  });

  if (result === undefined) {
    return;
  }

  const [columnsRaw, rowsRaw] = result.split(/x/i);
  const numberColumns = Number(columnsRaw);
  const numberRows = Number(rowsRaw);

  // An array with an `undefined` element for each column
  const columnsTemplate = Array.from({ length: numberColumns });

  const header = columnsTemplate
    .map((_column, columnIndex) => `Col ${columnIndex + 1}`)
    .join(' | ');

  const headerLine = columnsTemplate.map(() => `-----`).join(' | ');

  const body = Array.from({ length: numberRows - 1 }).map(() => {
    return columnsTemplate.map(() => 'x').join(' | ');
  });

  const table = `| ${[header, headerLine, ...body].join(' |\n| ')} |`;

  const line = editor.document.lineAt(editor.selection.active.line);

  // Insert table after the current line (can't use edit passed from the
  // registerTextEditorCommand because of the async call before)
  await editor.edit((textEdit) => {
    textEdit.replace(line.range.end, `\n${table}\n`);
  });
}

/**
 * Insert a list bullet on Enter press at the end of a list item line
 */
export function onEnterKey(editor: TextEditor, edit: TextEditorEdit) {
  const line = editor.document.lineAt(editor.selection.active.line);

  // The cursor is at the end of line
  if (line.range.end.character === editor.selection.end.character) {
    // The current line starts with a list bullet
    const match = line.text.match(lineStartsWithListBulletRegExp);
    if (match) {
      // The current line has ONLY list bullet
      if (line.text.length === match[0].length) {
        // Clear the current line
        edit.replace(line.range, '');
      } else {
        const number = Number.parseInt(match[2]);
        if (Number.isNaN(number)) {
          // Insert a new line with the same bullet as the current line
          edit.replace(line.range.end, `\n${match[0]}`);
        } else {
          // Insert a new line with the next number
          const nextNumber = number + 1;
          edit.replace(
            line.range.end,
            `\n${match[1]}${nextNumber}.${match[3]}${match[4] ?? ''}`,
          );
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
export function onTabKey(editor: TextEditor) {
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
export function onShiftTabKey(editor: TextEditor) {
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
