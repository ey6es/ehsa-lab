//
// $Id: tbm_base.js 72 2013-02-22 00:44:36Z drzej.k@gmail.com $
//
// This file is subject to the terms and conditions defined in
// 'LICENSE', which is part of this source code package.

/** The canvas upon which we draw. */
var canvas;

/** The context with which we draw on the canvas. */
var ctx;

/** The div containing the simulation controls. */
var controls; 

/** The start/pause button. */
var startButton;

/** The number of milliseconds to wait between ticks. */
var delay;

/** The tick timeout. */
var tickTimeout;

/** The size of the grid cells. */
var CELL_SIZE = 15;

/** The width of the grid in cells. */
var cellWidth;

/** The height of the grid in cells. */
var cellHeight;

/** Indicates the presence of a wall separating horizontally adjacent cells. */
var X_WALL_FLAG = (1 << 0);

/** Indicates the presence of a wall separating vertically adjacent cells. */
var Y_WALL_FLAG = (1 << 1);

/** The wall flags for each grid location. */
var wallFlags;

/** The number of elements in each row of the wall flag array. */
var wallStride;

/** The state of the agent. */
var agent;


/**
 * Constructor for adjacent sections.
 */
function Adjacency (x, y, flag, section)
{
    this.x = x;
    this.y = y;
    this.flag = flag;
    this.section = section;
}


/**
 * Constructs the agent.
 */
function Agent ()
{
    // position randomly
    this.x = Math.floor(Math.random() * cellWidth);
    this.y = Math.floor(Math.random() * cellHeight);
    
    // initialize "memory" and visit counts
    this.memory = [];
    this.counts = [];
    for (var yy = 0; yy < cellHeight; yy++) {
        for (var xx = 0; xx < cellWidth; xx++) {
            this.memory.push(0);
            this.counts.push(0);
        }
    }
    this.memory[this.y * cellWidth + this.x] = new Date().getTime();
    this.counts[this.y * cellWidth + this.x] = 1;
}

/**
 * Updates the agent's state.
 */
Agent.prototype.tick = function ()
{
    // figure out which directions we can travel in and when we last visited
    var up = (wallFlags[this.y * wallStride + this.x] & Y_WALL_FLAG) ?
        Infinity : this.memory[(this.y - 1) * cellWidth + this.x];
    var left = (wallFlags[this.y * wallStride + this.x] & X_WALL_FLAG) ?
        Infinity : this.memory[this.y * cellWidth + (this.x - 1)];
    var down = (wallFlags[(this.y + 1) * wallStride + this.x] & Y_WALL_FLAG) ?
        Infinity : this.memory[(this.y + 1) * cellWidth + this.x];
    var right = (wallFlags[this.y * wallStride + (this.x + 1)] & X_WALL_FLAG) ?
        Infinity : this.memory[this.y * cellWidth + (this.x + 1)];
    
    // go in the direction of the least recently visited accessible location
    if (up <= left && up <= down && up <= right) {
        this.y -= 1;
        
    } else if (left <= up && left <= down && left <= right) {
        this.x -= 1;
        
    } else if (down <= up && down <= left && down <= right) {
        this.y += 1;
        
    } else if (right <= up && right <= left && right <= down) {
        this.x += 1;
    } 
    
    // note the time in our memory, increment visit count
    this.memory[this.y * cellWidth + this.x] = new Date().getTime();
    this.counts[this.y * cellWidth + this.x]++;
};

/**
 * Clears the location occupied by the agent.
 */
Agent.prototype.clear = function ()
{
    // increasing counts cause increased saturation
    var saturation = Math.max(0, 240 - this.counts[this.y * cellWidth + this.x] * 16).toString(16);
    if (saturation.length == 1) {
        saturation = "0" + saturation;
    }
    ctx.fillStyle = "#" + saturation + "FF" + saturation;
    var up = (wallFlags[this.y * wallStride + this.x] & Y_WALL_FLAG) ? 1 : 0;
    var left = (wallFlags[this.y * wallStride + this.x] & X_WALL_FLAG) ? 1 : 0;
    var down = (wallFlags[(this.y + 1) * wallStride + this.x] & Y_WALL_FLAG) ? 1 : 0;
    var right = (wallFlags[this.y * wallStride + (this.x + 1)] & X_WALL_FLAG) ? 1 : 0;
    ctx.fillRect(this.x * CELL_SIZE + left, this.y * CELL_SIZE + up, CELL_SIZE - (left + right), CELL_SIZE - (up + down));
    ctx.fillStyle = "#000000";
};

/**
 * Renders the agent.
 */
Agent.prototype.render = function ()
{
    ctx.beginPath();
    ctx.arc((this.x + 0.5) * CELL_SIZE, (this.y + 0.5) * CELL_SIZE, CELL_SIZE * 0.25, 0.0, Math.PI * 2.0);
    ctx.fill();    
};


/**
 * Initializes the base bits.
 */
function init ()
{
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    controls = document.getElementById("controls");
    
    // create the controls the first time
    if (!startButton) {
        controls.innerHTML =
            "<button id='start' onclick='start()'>Start</button>" +
            "<button onclick='init()'>Reset</button>" +
            "&nbsp;&nbsp; Delay: <select id='delay'>" +
                "<option value='200'>200 ms</option>" +
                "<option value='100'>100 ms</option>" +
                "<option value='30' selected='true'>30 ms</option>" +
                "<option value='10'>10 ms</option>" +
                "<option value='1'>1 ms</option>" +
            "</select>";
        startButton = document.getElementById("start");
        delay = 30;
        document.getElementById("delay").onchange = function (event) {
            delay = parseInt(event.target.options[event.target.selectedIndex].value);
        };
    }
    
    // determine the size of the canvas in cells
    cellWidth = Math.floor(canvas.width / CELL_SIZE);
    cellHeight = Math.floor(canvas.height / CELL_SIZE);
    wallStride = cellWidth + 1;
    
    // initialize the array of wall flags
    wallFlags = [];
    for (var yy = 0; yy <= cellHeight; yy++) {
        for (var xx = 0; xx <= cellWidth; xx++) {
            wallFlags.push((yy == cellHeight ? 0 : X_WALL_FLAG) | (xx == cellWidth ? 0 : Y_WALL_FLAG));
        }
    }
    
    // initialize the array of sections
    var sections = [];
    for (var yy = 0; yy < cellHeight; yy++) {
        for (var xx = 0; xx < cellWidth; xx++) {
            sections.push([]);
        }
    }
    
    // populate with adjacent sections
    for (var yy = 0, ii = 0; yy < cellHeight; yy++) {
        for (var xx = 0; xx < cellWidth; xx++, ii++) {
            if (xx != 0) {
                sections[ii].push(new Adjacency(xx, yy, X_WALL_FLAG, sections[yy * cellWidth + (xx - 1)]));
            }
            if (xx != cellWidth - 1) {
                sections[ii].push(new Adjacency(xx + 1, yy, X_WALL_FLAG, sections[yy * cellWidth + (xx + 1)]));
            }
            if (yy != 0) {
                sections[ii].push(new Adjacency(xx, yy, Y_WALL_FLAG, sections[(yy - 1) * cellWidth + xx]));
            }
            if (yy != cellHeight - 1) {
                sections[ii].push(new Adjacency(xx, yy + 1, Y_WALL_FLAG, sections[(yy + 1) * cellWidth + xx]));
            }
        }
    }
    
    // merge sections until fully connected
    while (sections.length > 1) {
        // pick a random section
        var sectionIndex = Math.floor(Math.random() * sections.length);
        var section = sections[sectionIndex];
        
        // and from that section, a random adjacency
        var adjacencyIndex = Math.floor(Math.random() * section.length);
        var adjacency = section[adjacencyIndex];
        
        // clear the wall dividing the two sections
        wallFlags[adjacency.y * wallStride + adjacency.x] &= (~adjacency.flag);
        
        // remove the old section
        var oldSection = adjacency.section;
        var removeIndex = sections.indexOf(oldSection);
        sections.splice(removeIndex, 1);
        
        // remove all adjacencies pointing to the old section
        for (var ii = section.length - 1; ii >= 0; ii--) {
            if (section[ii].section == oldSection) {
                section.splice(ii, 1);
            }
        }
        
        // merge adjacencies in old section
        for (var ii = 0; ii < oldSection.length; ii++) {
            if (oldSection[ii].section == section) {
                continue;
            }
            section.push(oldSection[ii]);
            
            // update the neighbor to point to this section
            var nextSection = oldSection[ii].section;
            for (var jj = 0; jj < nextSection.length; jj++) {
                if (nextSection[jj].section == oldSection) {
                    nextSection[jj].section = section;
                }
            }
        }
    }
    
    // clear and draw the walls
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var yy = 0, ii = 0; yy <= cellHeight; yy++) {
        for (var xx = 0; xx <= cellWidth; xx++, ii++) {
            if (wallFlags[ii] & X_WALL_FLAG) {
                ctx.beginPath();
                ctx.moveTo(xx * CELL_SIZE, yy * CELL_SIZE);
                ctx.lineTo(xx * CELL_SIZE, yy * CELL_SIZE + CELL_SIZE);
                ctx.stroke();
            }
            if (wallFlags[ii] & Y_WALL_FLAG) {
                ctx.beginPath();
                ctx.moveTo(xx * CELL_SIZE, yy * CELL_SIZE);
                ctx.lineTo(xx * CELL_SIZE + CELL_SIZE, yy * CELL_SIZE);
                ctx.stroke();
            }
        }
    }
    
    // create and render the agent
    agent = new Agent();
    agent.render();
}

/**
 * Performs the first render and starts the ticking process.
 */
function start ()
{
    // toggle the button
    startButton.textContent = "Pause";
    startButton.onclick = pause;

    // perform the first tick
    tick();
}

/**
 * Pauses the simulation.
 */
function pause ()
{
    // toggle the button
    startButton.textContent = "Start";
    startButton.onclick = start;
    
    // cancel the next tick
    window.clearTimeout(tickTimeout);
}

/**
 * Advances the simulation state and updates the display.
 */
function tick ()
{
    agent.clear();
    agent.tick();
    agent.render();

    // schedule the next tick
    tickTimeout = window.setTimeout(tick, delay);
}

