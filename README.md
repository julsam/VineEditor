# Vine Editor

Very much WIP. Many things here are incomplete and subject to change.

Dialogue editor for the [VineScript language](https://github.com/julsam/VineScript). Forked from the excellent [Yarn Editor](https://github.com/InfiniteAmmoInc/Yarn). Both are heavily inspired by and based on the amazing Twine software: http://twinery.org/

![Screenshot](http://infiniteammo.com/Yarn/screenshot.jpg)

## TODO
 * more explanations
 * examples
 * update the screenshots

## Builds

Win64: **Soon**

MacOS: **Soon**

## Examples

**TODO**

## How to Connect Nodes

Node connections work similar to Twine.

![Node Connections](https://i.imgur.com/Okb0MnE.png)

## Code Editor

![Code Editor](https://i.imgur.com/1fkjv4A.png)

## Built With

* [node](https://nodejs.org/en/)
* [electron](https://electronjs.org/)
* [electron-builder](https://www.electron.build/)

## Build from source

### Prerequisites

This software needs to be installed:

```
node >= 10.4.1
```

The lowest version of Node that would probably work (but is untested) is v8.9.3.

### Installing dependencies
```
npm install
```

### Running the app from source

Good for development and testing.
```
npm start
```

### Building the app

You can build the app unpacked, it produces an executable for your current platform:
```
npm run build
```

Alternatively you can build an installer for it:
```
npm run dist
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

See also the list of [contributors](https://github.com/julsam/VineEditor) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Special Thanks

* **Alec Holowka** - *Yarn creator* - [@InfiniteAmmoDev](https://twitter.com/InfiniteAmmoDev)
* **Noel Berry** - *Yarn co-creator* - [@NoelFB](https://twitter.com/NoelFB)
* **All Yarn contributors** - [Contributors list](https://github.com/InfiniteAmmoInc/Yarn/graphs/contributors)
* **Twine creators** - [Twine Software](http://twinery.org/)