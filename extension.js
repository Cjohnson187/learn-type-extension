const vscode = require('vscode');

// --- Global State Variables ---
let isPracticeMode = false;
let targetText = '';
let targetLength = 0;
let disposables = [];

// Decoration types for highlighting
let correctDecorationType;
let errorDecorationType;
let overlayDecorationType;

/**
 * Calculates the current match state (correct, error, and overlay ranges) 
 * and applies the appropriate decorations.
 * @param {vscode.TextEditor} editor 
 */
function updateDecorations(editor) {
    if (!editor || !isPracticeMode || !targetText) {
        return;
    }

    const document = editor.document;
    const currentText = document.getText();
    const currentLength = currentText.length;

    let matchIndex = 0;
    
    // Find the boundary of the correctly typed prefix
    while (matchIndex < currentLength && matchIndex < targetLength && currentText[matchIndex] === targetText[matchIndex]) {
        matchIndex++;
    }

    const correctRanges = [];
    const errorRanges = [];
    const overlayRanges = [];
    
    // 1. Determine Correct and Error Ranges in the current document (typed text)
    if (currentLength > 0) {
        let errorStart = -1;

        // Iterate through the typed portion
        for (let i = 0; i < currentLength; i++) {
            const charMatch = (i < targetLength) && (currentText[i] === targetText[i]);

            if (charMatch) {
                // If we were in an error state, close the error range
                if (errorStart !== -1) {
                    const errorEndPos = document.positionAt(i);
                    const errorStartPos = document.positionAt(errorStart);
                    errorRanges.push(new vscode.Range(errorStartPos, errorEndPos));
                    errorStart = -1;
                }
                // Add correct character range
                const startPos = document.positionAt(i);
                const endPos = document.positionAt(i + 1);
                correctRanges.push(new vscode.Range(startPos, endPos));
            } else {
                // Character mismatch or extra characters
                if (errorStart === -1) {
                    errorStart = i;
                }
            }
        }
        
        // Handle trailing error text (mismatch or extra characters at the end)
        if (errorStart !== -1) {
            const errorStartPos = document.positionAt(errorStart);
            const errorEndPos = document.positionAt(currentLength);
            errorRanges.push(new vscode.Range(errorStartPos, errorEndPos));
        }
    }

    // 2. Determine Overlay Range (untyped target text)
    // The overlay starts from the index where the current document stops matching the target text (matchIndex).
    let overlayStartIndex = matchIndex;
    
    if (overlayStartIndex < targetLength) {
        const overlayStartPos = document.positionAt(overlayStartIndex);
        const overlayEndPos = document.positionAt(targetLength);
        overlayRanges.push(new vscode.Range(overlayStartPos, overlayEndPos));
    }


    // Apply the decorations to the editor
    editor.setDecorations(correctDecorationType, correctRanges);
    editor.setDecorations(errorDecorationType, errorRanges);
    editor.setDecorations(overlayDecorationType, overlayRanges);
}


/**
 * Sets up the initial decorations and listeners for practice mode.
 * @param {vscode.ExtensionContext} context 
 */
function startPractice() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    isPracticeMode = true;
    targetText = editor.document.getText();
    targetLength = targetText.length;

    // --- 1. Define Decoration Types ---
    correctDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.1)', // Light green background
        color: '#00cc00', // Bright green text
    });

    errorDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 0, 0, 0.3)', // Red background
        color: '#ff3333', // Red text
        is : true // Optional: A slightly different presentation for error
    });

    overlayDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#55555555', // Faint gray text for the overlay
    });

    // --- 2. Setup Listeners ---
    // Listen for changes in the text document to update decorations
    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document === editor.document && isPracticeMode) {
            updateDecorations(editor);
        }
    });

    // Listen for editor changes (e.g., changing tabs) to stop practice
    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(e => {
        if (e !== editor && isPracticeMode) {
             // Optional: automatically stop practice if the user navigates away
            stopPractice();
            vscode.window.showInformationMessage('CodeType Club: Practice stopped because you changed editor tabs.');
        }
    });
    
    disposables.push(changeListener, activeEditorListener);

    // Initial setup: move cursor to start and apply initial overlay
    const startPos = new vscode.Position(0, 0);
    editor.selection = new vscode.Selection(startPos, startPos);
    
    updateDecorations(editor);

    vscode.window.showInformationMessage('CodeType Club: Practice Started! Type the code below. Errors must be manually corrected.');
}

/**
 * Cleans up listeners and decorations to stop practice mode.
 */
function stopPractice() {
    if (!isPracticeMode) return;

    isPracticeMode = false;

    // Dispose of listeners
    disposables.forEach(d => d.dispose());
    disposables = [];
    
    // Clear decorations
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.setDecorations(correctDecorationType, []);
        editor.setDecorations(errorDecorationType, []);
        editor.setDecorations(overlayDecorationType, []);
    }
    
    // Dispose of decoration types
    correctDecorationType.dispose();
    errorDecorationType.dispose();
    overlayDecorationType.dispose();

    vscode.window.showInformationMessage('CodeType Club: Practice Stopped. Happy coding!');
}

/**
 * Entry point for the extension.
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    // Register the start command
    let disposableStart = vscode.commands.registerCommand('codetypeclub.startPractice', startPractice);
    context.subscriptions.push(disposableStart);
    
    // Register the stop command
    let disposableStop = vscode.commands.registerCommand('codetypeclub.stopPractice', stopPractice);
    context.subscriptions.push(disposableStop);
}

// this method is called when your extension is deactivated
function deactivate() {
    stopPractice();
}

module.exports = {
    activate,
    deactivate
}
