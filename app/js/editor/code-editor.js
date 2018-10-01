'use strict'

// const electron = require("electron");
// const remote = electron.remote;
// const appSettings = remote.require("./main/vine-editor-settings");

var toggleComment = function(editor) {
    // Only line comments are handled
    
    // Set options
    let options = {
        lineComment: "//",
        padding: " ",
        commentBlankLines: false,
        indent: true
    };

    // Get the selection range
    let range = {
        from: editor.getCursor("from"),
        to: editor.getCursor("to")
    };

    let hasUncommentedLines = false;
    if (range.from.line !== range.to.line) {
        // Look for uncommented lines in the selection
        for (let i = range.from.line; i <= range.to.line; i++) {
            let line = editor.getLine(i).trimLeft();
            if (!line.startsWith("//") && line !== "") {
                // if it doesn't starts with "//" and it's not an empty line
                hasUncommentedLines = true;
                break;
            }
        }
    } else {
        // there's only one line
        // even if it's an empty line (with whitespace), toggle comment on it
        if (!editor.getLine(range.from.line).trimLeft().startsWith("//")) {
            hasUncommentedLines = true;
        }
    }

    if (hasUncommentedLines) {
        // if there's at least one uncommented line, comment everything
        editor.lineComment(range.from, range.to, options);
    } else {
        // if all lines are commented, uncomment.
        editor.uncomment(range.from, range.to, options);
    }
    // editor.toggleComment(range.from, range.to, options);
}

/**
 * Create a new CodeMirror instance configured for VineScript
 */
module.exports.newVineEditor = (elementID) => {
    // TODO make an informative placeholder
    const placeholder = "Empty Text";

    let editor = CodeMirror.fromTextArea(document.getElementById(elementID), {
        // Options
        indentWithTabs: true,
        indentUnit: 4,
        tabSize: 4,
        smartIndent: true,
        // electricChars: true,
        direction: "ltr",
        lineWrapping: true,
        lineNumbers: true,
        showCursorWhenSelecting: true,
        undoDepth: 250,
        // tabindex: 1,
        autofocus: true,
        dragDrop: false,
        // Addons
        placeholder: placeholder,
        styleActiveLine: true,
        matchBrackets: true,
        autoCloseBrackets: {
            pairs: "{}[]()\"\"<>",
            override: true
        },
        styleSelectedText: true,
        highlightSelectionMatches: {annotateScrollbar: true, wordsOnly: true},
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        // Other
        extraKeys: {
            // CM uses Shift-Tab to auto-indent, override it with unindent
            "Shift-Tab": "indentLess",
            "Ctrl-Space": "autocomplete",
            "Ctrl-/": toggleComment,
            "Cmd-/": toggleComment,
            "F3": "findNext",
            "Shift-F3": "findPrev",
        }
    });

    // This is a small hack to allow modes such as VineScript to
    // access the full text of the textarea, permitting its lexer
    // to grow a syntax tree by itself. Idea taken from Twinejs.
    CodeMirror.modes["vinescript"].cm = editor;
    editor.setOption("mode", {
        name: "vinescript",
        // other mode options...
    });

    return editor;
}