import { World, System, Component, Entity, Types, Not } from 'ecsy';


import { Matrix, matrix, zeros, subtract, add, multiply, transpose } from 'mathjs';
import * as math from 'mathjs';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { SRenderSystem } from "./renderSystem";
import { Globals } from "./globals";


//debug log:
// do not misuse global id and local id; which is used for matrix indexing;
// keep the DC previous state and component state separate; as charge for DC should not be driven by AC;



//by k0 * exp -alpha*d * cos
function estimateMutualInductance(thisEntt: Entity, other: Entity): number {

    const cTransform = thisEntt.getComponent(COMP.CTransform)!;
    const cTransformOther = other.getComponent(COMP.CTransform)!;

    const cElement = thisEntt.getComponent(COMP.CElement)!;
    const cElementOther = other.getComponent(COMP.CElement)!;

    const cInductance = thisEntt.getComponent(COMP.CInductance)!;
    const cInductanceOther = other.getComponent(COMP.CInductance)!;


    //the angle:
    const alpha = math.abs(cTransform.rotation.y - cTransformOther.rotation.y);
    const dist = cTransform.position.distanceTo(cTransformOther.position);


    const k = math.exp(-1 * dist) * math.cos(alpha);
    console.log("estimateMutualInductance: k: " + k + " alpha: " + alpha + " dist: " + dist);
    return k * Math.sqrt(cInductance.inductance * cInductanceOther.inductance);

}













function toTimeDomain(value: math.Complex, freq: number, time: number): number {
    // console.log("toTimeDomain value re: " + value.re, "img: " + value.im);
    if (typeof value === 'number') {
        console.log("toTimeDomain: value type");
        return value;
    }
    const complex_v = multiply(value, math.exp(math.complex(0, freq * time))) as math.Complex;
    return complex_v.re;
}

function toTimeDomainMatrix(inputMat: Matrix, freq: number, time: number): Matrix {

    const outputMat = inputMat.map((value, index) => {
        if (typeof value === 'number') {
            return value;
        }
        else {
            const complex_v = multiply(value as math.Complex, math.exp(math.complex(0, freq * time))) as math.Complex;
            return complex_v.re;
        }
    });
    return outputMat;
}

/**
 *  
 * @param inci 
 * @param cond 
 * @param edgeVoltSrc 
 * @param nodeCurrSrc 
 * @returns 
 */
function solve(inci: Matrix, cond: Matrix, edgeVoltSrc: Matrix, edgeCurrSrc: Matrix): { "nodeVolt": Matrix, "edgeCurr": Matrix, "edgeVolt": Matrix } {
    //check dimensions

    if (inci.size()[0] != cond.size()[0] || inci.size()[0] != edgeVoltSrc.size()[0] || inci.size()[0] != edgeCurrSrc.size()[0]) {
        console.error("solve: matrix dimensions do not match");
        return { "nodeVolt": matrix([]), "edgeCurr": matrix([]), "edgeVolt": matrix([]) };
    }

    const edgeNum = inci.size()[0];
    const nodeNum = inci.size()[1];

    const At = transpose(inci);
    const AtC = multiply(At, cond);

    // Compute A^T * C * A  ; valid dim nodeNum x nodeNum
    const Lap = multiply(AtC, inci);

    // Compute A^T * C * b  ； for right hand side ;  valid dim nodeNum x 1
    const AtCb = multiply(AtC, edgeVoltSrc);

    //compute A^T * I0 ; valid dim nodeNum x 1
    const nodeCurrSrc = multiply(At, edgeCurrSrc);
    const RHS = add(AtCb, nodeCurrSrc);

    //pick ground node, say 0 ; todo: better way? 
    //take sub matrix  ; dim -= 1
    const Lap_sub = math.subset(Lap, math.index(math.range(1, nodeNum), math.range(1, nodeNum))) as Matrix;
    const RHS_sub = math.subset(RHS, math.index(math.range(1, nodeNum), 0)) as Matrix;

    // Solve the matrix equation


    const nodeVolt = matrix(zeros([nodeNum]));
    //if only 2 nodes, matrix is degenerate to scalar/number/complex;  lu solve will report, use simple division;
    // same for subset when it's 1x1, scalar is expected
    if (nodeNum == 2) {
        //simple scalar division
        const reducedVolt = math.divide(RHS_sub, Lap_sub);  //scalar
        nodeVolt.subset(math.index(math.range(1, nodeNum), 0), reducedVolt);
    }
    else {
        const reducedVol = math.lusolve(Lap_sub, RHS_sub);  //matrix
        nodeVolt.subset(math.index(math.range(1, nodeNum), 0), reducedVol);
    }


    //w = C * (b-Au)
    const dV = subtract(edgeVoltSrc, multiply(inci, nodeVolt));
    const edgeCurr = multiply(cond, dV);
    //new: add up source current; 
    const correctedEdgeCurr = add(edgeCurr, edgeCurrSrc);

    const edgeVolt = multiply(inci, nodeVolt);

    return { "nodeVolt": nodeVolt, "edgeCurr": correctedEdgeCurr, "edgeVolt": edgeVolt };

}



/**
 * nodeNum here = logical nodes;
 * l prefix = local
 * g prefix = global
 */


class Result {
    public nodeVolt: Matrix = matrix([]);
    public edgeCurr: Matrix = matrix([]);
    public edgeVolt: Matrix = matrix([]);

    clear(nodeNum: number, edgeNum: number): void {
        this.nodeVolt = matrix(zeros([nodeNum, 1]));
        this.edgeCurr = matrix(zeros([edgeNum, 1]));
        this.edgeVolt = matrix(zeros([edgeNum, 1]));
    }
}


class Subsystem {
    public slotIDs: number[] = [];
    public slotToNodes: Map<number, number[]> = new Map(); //<slotID, nodeID> 
    public gEdgeIDs: number[] = [];

    //new:
    public shorted: boolean = false;

    //
    private ACMap: Map<number, number[]> = new Map(); //<frequency, edgeID> 
    //the local matrices
    private inci: Matrix = matrix([]);
    private cond: Matrix = matrix([]);
    private edgeVoltSrc: Matrix = matrix([]);
    private edgeCurrSrc: Matrix = matrix([]);

    //the unknowns
    public DCResult: Result = new Result();
    public ACResults: Map<number, Result> = new Map(); //<frequency, result>
    public finalResult: Result = new Result();

    //the state for DC simulation;  turns out charge is more powerful as stage;
    //public prevEdgeVolt: Matrix = matrix([]);
    public prevEdgeCharge: Matrix = matrix([]);
    public prevEdgeCurr: Matrix = matrix([]);


    private readonly elementPool: Array<Entity>;
    private readonly nodePool: Array<Entity>;
    constructor(_elements: Array<Entity>, _nodes: Array<Entity>) {
        this.elementPool = _elements;
        this.nodePool = _nodes;

        //warn: nothing useful on construction, the data is filled in later
    }


    init(): void {
        const nodeNum = this.slotIDs.length;
        const edgeNum = this.gEdgeIDs.length;
        //console.log("subsystem init: nodeNum: " + nodeNum + " edgeNum: " + edgeNum);

        //init the matrices 
        this.inci = matrix(zeros([edgeNum, nodeNum]));
        this.cond = matrix(zeros([edgeNum, edgeNum]));
        this.edgeCurrSrc = matrix(zeros([edgeNum, 1]));
        this.edgeVoltSrc = matrix(zeros([edgeNum, 1]));

        //new: previous state should be set from L,C elements
        //this.prevEdgeCurr = matrix(zeros([edgeNum, 1]));
        //this.prevEdgeVolt = matrix(zeros([edgeNum, 1]));
        //this.prevEdgeCharge = matrix(zeros([edgeNum, 1]));

        //new: subsystem now need to know the AC sources and solver per frequency;
        this.gEdgeIDs.forEach(gEdgeId => {
            const entity = this.elementPool[gEdgeId];
            if (!entity || !entity.hasComponent(COMP.CElement)) {
                console.error("subsystem init: invalid entity id" + gEdgeId);
                return;
            }

            if (entity.hasComponent(COMP.CCapacitance)) {
                const cCapacitance = entity.getComponent(COMP.CCapacitance)!;

                const lEdgeID = this.gEdgeIDs.indexOf(gEdgeId);
                this.prevEdgeCharge.set([lEdgeID, 0], cCapacitance.charge);

                //console.log("subsystem init: id " + gEdgeId + " charge: " + cCapacitance.charge);
            }

            if (entity.hasComponent(COMP.CInductance)) {
                const cElement = entity.getComponent(COMP.CElement)!;

                const lEdgeID = this.gEdgeIDs.indexOf(gEdgeId);
                this.prevEdgeCurr.set([lEdgeID, 0], cElement.current);
            }

            if (entity.hasComponent(COMP.CACVoltage)) {
                const acVoltage = entity.getComponent(COMP.CACVoltage)!;
                if (!this.ACMap.has(acVoltage.freq)) {
                    this.ACMap.set(acVoltage.freq, []);
                }
                this.ACMap.get(acVoltage.freq)!.push(gEdgeId);
            }
        });

        // console.log("subsystem init: collected AC sources: ");
        // this.ACMap.forEach((value, key) => {
        //     console.log("freq: " + key + " edgeIDs: " + value);
        // });  

        this.DCResult.clear(nodeNum, edgeNum);

        //set the AC results
        this.ACMap.forEach((value, key) => {
            const result = new Result();
            this.ACResults.set(key, result);
            result.clear(nodeNum, edgeNum);
        });



    }

    executeAC(): void {
        const edgeNum = this.gEdgeIDs.length;
        const nodeNum = this.slotIDs.length;

        for (const [freq, edgeIDs] of this.ACMap) {
            // console.log("subsystem: simulate AC at freq: " + freq);
            this.updateMatricesAC(freq, edgeIDs);
            this.simulateAC(freq);
            //this.handleResultsAC(freq, time);
        }

    }

    //todo : handle when it's less than 2 elements;
    //new: we need centralize the update logic here;
    update(delta: number, time: number): void {

        const edgeNum = this.gEdgeIDs.length;
        const nodeNum = this.slotIDs.length;

        //new: clear the final result
        this.finalResult.clear(nodeNum, edgeNum);

        //
        this.updateMatricesDC(delta);
        this.simulateDC();
        this.processResultsDC();

        for (const [freq, edgeIDs] of this.ACMap) {
            this.processResultsAC(time);
        }

        this.processFinalResult();
    }


    updateMatricesDC(delta: number): void {

        //clear the matrices
        const nodeNum = this.slotIDs.length;
        const edgeNum = this.gEdgeIDs.length;
        this.inci = matrix(zeros([edgeNum, nodeNum]));
        this.cond = matrix(zeros([edgeNum, edgeNum]));
        this.edgeCurrSrc = matrix(zeros([edgeNum, 1]));
        this.edgeVoltSrc = matrix(zeros([edgeNum, 1]));

        // console.log("subsystem update: node num: " + nodeNum + " edge num: " + edgeNum);
        // console.log("prev charge: " + this.prevEdgeCharge.toString());


        //iterate over all elements 
        this.gEdgeIDs.forEach(gEdgeID => {

            const entity = this.elementPool[gEdgeID];
            if (!entity || !entity.hasComponent(COMP.CElement)) {
                console.error("subsystem: invalid entity");
                return;
            }

            const cElement = entity.getMutableComponent(COMP.CElement)!;

            const lEdgeID = this.gEdgeIDs.indexOf(gEdgeID);

            const slotL = cElement.nodeL.getComponent(COMP.CNode)!.slotID;
            const slotR = cElement.nodeR.getComponent(COMP.CNode)!.slotID;

            const lNodeIdL = this.slotIDs.indexOf(slotL);
            const lNodeIdR = this.slotIDs.indexOf(slotR);

            //[-1,1]  R out , L in
            this.inci.set([lEdgeID, lNodeIdR], -1);
            this.inci.set([lEdgeID, lNodeIdL], 1);

            //update the voltage source vector
            if (entity.hasComponent(COMP.CDCVoltage)) {
                let voltSrc = entity.getComponent(COMP.CDCVoltage)!.voltage;
                voltSrc += this.edgeVoltSrc.get([lEdgeID, 0]);
                this.edgeVoltSrc.set([lEdgeID, 0], voltSrc);
            }

            //update the conductance matrix
            if (entity.hasComponent(COMP.CResistance)) {
                const resistance = entity.getComponent(COMP.CResistance)!.resistance;
                this.cond.set([lEdgeID, lEdgeID], 1 / resistance);
            }
            else {
                //for now,every element that do not define own resistance is considered to have a minimum resistance;
                //warn: C, L overwrites this;
                this.cond.set([lEdgeID, lEdgeID], 1.0e+9);
            }

            if (entity.hasComponent(COMP.CCapacitance)) {
                const cCapacitance = entity.getComponent(COMP.CCapacitance)!;

                const C = cCapacitance.capacitance / delta;
                this.cond.set([lEdgeID, lEdgeID], C);

                //effective current source ; from previous time step;    
                //in cases where the capacitance changes, dV also changes; but charge is conserved;
                let prevCharge = this.prevEdgeCharge.get([lEdgeID, 0]);
                let voltSrc = prevCharge / cCapacitance.capacitance;   //V=Q/C
                voltSrc += this.edgeVoltSrc.get([lEdgeID, 0]);
                this.edgeVoltSrc.set([lEdgeID, 0], voltSrc);

                //console.log("subsystem update: id " + gEdgeID + " charge: " + prevCharge + " volt: " + voltSrc);
            }



            if (entity.hasComponent(COMP.CInductance)) {
                const inductance = entity.getComponent(COMP.CInductance)!.inductance;

                //effective resistance/conductance； 
                const C = delta / inductance;
                this.cond.set([lEdgeID, lEdgeID], C);


                let currSrc = this.prevEdgeCurr.get([lEdgeID, 0]);
                currSrc += this.edgeCurrSrc.get([lEdgeID, 0]);
                this.edgeCurrSrc.set([lEdgeID, 0], currSrc);

            }

        });


    }

    simulateDC(): void {

        const result = solve(this.inci, this.cond, this.edgeVoltSrc, this.edgeCurrSrc);
        this.DCResult.nodeVolt = result.nodeVolt;
        this.DCResult.edgeCurr = result.edgeCurr;
        this.DCResult.edgeVolt = result.edgeVolt;

        // console.log("incidence: " + this.inci.toString());
        // console.log("conductance: " + this.cond.toString());
        // console.log("results node vol: " + this.nodeVolt.toString());
        // console.log("results edge cur: " + this.edgeCurr.toString());
        // console.log("results edge vol: " + this.edgeVolt.toString()); 
    }

    processResultsDC(): void {

        //add to final result
        this.finalResult.nodeVolt = add(this.finalResult.nodeVolt, this.DCResult.nodeVolt);
        this.finalResult.edgeCurr = add(this.finalResult.edgeCurr, this.DCResult.edgeCurr);
        this.finalResult.edgeVolt = add(this.finalResult.edgeVolt, this.DCResult.edgeVolt);

        this.prevEdgeCurr = this.DCResult.edgeCurr;
        //this.prevEdgeVolt = this.edgeVolt_DC; 

        //new : store the state of capacitor
        this.gEdgeIDs.forEach((gEdgeID, index) => {
            const entity = this.elementPool[gEdgeID];
            if (!entity || !entity.hasComponent(COMP.CElement)) {
                console.error("subsystem: invalid entity id: " + gEdgeID);
                return;
            }

            const current = this.DCResult.edgeCurr.get([index, 0]);
            if (current > 1.0e+6) {
                this.shorted = true;
            }

            if (entity.hasComponent(COMP.CCapacitance)) {
                const cCapacitance = entity.getComponent(COMP.CCapacitance)!;
                //Q = C * V
                const V = this.DCResult.edgeVolt.get([index, 0]);
                this.prevEdgeCharge.set([index, 0], cCapacitance.capacitance * V);
            }
        });
    }


    updateMatricesAC(freq: number, ACSrcs: Array<number>): void {

        //clear the matrices
        const nodeNum = this.slotIDs.length;
        const edgeNum = this.gEdgeIDs.length;
        this.inci = matrix(zeros([edgeNum, nodeNum]));
        this.cond = matrix(zeros([edgeNum, edgeNum]));


        //impedence of AC source is its amplitude
        ACSrcs.forEach(gEdgeID => {
            const entity = this.elementPool[gEdgeID];
            if (!entity || !entity.hasComponent(COMP.CElement)) {
                console.error("subsystem: invalid entity id: " + gEdgeID);
                return;
            }

            const cACVoltage = entity.getComponent(COMP.CACVoltage)!;

            const lEdgeID = this.gEdgeIDs.indexOf(gEdgeID);
            //update the voltage source vector
            this.edgeVoltSrc.set([lEdgeID, 0], math.complex(cACVoltage.amp, 0));
        });



        //iterate over all elements 
        this.gEdgeIDs.forEach(gEdgeID => {

            const entity = this.elementPool[gEdgeID];
            if (!entity || !entity.hasComponent(COMP.CElement)) {
                console.error("subsystem: invalid entity id: " + gEdgeID);
                return;
            }

            const cElement = entity.getMutableComponent(COMP.CElement)!;

            const lEdgeID = this.gEdgeIDs.indexOf(gEdgeID);

            const slotL = cElement.nodeL.getComponent(COMP.CNode)!.slotID;
            const slotR = cElement.nodeR.getComponent(COMP.CNode)!.slotID;

            const lNodeIdL = this.slotIDs.indexOf(slotL);
            const lNodeIdR = this.slotIDs.indexOf(slotR);

            //[-1,1]  R out , L in
            this.inci.set([lEdgeID, lNodeIdR], -1);
            this.inci.set([lEdgeID, lNodeIdL], 1);


            //update the conductance matrix
            if (entity.hasComponent(COMP.CResistance)) {
                const resistance = entity.getComponent(COMP.CResistance)!.resistance;
                const C = math.complex(1 / resistance, 0);
                this.cond.set([lEdgeID, lEdgeID], C);
            }
            else {
                //for now,every element that do not define own resistance is considered to have a minimum resistance
                this.cond.set([lEdgeID, lEdgeID], math.complex(1.0e+9, 0));
            }

            if (entity.hasComponent(COMP.CCapacitance)) {
                const cCapacitance = entity.getComponent(COMP.CCapacitance)!;

                //z=1/jwC , 1/z = jwC
                const C = math.complex(0, freq * cCapacitance.capacitance);
                this.cond.set([lEdgeID, lEdgeID], C);
            }

            if (entity.hasComponent(COMP.CInductance)) {
                const inductance = entity.getComponent(COMP.CInductance)!.inductance;

                //impendence of inductor : z=jwL， 1/z = -j/wL
                const C = math.complex(0, -1 / (freq * inductance));
                this.cond.set([lEdgeID, lEdgeID], C);

            }

        });


    }

    simulateAC(freq: number): void {

        const result = solve(this.inci, this.cond, this.edgeVoltSrc, this.edgeCurrSrc);

        const ACResult = this.ACResults.get(freq)!;
        ACResult.nodeVolt = result.nodeVolt;
        ACResult.edgeCurr = result.edgeCurr;
        ACResult.edgeVolt = result.edgeVolt;

        // console.log("incidence: " + this.inci.toString());
        // console.log("conductance: " + this.cond.toString());
        // console.log("results node vol: " + this.nodeVolt.toString());
        // console.log("results edge cur: " + this.edgeCurr.toString());
        // console.log("results edge vol: " + this.edgeVolt.toString());
    }


    processResultsAC(time: number): void {

        //time_domain = sum( freq_response * exp(jwt))  

        for (const [freq, result] of this.ACResults) {

            this.finalResult.nodeVolt = add(this.finalResult.nodeVolt, toTimeDomainMatrix(result.nodeVolt, freq, time));
            this.finalResult.edgeCurr = add(this.finalResult.edgeCurr, toTimeDomainMatrix(result.edgeCurr, freq, time));
            this.finalResult.edgeVolt = add(this.finalResult.edgeVolt, toTimeDomainMatrix(result.edgeVolt, freq, time));

        }
    }


    processFinalResult(): void {

        this.slotIDs.forEach((slotID, index) => {
            const gNodeIDs = this.slotToNodes.get(slotID)!;

            gNodeIDs.forEach(gNodeID => {
                const eNode = this.nodePool[gNodeID];
                if (!eNode || !eNode.hasComponent(COMP.CNode)) {
                    console.error("subsystem: invalid node id: " + gNodeID);
                    return;
                }

                const cNode = eNode.getMutableComponent(COMP.CNodeSim)!;
                cNode.voltage = this.finalResult.nodeVolt.get([index, 0]);

            });

        });


        this.gEdgeIDs.forEach((gEdgeID, index) => {
            const entity = this.elementPool[gEdgeID];
            if (!entity || !entity.alive || !entity.hasComponent(COMP.CElement)) {
                console.error("subsystem: invalid entity id: " + gEdgeID);
                return;
            }

            const cElement = entity.getMutableComponent(COMP.CElement)!;
            cElement.current = this.finalResult.edgeCurr.get([index, 0]);
            cElement.voltage = this.finalResult.edgeVolt.get([index, 0]);
        });


    }


}



class SystemManager {

    private parent: number[];
    private slotMap: Map<number, number> = new Map();  //<registered slotID, root node index> 
    public subsystems: Map<number, Subsystem> = new Map();

    private readonly elementPool: Array<Entity>;
    private readonly nodePool: Array<Entity>;

    constructor(elements: Array<Entity>, nodes: Array<Entity>) {
        this.elementPool = elements;
        this.nodePool = nodes;


        const size = nodes.length;
        this.parent = Array.from({ length: size }, (_, i) => i);  //initialize with self-parent
        //console.log("simulate: system node num: " + size);
    }


    find(a: number): number {
        if (this.parent[a] != a) {
            this.parent[a] = this.find(this.parent[a]);
        }
        return this.parent[a];
    }

    union(a: number, b: number): void {
        const rootA = this.find(a);
        const rootB = this.find(b);
        this.parent[rootA] = rootB;
    }

    clear(): void {
        this.parent = Array.from({ length: this.parent.length }, (_, i) => i);
        this.slotMap.clear();
        this.subsystems.clear();
    }


    processSystem(): void {

        this.elementPool.forEach(entity => {
            const element = entity.getComponent(COMP.CElement)!;

            const eNodeL = element.nodeL;
            const eNodeR = element.nodeR;

            const gNodeIdL = this.nodePool.indexOf(eNodeL);
            const gNodeIdR = this.nodePool.indexOf(eNodeR);

            const cNodeL = eNodeL.getComponent(COMP.CNode)!;
            const cNodeR = eNodeR.getComponent(COMP.CNode)!;

            if (cNodeL.slotID == COMP.INVALID_SLOT || cNodeR.slotID == COMP.INVALID_SLOT) {
                console.warn("systemmanager: invalid slot ids");
                return;
            }

            //first connect the two nodes 
            this.union(gNodeIdL, gNodeIdR);

            //union based on slots
            if (!this.slotMap.has(cNodeL.slotID)) {
                this.slotMap.set(cNodeL.slotID, this.find(gNodeIdL));
                //console.log("add new slot: " + cNodeL.slotID + " with root: " + this.find(gNodeIdL));
            }
            else {
                this.union(this.slotMap.get(cNodeL.slotID)!, gNodeIdL);
                //console.log("overlap slots, union: " + this.slotMap.get(cNodeL.slotID) + " with " + gNodeIdL); 
            }

            if (!this.slotMap.has(cNodeR.slotID)) {
                this.slotMap.set(cNodeR.slotID, this.find(gNodeIdR));
                //console.log("add new slot: " + cNodeR.slotID + " with root: " + this.find(gNodeIdR));
            }
            else {
                this.union(this.slotMap.get(cNodeR.slotID)!, gNodeIdR);
                //console.log("overlap slots, union: " + this.slotMap.get(cNodeR.slotID) + " with " + gNodeIdR); 
            }

        });

        //console.log("systemmanager: registered slots: " + this.slotMap.size);

    }


    rebuildSubsystems() {

        this.elementPool.forEach(element => {
            const cElement = element.getComponent(COMP.CElement)!;
            const elementID = this.elementPool.indexOf(element);

            const eNodeL = cElement.nodeL;
            const eNodeR = cElement.nodeR;

            const rootL = this.find(this.nodePool.indexOf(eNodeL));
            const rootR = this.find(this.nodePool.indexOf(eNodeR));

            if (rootL != rootR) {
                console.error("subsystem: unexpected behavior: rootL is not rootR");
                return;
            }

            if (!this.subsystems.has(rootL)) {
                this.subsystems.set(rootL, new Subsystem(this.elementPool, this.nodePool));
                //console.log("register new subsystem, with root: " + rootL);
            }
            const subsystem = this.subsystems.get(rootL)!;

            const _slotL = eNodeL.getComponent(COMP.CNode)!.slotID;
            const _slotR = eNodeR.getComponent(COMP.CNode)!.slotID;

            const gNodeIdL = this.nodePool.indexOf(eNodeL);
            const gNodeIdR = this.nodePool.indexOf(eNodeR);

            if (!subsystem.slotIDs.includes(_slotL)) {
                subsystem.slotIDs.push(_slotL);
                subsystem.slotToNodes.set(_slotL, []);
            }
            subsystem.slotToNodes.get(_slotL)!.push(gNodeIdL);

            if (!subsystem.slotIDs.includes(_slotR)) {
                subsystem.slotIDs.push(_slotR);
                subsystem.slotToNodes.set(_slotR, []);
            }
            subsystem.slotToNodes.get(_slotR)!.push(gNodeIdR);

            subsystem.gEdgeIDs.push(elementID);
        });

        //console.log("simulate: subsystem num: " + this.subsystems.size);

    }

}




export class SSimulateSystem extends System {
    //new:
    public systemManager: SystemManager | null = null;
    public running: boolean = true;



    public renderSystemRef: SRenderSystem | null = null;

    static queries = {
        nodes: { components: [COMP.CNode, COMP.CTransform], listen: { added: true, removed: true, changed: [COMP.CNode] } },

        elements: { components: [COMP.CElement, COMP.CTransform], listen: { added: true, removed: true, changed: [COMP.CTransform] } },

        resistors: { components: [COMP.CResistance], listen: { added: true, removed: true, changed: [COMP.CResistance] } },
        inductors: { components: [COMP.CInductance], listen: { added: true, removed: true, changed: [COMP.CInductance] } },
        capacitors: { components: [COMP.CCapacitance], listen: { added: true, removed: true, changed: [COMP.CCapacitance] } },

        DCVoltages: { components: [COMP.CDCVoltage], listen: { added: true, removed: true, changed: [COMP.CDCVoltage] } },
        ACVoltages: { components: [COMP.CACVoltage], listen: { added: true, removed: true, changed: [COMP.CACVoltage] } },


    };

    init(): void {
        console.log("init simulate system");

        this.renderSystemRef = this.world.getSystem(SRenderSystem);
    }


    isTopoChanged(): boolean {

        const changed =
            this.queries.nodes.added!.length > 0 ||
            this.queries.nodes.removed!.length > 0 ||
            this.queries.nodes.changed!.length > 0;


        return changed;
    }

    getAllElements(): Array<Entity> {
        return this.queries.elements.results;
    }

    isACSrcChanged(): boolean {

        const changed =
            this.queries.ACVoltages.changed!.length > 0;

        return changed;
    }


    execute(delta: number, time: number): void {
        //new: rebuild the system if there's any change; 
        if (this.isTopoChanged()) {

            this.systemManager = new SystemManager(this.queries.elements.results, this.queries.nodes.results);
            this.systemManager.processSystem();
            this.systemManager.rebuildSubsystems();

            //validate the system
            const elementNum = this.queries.elements.results.length;
            const nodeNum = this.queries.nodes.results.length;

            // console.warn("simulate at:" + time, "topo changed: rebuild subsystems");
            // console.log("total element num: " + elementNum + " total node num: " + nodeNum);

            this.systemManager.subsystems.forEach(subsystem => {

                const elementNum = subsystem.gEdgeIDs.length;
                const nodeNum = subsystem.slotIDs.length;
                if (elementNum < 1 || nodeNum < 2) {
                    console.error("simulate validate: invalid subsystem: element num: " + elementNum + " node num: " + nodeNum);
                    return;
                }

                subsystem.init();
                subsystem.executeAC();

            });
        }

        if (this.systemManager && this.isACSrcChanged()) {
            //new: init the subsystems
            this.systemManager.subsystems.forEach(subsystem => {
                subsystem.executeAC();
                console.log("simulate: rebuild AC");
            });
        }

        let bShorted = false;
        if (this.systemManager && this.running) {
            // this.showDebugGUI();  
            for (const [key, system] of this.systemManager.subsystems) {
                //console.log("simuate: execute delta: " + delta); 
                system.update(delta, time);

                if (system.shorted) {
                    bShorted = true;
                }

            }
        }

        //new: if shorted, stop simulation
        if (bShorted) {
            this.renderSystemRef!.updateMessage("Shorted!");
        }
        else {
            this.renderSystemRef!.updateMessage("");
        }
    }

}


