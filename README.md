# Code Typer Extension

#### A VS Code Extension for Code Typing Practice.

Practice your code typing speed and accuracy directly within your Visual Studio Code editor, using real code snippets.

### Features

- **In-Editor Overlay:** The target code snippet appears in the editor, marked with a faint gray color (the "overlay").

- **Real-Time Feedback:** Characters are checked as you type, letter by letter.

- **Correct Typing:** Correctly typed characters are highlighted in green.

- **Error Handling (Permissive Mode):** Incorrect characters are allowed to be typed and are immediately highlighted in red. You must manually backspace and correct any errors before you can advance by typing the correct sequence of the target text.

- **Input Handling:** The extension allows all keystrokes, including incorrect ones and backspaces, providing a more standard text editing feel.

### How to Use
1. **Open a file:** Open any code file (``.js``, ``.ts``, ``.py``, etc.) containing the code snippet you want to practice typing. The entire content of the active file will be used as the target text.

2. **Start Practice:** Open the Command Palette (``Ctrl+Shift+P`` or ``Cmd+Shift+P``) and execute the command:
``Code Typer: Start Practice``

3. **Type:** Your cursor will jump to the beginning of the file. Start typing the code.
    - **Correct characters** will be highlighted in green.
    - **Incorrect characters** will be typed into the document and highlighted in red. You must use backspace to delete the error(s) and then type the correct character to proceed.
    - **The remaining**, untyped characters will appear in a faint gray (the overlay).
4. **Stop Practice:** To exit the practice mode and resume normal editing, execute the command:
    ``Code Typer: Stop Practice``

### Setup (For Developers)

To run and debug this extension locally, follow these steps:

1. **Clone or create the files:** Ensure you have package.json and extension.js in your project folder.

2. **Initialize the project:** Run the following commands in your terminal:
```
npm install
```
3. **Launch the Extension:**

    - Open the project folder in VS Code.

    - Go to the Run and Debug view (Ctrl+Shift+D).

    - Select "Run Extension" and click the green play button.

    - A new "Extension Development Host" window will open.

    - In this new window, open any code file and run the CodeType Club: Start Practice command to test it.

### Future Enhancements (Ideas)

- Implement a method to load random code snippets instead of using the entire open file.

- Track metrics like WPM (Words Per Minute) and accuracy.

- Add configuration settings for error tolerance or different color themes.