/**
 * Playing with code I found here: https://www.blog.drewcutchins.com/blog/2018-8-16-flocking
 * 
 */

function CodeDisplay(id, loop, initialize, deinitialize){
    this.element = document.getElementById(id);
    this.loop = loop;
    this.initialize = initialize;
    this.deinitialize = deinitialize;
    this.initialized = false;
}

var codeDisplays = [];

function checkVisible(elm) {
    var rect = elm.getBoundingClientRect();
    var viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}

$(window).scroll(function()
{
    for(var i = 0; i < codeDisplays.length; i++){
        var visible = checkVisible(codeDisplays[i].element);
        if( visible && !codeDisplays[i].initialized){
            codeDisplays[i].initialize();
            codeDisplays[i].initialized = true;
            console.log("initializing");
        }
        else if(!visible && codeDisplays[i].initialized){
            codeDisplays[i].deinitialize();
            codeDisplays[i].initialized = false;
        }
    }
});

var deltaTime;
var lastUpdate = Date.now();
function MainLoop(){
    deltaTime = Date.now() - lastUpdate;
    lastUpdate = Date.now();
    for(var i = 0; i < codeDisplays.length; i++){
        if(codeDisplays[i].initialized){
            codeDisplays[i].loop(deltaTime);
        }
    }
    requestAnimationFrame(MainLoop);
}

MainLoop();

var vectorUtils = {
    normalize: function(vec2){
        var magnitude = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
        if(magnitude == 0){
            return {x: 0, y: 0};
        }
        return {x: vec2.x / magnitude, y: vec2.y / magnitude};
    }
}

function Canvas(id, normalWidth, normalHeight){
    this.element = document.getElementById(id);
    this.normalWidth = normalWidth;
    this.normalHeight = normalHeight;
    this.aspectRatio = normalWidth / normalHeight;
}

var padding = 200;
$(document).ready(function(){
    var canvases = $("canvas").toArray();
    console.log(canvases);
    for(var i = 0; i < canvases.length; i++){
        console.log(canvases[i].width);
        console.log(window.innerWidth - padding);
        if(canvases[i].width > window.innerWidth - padding){
            var aspectRatio = canvases[i].width / canvases[i].height;
            canvases[i].width = window.innerWidth - padding;
            canvases[i].height = canvases[i].width / aspectRatio;
        }
    }
});

class Boid{

    // They will be initialized with a starting x and y position
    constructor(xPos, yPos, planeWidth, planeHeight, wrap, separationStrength, separationDistance, alignmentStrength, alignmentDistance, cohesionStrength, cohesionDistance){
        //  The mass of the boid will dictate how responsive it is to flocking forces
        this.mass = 1;
        this.maxSpeed = .5;
        this.position = {x: xPos, y: yPos};
        this.velocity = {x: 0, y: 0};
        this.acceleration = {x: 0, y: 0};  

        this.planeWidth = planeWidth;
        this.planeHeight = planeHeight;     
        this.wrap = wrap;

        this.separationDistance = separationDistance;
        this.separationStrength = separationStrength;

        this.alignmentDistance = alignmentDistance;
        this.alignmentStrength = alignmentStrength;

        this.cohesionDistance = cohesionDistance;
        this.cohesionStrength = cohesionStrength;
    }

    //  Heading is represented by a decimal value indicating the radians
    get heading() {
        return Math.atan2(this.velocity.y, this.velocity.x);
    }

    //  This function will be called to guide the boid while flocking
    applyForce(force){
        //  Acceleration is force devided by mass
        this.acceleration.x += force.x / this.mass;
        this.acceleration.y += force.y / this.mass;
    }

    update(neighbors){
        var separationForce = this.separation(neighbors);
        var cohesionForce = this.cohesion(neighbors);
        var alignmentForce = this.alignment(neighbors);

        this.applyForce(separationForce);
        this.applyForce(cohesionForce);
        this.applyForce(alignmentForce);
        this.updatePosition();
    }

    separation(neighbors){
        var separationForce = {x: 0, y: 0}
        var count = 0;
        for(var i = 0; i < neighbors.length; i++){
            var distance = Math.pow(Math.pow(this.position.x - neighbors[i].position.x, 2) + Math.pow(this.position.y - neighbors[i].position.y, 2), .5);
            if(distance < this.separationDistance){
                var offset = {
                    x: this.position.x - neighbors[i].position.x,
                    y: this.position.y - neighbors[i].position.y,
                }

                var normalizedOffset = vectorUtils.normalize(offset)

                var force = {x:normalizedOffset.x / (distance + .01), y:normalizedOffset.y / (distance + .01)};;

                separationForce.x += force.x;
                separationForce.y += force.y;

                count += 1;
            }
        }
        if(count > 0){
            separationForce.x /= count;
            separationForce.y /= count;

            separationForce.x *= this.separationStrength;
            separationForce.y *= this.separationStrength;
        }

        return separationForce;
    }

    cohesion(neighbors){
        var positionSum = {x: 0, y: 0};

        var count = 0;

        for(var i = 0; i < neighbors.length; i++){
            var distance = Math.pow(Math.pow(this.position.x - neighbors[i].position.x, 2) + Math.pow(this.position.y - neighbors[i].position.y, 2), .5);
            if(distance < this.cohesionDistance){
                positionSum.x += neighbors[i].position.x;
                positionSum.y += neighbors[i].position.y;
                count++;
            }
        }

        var averagePosition;
        if(count > 0 ){
            averagePosition = {x: positionSum.x / count, y: positionSum.y / count};
        }
        else{
            return {x: 0, y:0};
        }

        var displacement = {x: -this.position.x + averagePosition.x, y: -this.position.y + averagePosition.y};

        var distance =  Math.pow(Math.pow(displacement.x, 2) + Math.pow(displacement.y, 2), .5);

        var normalizedDisplacement = vectorUtils.normalize(displacement);

        if(distance < 50){ 
            normalizedDisplacement.x *= distance/50;
            normalizedDisplacement.y *= distance/50;
        }

        var cohesionForce = {x: normalizedDisplacement.x * this.cohesionStrength, y: normalizedDisplacement.y * this.cohesionStrength};

        return cohesionForce;
    }
    alignment(neighbors){
        //  This is the average velocity of all neighbors
        var averageVelocity = {x: 0, y: 0};

        //  Tracks the number of boids within the cohesion distance
        var count = 0;

        for(var i = 0; i < neighbors.length; i++){
            var distance = Math.pow(Math.pow(this.position.x - neighbors[i].position.x, 2) + Math.pow(this.position.y - neighbors[i].position.y, 2), .5);
            if(distance < this.alignmentDistance){
                averageVelocity.x += neighbors[i].velocity.x;
                averageVelocity.y += neighbors[i].velocity.y;
                count++;
            }
        }

        if(count > 0){
            averageVelocity.x /= count;
            averageVelocity.y /= count;
        }

        var alignmentForce = {x: averageVelocity.x * this.alignmentStrength, y: averageVelocity.y * this.alignmentStrength};

        return alignmentForce
    }
    updatePosition(){
        //  Acceleration is change in velocity
        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;

        this.velocity.x = Math.abs(this.velocity.x) > this.maxSpeed ? Math.sign(this.velocity.x) * this.maxSpeed : this.velocity.x;
        this.velocity.y = Math.abs(this.velocity.y) > this.maxSpeed ? Math.sign(this.velocity.y) * this.maxSpeed : this.velocity.y;

        if(this.wrap){
            this.position.x = (this.position.x + this.velocity.x) % this.planeWidth;
            this.position.y = (this.position.y + this.velocity.y) % this.planeHeight;
            if(this.position.x < 0){
                this.position.x = this.planeWidth;
            }
            if(this.position.y < 0){
                this.position.y = this.planeHeight;
            }
        }
        else{
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
        }

        this.acceleration = {x: 0, y: 0};  
    }
}

// Defining the model for a flock
class Flock{
    constructor(flockSize, canvasWidth, canvasHeight, wrap, separationStrength, separationDistance, alignmentStrength, alignmentDistance, cohesionStrength, cohesionDistance){
        this.boids = [];
        this.size = flockSize;

        this._separationStrength = separationStrength;
        this._separationDistance = separationDistance;
        this._alignmentStrength = alignmentStrength;
        this._alignmentDistance = alignmentDistance;
        this._cohesionStrength = cohesionStrength;
        this._cohesionDistance = cohesionDistance;

        this.populateFlock(canvasWidth, canvasHeight, wrap);
        this.neighborDistance = 100;
        this.neighborDistanceSquared = Math.pow(this.neighborDistance, 2);
    }

    set separationStrength(strength){
        if(strength != this._separationStrength){
            this._separationStrength = strength;
            for(var i = 0; i < this.size; i++){
                this.boids[i].separationStrength = strength;
            }
        }
    }

    set separationDistance(distance){
        if(distance != this._separationDistance){
            this._separationDistance = distance;
            for(var i = 0; i < this.size; i++){
                this.boids[i].separationDistance = distance;
            }
        }
    }

    set alignmentStrength(strength){
        if(strength != this._alignmentStrength){
            this._alignmentStrength = strength;
            for(var i = 0; i < this.size; i++){
                this.boids[i].alignmentStrength = strength;
            }
        }
    }

    set alignmentDistance(distance){
        if(distance != this._alignmentDistance){
            this._alignmentDistance = distance;
            for(var i = 0; i < this.size; i++){
                this.boids[i].alignmentDistance = distance;
            }
        }
    }

    set cohesionStrength(strength){
        if(strength != this._cohesionStrength){
            this._cohesionStrength = strength;
            for(var i = 0; i < this.size; i++){
                this.boids[i].cohesionStrength = strength;
            }
        }
    }

    set cohesionDistance(distance){
        if(distance != this._cohesionDistance){
            this._cohesionDistance = distance;
            for(var i = 0; i < this.size; i++){
                this.boids[i].cohesionDistance = distance;
            }
        }
    }

    populateFlock(canvasWidth, canvasHeight, wrap){
        for(var n = 0; n < this.size; n++){

            //  The boids will be created at the center of the graph.
            this.boids.push(new Boid(canvasWidth / 2,canvasHeight / 2, canvasWidth, canvasHeight, wrap, this._separationStrength, this._separationDistance, this._alignmentStrength, this._alignmentDistance, this._cohesionStrength, this._cohesionDistance));

            //  The angle of the boids are evenly distributed in a circle
            var angle = (n / this.size) * 2 * Math.PI;

            //  The velocity is set based on the calculated angle
            this.boids[n].velocity = {x: Math.cos(angle), y: Math.sin(angle)};
        }
    }

    update(){
        for(var i = 0; i < this.size; i++){
            var neighbors = [];
            //  Iterates through all other boids to find neighbors.
            for(var j = 0; j < this.size; j++){
                if(j != i){
                    var squareDistance = Math.pow(this.boids[j].position.x - this.boids[i].position.x, 2) + Math.pow(this.boids[j].position.y - this.boids[i].position.y, 2);
                    if(squareDistance < this.neighborDistanceSquared){
                        neighbors.push(this.boids[j]);
                    }
                }
            }
            this.boids[i].update(neighbors);
        }

    }
}

var drawingUtils = {
    drawTriangle: function(context, PosX, PosY, SideLength, Orientation) {
        context.setTransform(1,0,0,1,PosX,PosY); // Set position
        context.rotate(Orientation);  // set rotation in radians
        context.beginPath();
        var sides = 3;
        var a = ((Math.PI * 2) / sides);
        context.moveTo(SideLength,0);

        context.lineTo(SideLength * Math.cos(a*1), SideLength * Math.sin(a*1));
        context.lineTo((SideLength + 3) * Math.cos(a*3), (SideLength + 3) * Math.sin(a*3))
        context.lineTo(SideLength * Math.cos(a*2), SideLength * Math.sin(a*2));

        context.closePath();
        context.fill()
        context.setTransform(1,0,0,1,0,0);// reset the transform

        return true;
    },
    renderFlock: function(flock, context){
        for(var i = 0; i < flock.size; i++){
            this.renderBoid(flock.boids[i], context);
        }
    },
    renderBoid: function(boid, context){
        //  The drawTriangle function takes a position and a rotation as parameters
        this.drawTriangle(context, boid.position.x, boid.position.y, 5, boid.heading);
    }
}

var testRenderingDisplay = {
    canvas: document.getElementById("rendering-test-display-canvas"),
    context: document.getElementById("rendering-test-display-canvas").getContext('2d'),
    element: document.getElementById("rendering-test-display"),
    restartButton: document.getElementById("rendering-test-display-restart"),
    flock: null,
    restart: function(){
        testRenderingDisplay.flock = new Flock(20, testRenderingDisplay.canvas.width, testRenderingDisplay.canvas.height, false, 0, 0, 0, 0, 0, 0);
    },
    loop: function (){
        this.flock.update();
        this.context.save(); // save the default state
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        drawingUtils.renderFlock(this.flock, this.context);
        this.context.restore();
    },
    initialize: function(){
        this.restartButton.onclick = this.restart;
        this.restart();
    },
    deinitialize: function(){}
}

var testRenderingWrappedDisplay = {
    canvas: document.getElementById("rendering-test-wrapped-display-canvas"),
    context: document.getElementById("rendering-test-wrapped-display-canvas").getContext('2d'),
    element: document.getElementById("rendering-test-wrapped-display"),
    restartButton: document.getElementById("rendering-test-wrapped-display-restart"),
    flock: null,
    restart: function(){
        testRenderingWrappedDisplay.flock = new Flock(20, testRenderingWrappedDisplay.canvas.width, testRenderingWrappedDisplay.canvas.height, true, 0, 0, 0, 0, 0, 0);
    },
    loop: function (){
        this.flock.update();
        this.context.save(); // save the default state
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height, false);
        drawingUtils.renderFlock(this.flock, this.context);
        this.context.restore();
    },
    initialize: function(){
        this.restartButton.onclick = this.restart;
        this.restart();
    },
    deinitialize: function(){}
}

var separationDisplay = {
    canvas: document.getElementById("separation-display-canvas"),
    context: document.getElementById("separation-display-canvas").getContext('2d'),
    element: document.getElementById("separation-display"),
    restartButton: document.getElementById("separation-display-restart"),
    distanceSlider: document.getElementById("separation-display-distance"),
    strengthSlider: document.getElementById("separation-display-strength"),
    flock: null,
    restart: function(){
        separationDisplay.flock = new Flock(30, separationDisplay.canvas.width, separationDisplay.canvas.height, true, 0, 0, 0, 0, 0, 0);
    },
    loop: function (){
        this.flock.separationDistance = this.distanceSlider.value / 1.5;
        this.flock.separationStrength = this.strengthSlider.value / 50;
        this.flock.update();
        this.context.save(); // save the default state
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height, false);
        drawingUtils.renderFlock(this.flock, this.context);
        this.context.restore();
    },
    initialize: function(){
        this.restartButton.onclick = this.restart;
        this.restart();
    },
    deinitialize: function(){}
}

var cohesionDisplay = {
    canvas: document.getElementById("cohesion-display-canvas"),
    context: document.getElementById("cohesion-display-canvas").getContext('2d'),
    element: document.getElementById("cohesion-display"),
    restartButton: document.getElementById("cohesion-display-restart"),
    distanceSlider: document.getElementById("cohesion-display-distance"),
    strengthSlider: document.getElementById("cohesion-display-strength"),
    flock: null,
    restart: function(){
        cohesionDisplay.flock = new Flock(30, cohesionDisplay.canvas.width, cohesionDisplay.canvas.height, true, 0, 0, 0, 0, 0, 0);
    },
    loop: function (){
        this.flock.cohesionDistance = this.distanceSlider.value / 3;
        this.flock.cohesionStrength = this.strengthSlider.value / 1000;
        this.flock.update();
        this.context.save(); // save the default state
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height, false);
        drawingUtils.renderFlock(this.flock, this.context);
        this.context.restore();
    },
    initialize: function(){
        this.restartButton.onclick = this.restart;
        this.restart();
    },
    deinitialize: function(){}
}
var cohesionSeparationDisplay = {
    canvas: document.getElementById("cohesion-separation-display-canvas"),
    context: document.getElementById("cohesion-separation-display-canvas").getContext('2d'),
    element: document.getElementById("cohesion-separation-display"),
    restartButton: document.getElementById("cohesion-separation-display-restart"),
    cohesionDistanceSlider: document.getElementById("cohesion-separation-display-cohesiondistance"),
    cohesionStrengthSlider: document.getElementById("cohesion-separation-display-cohesionstrength"),
    separationDistanceSlider: document.getElementById("cohesion-separation-display-separationdistance"),
    separationStrengthSlider: document.getElementById("cohesion-separation-display-separationstrength"),
    flock: null,
    restart: function(){
        cohesionSeparationDisplay.flock = new Flock(30, cohesionSeparationDisplay.canvas.width, cohesionSeparationDisplay.canvas.height, true, 0, 0, 0, 0, 0, 0);
    },
    loop: function (){
        this.flock.cohesionDistance = this.cohesionDistanceSlider.value;
        this.flock.cohesionStrength = this.cohesionStrengthSlider.value / 400;
        this.flock.separationDistance = this.separationDistanceSlider.value / 1.7;
        this.flock.separationStrength = this.separationStrengthSlider.value / 20;
        this.flock.update();
        this.context.save(); // save the default state
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height, false);
        drawingUtils.renderFlock(this.flock, this.context);
        this.context.restore();
    },
    initialize: function(){
        this.restartButton.onclick = this.restart;
        this.restart();
    },
    deinitialize: function(){}
}
var finalDisplay = {
    canvas: document.getElementById("final-display-canvas"),
    context: document.getElementById("final-display-canvas").getContext('2d'),
    element: document.getElementById("final-display"),
    restartButton: document.getElementById("final-display-restart"),
    cohesionDistanceSlider: document.getElementById("final-display-cohesiondistance"),
    cohesionStrengthSlider: document.getElementById("final-display-cohesionstrength"),
    separationDistanceSlider: document.getElementById("final-display-separationdistance"),
    separationStrengthSlider: document.getElementById("final-display-separationstrength"),
    alignmentDistanceSlider: document.getElementById("final-display-alignmentdistance"),
    alignmentStrengthSlider: document.getElementById("final-display-alignmentstrength"),
    flock: null,
    restart: function(){
        finalDisplay.flock = new Flock(30, finalDisplay.canvas.width, finalDisplay.canvas.height, true, 0, 0, 0, 0, 0, 0);
    },
    loop: function (){
        this.flock.cohesionDistance = this.cohesionDistanceSlider.value;
        this.flock.cohesionStrength = this.cohesionStrengthSlider.value / 400;
        this.flock.separationDistance = this.separationDistanceSlider.value / 1.7;
        this.flock.separationStrength = this.separationStrengthSlider.value / 20;
        this.flock.alignmentDistance = this.alignmentDistanceSlider.value / 2.5;
        this.flock.alignmentStrength = this.alignmentStrengthSlider.value / 1700;
        this.flock.update();
        this.context.save(); // save the default state
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height, false);
        drawingUtils.renderFlock(this.flock, this.context);
        this.context.restore();
    },
    initialize: function(){
        this.restartButton.onclick = this.restart;
        this.restart();
    },
    deinitialize: function(){}
}
codeDisplays.push(testRenderingDisplay);
codeDisplays.push(testRenderingWrappedDisplay);
codeDisplays.push(separationDisplay);
codeDisplays.push(cohesionDisplay);
codeDisplays.push(cohesionSeparationDisplay);
codeDisplays.push(finalDisplay);