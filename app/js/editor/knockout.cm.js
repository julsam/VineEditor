const CodeEditor = require("./js/editor/code-editor");

(function() {

    // CodeMirror instance containing the editor
    var cmInstance = null;

    ko.bindingHandlers.cm = {
        init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {

            // options are not actually used, but could be in the future if needed.
            let options = allBindingsAccessor().cmOptions || {};

            // get the node associated with this editor instance
            let node = ko.utils.unwrapObservable(valueAccessor());

            cmInstance = CodeEditor.newVineEditor("editor");
            if (node.doc() != null) {
                cmInstance.swapDoc(node.doc());
            } else {
                cmInstance.doc.setValue(node.body());
                node.doc(cmInstance.doc);
                // clear history so the user can't go back to the default empty text
                node.doc().clearHistory()
            }

            cmInstance.focus();
            ko.NodeEditor.updateStats();

            cmInstance.doc.on("change", () => {
                node.body(node.doc().getValue());
            });

            cmInstance.doc.on("cursorActivity", ko.NodeEditor.updateStats);

            // destroy the editor instance when the element is removed
            ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
                // remove the editor reference from the doc
                cmInstance.swapDoc(CodeMirror.Doc(""));
                cmInstance = null;
            });
        }
    };
    
    ko.NodeEditor = {
        get: function() {
            return cmInstance;
        },
        updateStats: function() {
            var doc = cmInstance.doc;
            var text = doc.getValue();
            var cursor = doc.getCursor();

            var lines = text.split("\n");

            $(".editor-footer .character-count").html(text.length);
            $(".editor-footer .line-count").html(lines.length);
            // add 1 because they're 0 indexed
            $(".editor-footer .row-index").html(cursor.line + 1);
            $(".editor-footer .column-index").html(cursor.ch + 1);
        }
    };
}());