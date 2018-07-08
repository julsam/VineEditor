'use strict';

// Constructor
// function Marquee() {
//     // Private vars
//     this.active = false;
// }
// // public vars
// Marquee.prototype.rect = { x1: 0, y1:0, x2:0, y2:0 };
// Marquee.prototype.selection = [];

// // methods
// Marquee.prototype.isActive = function() {
//     return this.active;
// }

// Marquee.prototype.setActive = function(value) {
//     this.active = value;
// }

// Marquee.prototype.disable = function() {
//     $("#marquee").css({x:0, y:0, width:0, height:0});
//     this.active = false;
//     this.rect = { x1: 0, y1:0, x2:0, y2:0 };
//     this.selection = [];
// }

// Marquee.prototype.draw = function() {
//     $("#marquee").css({
//         x: this.rect.x1,
//         y: this.rect.y1,
//         width: Math.abs(this.rect.x1 - this.rect.x2),
//         height: Math.abs(this.rect.y1 - this.rect.y2)
//     });
// }

class Marquee
{
    constructor() {
        this.active = false;
        this.rect = { x1: 0, y1:0, x2:0, y2:0 };
        this.selection = [];
    }

    isActive() {
        return this.active;
    }

    setActive(value) {
        this.active = value;
        if (value == true) {
            document.body.classList.add('mouseMarquee');
        } else {
            document.body.classList.remove('mouseMarquee');
        }
    }

    disable() {
        $("#marquee").css({x:0, y:0, width:0, height:0});
        this.setActive(false);
        this.rect = { x1: 0, y1:0, x2:0, y2:0 };
        this.selection = [];
    }

    draw() {
        $("#marquee").css({
            x: this.rect.x1,
            y: this.rect.y1,
            width: Math.abs(this.rect.x1 - this.rect.x2),
            height: Math.abs(this.rect.y1 - this.rect.y2)
        });
    }
}

// export
module.exports = Marquee;