'use strict'

const electron = require("electron");
const {app, shell, ipcMain, BrowserWindow} = electron;

const menuTemplate = [
    {
        label: "File",
        submenu: [
            {
                label: "New File",
                id: "NewFile",
                accelerator: "CmdOrCtrl+N",
                click: () => {
                    const mainWin = BrowserWindow.fromId(global.mainWindowId);
                    mainWin.webContents.send("try-new-file");
                }
            },
            {
                label: "Open File",
                id: "OpenFile",
                accelerator: "CmdOrCtrl+O",
                click: () => { ipcMain.emit("open-file-dialog", null, "tryOpenFile"); }
            },
            {
                label: "Append",
                id: "Append",
                accelerator: "CmdOrCtrl+Shift+A",
                click: () => {
                    const mainWin = BrowserWindow.fromId(global.mainWindowId);
                    mainWin.webContents.send("try-append");
                }
            },
            {
                label: "Save",
                id: "SaveCurrent",
                accelerator: "CmdOrCtrl+S",
                click: () => {
                    const mainWin = BrowserWindow.fromId(global.mainWindowId);
                    mainWin.webContents.send("try-save-current");
                }
            },
            {
                label: "Save As...",
                id: "SaveAs",
                accelerator: "CmdOrCtrl+Shift+S",
                click: () => {
                    const mainWin = BrowserWindow.fromId(global.mainWindowId);
                    mainWin.webContents.send("try-save");
                }
            }
        ]
    },
    {
        label: "Edit",
        submenu: [
            {role: "undo"},
            {role: "redo"},
            {type: "separator"},
            {role: "cut"},
            {role: "copy"},
            {role: "paste"},
            {role: "delete"},
            {role: "selectall"}
        ]
    },
    {
        label: "View",
        submenu: [
            {role: "reload"},
            {role: "forcereload"},
            {role: "toggledevtools"},
            {type: "separator"},
            {role: "resetzoom"},
            {role: "zoomin"},
            {role: "zoomout"},
            {type: "separator"},
            {role: "togglefullscreen"}
        ]
    },
    {
        role: "window",
        submenu: [
            {role: "minimize"},
            {role: "close"}
        ]
    },
    {
        role: "help",
        submenu: [
            {
                label: "Learn More",
                click: () => {
                    shell.openExternal("https://github.com/julsam/VineEditor");
                }
            }
        ]
    }
];

if (process.platform !== "darwin")
{
    // File menu
    menuTemplate[0].submenu.push(
        {role: "quit", label: "Quit", accelerator: 'CmdOrCtrl+Q'}
    );

    // Help menu
    menuTemplate[4].submenu.push({
        label: "About",
        click: () => {
            console.log("Not implemented yet");
        }
    });
}

if (process.platform === "darwin")
{
    menuTemplate.unshift({
        label: app.getName(),
        submenu: [
            {role: "about"},
            {type: "separator"},
            {role: "services", submenu: []},
            {type: "separator"},
            {role: "hide"},
            {role: "hideothers"},
            {role: "unhide"},
            {type: "separator"},
            {role: "quit"}
        ]
    });
  
    // Edit menu
    menuTemplate[2].submenu.push(
        {type: "separator"},
        {
            label: "Speech",
            submenu: [
                {role: "startspeaking"},
                {role: "stopspeaking"}
            ]
        }
    );
  
    // Window menu
    menuTemplate[4].submenu = [
        {role: "close"},
        {role: "minimize"},
        {role: "zoom"},
        {type: "separator"},
        {role: "front"}
    ];
}

module.exports = menuTemplate;