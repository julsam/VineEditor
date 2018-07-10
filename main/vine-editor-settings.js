'use strict';

// Imports
const electron_is = require("electron-is");
var _settings;
var _fs;
if (electron_is.main()) {
    _settings = require("electron-settings");
    _fs = require("fs");
} else if (electron_is.renderer()) {
    _settings = ("electron").remote.require("electron-settings");
    _fs = remote.require("fs");
}
const settings = _settings;
const fs = _fs;

let versionNumber = require('./../package.json').version;

// Default Settings
const defaultSettings = {
    version: versionNumber,
    config: {
        // set both (x, y) to -1 to center the window
        x: -1,
        y: -1,
        width: 1280,
        height: 800,
        maximized: false,
        currentPath: "" // Not used yet
    },
    prefs: {
        vineBinPath: "", // Not used yet
        snapToGrid: false,
        nodeConnectionTypeId: 0,
        theme: [ // Not used yet
            "blue"
        ],
        editor: { // Not used yet
            fontSize: 14
        },
        // only used in dev:
        openDevTools: electron_is.dev()
    },
    data: {
        minWidth: 800,
        minHeight: 600,
        nodeConnectionTypeList: [
            "Straight",
            "Quadratic",
            "Bezier"
        ]
    }
};

/**
 * Loads the settings file and manage a local version of it to avoid
 * read/write calls everytime we need it.
 * 
 * The path of the settings file is either:
 *  - '%APPDATA%\Vine Editor\Settings' on Windows
 *  - '$XDG_CONFIG_HOME/Vine\ Editor/Settings'
 *    or '~/.config/Vine\ Editor/Settings' on Linux
 *  - '~/Library/Application\ Support/Vine\ Editor/Settings' on macOS
 */
class VineEditorSettings
{
    /**
     * @constructor
     * @private
     */
    constructor() {
        /**
         * Local copy of the settings.
         * @private
         */
        this.localSettings = {};

        /**
         * Indicates wether a value has been set.
         * @private
         */
        this.isDirty = false;
    }

    /**
     * Writes the settings to the file.
     * @public
     */
    flush() {
        if (this.isDirty) {
            settings.setAll(this.localSettings, { prettify: true });
            this.isDirty = false;
            return true;
        }
        return false;
    }

    /**
     * Loads settings from the file or the default settings if no file is
     * found. Should be called before any other methods.
     * @public
     */
    loadSettings() {
        if (!fs.existsSync(settings.file())) {
            // File doesn't exist, copy data from defaultSettings
            // Deep Clone
            this.localSettings = JSON.parse(JSON.stringify(defaultSettings));
        }
        else
        {
            // File already exists, checks it's not missing any values

            // version
            this._checkMissingValue("version", defaultSettings.version);

            // config
            this._checkMissingValue("config.x", defaultSettings.config.x);
            this._checkMissingValue("config.y", defaultSettings.config.y);
            this._checkMissingValue("config.width", defaultSettings.config.width);
            this._checkMissingValue("config.height", defaultSettings.config.height);
            this._checkMissingValue("config.maximized", defaultSettings.config.maximized);

            // user preferences
            this._checkMissingValue("prefs.snapToGrid", defaultSettings.prefs.snapToGrid);
            this._checkMissingValue(
                "prefs.nodeConnectionTypeId",
                defaultSettings.prefs.nodeConnectionTypeId
            );
            this._checkMissingValue(
                "prefs.openDevTools", defaultSettings.prefs.openDevTools
            );
            
            // data
            this._checkMissingValue("data.minWidth", defaultSettings.data.minWidth);
            this._checkMissingValue("data.minHeight", defaultSettings.data.minHeight);
            this._checkMissingValue(
                "data.nodeConnectionTypeList",
                defaultSettings.data.nodeConnectionTypeList
            );

            this.localSettings = settings.getAll();
        }
    }

    /**
     * If a key is missing from the loaded file, sets a default one.
     * @param {string} key
     * @param {any} defaultValue
     * @private
     */
    _checkMissingValue(key, defaultValue) {
        if (!settings.has(key)) {
            settings.set(key, defaultValue, {prettify: true});
        }
    }

    /**
     * Checks if the key exists.
     * @param {string} key
     * @returns {boolean}
     * @public
     */
    has(key) {
        let obj = this.localSettings;
        const keys = key.split(/\./);

        for (let i = 0, len = keys.length; i < len; i++) {
            const el = keys[i];
        
            if (Object.prototype.hasOwnProperty.call(obj, el)) {
                obj = obj[el];
            } else {
                return false;
            }
        }
        return true;
    }

    /**
     * Get the value of the given key, or returns a default value, if provided,
     * if the key doesn't exists.
     * @param {string} key 
     * @param {any} [defaultValue]
     * @returns {any}
     * @public
     */
    get(key, defaultValue=undefined) {
        let obj = this.localSettings;
        const keys = key.split(/\./);

        for (let i = 0, len = keys.length; i < len; i++) {
            const el = keys[i];

            if (Object.prototype.hasOwnProperty.call(obj, el)) {
                obj = obj[el];
            } else {
                return defaultValue;
            }
        }

        return obj;
    }

    /**
     * Sets the value at the given key.
     * @param {string} name 
     * @param {any} value 
     * @public
     */
    set(name, value) {
        this.isDirty = true;
        let obj = this.localSettings;
        const keys = name.split(/\./);

        while (keys.length > 1) {
            const key = keys.shift();

            if (!Object.prototype.hasOwnProperty.call(obj, key)) {
                obj[key] = {};
            }

            obj = obj[key];
        }

        obj[keys.shift()] = value;
    }

    /**
     * Delete the settings file.
     * @public
     */
    removeStoredSettings() {
        try {
            // removes a file or a symbolic link
            fs.unlinkSync(settings.file());
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
}
const vineEditorSettings = new VineEditorSettings();

module.exports = vineEditorSettings;
