import { World, System, Component, Entity, Types, Not } from 'ecsy';
import { Matrix, matrix, zeros, subtract, add, multiply, transpose } from 'mathjs';
import * as math from 'mathjs';

import * as COMP from "./components";
import * as ENTT from "./entities";


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
    const Lap_sub = math.subset(Lap, math.index(math.range(1, nodeNum), math.range(1, nodeNum)));
    const RHS_sub = math.subset(RHS, math.index(math.range(1, nodeNum), 0));

    // Solve the matrix equation
    const reducedVol = math.lusolve(Lap_sub, RHS_sub);
    const nodeVolt = matrix(zeros([nodeNum]));
    nodeVolt.subset(math.index(math.range(1, nodeNum), 0), reducedVol);

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
class Subsystem {
    public slotIDs: number[] = [];
    public slotToNodes: Map<number, number[]> = new Map(); //<slotID, nodeID> 
    public gEdgeIDs: number[] = [];

    //the local matrices
    private inci: Matrix = matrix([]);
    private cond: Matrix = matrix([]);
    private edgeVoltSrc: Matrix = matrix([]);
    private edgeCurrSrc: Matrix = matrix([]);

    //the unknowns
    public nodeVolt: Matrix = matrix([]);
    public edgeCurr: Matrix = matrix([]);
    public edgeVolt: Matrix = matrix([]);

    //the state
    public prevEdgeVolt: Matrix = matrix([]);
    public prevEdgeCurr: Matrix = matrix([]);


    private readonly elementPool: Array<Entity>;
    private readonly nodePool: Array<Entity>;
    constructor(_elements: Array<Entity>, _nodes: Array<Entity>) {
        this.elementPool = _elements;
        this.nodePool = _nodes;
    }

    updateMatrices(delta: number): void {

        const nodeNum = this.slotIDs.length;
        const edgeNum = this.gEdgeIDs.length;

        //console.log("update subSystem: edgeNum: " + edgeNum + " nodeNum: " + nodeNum);

        //clear the matrices 
        this.inci = matrix(zeros([edgeNum, nodeNum]));
        this.cond = matrix(zeros([edgeNum, edgeNum]));
        this.edgeVoltSrc = matrix(zeros([edgeNum, 1]));
        this.edgeCurrSrc = matrix(zeros([edgeNum, 1]));

        //new: if it's first frame, init the previous values
        if (this.prevEdgeVolt.size()[0] == 0) {
            this.prevEdgeVolt = matrix(zeros([edgeNum, 1]));
            this.prevEdgeCurr = matrix(zeros([edgeNum, 1]));
        }

        //iterate over all elements 
        this.gEdgeIDs.forEach(gEdgeID => {

            const entity = this.elementPool[gEdgeID];
            if (!entity) {
                console.error("matrices: entity not found, of id: " + gEdgeID);
                return;
            }
            if (!entity.hasComponent(COMP.CElement)) {
                console.error("access element without CElement component");
                return;
            }
            const cElement = entity.getComponent(COMP.CElement)!;

            const lEdgeID = this.gEdgeIDs.indexOf(gEdgeID);

            const slotL = cElement.nodeL.getComponent(COMP.CNode)!.slotID;
            const slotR = cElement.nodeR.getComponent(COMP.CNode)!.slotID;

            const lNodeIdL = this.slotIDs.indexOf(slotL);
            const lNodeIdR = this.slotIDs.indexOf(slotR);

            this.inci.set([lEdgeID, lNodeIdL], -1);
            this.inci.set([lEdgeID, lNodeIdR], 1);


            //update the conductance matrix
            if (entity.hasComponent(COMP.CResistance)) {
                const impendance = entity.getComponent(COMP.CResistance)!;
                this.cond.set([lEdgeID, lEdgeID], impendance.value);
            }
            else {
                //1/0 be a very large number
                this.cond.set([lEdgeID, lEdgeID], 1.0e+9);
            }

            //update the voltage source vector
            if (entity.hasComponent(COMP.CVoltage)) {
                const voltage = entity.getComponent(COMP.CVoltage)!;
                this.edgeVoltSrc.set([lEdgeID, 0], voltage.value);
            }

            if (entity.hasComponent(COMP.CInductance)) {
                const inductance = entity.getComponent(COMP.CInductance)!;

                //effective resistance/conductance； 
                const C = delta / inductance.value;
                this.cond.set([lEdgeID, lEdgeID], C);

                //effective current source from previous time step;  make sure to add to original current source
                const prevCurr = this.prevEdgeCurr.get([lEdgeID, 0]);
                this.edgeCurrSrc.set([lEdgeID, 0], prevCurr);

            }

            if (entity.hasComponent(COMP.CCapacitance)) {
                const capacitance = entity.getComponent(COMP.CCapacitance)!;

                //effective resistance/conductance； 
                const C = capacitance.value / delta;
                this.cond.set([lEdgeID, lEdgeID], C);

                //effective current source ; from previous time step;  make sure to add to original current source
                const voltSrc = this.prevEdgeVolt.get([lEdgeID, 0]) + this.edgeVoltSrc.get([lEdgeID, 0]);
                this.edgeVoltSrc.set([lEdgeID, 0], voltSrc);

            }

        });


    }

    simulate(): void {

        console.log("incidence: " + this.inci.toString());
        console.log("conductance: " + this.cond.toString());

        const result = solve(this.inci, this.cond, this.edgeVoltSrc, this.edgeCurrSrc);
        this.nodeVolt = result.nodeVolt;
        this.edgeCurr = result.edgeCurr;
        this.edgeVolt = result.edgeVolt;

        //new: set previous values
        this.prevEdgeCurr = this.edgeCurr.clone();
        this.prevEdgeVolt = this.edgeVolt.clone();

        console.log("results node vol: " + this.nodeVolt.toString());
        console.log("results edge cur: " + this.edgeCurr.toString());
        console.log("results edge vol: " + this.edgeVolt.toString());

    }

    handleResults(): void {
        //node voltage  
        this.slotIDs.forEach((slotID, index) => {
            const gNodeIDs = this.slotToNodes.get(slotID)!;

            gNodeIDs.forEach(gNodeID => {
                const eNode = this.nodePool[gNodeID];
                if (!eNode) {
                    console.error("populate: node not found, of id: " + gNodeID);
                    return;
                }

                const cNode = eNode.getMutableComponent(COMP.CNode)!;
                cNode.voltage = this.nodeVolt.get([index, 0]);
            });
        });


        //assign to elements
        this.gEdgeIDs.forEach((gEdgeID, index) => {
            const entity = this.elementPool[gEdgeID];
            if (!entity) {
                console.error("populate: element not found, of id: " + gEdgeID);
                return;
            }
            const cElement = entity.getMutableComponent(COMP.CElement)!;
            cElement.current = this.edgeCurr.get([index, 0]);
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

        //new: assign debugID to elements and nodes
        elements.forEach((element, index) => {
            element.getMutableComponent(COMP.CElement)!.debugID = index;
        });

        nodes.forEach((node, index) => {
            node.getMutableComponent(COMP.CNode)!.debugID = index;
        });

        const size = nodes.length;
        this.parent = Array.from({ length: size }, (_, i) => i);  //initialize with self-parent
        console.log("system node num: " + size);
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
                console.log("register new subsystem, with root: " + rootL);
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


        console.log("subsystem num: " + this.subsystems.size);

    }

}




export class SSimulateSystem extends System {

    //new:
    private systemManager: SystemManager | null = null;

    static queries = {
        //has component CElement but not CPrototype
        elements: {
            components: [COMP.CElement],
            listen: { added: true, removed: true, changed: [COMP.CElement] }
        },
        nodes: {
            components: [COMP.CNode],
            listen: { added: true, removed: true, changed: [COMP.CNode] }
        }
    };

    init(): void {
        console.log("init simulate system");
    }


    execute(delta: number, time: number): void {

        //new: rebuild the system if there's any change; 
        if (this.queries.elements.added!.length > 0 ||
            this.queries.elements.removed!.length > 0 ||
            this.queries.elements.changed!.length > 0 ||
            this.queries.nodes.added!.length > 0 ||
            this.queries.nodes.removed!.length > 0 ||
            this.queries.nodes.changed!.length > 0
        ) {

            this.systemManager = new SystemManager(this.queries.elements.results, this.queries.nodes.results);
            this.systemManager.processSystem();
            this.systemManager.rebuildSubsystems();

            console.log("simulate: rebuild system");
        }

        if (!this.systemManager) {
            //won't trigger the first frame until there's a change
            return;
        }

        // this.showDebugGUI();  
        for (const [key, system] of this.systemManager.subsystems) {

            const edgeNum = system.gEdgeIDs.length;
            const nodeNum = system.slotIDs.length;

            if (edgeNum < 2 || nodeNum < 3) {
                //console.log("subsystem edgeNum: " + edgeNum + " nodeNum: " + nodeNum);
                //console.log("subsystem root: " + key + " not enough edges or nodes to simulate.");
                continue;
            }

            console.log("delta: " + delta);

            system.updateMatrices(delta);
            system.simulate();
            system.handleResults();
        }


        // const test = 0.5e+9 / ((0.5 + 1.0e-9) * 1.0e+9);
        // const testA = math.matrix([[2, -1], [-1, 1]]);
        // const testb = math.matrix([1, 0]);
        // const testx = math.lusolve(testA, testb);
        // console.log("test: " + testx);

        // const testA = math.matrix([[1, -1], [-1, 1]]);
        // const testb = math.matrix([-1, 1]);
        // const testx = math.lusolve(testA, testb);
        // console.log("test: " + testx);

        //const test = math.complex(2, 3);
        //console.log("test: " + test.toString());
        //get its real part
        //console.log("test: " + test.re); 
        //console.log("test: " + test.im);
        //its magnitude
        //console.log("test: " + math.abs(test));
        //its phase
        //console.log("test: " + math.arg(test));

    }




}