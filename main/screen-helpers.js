'use strict'

const electron = require("electron");

/**
 * Returns the nearest screen display of the given window
 * @param {Electron.BrowserWindow} window
 * @returns {Electron.Display}
 */
module.exports.getNearestScreenDisplay = (window) => {
    const winBounds = window.getBounds();
    return electron.screen.getDisplayNearestPoint({
        x: winBounds.x,
        y: winBounds.y
    });
}

/**
 * Indicates whether the window is visible on a screen display.
 * @param {Electron.BrowserWindow} window
 * @param {Electron.Display} display
 * @returns {boolean}
 */
module.exports.isWindowVisible = (window) => {
    const display = exports.getNearestScreenDisplay(window);
    const winpos = window.getPosition();
    if (    winpos.x >= display.bounds.x
        &&  winpos.x <= display.bounds.x + display.bounds.width
        &&  winpos.y >= display.bounds.y
        &&  winpos.y <= display.bounds.y + display.bounds.height
    ) {
        return true;
    }
    return false;
}

/**
 * Indicates whether the given point is on a screen display.
 * @param {Electron.Point} point
 * @returns {boolean}
 */
module.exports.isPointOnScreen = (point) => {
    const display = electron.screen.getDisplayNearestPoint(point);
    if (    point.x >= display.bounds.x
        &&  point.x <= display.bounds.x + display.bounds.width
        &&  point.y >= display.bounds.y
        &&  point.y <= display.bounds.y + display.bounds.height
    ) {
        return true;
    }
    return false;
}