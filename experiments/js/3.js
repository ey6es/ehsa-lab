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

/** The value of the clock. */
var clock;

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

/** The state of the goal. */
var goal;


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
 * Constructs the goal.
 */
function Goal ()
{
    // position randomly
    this.x = Math.floor(Math.random() * cellWidth);
    this.y = Math.floor(Math.random() * cellHeight);
}

/**
 * Renders the goal.
 */
Goal.prototype.render = function ()
{
    ctx.lineWidth = 1.5;
    ctx.beginPath();    
    ctx.moveTo((this.x + 0.5) * CELL_SIZE, (this.y + 0.25) * CELL_SIZE);
    ctx.lineTo((this.x + 0.5) * CELL_SIZE, (this.y + 0.75) * CELL_SIZE);
    ctx.moveTo((this.x + 0.25) * CELL_SIZE, (this.y + 0.5) * CELL_SIZE);
    ctx.lineTo((this.x + 0.75) * CELL_SIZE, (this.y + 0.5) * CELL_SIZE);
    ctx.stroke();
    ctx.lineWidth = 1;
};


/**
 * Constructs a memory node.
 */
function MemoryNode ()
{
    this.lastVisited = clock;
    this.rewardDistance = Infinity;
    this.weights = {};
}

/**
 * Compares two memory nodes, returning true if the first is "better" than the second.
 */
function memoryNodeBetter (firstNode, secondNode)
{
    if (!firstNode) {
        return true;
    }
    if (!secondNode) {
        return false;
    }
    if (firstNode.rewardDistance < secondNode.rewardDistance) {
        return true;
    }
    if (firstNode.rewardDistance > secondNode.rewardDistance) {
        return false;
    }
    return firstNode.lastVisited <= secondNode.lastVisited;
}


/** The available directions of motion. */
var UP = 0, LEFT = 1, RIGHT = 2, DOWN = 3;

/** The number of available directions. */
var DIRECTION_COUNT = 4;

/**
 * Creates a hash key that represents the action of moving in the specified direction from the specified position.
 */
function createInputKey (x, y, direction)
{
    return String.fromCharCode(y * cellWidth + x, cellHeight * cellWidth + direction);
}


/**
 * Constructs the agent.
 */
function Agent ()
{
    this.resetPosition();
    
    // initialize the memory node hash
    this.memory = {};
    
    // initialize visit counts
    this.counts = [];
    for (var yy = 0; yy < cellHeight; yy++) {
        for (var xx = 0; xx < cellWidth; xx++) {
            this.counts.push(0);
        }
    }
    this.counts[this.y * cellWidth + this.x] = 1;
}

/**
 * Updates the agent's state.
 */
Agent.prototype.tick = function ()
{
    this.clear();
    
    // enumerate the direction options, look them up in memory, determine the "best" option
    var directionKeys = [];
    var directionMemory = [];
    var bestDirection = Math.floor(DIRECTION_COUNT * Math.random());
    for (var ii = 0; ii < DIRECTION_COUNT; ii++) {
        directionKeys[ii] = createInputKey(this.x, this.y, ii);
        directionMemory[ii] = this.memory[directionKeys[ii]];
        if (memoryNodeBetter(directionMemory[ii], directionMemory[bestDirection])) {
            bestDirection = ii;
        }
    }
    
    // attempt to move in the desired direction, thickening the wall if unable
    switch (bestDirection) {
        case UP:
            if (wallFlags[this.y * wallStride + this.x] & Y_WALL_FLAG) {
                ctx.fillRect(this.x * CELL_SIZE, this.y * CELL_SIZE, CELL_SIZE, 3);
            } else {
                this.y -= 1;
            }
            break;
            
        case LEFT:
            if (wallFlags[this.y * wallStride + this.x] & X_WALL_FLAG) {
                ctx.fillRect(this.x * CELL_SIZE, this.y * CELL_SIZE, 3, CELL_SIZE);
            } else {
                this.x -= 1;
            }
            break;
            
        case RIGHT:
            if (wallFlags[this.y * wallStride + (this.x + 1)] & X_WALL_FLAG) {
                ctx.fillRect((this.x + 1) * CELL_SIZE - 3, this.y * CELL_SIZE, 3, CELL_SIZE);
            } else {
                this.x += 1;
            }
            break;
            
        case DOWN:
            if (wallFlags[(this.y + 1) * wallStride + this.x] & Y_WALL_FLAG) {
                ctx.fillRect(this.x * CELL_SIZE, (this.y + 1) * CELL_SIZE - 3, CELL_SIZE, 3);
            } else {
                this.y += 1;
            }
            break;
    }
    
    // note the time in our memory, increment visit count
    if (!directionMemory[bestDirection]) {
        this.memory[directionKeys[bestDirection]] = directionMemory[bestDirection] = new MemoryNode();
    }
    directionMemory[bestDirection].lastVisited = clock;
    this.counts[this.y * cellWidth + this.x]++;
    
    // if we didn't hit the goal, just render
    if (this.x != goal.x || this.y != goal.y) {
        this.render();
        return;
    }
    
    // clear, rerender the goal
    this.clear();
    goal.render();
    
    // reset our position
    this.resetPosition();
    
    this.render();
};

/**
 * Resets the agent's position.
 */
Agent.prototype.resetPosition = function ()
{
    // position randomly (but not right on top of the goal)
    do {
        this.x = Math.floor(Math.random() * cellWidth);
        this.y = Math.floor(Math.random() * cellHeight);
    
    } while (this.x == goal.x && this.y == goal.y);
    
    // (re)initialize the path
    this.path = [ { x: this.x, y: this.y } ];
}

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
            "&nbsp;<button onclick='init()'>Reset</button>" +
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
    ctx.beginPath();
    for (var yy = 0, ii = 0; yy <= cellHeight; yy++) {
        for (var xx = 0; xx <= cellWidth; xx++, ii++) {
            if (wallFlags[ii] & X_WALL_FLAG) {
                ctx.moveTo(xx * CELL_SIZE, yy * CELL_SIZE);
                ctx.lineTo(xx * CELL_SIZE, yy * CELL_SIZE + CELL_SIZE);
            }
            if (wallFlags[ii] & Y_WALL_FLAG) {
                ctx.moveTo(xx * CELL_SIZE, yy * CELL_SIZE);
                ctx.lineTo(xx * CELL_SIZE + CELL_SIZE, yy * CELL_SIZE);
            }
        }
    }
    ctx.stroke();
    
    // reset the clock
    clock = 0;
    
    // create and render the goal
    goal = new Goal();
    goal.render();
    
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
    // update the clock
    clock++;
    
    // and the agent
    agent.tick();

    // schedule the next tick
    tickTimeout = window.setTimeout(tick, delay);
}

