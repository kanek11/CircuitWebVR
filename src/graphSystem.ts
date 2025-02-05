import * as THREE from 'three';
import { World, System, Component, Entity, Types } from 'ecsy';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { SRenderSystem } from "./renderSystem";

import { Globals } from "./globals";



//list of stroke style to use:

const strokeStylePool = [
    "#007BFF", //blue
    "#FFC107", //yellow
    "#28A745", //green
    "#DC3545", //red
    "#17A2B8", //cyan
    "#6610F2", //purple 
];



interface ILineState2 {
    yData: number[];
    timeStamps: number[];
    startX: number;
    strokeStyle: string;
    getValue: () => number;
}


export class Graph2 {
    public canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width;
    private height;

    private oX = 0;
    private oY;

    private yRange = 2; //range of y
    private yScale;

    private time = 0;
    private timeScale = 1;
    private interval = 3; //contain 3s of data

    private maxDataPoints; // Limit number of points shown 

    private texture: THREE.Texture | null = null;

    constructor() {

        this.canvas = document.createElement("canvas");

        const options = { willReadFrequently: true };
        this.ctx = this.canvas.getContext('2d', options) as CanvasRenderingContext2D;
        //, { willReadFrequently: true }
        this.ctx.lineWidth = 2;
        // this.ctx.globalCompositeOperation = "source-over"; // 覆盖模式
        // this.ctx.globalAlpha = 1.0; // 不使用透明
        //this.canvas.width = this.width; 

        //for post-scale of the canvas
        // this.canvas.style.width = '50%';
        // this.canvas.style.height = '25%';

        this.canvas.style.backgroundColor = "black";
        this.canvas.style.position = "absolute";
        this.canvas.style.zIndex = "2";

        document.body.appendChild(this.canvas);

        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Canvas context is not available");
        }



        this.width = window.innerWidth * 0.5;
        this.height = window.innerHeight * 0.25;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.oY = this.height / 2;
        this.yScale = this.height / 2 * 1 / this.yRange;
        this.maxDataPoints = Math.floor(this.interval / 0.016);
        // Limit number of points shown, it's ok that the actual delta is not exactly 0.016s


        //console.log("graph: width: ", this.width, "height: ", this.height);


    }


    setYRange(yRange: number): void {
        this.yRange = yRange;
        this.yScale = this.height / 2 * 1 / this.yRange;

        this.clearCanvas();
    }

    setTimeScale(scale: number): void {

        this.timeScale = scale;
        this.maxDataPoints = Math.floor(this.interval / scale / 0.016);

        this.clearCanvas();
        console.log("set time scale: ", scale, "interval: ", this.interval, "maxDataPoints: ", this.maxDataPoints);
    }


    canvasAsTexture(): THREE.Mesh {

        const texture = new THREE.CanvasTexture(this.canvas);
        this.texture = texture;

        const meshMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const geometry = new THREE.PlaneGeometry(1, 1 * this.height / this.width);

        const canvasPlane = new THREE.Mesh(geometry, meshMaterial);

        return canvasPlane;
    }

    clearCanvas(): void {
        //clear the canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(0, 0, this.width, this.height);
    }


    beginDraw(time: number): void {
        //clear the canvas
        this.clearCanvas();

        this.time = time;

        // Draw axes
        this.drawXAxis(this.ctx, this.oY);

        //draw a Y axis at x=0,0.5,1,1.5,2. 
        //derive ticks from range [time-interval, time] that can be divided by 0.5 
        const startX = Math.floor(this.time - this.interval);
        const firstTick = startX + startX % 0.5;
        for (let i = firstTick; i <= this.time; i += 0.5) {
            const x = this.translateX(i);
            this.drawYAxis(this.ctx, x);
            this.drawText(i.toFixed(1), x, this.oY + 20);
        }

        //Y range at right top corner
        this.drawText("max Y: " + this.yRange, this.width - 100, 20);

        //current time step:
        this.drawText("step: " + 0.016 * this.timeScale, this.width - 100, 40);

    }


    drawText(text: string, x: number, y: number): void {
        if (x < 0) {
            return;
        }
        this.ctx.font = "16px Arial";
        this.ctx.fillStyle = "white";
        this.ctx.fillText(text, x, y);
    }



    endDraw(time: number): void {

        if (this.texture) {
            this.texture.needsUpdate = true;
        }

    }


    drawLine(line: ILineState2, y: number, timeStamp: number): void {
        const ctx = this.ctx;
        if (line.yData.length >= this.maxDataPoints) {
            line.yData.shift(); // Remove oldest data point
            line.timeStamps.shift();
            //console.log("shift data: ", line.yData.length);
        }
        line.yData.push(y);
        line.timeStamps.push(timeStamp);

        ctx.strokeStyle = line.strokeStyle;
        ctx.beginPath();
        //draw data from right to left
        for (let i = 0; i < line.yData.length; i++) {
            const y = this.translateY(line.yData[i]);
            const x = this.translateX(line.timeStamps[i]);
            ctx.lineTo(x, y);
            //console.log("draw line: ", x, y);
        }

        ctx.stroke();

    }

    drawLineInfo(text: string, line: ILineState2, index: number): void {
        this.ctx.font = "16px Arial";
        this.ctx.fillStyle = line.strokeStyle;
        this.ctx.fillText(text, 10, 20 + index * 20);
    }



    translateY(y: number): number {
        return y * this.yScale + this.oY;
    }

    translateX(x: number): number {
        // 1 - t-t0 / interval 
        const scr_x = (1 - (this.time - x) / this.interval) * this.width;
        if (scr_x < 0) {
            return -1; //clipped 
        }
        return scr_x;
    }


    drawXAxis(ctx: CanvasRenderingContext2D, y: number): void {

        ctx.lineWidth = 1;
        ctx.strokeStyle = "#aaa";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
    }


    drawYAxis(ctx: CanvasRenderingContext2D, x: number): void {
        //a semi-transparent line
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(170, 170, 170, 0.5)";
        ctx.beginPath();
        ctx.moveTo(x, this.height);
        ctx.lineTo(x, 0);
        ctx.stroke();
    }

}





export class SGraphSystem extends System {
    public graph: Graph2 = new Graph2();

    public lines: Map<string, ILineState2> = new Map();
    private time = 0;

    static queries = {
        // resistors: { components: [COMP.CResistance], listen: { added: true, removed: true, changed: [COMP.CResistance] } },
        // voltages: { components: [COMP.CDCVoltage], listen: { added: true, removed: true, changed: [COMP.CDCVoltage] } },
        // inductors: { components: [COMP.CInductance], listen: { added: true, removed: true, changed: [COMP.CInductance] } },
        // capacitors: { components: [COMP.CCapacitance], listen: { added: true, removed: true, changed: [COMP.CCapacitance] } },

        // elements: {
        //     components: [COMP.CElement, COMP.CTransform],
        //     listen: { added: true, removed: true, changed: [COMP.CTransform] },
        // },
    };

    init(): void {
        console.log("init graph system");
        //this.graph.drawAxies(); 

    }

    execute(delta: number, time: number): void {
        this.time = time;

        // this.queries.capacitors.added!.forEach((entity) => {
        // });

        // this.queries.capacitors.results.forEach((entity) => {
        // });

        this.graph.beginDraw(time);

        Array.from(this.lines.entries()).forEach(([name, line], index) => {
            const y = line.getValue();
            this.graph.drawLine(line, y, time);
            this.graph.drawLineInfo(name, line, index);
            //console.log("draw line: ", name, "y: ", y);
        });
        this.graph.endDraw(time);
    }


    addLine(_name: string, _getValue: () => number): void {
        const id = this.lines.size;

        const line: ILineState2 = {
            yData: [],
            timeStamps: [],
            startX: this.time,
            strokeStyle: strokeStylePool[id % strokeStylePool.length],
            getValue: _getValue,
        };
        this.lines.set(_name, line);
        console.log("add line: ", _name);
    }

    removeLine(_name: string): void {
        this.lines.delete(_name);
        console.log("remove line: ", _name);
    }

    hasMonitored(name: string): boolean {
        return this.lines.has(name);
    }

}