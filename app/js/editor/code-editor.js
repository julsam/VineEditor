'use strict'

// const electron = require("electron");
// const remote = electron.remote;
// const appSettings = remote.require("./main/vine-editor-settings");

const placeholder = `You can write the text of your passage here.

// And write comments like this

To display special symbols without them being transformed, put them between \`backticks\`.

To link to another passage, put two square brackets around its name, [[like this]].
Or you can write the link text and the passage name like this: [[link text|passage name]].

Instructions like \`<<set>>\` and \`<<unset>>\` are for setting or deleting the variables of your passage. If you've \`<<set>>\` a variable <<set myVar = "Hello">> you can display it in your passage using \`{{varname}}\`: {{myVar}}.

You can also call functions in any instruction or display: \`<<set myVarUppercase = Uppercase(myVar)>> {{myVarUppercase}}\`.

You can control the flow of your story using statements \`<<if>>\`, \`<<elif>>\`, \`<<else>>\` and \`<<for>>\`.
<<if myVar == "Hello">>
	Hi there! 👋
<<else>>
	Okay, bye!
<<end>>

You can collapse lines like this:
{
This sentence will be
on one line with
only single spaces.
}

Consult \`https://github.com/julsam/VineScript\` and \`https://github.com/julsam/VineEditor\` for more information.`;

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