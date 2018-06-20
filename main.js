
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const url = require('url')
const path = require('path')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let yarnRunnerWindow;

function createWindow () {
    // Create the browser window.
    mainWindow =  new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false,
        //frame: false,
        //icon: "Yarn.png"
    });
    // Hide the menu
    //mainWindow.setMenu(null);
    
    // and load the index.html of the app.
    // mainWindow.loadURL(url.format({
    //   pathname: path.join(__dirname, 'app/index.html'),
    //   protocol: 'file',
    //   slashes: true
    // }));
    mainWindow.loadFile('app/index.html');
    
    // While loading the page, the ready-to-show event will be emitted when the
    // renderer process has rendered the page for the first time if the window has
    // not been shown yet. Showing the window after this event will have no visual
    // flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        //mainWindow.maximize();
    })

    // Open the DevTools.
    //mainWindow.webContents.openDevTools({mode:'bottom'});
    
    mainWindow.on('close', function (event) {
        event.preventDefault();
        if (yarnRunnerWindow) {
            yarnRunnerWindow.destroy();
        }
        mainWindow.destroy();
        mainWindow = null;
    });
    
    // mainWindow.webContents.on('dom-ready', () => { // in case you want to send data to yarn window on init
    //   mainWindow.webContents.send('loadYarnDataObject', yarnData);
    //   mainWindow.show();
    //   mainWindow.maximize();
    // });
    
    ipcMain.on('openFileYarn', (event, operation) => {
        console.log("Open file");
        dialog.showOpenDialog({
            properties: ['openFile']
        }, function (files) {
            if (files) {
                mainWindow.webContents.send('selected-file', files[0], operation);
            }
        });
    }); 
    
    ipcMain.on('saveFileYarn', (event, type, content) => {
        dialog.showSaveDialog(mainWindow,
            { filters: [{ name: 'story', extensions: [type] }]},
            function(filepath) {
                mainWindow.webContents.send('saved-file', filepath, type, content);
            });
        });
        
        ipcMain.on('sendYarnDataToObject', (event, content, startTestNode) => { // in case you wanna export yarn object to another embedded app
            // otherApp.webContents.send('yarnSavedStory',content);
            // mainWindow.close();
        })
        
        ipcMain.on('testYarnStoryFrom' ,(event, content, startTestNode) => {
            createYarnTesterWindow(content,startTestNode);
        })
        
    }
    
function createYarnTesterWindow(content, startTestNode){
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
    yarnRunnerWindow.webContents.openDevTools();
    
    yarnRunnerWindow.webContents.on('dom-ready', () => {
        yarnRunnerWindow.webContents.send('loadYarnDataOnRunner', content,startTestNode);
        yarnRunnerWindow.show();
        // yarnRunnerWindow.maximize();
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.