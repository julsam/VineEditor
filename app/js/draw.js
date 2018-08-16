var Draw =
{
    drawStraightLine: function(ctx, from, to, scale, normal, color) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // draw arrow
        ctx.beginPath();
        ctx.moveTo(to.x + normal.x * 4, to.y + normal.y * 4);
        ctx.lineTo(
            to.x - normal.x * 16 * scale - normal.y * 12 * scale,
            to.y - normal.y * 16 * scale + normal.x * 12 * scale
        );
        ctx.lineTo(
            to.x - normal.x * 16 * scale + normal.y * 12 * scale,
            to.y - normal.y * 16 * scale - normal.x * 12 * scale
        );
        ctx.fill();
    },
    
    drawBezierLine: function(ctx, from, to, scale, color) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);

        var dx = to.x - from.x;
        var dy = to.y - from.y;

        var bezier = {
            sx: from.x,
            sy: from.y,
            cx1: from.x + dx * 0.33,
            cy1: from.y,
            cx2: from.x + dx * 0.67,
            cy2: to.y,
            ex: to.x,
            ey: to.y
        };
        ctx.bezierCurveTo(
            bezier.cx1,
            bezier.cy1,
            bezier.cx2,
            bezier.cy2,
            bezier.ex,
            bezier.ey
        );
        ctx.stroke();
        
        // DEBUG draw control points
        // ctx.beginPath();
        // ctx.arc(bezier.cx1, bezier.cy1, 6 * scale, 0, 2* Math.PI, false);
        // ctx.fill();
        // ctx.closePath();
        // ctx.beginPath();
        // ctx.arc(bezier.cx2, bezier.cy2, 6 * scale, 0, 2* Math.PI, false);
        // ctx.fill();
        // ctx.closePath();

        var angle = Draw.angleRadians(
            from.x, from.y, to.x, to.y
        );

        Draw.drawCurvedArrow(
            ctx,
            to.x,
            to.y,
            angle,
            20 * scale,
            24 * scale
        );
    },
    
    drawQuadraticLine: function(ctx, from, to, scale, color) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);

        //var xoffset = from.x > to.x ? -20 : 20;
        //var cx = xoffset + from.x + (to.x - from.x) * 0.45;
        //var cy = from.y - (distance * 0.133);
        
        // https://stackoverflow.com/questions/39792895/draw-uniform-quadratic-curve
        // How far out the curve is compared to the line length
        var curveAmount = 0.08;
        // mid point:
        var mx = (from.x + to.x) / 2;
        var my = (from.y + to.y) / 2;
        // vector from first to second point
        var vx = to.x - from.x;
        var vy = to.y - from.y;
        // The line at 90deg (clockwise or right) from the start and end points is
        var px = -vy; // perpendicular
        var py = vx;
        if (from.x > to.x) {
            var cx = mx + px * (curveAmount * 2);
            var cy = my + py * (curveAmount * 2);
        } else {
            var cx = mx - px * (curveAmount * 2);
            var cy = my - py * (curveAmount * 2);
        }

        ctx.quadraticCurveTo(
            cx,
            cy,
            to.x,
            to.y
        );
        ctx.stroke();

        // DEBUG draw control point
        // ctx.beginPath();
        // ctx.arc(cx, cy, 6 * scale, 0, 2* Math.PI, false);
        // ctx.fill();
        // ctx.closePath();

        var angle = Draw.angleRadians(
            cx,
            cy,
            to.x,
            to.y
        );

        Draw.drawCurvedArrow(
            ctx,
            to.x,
            to.y,
            angle,
            20 * scale,
            24 * scale
        );
    },

    drawCurvedArrow: function(ctx, locx, locy, angle, sizex, sizey) {
        var hx = sizex / 2;
        var hy = sizey / 2;

        ctx.translate(locx, locy);
        ctx.rotate(angle);
        ctx.translate(-hx, -hy);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 1 * sizey);
        ctx.lineTo(1 * sizex, 1 * hy);
        ctx.closePath();
        ctx.fill();

        ctx.translate(hx, hy);
        ctx.rotate(-angle);
        ctx.translate(-locx, -locy);
    },

    /**
     * Returns angle in degrees.
     */
    angleDeg: function(sx, sy, ex, ey) {
        let theta = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI; // range (-180, 180]
        if (theta < 0) {
            theta += 360; // range [0, 360)
        }
        return theta;
    },

    /**
     * Returns angle in radians.
     */
    angleRadians: function(sx, sy, ex, ey) {
        // make sx and sy at the zero point
        return Math.atan2(ey - sy, ex - sx);
    },

    /**
     * Degrees to cardinal direction from a clockwise angle.
     */
    degToCardinal: function(angle) {
        const dir = ["E", "S", "W", "N"]
        return dir[Math.floor(((angle + (360 / 4) / 2) % 360) / (360 / 4))];
    },

    getPointOffset: function(angle) {
        // E, S, W, N
        const dir = [{x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}]
        return dir[Math.floor(((angle + (360 / 4) / 2) % 360) / (360 / 4))];
    }
}

// export
module.exports = Draw;