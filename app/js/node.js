var globalNodeIndex = 0;
const NodeExpandWidth = 300;
const NodeExpandHeight = 150;
const ClipNodeTextLength = 1024;

var Node = function()
{
    var self = this;
    this.titleColorValues = ['#EEE', '#6EA5E0', '#C39BDF', '#DB9DBE', '#F0756A', '#F7A666', '#FAD070', '#F7FDC9', '#9EDE74', '#60C1E4'];
    // primary values
    this.index = ko.observable(globalNodeIndex++);
    this.title = ko.observable("Node" + this.index());
    this.tags = ko.observable("");
    this.body = ko.observable("Empty Text");
    //this.x = ko.observable(128);
    //this.y = ko.observable(128);
    this.active = ko.observable(true);
    this.tempWidth;
    this.tempHeight;
    this.tempOpacity;
    this.style;
    this.colorID = ko.observable(0);
    this.checked = false;
    this.selected = false;
    this.focused = false;

    // clipped values for display
    this.clippedTags = ko.computed(function()
    {
        var tags = this.tags().split(" ");
        var output = "";
        if (this.tags().length > 0)
        {
            for (var i = 0; i < tags.length; i++) {
                output += "<span>" + tags[i] + "</span>";
            }
        }
        return output;
    }, this);

    this.clippedBody = ko.computed(function()
    {
        var result = app.getHighlightedText(this.body());
        while (result.indexOf("\n") >= 0) {
            result = result.replace("\n", "<br />");
        }
        while (result.indexOf("\r") >= 0) {
            result = result.replace("\r", "<br />");
        }
        result = result.substr(0, ClipNodeTextLength);
        return result;
    }, this);

    // internal cache
    this.linkedTo = ko.observableArray();
    this.linkedFrom = ko.observableArray();

    // reference to element containing us
    this.element = null;

    this.canDoubleClick = true;

    this.create = function()
    {
        Utils.pushToTop($(self.element));
        self.style = window.getComputedStyle($(self.element).get(0));

        var parent = $(self.element).parent();
        self.x(-parent.offset().left + $(window).width() / 2 - 100);
        self.y(-parent.offset().top + $(window).height() / 2 - 100);

        var updateArrowsInterval = setInterval(app.updateArrowsThrottled, 16);

        $(self.element)
            .css({opacity: 0, scale: 0.8, y: "-=80px", rotate: "45deg"})
            .transition(
                {
                    opacity: self.active() ? 1 : 0.25,
                    scale: 1,
                    y: "+=80px",
                    rotate: "0deg"
                },
                250,
                "easeInQuad",
                function() {
                    clearInterval(updateArrowsInterval);
                    app.updateArrowsThrottled();
                }
            );
        self.drag();

        $(self.element).on("dblclick", function()
        {
            if (self.canDoubleClick) {
                app.editNode(self);
            }
        });

        $(self.element).on("click", function(e)
        {
            if(e.ctrlKey)
            {
                if(self.selected) {
                    app.removeNodeSelection(self);
                } else {
                    app.addNodeSelected(self);
                }
            }
        });
    }

    this.setSelected = function(select)
    {
        self.selected = select;
        
        if (self.selected) {
            $(self.element).addClass("selected");
        } else {
            $(self.element).removeClass("selected");
        }
    }

    this.setFocus = function(focused)
    {
        self.focused = focused;
        
        if (self.focused) {
            $(self.element).addClass("focused");
        } else {
            $(self.element).removeClass("focused");
        }
    }

    this.toggleSelected = function()
    {
        self.setSelected(!self.selected);
    }

    // TODO rename
    this.x = function(inX)
    {
        if (inX != undefined) {
            $(self.element).css({x:Math.floor(inX)});
        }
        return Math.floor((new WebKitCSSMatrix(self.style.webkitTransform)).m41);
    }

    // TODO rename
    this.y = function(inY)
    {
        if (inY != undefined) {
            $(self.element).css({y:Math.floor(inY)});
        }
        return Math.floor((new WebKitCSSMatrix(self.style.webkitTransform)).m42);
    }

    this.resetDoubleClick = function()
    {
        self.canDoubleClick = true;
    }

    this.tryRemove = function()
    {
        if (self.active()) {
            app.deleting(this);
        }

        setTimeout(self.resetDoubleClick, 500);
        self.canDoubleClick = false;
    }

    this.cycleColorDown = function()
    {
        self.doCycleColorDown();

        setTimeout(self.resetDoubleClick, 500);
        self.canDoubleClick = false;

        if (app.shifted) {
            app.matchConnectedColorID(self);
        }

        if (self.selected) {
            app.setSelectedColors(self);
        }
    }

    this.cycleColorUp = function()
    {	
        self.doCycleColorUp();

        setTimeout(self.resetDoubleClick, 500);
        self.canDoubleClick = false;

        if (app.shifted) {
            app.matchConnectedColorID(self);
        }

        if (self.selected) {
            app.setSelectedColors(self);
        }
    }

    this.doCycleColorDown = function()
    {
        self.colorID(self.colorID() - 1);
        if (self.colorID() < 0) {
            self.colorID(this.titleColorValues.length - 1);
        }
    }

    this.doCycleColorUp = function()
    {
        self.colorID(self.colorID() + 1);
        if (self.colorID() >= this.titleColorValues.length) {
            self.colorID(0);
        }
    }
    
    this.remove = function()
    {
        $(self.element).transition({opacity: 0, scale: 0.8, y: "-=80px", rotate: "-45deg"}, 250, "easeInQuad", function()
        {
            app.removeNode(self);
            app.updateArrowsThrottled();
        });
        app.deleting(null);
    }

    this.drag = function()
    {
        var leftButtonHeld = false;
        var ctrlKeyDown = false;
        var dragging = false;
        var groupDragging = false;

        var offset = [0, 0];
        var moved = false;

        $(document.body).on("mousemove", function(e)
        {
            if (dragging)
            {
                var parent = $(self.element).parent();
                var newX = (e.pageX / self.getScale() - offset[0]);
                var newY = (e.pageY / self.getScale() - offset[1]);
                
                if (appSettings.get("prefs.snapToGrid", false)) {
                    // snap to grid 25x25
                    let snappedPos = Utils.getSnapPosition(newX, newY, 25);
                    newX = snappedPos.x;
                    newY = snappedPos.y;
                }

                var movedX = newX - self.x();
                var movedY = newY - self.y();

                moved = true;
                self.x(newX);
                self.y(newY);

                if (groupDragging)
                {
                    var nodes = [];
                    if(self.selected)
                    {
                        nodes = app.getSelectedNodes();
                        nodes.splice(nodes.indexOf(self), 1);
                    }
                    else
                    {
                        nodes = app.getNodesConnectedTo(self);
                    }
                    
                    if (nodes.length > 0)
                    {
                        for (var i in nodes)
                        {
                            nodes[i].x(nodes[i].x() + movedX);
                            nodes[i].y(nodes[i].y() + movedY);
                        }
                    }
                }

                //app.refresh();
                app.updateArrowsThrottled();
            }
        });

        $(self.element).on("mousedown", function(e)
        {
            moved = false;
            if (e.button == 0) {
                leftButtonHeld = true;
            }
            if (e.ctrlKey) {
                ctrlKeyDown = true;
            }
            // checks that the left button is pressed, the node is active and
            // the click target is not a button (with the class icon)
            if (leftButtonHeld && !dragging && self.active() && !$(e.target).hasClass("icon"))
            {
                document.body.classList.add("mouseGrabbing");

                var parent = $(self.element).parent();

                dragging = true;

                if (app.shifted || self.selected) {
                    groupDragging = true;
                }

                offset[0] = (e.pageX / self.getScale() - self.x());
                offset[1] = (e.pageY / self.getScale() - self.y());
            }
        });

        $(self.element).on("mousedown", function(e)
        {
            e.stopPropagation();
        });

        $(self.element).on("mouseup", function(e)
        {
            if (!ctrlKeyDown && dragging && !groupDragging) {
                // deselect all nodes
                app.mouseUpOnNodeNotMoved();
                // set the selection to this node
                app.addNodeSelected(self);
            }

            document.body.classList.remove("mouseGrabbing");
            moved = false;
        });

        $(document.body).on("mouseup", function(e)
        {
            ctrlKeyDown = false;
            dragging = false;
            groupDragging = false;
            moved = false;
            if (e.button == 0) {
                leftButtonHeld = false;
            }

            document.body.classList.remove("mouseGrabbing");
            app.updateArrowsThrottled();
        });
    }

    this.moveTo = function(newX, newY)
    {
        $(self.element).clearQueue();
        $(self.element).transition(
            {
                x: newX,
                y: newY
            },
            app.updateArrowsThrottled,
            500
        );
    }

    this.isConnectedTo = function(otherNode, checkBack)
    {
        if (checkBack && otherNode.isConnectedTo(self, false)) {
            return true;
        }

        var linkedNodes = self.linkedTo();
        for (var i in linkedNodes)
        {
            if (linkedNodes[i] == otherNode) {
                return true;
            }
            if (linkedNodes[i].isConnectedTo(otherNode, false)) {
                return true;
            }
            if (otherNode.isConnectedTo(linkedNodes[i], false)) {
                return true;
            }
        }

        return false;
    }

    this.updateLinks = function()
    {
        self.resetDoubleClick();
        // clear existing links
        self.linkedTo.removeAll();

        // find all the links
        var links = self.body().match(/\[\[(.*?)\]\]/g);
        if (links != undefined)
        {
            var exists = {};
            for (var i = links.length - 1; i >= 0; i--)
            {
                links[i] = links[i].substr(2, links[i].length - 4).toLowerCase();

                if (links[i].indexOf("|") >= 0) {
                    links[i] = links[i].split("|")[1];
                }

                if (exists[links[i]] != undefined) {
                    links.splice(i, 1);
                }
                
                exists[links[i]] = true;
            }

            // update links
            for (var index in app.nodes())
            {
                var other = app.nodes()[index];
                for (var i = 0; i < links.length; i++) {
                    if (other != self && other.title().toLowerCase() == links[i]) {
                        self.linkedTo.push(other);
                    }
                }
            }
        }
    }

    this.getScale = function() {
        if (app && typeof app.cachedScale === "number") {
            return app.cachedScale;
        } else {
            return 1;
        }
    }

    this.snapToGrid = function(gridSize=25) {
        let pos = Utils.getSnapPosition(self.x(), self.y(), gridSize);
        self.x(pos.x);
        self.y(pos.y);
    }
}

ko.bindingHandlers.nodeBind = 
{
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) 
    {
        bindingContext.$rawData.element = element;
        bindingContext.$rawData.create();
    },

    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) 
    {
        $(element).on("mousedown", function() { Utils.pushToTop($(element)); });
    }
};
