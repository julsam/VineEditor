'use strict';

const electron = require("electron");
const remote = electron.remote;
const Marquee = require("./js/marquee");
const Draw = require("./js/draw");
const appSettings = remote.require("./main/vine-editor-settings");
const fs = remote.require("graceful-fs");
const ipc = electron.ipcRenderer;

var App = function(name, version)
{
    // self
    var self = this;
    // this.instance = this;
    this.name = ko.observable(name);
    this.version = ko.observable(version);
    this.editing = ko.observable(null);
    this.deleting = ko.observable(null);
    this.nodes = ko.observableArray([]);
    this.cachedScale = 1;
    this.canvas;
    this.context;
    this.nodeHistory = [];
    this.nodeFuture = [];
    this.editingHistory = [];
    //this.appleCmdKey = false;
    this.editingSaveHistoryTimeout = null;
    this.dirty = false; // not used
    this.focusedNode = null;
    this.focusedNodeIdx = -1;
    this.zoomSpeed = .005;
    this.zoomLimitMin = .05;
    this.zoomLimitMax = 1;
    this.transformOrigin = [0, 0];
    this.shifted = false;
    this.isElectron = false;
    this.allowSelectNextNode = true; // allows toggle nodes with spacebar
    
    this.UPDATE_ARROWS_THROTTLE_MS = 25;

    //this.editingPath = ko.observable(null);

    this.nodeSelection = [];

    this.$searchField = $("#app-search-field");

    // checks that we are in a desktop app (as opposed to in a browser)
    if (typeof(require) == "function")
    {
        this.gui = remote.getCurrentWindow();
        this.isElectron = true;
    }

    this.run = function()
    {
        var osName = "Unknown OS";
        if (navigator.platform.indexOf("Win") != -1) osName="Windows";
        if (navigator.platform.indexOf("Mac") != -1) osName="MacOS";
        if (navigator.platform.indexOf("X11") != -1) osName="UNIX";
        if (navigator.platform.indexOf("Linux") != -1) osName="Linux";

        if (osName == "Windows") {
            self.zoomSpeed = .1;
        }

        $("#app").show();
        ko.applyBindings(self, $("#app")[0]);

        self.canvas = $(".arrows")[0];
        self.context = self.canvas.getContext("2d");

        const lastFile = appSettings.get("config.lastFile", "");
        if (lastFile !== "" && appSettings.get("prefs.openLastFileOnStart", false)) {
            if (data.readFileSync(lastFile, false, false) === true) {
                self.refreshWindowTitle(lastFile);
            } else {
                self.newNode().title("Start");
            }
        } else {
            self.newNode().title("Start");
        }

        // search field
        self.$searchField.on("keyup", function(e)
        {
            // enter
            if (e.keyCode == 13) {
                self.searchWarp();
                e.stopPropagation();
            }

            // escape
            if (e.keyCode == 27) {
                self.clearSearch();
            }
        });

        // prevent click bubbling
        ko.bindingHandlers.preventBubble =
        {
            init: function(element, valueAccessor)
            {
                var eventName = ko.utils.unwrapObservable(valueAccessor());
                ko.utils.registerEventHandler(element, eventName, function(event)
                {
                    event.cancelBubble = true;
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    }
                });
            }
        };

        ko.bindingHandlers.mousedown =
        {
            init: function(element, valueAccessor, allBindings, viewModel, bindingContext)
            {
                var value = ko.unwrap(valueAccessor());
                $(element).mousedown(function() {
                    value();
                });
            }
        };

        // updateArrows
        // setInterval(function() { self.updateArrows(); }, 16);

        // drag node holder around
        (function()
        {
            var mouseButtonDown = false;
            var offset = { x: 0, y: 0 };
            var marquee = new Marquee();
            var leftButtonHeld = false;
            var middleButtonHeld = false;

            $(".nodes").on("mousedown", function(e)
            {
                if (e.button == 0) {
                    leftButtonHeld = true;
                }
                if (e.button == 1) {
                    middleButtonHeld = true;
                }
                mouseButtonDown = true;
                offset.x = e.pageX;
                offset.y = e.pageY;
                marquee.disable();

                var scale = self.cachedScale;

                if (!e.altKey && !e.shiftKey && !middleButtonHeld) {
                    self.deselectAllNodes();
                }
            });

            $(".nodes").on("mousemove", function(e)
            {
                if (mouseButtonDown)
                {
                    //if (e.ctrlKey)
                    if (e.altKey || middleButtonHeld)
                    {
                        //prevents jumping straight back to standard dragging
                        if (!marquee.isActive())
                        {
                            document.body.classList.add("mouseMoveView");

                            self.transformOrigin[0] += e.pageX - offset.x;
                            self.transformOrigin[1] += e.pageY - offset.y;

                            self.translate();

                            offset.x = e.pageX;
                            offset.y = e.pageY;

                            // const nodes = self.nodes();
                            // for (let i in nodes)
                            // {
                            //     nodes[i].x(nodes[i].x() + (e.pageX - offset.x) / self.cachedScale);
                            //     nodes[i].y(nodes[i].y() + (e.pageY - offset.y) / self.cachedScale);
                            // }
                            // offset.x = e.pageX;
                            // offset.y = e.pageY;

                            // self.updateArrowsThrottled();
                        }
                    }
                    else if (leftButtonHeld)
                    {
                        if (!marquee.isActive()) {
                            marquee.setActive(true);
                        }

                        var scale = self.cachedScale;

                        if (e.pageX >= offset.x && e.pageY <= offset.y) 
                        {
                            // top-right direction
                            marquee.rect.x1 = offset.x;
                            marquee.rect.y1 = e.pageY;
                            marquee.rect.x2 = e.pageX;
                            marquee.rect.y2 = offset.y;
                        }
                        else if (e.pageX >= offset.x && e.pageY >= offset.y)
                        {
                            // bottom-right direction
                            marquee.rect.x1 = offset.x;
                            marquee.rect.y1 = offset.y;
                            marquee.rect.x2 = e.pageX;
                            marquee.rect.y2 = e.pageY;
                        }
                        else if (e.pageX <= offset.x && e.pageY <= offset.y)
                        {
                            // top-left direction
                            marquee.rect.x1 = e.pageX;
                            marquee.rect.y1 = e.pageY;
                            marquee.rect.x2 = offset.x;
                            marquee.rect.y2 = offset.y;
                        }
                        else if (e.pageX <= offset.x && e.pageY >= offset.y)
                        {
                            // bottom-left direction
                            marquee.rect.x1 = e.pageX;
                            marquee.rect.y1 = offset.y;
                            marquee.rect.x2 = offset.x;
                            marquee.rect.y2 = e.pageY;
                        }

                        marquee.draw();

                        // Select nodes which are within the marquee
                        // Marquee.selection is used to prevent it from deselecting already
                        // selected nodes and deselecting onces which have been selected
                        // by the marquee
                        var nodes = self.getActiveNodes();
                        for (var i in nodes)
                        {
                            var index = marquee.selection.indexOf(nodes[i]);
                            var inMarqueeSelection = (index >= 0);

                            //test the Marque scaled to the nodes x,y values

                            var holder = $(".nodes-holder").offset(); 
                            var marqueeOverNode = 
                                    (marquee.rect.x2 - holder.left) / scale > nodes[i].x()
                                &&  (marquee.rect.x1 - holder.left) / scale < nodes[i].x() + nodes[i].tempWidth
                                &&  (marquee.rect.y2 - holder.top) / scale > nodes[i].y()
                                &&  (marquee.rect.y1 - holder.top) / scale < nodes[i].y() + nodes[i].tempHeight;

                            if (marqueeOverNode)
                            {
                                if (!inMarqueeSelection)
                                {
                                    self.addNodeSelected(nodes[i]);
                                    marquee.selection.push(nodes[i]);
                                }
                            }
                            else
                            {
                                if (inMarqueeSelection)
                                {
                                    self.removeNodeSelection(nodes[i]);
                                    marquee.selection.splice(index, 1);
                                }
                            }
                        }
                    }
                }
            });

            $(".nodes").on("mouseup", function(e)
            {
                mouseButtonDown = false;

                if (marquee.isActive() && marquee.selection.length == 0) {
                    self.deselectAllNodes();
                }
                document.body.classList.remove("mouseMoveView");

                marquee.disable();

                if (e.button == 0) {
                    leftButtonHeld = false;
                }
                if (e.button == 1) {
                    middleButtonHeld = false;
                }
            });
        })();

        // search field
        self.$searchField.on("input", self.updateSearch);
        $(".search-title input").click(self.updateSearch);
        $(".search-body input").click(self.updateSearch);
        $(".search-tags input").click(self.updateSearch);
        
        // Shortcut to focus search field
        $(document).on("keydown", function(e) {
            if (self.editing() || self.$searchField.is(":focus")) {
                return;
            }
            if (e.ctrlKey || e.metaKey) {
                if (e.keyCode === 70) { // Ctrl + F
                    self.$searchField.focus();
                }
            }
        });

        // Zoom In & Out
        // using the event helper
        $(".nodes").mousewheel(function(event) {
            // https://github.com/InfiniteAmmoInc/Yarn/issues/40
            if (event.altKey) {
                return;
            } else {
                event.preventDefault();
            }

            var lastZoom = self.cachedScale;
            var scaleChange = event.deltaY * self.zoomSpeed * self.cachedScale;

            self.cachedScale = Utils.clamp(
                self.cachedScale + scaleChange, self.zoomLimitMin, self.zoomLimitMax
            );
           
            // Remove css class starting with "zoomLevel"
            $("body").removeClass(function(index, css) {
                return (css.match(/(^|\s)zoomLevel\S+/g) || []).join(" ");
            });

            // Sets the appropriate zoom level class that changes some elements
            // to make them more or less visibles depending on the zoom level
            if (self.cachedScale < 0.15) {
                $("body").addClass("zoomLevel-5");
            } else if (self.cachedScale < 0.25) {
                $("body").addClass("zoomLevel-4");
            } else if (self.cachedScale < 0.5) {
                $("body").addClass("zoomLevel-3");
            } else if (self.cachedScale < 0.8) {
                $("body").addClass("zoomLevel-2");
            } else {
                $("body").addClass("zoomLevel-1");
            }

            // Scaled background-size: 100px * scale
            const scaledBgSize = Math.round(100 * self.cachedScale);
            const bgsizeStr = scaledBgSize + "px " + scaledBgSize + "px";
            document.getElementById("app-bg").style.backgroundSize = bgsizeStr;

            var mouseX = event.pageX - self.transformOrigin[0];
            var mouseY = event.pageY - self.transformOrigin[1];
            var newX = mouseX * (self.cachedScale / lastZoom);
            var newY = mouseY * (self.cachedScale / lastZoom);
            var deltaX = (mouseX - newX);
            var deltaY = (mouseY - newY);

            self.transformOrigin[0] += deltaX;
            self.transformOrigin[1] += deltaY;

            self.translate();
        });

        $(document).on("keyup keydown", function(e) {
            self.shifted = e.shiftKey; 
        });

        // right click
        $(document).contextmenu( function(e) {
            // right click on the 'nodes' element (holding all the nodes)
            let isAllowedEl = $(e.target).hasClass("nodes");
            if (isAllowedEl)
            {
                // create new node
                var x = self.transformOrigin[0] * -1 / self.cachedScale;
                var y = self.transformOrigin[1] * -1 / self.cachedScale;

                x += event.pageX / self.cachedScale;
                y += event.pageY / self.cachedScale;

                self.newNodeAt(x, y);
                
                // new node could be inactive if it doesn't match the current search
                self.updateSearch();
            }

            return !isAllowedEl;
        }); 

        $(document).on("keydown", function(e) {
            if (self.editing() || self.$searchField.is(":focus")) {
                return;
            }
            //global ctrl+z
            if ((e.metaKey || e.ctrlKey) && !self.editing())
            {
                switch(e.keyCode)
                {
                    case 90: // Z
                        self.historyDirection("undo");
                        break;
                    case 89: // Y
                        self.historyDirection("redo");
                    break;
                    case 65: // A
                        self.selectAllNodes();
                    break;
                    case 68: // D
                        self.deselectAllNodes();
                }
            }
        });
        
        $(document).on("keydown", function(e) {
            if (self.editing() || self.$searchField.is(":focus") || e.ctrlKey || e.metaKey) {
                return;
            }
            let scale = self.cachedScale || 1;
            let movement = scale * 500;

            if (e.shiftKey) {
                movement = scale * 100;
            }

            if (e.keyCode === 65 || e.keyCode === 37) // a or left arrow
            {  
                self.transformOrigin[0] += movement;
                self.translate(100);
            }
            else if (e.keyCode === 68 || e.keyCode === 39) // d or right arrow
            {
                self.transformOrigin[0] -= movement;
                self.translate(100);
            }
            else if (e.keyCode === 87 || e.keyCode === 38) // w or up arrow
            {
                self.transformOrigin[1] += movement;
                self.translate(100);
            }
            else if (e.keyCode === 83 || e.keyCode === 40) // w or down arrow
            {
                self.transformOrigin[1] -= movement;
                self.translate(100);
            }
             // Spacebar toggle between nodes
            else if (e.keyCode === 32 && self.allowSelectNextNode)
            {
                // Select the next node
                let selectedNodes = self.getSelectedNodes();
                // needs more than 1 to toggle between nodes
                let isNodeSelected = selectedNodes.length > 1;
                let nodes = isNodeSelected ? selectedNodes : self.getActiveNodes();
                let focusedNodeIdx = nodes.indexOf(self.focusedNode);
                if (focusedNodeIdx > -1 && nodes.length > focusedNodeIdx)
                {
                    let isNodeCenteredOnView = (
                            self.transformOrigin[0] !=
                                -nodes[focusedNodeIdx].x() +
                                $(window).width() / 2 -
                                $(nodes[focusedNodeIdx].element).width() / 2
                        ||  self.transformOrigin[1] !=
                                -nodes[focusedNodeIdx].y() +
                                $(window).height() / 2 -
                                $(nodes[focusedNodeIdx].element).height() / 2
                    );
                    if (isNodeCenteredOnView) {
                        focusedNodeIdx = -1;
                    }
                }
                
                if (++focusedNodeIdx >= nodes.length) {
                    focusedNodeIdx = 0;
                }

                self.cachedScale = 1;
                if (isNodeSelected) {
                    self.warpToSelectedNodeIdx(focusedNodeIdx);
                } else {
                    self.warpToNodeIdx(focusedNodeIdx);
                }

                self.allowSelectNextNode = false;
                setTimeout(self.startSelectNextNodeTimer, 300);
            }
        });
        
        $(document).on("keyup", function(e) {
            if (self.$searchField.is(":focus") || e.ctrlKey || e.metaKey) {
                return;
            }
            
            // reset the allowSelectNextNode timer
            self.allowSelectNextNode = true;
            clearTimeout(self.startSelectNextNodeTimer);

            if (self.editing() === null) // Not in edit mode
            {
                // Delete key
                if (e.keyCode === 46 || e.key === "Delete") {
                    // Delete selected nodes
                    self.deleteSelectedNodes();
                }

                // Enter key
                if (e.keyCode === 13 || e.key === "Enter")
                {
                    // Open the active node with enter
                    let selectedNodes = self.getSelectedNodes();
                    var activeNode = self.getActiveNodes()[self.focusedNodeIdx];
                    if (activeNode !== undefined) {
                        self.editNode(activeNode);
                    } else if (selectedNodes.length > 0) {
                        self.editNode(selectedNodes[0]);
                    }
                }
            }
            else // In edit mode
            {
                // Escape key
                if (e.keyCode === 27 || e.key === "Escape")
                {
                    if (self.editing() !== null) {
                        // closes an open node
                        self.saveNode();
                    }
                }
            }
        });

        $(window).on("resize", self.updateArrowsThrottled);

        $(document).on("keyup keydown mousedown mouseup", function(e) {
            if (self.editing() != null) {
                self.updateEditorStats();
            }
        });
        // apple command key
        //$(window).on('keydown', function(e) { if (e.keyCode == 91 || e.keyCode == 93) { self.appleCmdKey = true; } });
        //$(window).on('keyup', function(e) { if (e.keyCode == 91 || e.keyCode == 93) { self.appleCmdKey = false; } });
    
        // Handle file dropping
        document.ondragover = document.ondrop = e => {
            e.preventDefault();
        };
        document.body.ondrop = e => {
            e.preventDefault();
            data.openFile(e.dataTransfer.files[0].path);
            for (var i = 1; i < e.dataTransfer.files.length; i++) {
                data.appendFile(e, e.dataTransfer.files[i].path, false);
            }
        };
    } // end of "run" function

    this.startSelectNextNodeTimer = function() {
        self.allowSelectNextNode = true;
    }

    this.getNodesConnectedTo = function(toNode)
    {
        var connectedNodes = [];
        var nodes = self.nodes();
        for (var i in nodes)
        {
            if (nodes[i] != toNode && nodes[i].isConnectedTo(toNode, true))
            {
                var hasNode = false;
                for (var j in connectedNodes)
                {
                    if (connectedNodes[j] == nodes[i])
                    {
                        hasNode = true;
                        break;
                    }
                }
                if (!hasNode)
                    connectedNodes.push(nodes[i]);
            }
        }
        return connectedNodes;
    }

    this.mouseUpOnNodeNotMoved = function()
    {
        self.deselectAllNodes();
    }

    this.matchConnectedColorID = function(fromNode)
    {
        var nodes = self.getNodesConnectedTo(fromNode);
        for (var i in nodes)
            nodes[i].colorID(fromNode.colorID());
    }

    this.quit = function()
    {
        if (self.isElectron) {
            self.gui.close();
        }
    }

    this.refreshWindowTitle = function(editingPath)
    {
        let title = "Vine Editor";
        if (editingPath !== "") {
            title += " - [" + editingPath + "]";
        }
        if (!self.isElectron) {
            document.title = title;
        } else {
            self.gui.setTitle(title);
        }
    }

    this.recordNodeAction = function(action, node)
    {
        //we can't go forward in 'time' when
        //new actions have been made
        if (self.nodeFuture.length > 0)
        {
            for (var i = 0; i < self.nodeFuture.length; i++) {
                var future = self.nodeFuture.pop();
                delete future.node;
            };

            delete self.nodeFuture;
            self.nodeFuture = [];
        }

        var historyItem = { action: action, node: node, lastX: node.x(), lastY: node.y() };

        if (action == "removed") {
            historyItem.lastY += 80;
        }

        self.nodeHistory.push(historyItem);
    }

    this.historyDirection = function(direction)
    {
        function removeNode(node){
            var index = self.nodes.indexOf(node);
            if (index >= 0) {
                self.nodes.splice(index, 1);
            }
            self.updateNodeLinks();
        }

        var historyItem = null;

        if (direction == "undo") {
            historyItem = self.nodeHistory.pop();
        } else {
            historyItem = self.nodeFuture.pop();
        }
        
        if (!historyItem) {
            return;
        }

        var action = historyItem.action;
        var node = historyItem.node;

        
        if (direction == "undo") //undo actions
        {
            if (action == "created")
            {
                historyItem.lastX = node.x();
                historyItem.lastY = node.y();
                removeNode(node);
            }
            else if (action == "removed")
            {
                self.recreateNode(node, historyItem.lastX, historyItem.lastY);
            }

            self.nodeFuture.push(historyItem);
        }
        else //redo undone actions
        {
            if (action == "created")
            {
                self.recreateNode(node, historyItem.lastX, historyItem.lastY);
            }
            else if (action == "removed")
            {
                removeNode(node);
            }

            self.nodeHistory.push(historyItem);
        }
    }

    this.recreateNode = function(node, x, y)
    {
        self.nodes.push(node);
        node.moveTo(x, y);
        self.updateNodeLinks();
    }

    this.setSelectedColors = function(node)
    {
        var nodes = self.getSelectedNodes();
        nodes.splice(nodes.indexOf(node), 1);

        for (var i in nodes) {
            nodes[i].colorID(node.colorID());
        }
    }

    this.setFocusByNode = function(node, value=true)
    {
        self.focusedNode = null;
        let nodes = self.nodes();
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i] === node) {
                nodes[i].setFocus(value);
                self.focusedNodeIdx = i;
                self.focusedNode = nodes[i];
            } else {
                nodes[i].setFocus(false);
            }
        }
    }

    this.getSelectedNodes = function()
    {
        var selectedNodes = [];
        for (var i in self.nodeSelection) {
            selectedNodes.push(self.nodeSelection[i]);
        }
        return selectedNodes;
    }

    this.getActiveNodes = function()
    {
        let activeNodes = [];
        let nodes = self.nodes();
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].active()) {
                activeNodes.push(nodes[i]);
            }
        }
        return activeNodes;
    }

    this.removeInactiveNodesFromSelection = function()
    {
        for (let i = self.nodeSelection.length - 1; i >= 0; i--) {
            if (!self.nodeSelection[i].active()) {
                self.removeNodeSelection(self.nodeSelection[i]);
            }
        }
    }

    this.deselectAllNodes = function()
    {
        var nodes = self.getSelectedNodes();
        for (var i in nodes) {
            self.removeNodeSelection(nodes[i]);
        }
    }

    this.selectAllNodes = function()
    {
        var nodes = self.getActiveNodes();
        self.deselectAllNodes();
        for (var i in nodes) {
            self.nodeSelection.push(nodes[i]);
            nodes[i].setSelected(true);
        }
    }

    this.addNodeSelected = function(node)
    {
        var index = self.nodeSelection.indexOf(node);
        if (index < 0) {
            self.nodeSelection.push(node);
            node.setSelected(true);
            self.setFocusByNode(node);
        }
    }

    this.removeNodeSelection = function(node)
    {
        var index = self.nodeSelection.indexOf(node);
        if (index >= 0) {
            self.nodeSelection.splice(index, 1);
            node.setSelected(false);
        }
    }

    this.deleteSelectedNodes = function()
    {
        var nodes = self.getSelectedNodes();
        for (var i in nodes) {
            self.removeNodeSelection(nodes[i]);
            if (i == self.focusedNodeIdx) {
                self.focusedNode = null;
                self.focusedNodeIdx = -1;
            }
            nodes[i].remove();
        }
    }

    this.newNode = function(updateArrows)
    {
        var node = new Node();
        self.nodes.push(node);
        if (appSettings.get("prefs.snapToGrid", false)) {
            node.snapToGrid(100);
        }
        if (updateArrows == undefined || updateArrows == true) {
            self.updateNodeLinks();
        }

        self.recordNodeAction("created", node);
        self.addNodeSelected(node);

        return node;
    }

    this.newNodeAt = function(x, y)
    {
        var node = new Node();
        self.nodes.push(node);

        if (appSettings.get("prefs.snapToGrid", false)) {
            let snappedPos = Utils.getSnapPosition(x - 100, y - 100, 25);
            node.x(snappedPos.x);
            node.y(snappedPos.y);
        } else {
            node.x(x);
            node.y(y);
        }
        self.updateNodeLinks();
        self.recordNodeAction("created", node);
        self.addNodeSelected(node);

        return node;
    }

    this.removeNode = function(node)
    {
        if (node.selected) {
            self.deleteSelectedNodes();
        }
        var index = self.nodes.indexOf(node);
        if (index >= 0) {
            self.recordNodeAction("removed", node);
            self.nodes.splice(index, 1);
        }
        self.updateNodeLinks();
    }

    this.editNode = function(node)
    {
        if (node.active())
        {
            ipc.send("modeChanged", "textEditorMode");

            self.editing(node);

            $(".node-editor").css({ opacity: 0 }).transition({ opacity: 1 }, 250);
            $(".node-editor .form").css({ y: "-100" }).transition({ y: "0" }, 250);

            //enable_spellcheck();
            contents_modified = true;
            //spell_check();

            self.updateEditorStats();
        }
    }

    this.trim = function(x)
    {
        return x.replace(/^\s+|\s+$/gm, "");
    }

    this.appendText = function(textToAppend) 
    {
        self.editing().body(
            self.editing().body()
            + " [[Answer:" + textToAppend + "|" + textToAppend + "]]"
        );
    }

    this.testRunFrom = function(startTestNode){
        ipc.send(
            "testYarnStoryFrom",
            JSON.parse(data.getSaveData(FILETYPE.JSON)),
            startTestNode
        );
    }

    this.openNodeListMenu = function(action) 
    {
        var helperLinkSearch = document.getElementById(action + "HelperMenuFilter").value;
        var rootMenu = document.getElementById(action + "HelperMenu");
        for (let i = rootMenu.childNodes.length - 1; i > 1; i--) {
            rootMenu.removeChild(rootMenu.childNodes[i]);
        }
        app.nodes().forEach((node, i) =>
        {
            if (    node.title().toLowerCase().indexOf(helperLinkSearch) >= 0
                ||  helperLinkSearch.length == 0)
            {
                var p = document.createElement("span");
                p.innerHTML = node.title();
                p.setAttribute("class", "item");
                var pColor = node.titleColorValues[app.nodes()[i].colorID()];
                p.setAttribute("style", "background:" + pColor + ";");

                if (action == "link")
                {
                    if (node.title() !== self.editing().title()) {
                        p.setAttribute("onclick", "app.appendText('" + node.title() + "')");
                        rootMenu.appendChild(p);
                    }
                }
                else if (action == "run")
                {
                    if (    node.title().toLowerCase().indexOf(helperLinkSearch) >= 0
                        ||  helperLinkSearch.length == 0)
                    {
                        p.setAttribute("onclick", "app.testRunFrom('" + node.title() + "')");
                        rootMenu.appendChild(p);
                    }
                }
            }
        });
    }

    this.saveNode = function()
    {
        if (self.editing() != null)
        {
            self.updateNodeLinks();

            self.editing().title(self.trim(self.editing().title()));

            $(".node-editor").transition({ opacity: 0 }, 250);
            $(".node-editor .form").transition({ y: "-100" }, 250, function()
            {
                self.editing(null);
                ipc.send("modeChanged", "nodeMode");
            });

            setTimeout(self.updateSearch, 100);
        }
    }

    this.updateSearch = function()
    {
        var search = self.$searchField.val().toLowerCase();
        var title = $(".search-title input").is(":checked");
        var body = $(".search-body input").is(":checked");
        var tags = $(".search-tags input").is(":checked");
        
        var on = 1;
        var off = 0.25;

        for (var i = 0; i < self.nodes().length; i++)
        {
            var node = self.nodes()[i];
            var element = $(node.element);

            if (search.length > 0 && (title || body || tags))
            {
                var matchTitle = (title && node.title().toLowerCase().indexOf(search) >= 0);
                var matchBody = (body && node.body().toLowerCase().indexOf(search) >= 0);
                var matchTags = (tags && node.tags().toLowerCase().indexOf(search) >= 0);

                if (matchTitle || matchBody || matchTags)
                {
                    node.active(true);
                    element.clearQueue();
                    element.transition({opacity: on}, 300);
                }
                else
                {
                    if (node.focused) {
                        self.setFocusByNode(node, false);
                    }
                    node.active(false);
                    element.clearQueue();
                    element.transition({opacity: off}, 300);
                }
            }
            else
            {
                node.active(true);
                element.clearQueue();
                element.transition({opacity: on}, 300);
            }
        }
        self.removeInactiveNodesFromSelection();
    }

    this.updateNodeLinks = function()
    {
        for (var i in self.nodes()) {
            self.nodes()[i].updateLinks();
        }
    }

    this.updateArrows = function()
    {
        self.canvas.width = $(window).width();
        self.canvas.height = $(window).height();

        var scale = self.cachedScale;
        var offset = $(".nodes-holder").offset();

        // Type of connection [straight, quadratic, bezier]
        let connectionId = appSettings.get("prefs.nodeConnectionTypeId");
        let connectionTypeList = appSettings.get("data.nodeConnectionTypeList");
        let connectionType = connectionTypeList[connectionId].toLowerCase();

        self.context.clearRect(0, 0, $(window).width(), $(window).height());
        self.context.lineWidth = 4 * scale;

        var nodes = self.nodes();

        for(var i in nodes)
        {
            var node = nodes[i];
            nodes[i].tempWidth = $(node.element).width();
            nodes[i].tempHeight = $(node.element).height();
            nodes[i].tempOpacity = $(node.element).css("opacity");
        }

        for(var index in nodes)
        {
            var node = nodes[index];
            if (node.linkedTo().length > 0)
            {
                for(var link in node.linkedTo())
                {
                    var linked = node.linkedTo()[link];

                    // get origins
                    var fromX = (node.x() + node.tempWidth/2) * scale + offset.left;
                    var fromY = (node.y() + node.tempHeight/2) * scale + offset.top;
                    var toX = (linked.x() + linked.tempWidth/2) * scale + offset.left;
                    var toY = (linked.y() + linked.tempHeight/2) * scale + offset.top;

                    // get the normal
                    var distance = Math.sqrt(
                            Math.pow(fromX - toX, 2)
                        +   Math.pow(fromY - toY, 2)
                    );
                    var normal = {
                        x: (toX - fromX) / distance,
                        y: (toY - fromY) / distance
                    };

                    var dist = 110 + 160 * (1 - Math.max(Math.abs(normal.x), Math.abs(normal.y)));

                    // get from / to
                    var from = { x: fromX + normal.x * dist * scale, y: fromY + normal.y * dist * scale };
                    var to = { x: toX - normal.x * dist * scale, y: toY - normal.y * dist * scale };

                    if (connectionType === "quadratic") {
                        Draw.drawQuadraticLine(self.context, from, to, scale,
                            "rgba(0, 0, 0, " + (node.tempOpacity * 0.6) + ")"
                        );
                    } else if (connectionType === "bezier") {
                        Draw.drawBezierLine(self.context, from, to, scale,
                            "rgba(0, 0, 0, " + (node.tempOpacity * 0.6) + ")"
                        );
                    } else {
                        // straight line
                        Draw.drawStraightLine(self.context, from, to, scale, normal,
                            "rgba(0, 0, 0, " + (node.tempOpacity * 0.6) + ")"
                        );
                    }
                }
            }
        }
    }

    this.updateArrowsThrottled = Utils.throttle(this.updateArrows, this.UPDATE_ARROWS_THROTTLE_MS);

    this.getHighlightedText = function(text)
    {
        text = text.replace(/\</g, '&lt;');
        text = text.replace(/\>/g, '&gt;');
        text = text.replace(/\&lt;\&lt;(.*?)\&gt;\&gt;/g, '<p class="conditionbounds">&lt;&lt;</p><p class="condition">$1</p><p class="conditionbounds">&gt;&gt;</p>');
        text = text.replace(/\[\[([^\|]*?)\]\]/g, '<p class="linkbounds">[[</p><p class="linkname">$1</p><p class="linkbounds">]]</p>');
        text = text.replace(/\[\[([^\[\]]*?)\|([^\[\]]*?)\]\]/g, '<p class="linkbounds">[[</p>$1<p style="color:red"><p class="linkbounds">|</p><p class="linkname">$2</p><p class="linkbounds">]]</p>');
        text = text.replace(/\/\/(.*)?($|\n)/g, '<span class="comment">//$1</span>\n');
        text = text.replace(/\/\*((.|[\r\n])*)?\*\//gm, '<span class="comment">/*$1*/</span>');
        text = text.replace(/\/\%((.|[\r\n])*)?\%\//gm, '<span class="comment">/%$1%/</span>');

        // create a temporary document and remove all styles inside comments
        var div = $("<div>");
        div[0].innerHTML = text;
        div.find(".comment").each(function() {
            $(this).find("p").each(function() {
                $(this).removeClass();
            });
        });

        // unhighlight links that don't exist
        div.find(".linkname").each(function() {
            var name = $(this).text();
            var found = false;
            for (var i in self.nodes())
            {
                if (self.nodes()[i].title().toLowerCase() == name.toLowerCase()) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                $(this).removeClass("linkname");
            }
        });

        text = div[0].innerHTML;
        return text;
    }

    this.updateLineNumbers = function(text)
    {
        // update line numbers
        var lines = text.split("\n");
        var lineNumbers = "";
        for (var i = 0; i < Math.max(1, lines.length); i ++)
        {
            if (i == 0 || i < lines.length - 1 || lines[i].length > 0) {
                lineNumbers += (i + 1) + "<br />";
            }
        }
        $(".editor-container .lines").html(lineNumbers);
    }

    this.updateHighlights = function(e)
    {
        if (e.keyCode == 17 || (e.keyCode >= 37 && e.keyCode <= 40)) {
            return;
        }

        // get the text
        var editor = $(".editor");
        var text = editor[0].innerText;
        var startOffset, endOffset;

        // ctrl + z
        if ((e.metaKey || e.ctrlKey) && e.keyCode == 90)
        {
            if (self.editingHistory.length > 0)
            {
                var last = self.editingHistory.pop();
                text = last.text;
                startOffset = last.start;
                endOffset = last.end;
            }
            else
            {
                return;
            }
        }
        else
        {
            // get the current start offset
            var range = window.getSelection().getRangeAt(0);
            var preCaretStartRange = range.cloneRange();
            preCaretStartRange.selectNodeContents(editor[0]);
            preCaretStartRange.setEnd(range.startContainer, range.startOffset);
            startOffset = preCaretStartRange.toString().length;

            // get the current end offset
            var preCaretEndRange = range.cloneRange();
            preCaretEndRange.selectNodeContents(editor[0]);
            preCaretEndRange.setEnd(range.endContainer, range.endOffset);
            endOffset = preCaretEndRange.toString().length;

            // ctrl + c
            if ((e.metaKey || e.ctrlKey) && e.keyCode == 67)
            {
                if (self.gui != undefined)
                {
                    var clipboard = self.gui.Clipboard.get();
                    clipboard.set(text.substr(startOffset, (endOffset - startOffset)), "text");
                }
            }
            else
            {
                // ctrl + v
                if ((e.metaKey || e.ctrlKey) && e.keyCode == 86)
                {
                    var clipboard = self.gui.Clipboard.get();
                    console.log(clipboard);
                    text = text.substr(0, startOffset) + clipboard.get("text") + text.substr(endOffset);
                    startOffset = endOffset = (startOffset + clipboard.get("text").length);
                }
                // ctrl + x
                else if ((e.metaKey || e.ctrlKey) && e.keyCode == 88)
                {
                    if (self.gui != undefined)
                    {
                        var clipboard = self.gui.Clipboard.get();
                        clipboard.set(text.substr(startOffset, (endOffset - startOffset)), "text");
                        text = text.substr(0, startOffset) + text.substr(endOffset);
                        endOffset = startOffset;
                    }
                }
                // increment if we just hit enter
                else if (e.keyCode == 13)
                {
                    startOffset++;
                    endOffset++;
                    if (startOffset > text.length) {
                        startOffset = text.length;
                    }
                    if (endOffset > text.length) {
                        endOffset = text.length;
                    }
                }
                // take into account tab character
                else if (e.keyCode == 9)
                {
                    text = text.substr(0, startOffset) + "\t" + text.substr(endOffset);
                    startOffset ++;
                    endOffset = startOffset;
                    e.preventDefault();
                }

                // save history (in chunks)
                if ((self.editingHistory.length == 0 || text != self.editingHistory[self.editingHistory.length - 1].text))
                {
                    if (self.editingSaveHistoryTimeout == null) {
                        self.editingHistory.push({ text: text, start: startOffset, end: endOffset });
                    }
                    clearTimeout(self.editingSaveHistoryTimeout);
                    self.editingSaveHistoryTimeout = setTimeout(function() { self.editingSaveHistoryTimeout = null; }, 500);
                }
            }
        }

        // update text
        //editor[0].innerHTML = self.getHighlightedText(text);

        self.updateLineNumbers(text);

        // reset offsets
        if (document.createRange && window.getSelection)
        {
            function getTextNodesIn(node)
            {
                var textNodes = [];
                if (node.nodeType == 3) {
                    textNodes.push(node);
                }
                else
                {
                    var children = node.childNodes;
                    for (var i = 0, len = children.length; i < len; ++i) {
                        textNodes.push.apply(textNodes, getTextNodesIn(children[i]));
                    }
                }
                return textNodes;
            }

            var range = document.createRange();
            range.selectNodeContents(editor[0]);
            var textNodes = getTextNodesIn(editor[0]);
            var charCount = 0, endCharCount;
            var foundStart = false;
            var foundEnd = false;

            for (var i = 0, textNode; textNode = textNodes[i++]; )
            {
                endCharCount = charCount + textNode.length;
                if (    !foundStart && startOffset >= charCount && (startOffset <= endCharCount
                    ||  (startOffset == endCharCount && i < textNodes.length))
                    ) {
                    range.setStart(textNode, startOffset - charCount);
                    foundStart = true;
                }
                if (    !foundEnd && endOffset >= charCount && (endOffset <= endCharCount
                    || (endOffset == endCharCount && i < textNodes.length))
                    ) {
                    range.setEnd(textNode, endOffset - charCount);
                    foundEnd = true;
                }
                if (foundStart && foundEnd) {
                    break;
                }
                charCount = endCharCount;
            }

            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    this.zoom = function(zoomLevel)
    {
        switch (zoomLevel)
        {
            case 1:
                self.cachedScale = 0.25;
                break;
            case 2:
                self.cachedScale = 0.5;
                break;
            case 3:
                self.cachedScale = 0.75;
                break;
            case 4:
                self.cachedScale = 1;
                break;
        }
        self.translate(200);
    }

    this.translate = function(speed=0)
    {
        var updateArrowsInterval = setInterval(self.updateArrowsThrottled, 16);

        $(".nodes-holder").transition(
            {
                transform: (
                    "matrix(" +
                        self.cachedScale + ",0,0," +
                        self.cachedScale + "," +
                        self.transformOrigin[0] +"," +
                        self.transformOrigin[1] +
                    ")"
                )
            },
            speed,
            "easeInQuad",
            //"linear",
            function() {
                clearInterval(updateArrowsInterval);
                self.updateArrowsThrottled();
            }
        );
        
        $("#app-bg").transition(
            {
                "background-position-x": Math.round(self.transformOrigin[0]),
                "background-position-y": Math.round(self.transformOrigin[1])
            },
            speed,
            "easeInQuad"
        );
    }

    /**
     * Align selected nodes relative to a node with the lowest x-value
     */
    this.arrangeX = function()
    {
        var SPACING = 250;

        var selectedNodes = self.nodes().filter(function(el) {
                return el.selected;
            })
            .sort(function(a, b) {
                if (a.x() > b.x()) return 1;
                if (a.x() < b.x()) return -1;
                return 0;
            });
        var referenceNode = selectedNodes.shift();

        if (!selectedNodes.length) {
            alert("Select nodes to align");
            return;
        }

        selectedNodes.forEach(function(node, i) {
            var x = referenceNode.x() + (SPACING * (i + 1));
            node.moveTo(x, referenceNode.y());
        });
    }

    /**
     * Align selected nodes relative to a node with the lowest y-value
     */
    this.arrangeY = function()
    {
        var SPACING = 250;

        var selectedNodes = self.nodes().filter(function(el) {
                return el.selected;
            })
            .sort(function(a, b) {
                if (a.y() > b.y()) return 1;
                if (a.y() < b.y()) return -1;
                return 0;
            });
        var referenceNode = selectedNodes.shift();

        if (!selectedNodes.length) {
            alert("Select nodes to align");
            return;
        }

        selectedNodes.forEach(function(node, i) {
            var y = referenceNode.y() + (SPACING * (i + 1));
            node.moveTo(referenceNode.x(), y);
        });
    }

    this.arrangeSpiral = function()
    {
        for (var i in self.nodes())
        {
            var node = self.nodes()[i];
            var y = Math.sin(i * .5) * (600 + i * 30);
            var x = Math.cos(i * .5) * (600 + i * 30);
            node.moveTo(x, y);
        }
    }

    this.sortAlphabetical = function()
    {
        console.log(self.nodes.sort);
        self.nodes.sort(function(a, b) { return a.title().localeCompare(b.title()); });
    }

    this.moveNodes = function(offX, offY)
    {
        for (var i in self.nodes())
        {
            var node = self.nodes()[i];
            node.moveTo(node.x() + offX, node.y() + offY);
        }
    }

    this.warpToNodeIdx = function(idx)
    {
        if (self.getActiveNodes().length > idx)
        {
            var node = self.getActiveNodes()[idx];
            var nodeXScaled = -(node.x() * self.cachedScale);
            var nodeYScaled = -(node.y() * self.cachedScale);
            var winXCenter = $(window).width() / 2;
            var winYCenter = $(window).height() / 2;
            var nodeWidthShift = node.tempWidth * self.cachedScale / 2;
            var nodeHeightShift = node.tempHeight * self.cachedScale / 2;

            self.transformOrigin[0] = nodeXScaled + winXCenter - nodeWidthShift;
            self.transformOrigin[1] = nodeYScaled + winYCenter - nodeHeightShift;
            self.translate(100);
            self.setFocusByNode(node, true);
        }
    }

    this.warpToSelectedNodeIdx = function(idx)
    {
        if (self.getSelectedNodes().length > idx)
        {
            var node = self.getSelectedNodes()[idx];
            var nodeXScaled = -(node.x() * self.cachedScale);
            var nodeYScaled = -(node.y() * self.cachedScale);
            var winXCenter = $(window).width() / 2;
            var winYCenter = $(window).height() / 2;
            var nodeWidthShift = node.tempWidth * self.cachedScale / 2;
            var nodeHeightShift = node.tempHeight * self.cachedScale / 2;

            self.transformOrigin[0] = nodeXScaled + winXCenter - nodeWidthShift;
            self.transformOrigin[1] = nodeYScaled + winYCenter - nodeHeightShift;
            self.translate(100);
            self.setFocusByNode(node, true);
        }
    }

    this.warpToNodeXY = function(x, y)
    {
        const nodeWidth = 100, nodeHeight = 100;
        var nodeXScaled = -(x * self.cachedScale);
        var nodeYScaled = -(y * self.cachedScale);
        var winXCenter = $(window).width() / 2;
        var winYCenter = $(window).height() / 2;
        var nodeWidthShift = nodeWidth * self.cachedScale / 2;
        var nodeHeightShift = nodeHeight * self.cachedScale / 2;

        self.transformOrigin[0] = nodeXScaled + winXCenter - nodeWidthShift;
        self.transformOrigin[1] = nodeYScaled + winYCenter - nodeHeightShift;

        self.translate(100);
    }

    this.searchWarp = function()
    {
        // if search field is empty
        if (self.$searchField.val() == "")
        {
            // warp to the first node
            self.warpToNodeIdx(0);
        }
        else 
        {
            var search = self.$searchField.val().toLowerCase();
            for (var i in self.nodes())
            {
                var node = self.nodes()[i];
                // TODO maybe warp to nodes even if there's > 1 result
                if (node.title().toLowerCase() == search)
                {
                    self.$searchField.blur();
                    self.warpToNodeIdx(i);
                    // TODO select & focus on the found node(s)?
                    return;
                }
            }
        }
    }

    this.clearSearch = function()
    {
        self.$searchField.val("");
        self.updateSearch();
    }


    this.updateEditorStats = function()
    {
        var editor = ace.edit("editor");
        var text = editor.getSession().getValue();
        var cursor = editor.getCursorPosition();

        var lines = text.split("\n");

        $(".editor-footer .character-count").html(text.length);
        $(".editor-footer .line-count").html(lines.length);
        $(".editor-footer .row-index").html(cursor.row);
        $(".editor-footer .column-index").html(cursor.column);
    }
}
