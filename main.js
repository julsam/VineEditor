
const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const url = require("url");
const path = require("path");
const isDev = require("electron-is").dev();
const appSettings = require("./main/vine-editor-settings");
const menuTemplate = require("./main/vine-editor-menu");
const ScreenHelpers = require("./main/screen-helpers");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let yarnRunnerWindow;

global.mainWindowId = 0;

const fileFilters = [
    { name: "Any Accepted Formats", extensions: [
        "json", "vine", "yarn.txt", "xml", "tw2", "txt"
    ] },
    { name: "JSON", extensions: ["json"] },
    { name: "VineScript", extensions: ["vine"] },
    { name: "YarnText", extensions: ["yarn.txt"] },
    { name: "XML", extensions: ["xml"] },
    { name: "Twee2", extensions: ["tw2"] },
    { name: "Text", extensions: ["txt"] },
    { name: "All Files", extensions: ["*"] }
];

function createWindow() {
    // Load settings
    appSettings.loadSettings();

    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: appSettings.get("config.width", 1280),
        height: appSettings.get("config.height", 800),
        minWidth: appSettings.get("data.minWidth", 800),
        minHeight: appSettings.get("data.minHeight", 600),
        show: false,
        center: false,
        // backgroundColor is used when the app is not completely loaded.
        // It's visible when the app is slow to load, or the time of a frame
        // when resizing. The color should correspond to the one defined for
        // the body of the #app-bg
        backgroundColor: "#80ceff"
        // frame: false
        //icon: "Yarn.png",
        //autoHideMenuBar:true
    });

    // global reference to the main window id
    global.mainWindowId = mainWindow.id;

    // Hide the menu
    //mainWindow.setMenu(null);

    // Build app menu from menuTemplate
    const mainMenu = Menu.buildFromTemplate(menuTemplate);
    // Set menu to menuTemplate - "activate" the menu
    Menu.setApplicationMenu(mainMenu);

    mainWindow.loadFile("app/index.html");
    
    // While loading the page, the ready-to-show event will be emitted when the
    // renderer process has rendered the page for the first time if the window has
    // not been shown yet. Showing the window after this event will have no visual
    // flash
    mainWindow.once("ready-to-show", () => {
        // Center the window
        if (    appSettings.get("config.x", -1) <= -1
            &&  appSettings.get("config.y", -1) <= -1
        ) {
            mainWindow.center();
        }
        else
        {
            // Checks that the window will be visible. Maybe the window
            // was on a second monitor the last time it was used,
            // but it got disconnected since then, so we have to make sure
            // the position fits the current monitor setup.
            const isOnScreen = ScreenHelpers.isPointOnScreen({
                x: appSettings.get("config.x"),
                y: appSettings.get("config.y")
            });
            if (!isOnScreen) {
                // sets new position to (0, 0)
                appSettings.set("config.x", 0);
                appSettings.set("config.y", 0);
            }
            // sets the position saved in the settings
            mainWindow.setPosition(
                appSettings.get("config.x"),
                appSettings.get("config.y")
            );
        }

        // Maximize
        if (appSettings.get("config.maximized", false)) {
            // Maximize and show the window (it doesn't show on MacOS...)
            mainWindow.maximize();
        }

        // Show and focus the window
        mainWindow.show();

        if (isDev && appSettings.get("prefs.openDevTools", false)) {
            mainWindow.webContents.openDevTools({mode: "bottom"});
        }
    });
    
    mainWindow.webContents.on("dom-ready", () => {
        // launch the app with the current version number
        mainWindow.webContents.send("launchApp", app.getVersion());
        
        // const { spawn } = require('child_process');
        // const vinepath = "C:\\VineFolder\\";
        // console.log(vinepath);

        // const ls = spawn(
        //      "VineScriptConsole.exe", 
        //     ["scripts/Example.vine"],
        //     {cwd: vinepath}
        // );

        // ls.stdout.on('data', (data) => {
        //     console.log(`stdout: ${data}`);
        // });

        // ls.stderr.on('data', (data) => {
        //     console.log(`stderr: ${data}`);
        // });

        // ls.on('close', (code) => {
        //     console.log(`child process exited with code ${code}`);
        // });

    });

    if (isDev) {
        mainWindow.webContents.on("devtools-opened", () => {
            appSettings.set("prefs.openDevTools", true);
        });
        mainWindow.webContents.on("devtools-closed", () => {
            appSettings.set("prefs.openDevTools", false);
        });
    }

    mainWindow.on("resize", () => {
        if (!mainWindow.isMaximized()) {
            appSettings.set("config.width", mainWindow.getSize()[0]);
            appSettings.set("config.height", mainWindow.getSize()[1]);
        }
    });

    mainWindow.on("move", () => {
        if (!mainWindow.isMaximized()) {
            appSettings.set("config.x", mainWindow.getPosition()[0]);
            appSettings.set("config.y", mainWindow.getPosition()[1]);
        }
    });

    mainWindow.on("maximize", () => {
        appSettings.set("config.maximized", true);
    });

    mainWindow.on("unmaximize", () => {
        appSettings.set("config.maximized", false);
    });

    mainWindow.on("close", (event) => {
        // save settings
        appSettings.flush();

        if (yarnRunnerWindow) {
            yarnRunnerWindow.destroy();
        }

        // Dereference the window object
        mainWindow = null;
    });

    ipcMain.on("modeChanged", (event, mode) => {
        if (mode === "textEditorMode") {
            mainMenu.getMenuItemById("NewFile").enabled = false;
            mainMenu.getMenuItemById("OpenFile").enabled = false;
            mainMenu.getMenuItemById("Append").enabled = false;
        } else { // nodeMode
            mainMenu.getMenuItemById("NewFile").enabled = true;
            mainMenu.getMenuItemById("OpenFile").enabled = true;
            mainMenu.getMenuItemById("Append").enabled = true;
        }
    });
    
    ipcMain.on("new-file-dialog", (event, hasUnsavedChanges) => {
        if (hasUnsavedChanges) {

        } else {
            mainWindow.webContents.send("new-file");
        }
    });
    
    ipcMain.on("open-file-dialog", (event, operation) => {
        dialog.showOpenDialog(mainWindow, {
            title: "Open File",
            properties: ["openFile"],
            // defaultPath: "",
            filters: fileFilters
        }, function (files) {
            if (files !== undefined) {
                mainWindow.webContents.send("open-file", files[0], operation);
            }
        });
    });
    
    ipcMain.on("append-file-dialog", (event, operation) => {
        dialog.showOpenDialog(mainWindow, {
            title: "Append Files",
            properties: ["openFile", "multiSelections"],
            // defaultPath: "",
            filters: fileFilters
        }, function (files) {
            if (files !== undefined) {
                for (var i = 0; i < files.length; i++) {
                    mainWindow.webContents.send("open-file", files[i], operation);
                }
            }
        });
    });
    
    ipcMain.on("open-directory-dialog", (event, operation) => {
        dialog.showOpenDialog(mainWindow, {
            title: "Open Directory",
            properties: ["openDirectory", "multiSelections"],
            filters: fileFilters // useless for directories?
        }, function (dirs) {
            if (dirs !== undefined) {
                for (var i = 0; i < dirs.length; i++) {
                    mainWindow.webContents.send("open-file", dirs[i], operation);
                }
            }
        });
    });
    
    ipcMain.on("save-file-dialog", (event, type, content) => {
        dialog.showSaveDialog(mainWindow, {
            filters: [{ name: "story", extensions: [type] }] 
        }, function(filepath) {
            if (filepath !== undefined) {
                mainWindow.webContents.send("save-file", filepath, type, content);
            }
        });
    });
    
    ipcMain.on("testYarnStoryFrom", (event, content, startTestNode) => {
        createYarnTesterWindow(content, startTestNode);
    });
}

function createYarnTesterWindow(content, startTestNode) {
    // console.log("START RUN::"+startTestNode);
    if (yarnRunnerWindow) {
        yarnRunnerWindow.destroy();
    }
    yarnRunnerWindow = new BrowserWindow({
        defaultWidth: 1400,
        defaultHeight: 200,
        maximize: false,
        show: false
    });
    
    yarnRunnerWindow.loadURL(`file://${__dirname}/app/renderer.html`);
    
    yarnRunnerWindow.webContents.on("dom-ready", () => {
        yarnRunnerWindow.webContents.send("loadYarnDataOnRunner", content, startTestNode);
        yarnRunnerWindow.show();
        // yarnRunnerWindow.maximize();
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", function() {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.