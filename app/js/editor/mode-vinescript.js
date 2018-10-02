const {UnicodeLetters, UnicodeEmojis, UnicodeNumbers} = require("./js/editor/unicode-regex");

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") { // CommonJS
        mod(require("codemirror/lib/codemirror"));
    } else if (typeof define == "function" && define.amd) { // AMD
        define(["codemirror/lib/codemirror"], mod);
    } else { // Plain browser env
        mod(CodeMirror);
    }
})(function(CodeMirror) {
    "use strict";

    CodeMirror.defineMode("vinescript", function(editorConfig, modeConfig) {
        // 
        let cm;
        let referenceVariables = [];
        let indentUnit = editorConfig.indentUnit;
        var curPunc;

        const ID_LETTER = "(?:" + UnicodeLetters + "|" + UnicodeEmojis + ")";
        const variableDef = new RegExp(ID_LETTER + "(?:" + ID_LETTER + "|" + UnicodeNumbers + ")*");

        const keywords = /(?:set|unset|if|elif|else|for|end|in|to|and|or)\b/;
        const operator = /(?:\*\*|\+=|-=|\*=|%\=|\/=|==|!=|<=|>=|&&|\|\|)|[-+\/*<>!=\^]/;
        const sign = /[[({})\]]/;
        const atom = /(?:true|false|null)\b/;
        const number = /(?:-)?(?:\d)+(?:\.\d+)?/;
        const string = /"(?:[^\\]|\\.)*?(?:")/;
        const punctuation = /[\.,:]/;
        // const indentEnding = {
        //     ">>": true, "}}": true, "]]": true, "}": true, "]": true
        // };
        const indentEndingStmt = [">>", "}}", "]]", "}", "]"];

        let init = function() {
            const doc = cm.doc;

            doc.on("beforeChange", (instance, changeObj) => {
                // const oldText = doc.getValue();
                // let newText = forceFullChange(change, oldText);
                // console.log(newText);
            });
            doc.on("change", (instance, changeObj) => {
                populateRefs(doc);
                cursorMarking(doc);
            });
            doc.on("cursorActivity", cursorMarking);
            doc.on("swapDoc", init);
            init = null;

            populateRefs(doc);
        };

        function populateRefs(doc)
        {
            referenceVariables = [];
            const text = doc.getValue();
            let lines = text.split("\n");
            for (let lineCount = 0; lineCount < lines.length; lineCount++)
            {
                let tokens = doc.cm.getLineTokens(lineCount, true);
                for (let tokenCount = 0; tokenCount < tokens.length; tokenCount++)
                {
                    let token = tokens[tokenCount];
                    if (token.type === "variable")
                    {
                        referenceVariables.push({
                            text: token.string,
                            line: lineCount,
                            start: token.start,
                            end: token.end,
                        });
                    }
                }
            }
        }
        
        // This 'beforeChange' event handler applies a hack to CodeMirror to force it
        // to rerender the entire text area whenever a change is made, not just the change.
        // This allows 'backtrack' styling, such as unclosed brackets, to be possible
        // under CodeMirror.
        function forceFullChange(changeObj, oldText)
        {
            if (!changeObj.update) {
                return;
            }
            
            // First, obtain the text area's full text line array, truncated
            // to just the line featuring the change.
            const line = changeObj.from.line;
            
            let newText = oldText
                .split("\n")
                .slice(0, changeObj.from.line + 1);
            
            // Join it with the change's text.
            newText[line] =
                newText[line].slice(0, changeObj.from.ch)
                + changeObj.text[0];
            
            // If the change is multi-line, the additional lines should be added.
            newText = newText.concat(changeObj.text.slice(1));
            
            // Now, register this change.
            changeObj.update({line: 0, ch: 0}, changeObj.to, newText);
            
            return newText.join("\n");
        }

        // This 'cursorActivity' event handler applies CodeMirror marks based on
        // the token that the cursor is resting on.
        let cursorMarks = [];
        function cursorMarking(doc)
        {
            if (cursorMarks.length) {
                cursorMarks.forEach(mark => mark.clear());
                cursorMarks = [];
            }
            
            const from = doc.getCursor("from");
            const from2 = {line: from.line, ch: from.ch};

            // look before the current position
            let token = doc.cm.getTokenAt(from);
            
            if (token.type !== "variable") {
                // getTokenAt returns the token before the given position
                // so we need to add 1 to look at the current position
                from2.ch += 1;
                token = doc.cm.getTokenAt(from2);
            }
            
            // If the cursor is at the end of the passage, or there is no text, then
            // the returned token will be null.
            if (!token || !token.type) {
                return;
            }
            
            // First, mark the containing token for the cursor's current position.
            // This illuminates the boundaries between tokens, and provides makeshift
            // bracket/closer matching.
            let mark = doc.markText(
                {line: from.line, ch: token.start},
                {line: from.line, ch: token.end},
                {className: "cm-vinescript-cursor"}
            );
            cursorMarks.push(mark);
            
            // If the token is a variable, then highlight all other occurrences
            // of the variable in the passage.
            // Use indexOf because it can have multiple types like "collapse variable"
            if (token.type.indexOf("variable") >= 0) {
                referenceVariables.forEach(e => {
                    if (e.start === token.start && e.end === token.end && e.line === from.line) {
                        // exclude the one that's currently under the cursor
                    }
                    else if (e.text === token.string) {
                        let mark = doc.markText(
                            {line: e.line, ch: e.start},
                            {line: e.line, ch: e.end},
                            {className: "cm-vinescript-variableOccurrence"}
                        );
                        cursorMarks.push(mark);
                    }
                });
            }
        }

        function tokenBaseInner(stream, state)
        {
            const ch = stream.peek();
            let match;

            if (stream.column() === 0) {
                state.line++;
                state.pos = 0;
            }

            // Verbatim ``` escapes everything
            if (state.inverbatim)
            {
                if (stream.match(state.verbatimRegex)) {
                    state.inverbatim = false;
                    state.verbatimOpener = "";
                    state.verbatimRegex = null;
                    return "verbatim";
                } else {
                    stream.next();
                    return "verbatim text";
                }
            }
            // Comment
            else if (state.incomment)
            {
                if (!stream.skipTo("*/")) {
                    stream.skipToEnd();
                } else {
                    stream.eatWhile(/\*|\//);
                    state.incomment = false;
                }
                return "comment";
            }
            // Stmt << ... >> or Display {{ ... }}
            else if (state.instmt || state.indisplay)
            {
                if (ch === "\"")
                {
                    if (stream.match(string)) {
                        return "string";
                    }
                    stream.skipToEnd();
                    return "error";
                }
                else if (stream.match(/\>\>/))
                {
                    curPunc = ">>";
                    state.instmt = false;
                    return "stmt";
                }
                else if (stream.match(/\}\}/))
                {
                    curPunc = "}}";
                    state.indisplay = false;
                    return "display";
                }
                else if (stream.match(operator))
                {
                    return "operator";
                }
                else if (stream.match(sign))
                {
                    return "sign";
                }
                else if (stream.match(punctuation))
                {
                    return "punctuation";
                }
                else if (stream.match(keywords))
                {
                    if (state.instmt) {
                        const ctx = state.context.prev
                            ? state.context.prev
                            : state.context;
                        if (stream.current() === "end") {
                            ctx.stmt = null;
                        }
                        if (stream.current() === "if") {
                            ctx.stmt = "if";
                        }
                    }
                    return "keyword";
                }
                else if (stream.match(atom))
                {
                    return "atom";
                }
                else if (stream.match(number))
                {
                    return "number";
                }
                else if (stream.match(variableDef))
                {
                    return "variable";
                }
                else if (stream.eatSpace()) {
                    return "whitespace";
                }
                else
                {
                    stream.next();
                    return "error";
                }
            }
            // Link [[title|link|code]] or [[title|link]] or [[title]]
            else if (state.inlink)
            {
                // Either escaped chars '\\', '\|', '\]]'
                // or anything but '\', '|' or ']'
                // Extra capturing parentheses are here to make it more readable
                if (stream.match(/(?:(?:\\\\)|(?:\\\|)|(?:\\\])|[^\\\|\]])+/))
                {
                    if (state.linkSep == 0) {
                        if (stream.peek() === "]") {
                            // [[mylink]] special case
                            // where the title is also the dest
                            return "link-dest";
                        }
                        return "link-title";
                    } else if (state.linkSep == 1) {
                        return "link-dest";
                    } else {
                        return "link-code";
                    }
                }
                else if (stream.match(/\|/))
                {
                    state.linkSep++;
                    return "link-sep";
                }
                else if (stream.match(/\]\]/))
                {
                    state.linkSep = 0;
                    state.inlink = false;
                    return "link";
                }
                else if (stream.match(/[\\\]]/))
                {
                    return "link-dest";
                }
            }
            // Closing Collapse }
            else if (state.incollapse && stream.match(/\}/))
            {
                state.incollapse = false;
                return "rcollapse";
            }

            // OPENERS starts here

            // Opening Verbatim ```
            else if (stream.match(/(`+)/, false) && !state.inverbatim)
            {
                const groupMatch = stream.match(/`+/);
                state.inverbatim = true;
                state.verbatimOpener = groupMatch[0];
                state.verbatimRegex = new RegExp("(?:" + groupMatch[0] + ")");
                return "verbatim";
            }
            else if (stream.match(/\<\</)) // Opening Stmt <<
            {
                curPunc = "<<";
                state.instmt = true;
                return "stmt";
            }
            else if (stream.match(/\{\{/)) // Opening Display {{
            {
                curPunc = "{{";
                state.indisplay = true;
                return "display";
            }
            else if (stream.match(/\[\[/)) // Opening Link [[
            {
                state.inlink = true;
                return "link";
            }
            else if (stream.match(/\/\//)) // Line Comment //
            {
                stream.skipToEnd();
                return "comment";
            }
            else if (stream.match(/\/\*/)) // Block Comments /*
            {
                state.incomment = true;
                if (!stream.skipTo("*/")) {
                    stream.skipToEnd();
                } else {
                    stream.eatWhile(/\*|\//);
                    state.incomment = false;
                }
                return "comment";
            }
            // Opening Collapse {
            else if (stream.match(/\{/) && !state.incollapse)
            {
                state.incollapse = true;
                return "lcollapse";
            }
            else
            {
                stream.next();
                return "text";
            }

            stream.next();
        }

        function tokenBase(stream, state)
        {
            const ctx = state.context;
            if (stream.sol()) {
                state.indentation = stream.indentation();
            }
            // if (stream.eatSpace()) {
            //     return "tab";
            // }

            curPunc = null;
            let style = tokenBaseInner(stream, state);
            
            if (state.incollapse) {
                style = "collapse " + style;
            }
            
            if (curPunc === "<<") {
                pushContext(state, stream.column(), ">>");
            }
            else if (curPunc === "{{") {
                pushContext(state, stream.column(), "}}");
            }
            else if (curPunc === ctx.type) {
                popContext(state);
            }

            state.pos += stream.current().length;

            return style;
        }

        function Context(indentation, column, type, stmt, prev) {
            this.indentation = indentation;
            this.column = column;
            this.type = type;
            this.stmt = stmt;
            this.prev = prev;
            this.inStmtDecl = false;
            this.inStmtBlock = false;
        }

        function pushContext(state, col, type) {
            return state.context = new Context(
                state.indentation, col, type, null, state.context
            );
        }

        function popContext(state) {
            if (!state.context.prev) {
                return;
            }
            // var t = state.context.type;
            // if (t == ">>" || t == "}}" /* || t == ")" || t == "]" || t == "}" */) {
            //     state.indentation = state.context.indentation;
            // }
            return state.context = state.context.prev;
        }
        

        return {
            startState: function(basecolumn) {
                if (!cm) {
                    // CodeMirror doesn't allow modes to have full access to
                    // the text of the document. This hack overcomes this
                    // respectable limitation:
                    // VineScript's NodeEditor stashes a reference to the
                    // CodeMirror instance in the VineScript modes object
                    // - and here, we retrieve it. Idea taken from Twinejs.
                    cm = CodeMirror.modes["vinescript"].cm;
                }
                // referenceVariables = [];
                return {
                    tokenize: tokenBase,
                    line: -1,
                    pos: 0,
                    context: new Context(
                        basecolumn || 0, 0, "top"
                    ),
                    // stmtBlockCtx: [],
                    linkSep: 0,
                    verbatimOpener: ""
                };
            },
            token: function(stream, state) {
                if (init) {
                    init();
                }
                return state.tokenize(stream, state);
            },
            blankLine(state) {
                state.line++;
                state.pos = 0;
            },
            indent: function(state, textAfter) {
                // TODO incomplete WIP doesn't really work

                // let ctx = state.context;
                // let closing = textAfter && textAfter.startsWith(ctx.type);
                // if (ctx.stmt === "if") {
                //     return ctx.indentation + indentUnit;
                // } else {
                //     // return ctx.indentation + (closing ? 0 : indentUnit);
                //     return ctx.indentation + (closing ? 0 : indentUnit);
                // }
                
                if (state.instmt || state.indisplay) {
                    for (let i = 0; i < indentEndingStmt.length; i++) {
                        if (textAfter.startsWith(indentEndingStmt[i])) {
                            return 0;
                        }
                    }
                    return indentUnit;
                }
                return CodeMirror.Pass;
            },

            electricInput: /^\s*[\}\]\)]\>$/,
            // closeBrackets: "()[]{}''\"\"``",
            // closeBrackets: {pairs: "}])\">"},
            blockCommentStart: "/*",
            blockCommentEnd: "*/",
            lineComment: "//",
            // fold: "indent"
        };
    });
    CodeMirror.defineMIME("text/x-vinescript", "vinescript");
});