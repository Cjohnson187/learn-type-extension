const vscode = require('vscode');

// --- Global State Variables ---
let isPracticeMode = false;
let targetText = '';
let targetLength = 0;
let disposables = [];
let decorationTimeout = null; 
let isSettingUp = false; 
// The SETUP_MARKER is no longer needed since we are not inserting the text anymore.
// const SETUP_MARKER = '\u200B'; 

// Decoration types for highlighting
let correctDecorationType = null; 
let errorDecorationType = null;
let overlayDecorationType = null;

/**
 * Disposes of all resources (listeners, decorations, timeouts) without 
 * resetting the core state variables (isPracticeMode, targetText).
 */
function disposeResources() {
    // Dispose of listeners
    disposables.forEach(d => d.dispose());
    disposables = [];
    console.log('LOG: Event listeners disposed.');
    
    // Clear the debounce timeout if it's active
    if (decorationTimeout) {
        clearTimeout(decorationTimeout);
        decorationTimeout = null;
        console.log('LOG: Debounce timer cleared.');
    }

    // Reset editor settings (optional, but good practice)
    vscode.workspace.getConfiguration().update('editor.wordWrap', undefined, vscode.ConfigurationTarget.Workspace);
    vscode.workspace.getConfiguration().update('editor.suggest.enabled', undefined, vscode.ConfigurationTarget.Workspace);
    // NEW: Restore inline suggest setting
    vscode.workspace.getConfiguration().update('editor.inlineSuggest.enabled', undefined, vscode.ConfigurationTarget.Workspace);
    
    // Clear decorations and dispose of decoration types
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        // Clear decorations using the defined decoration types
        if (correctDecorationType) editor.setDecorations(correctDecorationType, []);
        if (errorDecorationType) editor.setDecorations(errorDecorationType, []);
        if (overlayDecorationType) editor.setDecorations(overlayDecorationType, []);
        console.log('LOG: Decorations cleared from editor.');
    }
    
    // Dispose of decoration types globally and set them to null
    if (correctDecorationType) correctDecorationType.dispose();
    if (errorDecorationType) errorDecorationType.dispose();
    if (overlayDecorationType) overlayDecorationType.dispose();
    console.log('LOG: Decoration types disposed.');

    // Reset decoration types to null
    correctDecorationType = null;
    errorDecorationType = null;
    overlayDecorationType = null;
}

/**
 * Debounced wrapper for updateDecorations to handle rapid text changes (like during setup).
 * Ensures decorations are only applied once the editor state has settled.
 * @param {vscode.TextEditor} editor 
 */
function debouncedUpdateDecorations(editor) {
    if (decorationTimeout) {
        clearTimeout(decorationTimeout);
        // console.log('LOG: Debounce: Timer reset.');
    }
    
    // Schedule the actual decoration update after 10ms
    decorationTimeout = setTimeout(() => {
        decorationTimeout = null;
        updateDecorations(editor);
        // console.log('LOG: Debounce: Update Executed.');
    }, 10);
}


/**
 * Calculates the current match state (correct, error, and overlay ranges) 
 * and applies the appropriate decorations.
 * @param {vscode.TextEditor} editor 
 */
function updateDecorations(editor) {
    // CRITICAL: This guard relies on state set in startPractice
    if (!editor || !isPracticeMode || !targetText) { 
        console.log('LOG: updateDecorations skipped (not in practice mode or missing data).');
        return;
    }
    
    // console.log('LOG: Decoration update is running after debounce.');

    const document = editor.document;
    const currentText = document.getText();
    const currentLength = currentText.length;

    // The target is still based on the original full text length
    console.log(`LOG: Update Decorations: Current Length: ${currentLength}, Target Length: ${targetLength}`);
    
    let matchIndex = 0;
    
    // Find the boundary of the correctly typed prefix
    while (matchIndex < currentLength && matchIndex < targetLength && currentText[matchIndex] === targetText[matchIndex]) {
        matchIndex++;
    }

    // NEW LOGIC: Move cursor to the boundary between correct text and the first error/untyped character.
    // This forces the user's focus back to the point of correction, immediately after the last correct character.
    if (editor) {
        const cursorPosition = document.positionAt(matchIndex);
        // Only change selection if the cursor is not already correctly positioned
        if (editor.selection.start.isEqual(cursorPosition) === false || editor.selection.end.isEqual(cursorPosition) === false) {
             editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
        }
    }

    const correctRanges = [];
    const errorRanges = [];
    const overlayRanges = [];
    
    // --- 1. Determine Correct and Error Ranges in the current document (typed text) ---
    // Error logic must now compare typed text against target text
    let errorStart = -1;

    for (let i = 0; i < currentLength; i++) {
        // If we haven't reached the target length, check for match
        const charMatch = (i < targetLength) && (currentText[i] === targetText[i]);
        
        // If current length exceeds target length, the rest is an error
        const overflowError = (i >= targetLength);

        if (charMatch) {
            if (errorStart !== -1) {
                // End of error block
                errorRanges.push(new vscode.Range(document.positionAt(errorStart), document.positionAt(i)));
                errorStart = -1;
            }
            // Correct character
            correctRanges.push(new vscode.Range(document.positionAt(i), document.positionAt(i + 1)));
        } else if (overflowError || !charMatch) {
            // Error character
            if (errorStart === -1) {
                errorStart = i;
            }
        }
    }
    
    // Finalize any remaining error block
    if (errorStart !== -1) {
        errorRanges.push(new vscode.Range(document.positionAt(errorStart), document.positionAt(currentLength)));
    }


    // --- 2. Determine Overlay Range (untyped target text) ---
    // The overlay range is where the ghost text (suggestion) should appear.
    // This is applied as an "after" content property of the decoration.
    let overlayStartIndex = matchIndex;
    
    if (overlayStartIndex < targetLength) {
        // 1. Calculate the remainder of the target text
        const remainderText = targetText.substring(matchIndex);
        
        // 2. The decoration is applied at the position of the first untyped character
        const decorationPosition = document.positionAt(matchIndex);
        
        // This is the cleanest way to render multiline content as a placeholder,
        // although it's still technically a decoration, not a suggestion.
        if (remainderText.length > 0) {
            overlayRanges.push({
                range: new vscode.Range(decorationPosition, decorationPosition),
                renderOptions: {
                    after: {
                        contentText: remainderText,
                        color: '#888888', // Faded gray text
                        backgroundColor: 'transparent',
                    }
                }
            });
        }
    }
    
    console.log(`LOG: Match Index: ${matchIndex}`);

    // Apply the decorations to the editor
    // Note: The correct/error decorations are applied using their defined types.
    // The overlay is applied as a dynamic decoration list since it uses a unique `renderOptions` property per update.
    editor.setDecorations(correctDecorationType, correctRanges);
    editor.setDecorations(errorDecorationType, errorRanges);
    editor.setDecorations(overlayDecorationType, overlayRanges);
    
    // Check for completion
    // Completion occurs when the entire target text has been correctly typed and the current length matches.
    if (matchIndex === targetLength && currentLength === targetLength && !isSettingUp) { 
        stopPractice(true);
        vscode.window.showInformationMessage('Code Typer Extension: CONGRATULATIONS! Practice Complete!');
    }
}


/**
 * Sets up the initial decorations and listeners for practice mode.
 */
function startPractice() {
    isSettingUp = true; // START SETUP GUARD
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        console.error('LOG: startPractice failed: No active text editor.');
        isSettingUp = false;
        return;
    }

    const document = editor.document;
    
    // Get the file name for display (basename is just the file name, not the full path)
    const fileName = document.fileName.substring(document.fileName.lastIndexOf('/') + 1);

    // Must have content to type
    if (document.getText().trim().length === 0) {
        vscode.window.showErrorMessage('Code Typer Extension: The current document is empty. Please open a file with code to start practice.');
        console.error('LOG: startPractice failed: Document is empty.');
        isSettingUp = false;
        return;
    }

    // Capture text and set mode. These must NOT be reset by cleanup.
    targetText = document.getText();
    targetLength = targetText.length;
    isPracticeMode = true; 
    
    console.log(`LOG: Practice Starting. File: ${fileName}, Target Length: ${targetLength}`);

    // --- 1. CLEANUP (Only dispose of old resources) ---
    disposeResources(); 

    // --- 2. Define Decoration Types ---
    correctDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.1)', // Light green background
        color: '#00cc00', // Bright green text
    });

    errorDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 0, 0, 0.3)', // Red background
        color: '#ff3333', // Red text
    });

    // The overlay decoration type itself is now minimal, as the content is set dynamically in updateDecorations
    overlayDecorationType = vscode.window.createTextEditorDecorationType({
        // The key property `after` is set in updateDecorations, not here.
        // We keep it defined to have a type to apply the dynamic ranges to.
    });
    console.log('LOG: Decoration types defined.');

    // --- 3. Setup Listeners ---
    const changeListener = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document === editor.document && isPracticeMode) {
            console.log('LOG: Text change event triggered.');
            debouncedUpdateDecorations(editor);
        }
    });

    // We keep the guard listener placeholder
    const typingGuardListener = vscode.workspace.onDidChangeTextDocument(event => {
        // Placeholder for future illegal edit enforcement
    });


    const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(e => {
        if (e !== editor && isPracticeMode) {
            stopPractice(false);
            vscode.window.showInformationMessage('Code Typer Extension: Practice stopped because you changed editor tabs.');
            console.log('LOG: Practice stopped due to active editor change.');
        }
    });
    
    disposables.push(changeListener, typingGuardListener, activeEditorListener);
    console.log('LOG: Event listeners registered.');

    // CRITICAL: Disable features that interfere with typing experience
    vscode.workspace.getConfiguration().update('editor.wordWrap', 'off', vscode.ConfigurationTarget.Workspace);
    vscode.workspace.getConfiguration().update('editor.suggest.enabled', false, vscode.ConfigurationTarget.Workspace);
    // NEW: Disable inline completion suggestions
    vscode.workspace.getConfiguration().update('editor.inlineSuggest.enabled', false, vscode.ConfigurationTarget.Workspace);
    
    // --- 4. EXECUTION FLOW: Clear Document, NO INSERT, Apply Decorations ---
    
    // Define the full range of the document content
    const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
    
    // Clear the document contents first
    editor.edit(editBuilder => {
        // **ACTION CHANGED: Now only clears the document.**
        editBuilder.delete(fullRange);
    }).then(success => {
        console.log(`LOG: Document cleared successfully: ${success}`);
        
        // **ACTION REMOVED: No longer inserting the text.**
        
        // Then, move the cursor to the start
        const startPos = new vscode.Position(0, 0);
        editor.selection = new vscode.Selection(startPos, startPos);
        
        // END SETUP GUARD: Now that the text is cleared and cursor is ready.
        isSettingUp = false; 

        // Call the debounced function to apply the initial overlay (ghost text suggestion)
        debouncedUpdateDecorations(editor);
        console.log('LOG: debouncedUpdateDecorations called for initial overlay.');


        // Display the success message
        vscode.window.showInformationMessage(`Code Typer Extension: Practice Started on ${fileName}! Type the code below. Errors must be manually corrected. The full target text appears as a placeholder suggestion.`);
    }).catch(error => {
        console.error('LOG: ERROR during startPractice edit sequence:', error);
        isSettingUp = false; // Ensure setup guard is reset on error
        vscode.window.showErrorMessage('Code Typer Extension: Failed to set up typing environment.');
    });
}

/**
 * Cleans up listeners and decorations to stop practice mode.
 * @param {boolean} [silent=false] Whether to suppress the "Stopped" message.
 */
function stopPractice(silent = false) {
    const editor = vscode.window.activeTextEditor;
    const currentTargetText = targetText; // Capture targetText before state reset

    // 1. Dispose of resources (listeners, decorations, timeouts)
    disposeResources();
    
    // 2. Reset global state variables
    if (isPracticeMode) {
        targetText = ''; 
        targetLength = 0; 
        isPracticeMode = false;
        isSettingUp = false; // Reset setup guard here too, just in case
        console.log('LOG: Global state reset and isPracticeMode set to false.');

        // 3. Restore the original text (Async edit)
        if (editor && currentTargetText.length > 0) {
            const document = editor.document;
            const fullRange = new vscode.Range(new vscode.Position(0, 0), document.positionAt(document.getText().length));
            
            // Clear current content (typed/partial text)
            editor.edit(editBuilder => {
                editBuilder.delete(fullRange);
            }).then(() => {
                // Insert original content
                return editor.edit(editBuilder => {
                    editBuilder.insert(new vscode.Position(0, 0), currentTargetText);
                });
            }).then(() => {
                console.log('LOG: Original text restored on stop.');
            }).catch(error => {
                console.error('LOG: Error restoring original text:', error);
            });
        }
    }

    if (!silent) {
        vscode.window.showInformationMessage('Code Typer Extension: Practice Stopped. Happy coding!');
    }
}

/**
 * Entry point for the extension.
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    try {
        // Register the start command
        let disposableStart = vscode.commands.registerCommand('codetyper.startPractice', startPractice);
        context.subscriptions.push(disposableStart);
        
        // Register the stop command
        let disposableStop = vscode.commands.registerCommand('codetyper.stopPractice', stopPractice);
        context.subscriptions.push(disposableStop);

        console.log('Code Typer Extension: All commands registered successfully.');

    } catch (error) {
        console.error('Code Typer Extension failed to activate:', error);
    }
}

// this method is called when your extension is deactivated
function deactivate() {
    stopPractice(true); // Clean up silently
}

module.exports = {
    activate,
    deactivate
}
