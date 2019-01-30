
function ModalDialog(name, cancelFn, validateFn) {
    var self = this;
    this.name = name;
    this.state = ko.observable('idle');
    this.onCancel = cancelFn;
    this.onSubmit = validateFn;

    this.submit = function(value) {
        self.state('submit');
    }
    this.cancel = function() {
        self.state('cancel');
    }
}

(function() {
    
    let cancelFn = null;

    function preventClickBubble(element, bindingContext) {
        if (element) {
            // Apparently, clickBubble without click won't work. If you
            // want an event on an entire element except for a certain
            // child element, setting data-bind: "clickBubble: false" on
            // the child will not work, you also need to specifiy a binding
            // for click, even if it's just an empty function...
            ko.applyBindingAccessorsToNode(element, {
                click: function() { return function() {return false;}},
                clickBubble: function() { return false; }
            }, bindingContext);
        }
    }

    ko.bindingHandlers.modalDialog = {

        init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            let value = ko.utils.unwrapObservable(valueAccessor());
            console.log(value);
            
            ko.applyBindingAccessorsToNode(element, {
                click: function() { app.modal() ? app.modal().cancel() : false;},
            }, bindingContext);

            let header = element.querySelector(".dialog header");
            let body = element.querySelector(".dialog .dialog-body");
            let footer = element.querySelector(".dialog footer");
            preventClickBubble(header, bindingContext);
            preventClickBubble(body, bindingContext);
            preventClickBubble(footer, bindingContext);

            $(element).on('keydown', function(e){
                if (e && e.keyCode == 27) { // Escape Key
                    bindingContext.$data.modal().cancel();
                }
            });

            // $(element).on('click', function(e){
            //     bindingContext.$data.hideModal();
            // });

            $(element).toggle(false);

            // TODO add close event on exit buttons
        },
        update: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            // Whenever the value subsequently changes, slowly fade the element in or out
            var value = valueAccessor();
            if (bindingContext.$data.modal() && ko.utils.unwrapObservable(value) === bindingContext.$data.modal().name)
            {
                if (bindingContext.$data.modal().state() === 'submit') {
                    $(element).fadeOut(200, bindingContext.$data.modal().onSubmit);
                } else if (bindingContext.$data.modal().state() === 'cancel') {
                    $(element).fadeOut(200, bindingContext.$data.modal().onCancel);
                } else {
                    $(element).fadeIn();
                    $(element).focus();
                }
            }
            // if (ko.utils.unwrapObservable(value) === bindingContext.$data.modal()) {
            //     $(element).fadeIn();
            //     $(element).focus();
            // } else {
            //     let options = allBindingsAccessor().modalOptions || {};
            //     if (options && options.fadeOutCb) {
            //         console.log(options.fadeOutCb);
            //         $(element).fadeOut(200, options.fadeOutCb);
            //     } else {
            //         $(element).fadeOut(200);
            //     }
            // }
        }
    };
}());