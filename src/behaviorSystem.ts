import * as THREE from 'three';
import { World, System, Component, Entity, Types } from 'ecsy';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { SRenderSystem } from './renderSystem';
import { SSimulateSystem } from './simulateSystem';

import * as Field from "./field";

import { Globals, RenderMode } from "./globals";
import { abs } from 'mathjs';

export function colorMap(value: number, min: number, max: number): THREE.Color {
    const alpha = (value - min) / (max - min);
    const t = Math.max(0, Math.min(1, alpha));

    const minColor = Globals.baseColor;
    const maxColor = Globals.conductColor;
    const result = minColor.clone().lerp(maxColor, t);
    return result;
}

/**
 * additional behavior for elements, 
 * eg: 
 * response to changes,
 * auxillary information such as field lines, models
 */

export class SElementBehaviorSystem extends System {

    static queries = {

        elements: { components: [COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CElement] } },
        nodes: { components: [COMP.CNode, COMP.CNodeSim], listen: { added: true, removed: true, changed: [COMP.CNodeSim] } },

        resistors: { components: [COMP.CResistance, COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CResistance] } },
        inductors: { components: [COMP.CInductance, COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CInductance] } },
        capacitors: { components: [COMP.CCapacitance, COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CCapacitance] } },

        DCVoltages: { components: [COMP.CDCVoltage, COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CDCVoltage] } },
        ACVoltages: { components: [COMP.CACVoltage, COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CACVoltage] } },

    };

    init(): void {
        console.log("init element behavior system");
    }

    onHeightOff() {
        this.queries.nodes.results.forEach(entity => {
            const cNode = entity.getComponent(COMP.CNode)!;
            const cElement = cNode.element;

            ENTT.OnNodesChange(cElement);
        });
    }

    onHeightOn() {

        this.queries.nodes.results.forEach(entity => {
            const cNode = entity.getComponent(COMP.CNode)!;
            const cElement = cNode.element;

            ENTT.OnNodesChange(cElement);
        });
    }

    execute(delta: number, time: number): void {

        const scene = this.world.getSystem(SRenderSystem).scene;


        if (Globals.heightByPotential) {
            this.queries.nodes.changed!.forEach(entity => {

                const cNode = entity.getComponent(COMP.CNode)!;
                const cElement = cNode.element;

                ENTT.OnNodesChange(cElement);

                //console.log("trigger node changed: " + entity.id);
            });
        }



        this.queries.inductors.added!.forEach(entity => {

            const field = new Field.BField(scene);

            const cInductance = entity.getMutableComponent(COMP.CInductance)!;
            cInductance.field = field;

            const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
            group.add(field.fieldGroup);
            group.add(field.arrowGroup);

            const coilMesh = group.getObjectByName("coil") as THREE.Mesh;

            //todo: make it more systematic
            field.fieldGroup.rotation.y = Math.PI / 2;
            field.fieldGroup.position.y = coilMesh.position.y;

            field.arrowGroup.rotation.y = Math.PI / 2;
            field.arrowGroup.position.y = coilMesh.position.y;

        });

        this.queries.capacitors.added!.forEach(entity => {

            //new: add field
            const field = new Field.EField(entity, scene);
            const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
            group.add(field.fieldGroup);
            group.add(field.arrowGroup);

            const cCapacitance = entity.getMutableComponent(COMP.CCapacitance)!;
            cCapacitance.field = field;
        });




        this.queries.resistors.results.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive");
                return;
            }

            const cResistance = entity.getMutableComponent(COMP.CResistance)!;
            const cElement = entity.getMutableComponent(COMP.CElement)!;

            cResistance.updateHeat(cElement.current, delta);

        });


        this.queries.DCVoltages.results.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive: " + entity.id + "/time: " + time);
                return;
            }

            // console.log("update DC voltage model");
            ENTT.syncDCVoltageModel(entity, true);
        });



        this.queries.inductors.results.forEach(entity => {
            if (!entity.alive) {
                console.log("entity is not alive");
                return;
            }
            const cInductance = entity.getMutableComponent(COMP.CInductance)!;
            const cElement = entity.getMutableComponent(COMP.CElement)!;
            cElement.elementSize = cInductance.length;

            //state 
            cInductance.updateInductance();
            cInductance.updateEnergy(cElement.current);

            //model
            ENTT.syncInductanceModel(entity, true);

            //the field:
            const field = cInductance.field!;
            field.update(entity);

        });


        this.queries.capacitors.results.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive: " + entity.id + "/time: " + time);
                return;
            }

            const cCapacitor = entity.getMutableComponent(COMP.CCapacitance)!;
            const cElement = entity.getMutableComponent(COMP.CElement)!;
            cElement.elementSize = cCapacitor.spacing;

            const voltage = cElement.voltage;

            cCapacitor.updateCapacitance();
            cCapacitor.updateCharge(voltage);
            cCapacitor.updateEnergy(voltage);

            //model
            ENTT.syncCapacitorModel(entity, true);

            //new: adjust the field lines
            const fields = cCapacitor.field!;
            fields.update(entity);
        });



    }

}







/**
 * basic implementation of reusable particle pool
 * use the visibility flag to indicate availability ;
 */
class particlePool {
    private particlePool: THREE.Mesh[] = [];
    private arrowPool: THREE.Mesh[] = [];

    constructor(size: number) {
        this.expandPool(size);
    }

    expandPool(size: number) {
        const geometry = new THREE.SphereGeometry(Globals.currentSize, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: Globals.currentColor, depthTest: false, depthWrite: false });

        for (let i = 0; i < size; i++) {

            {
                const particle = new Field.Arrow().mesh;
                particle.name = "arrow" + i;
                particle.scale.copy(Globals.arrowSize);

                //application needs
                particle.renderOrder = Globals.currentRenderOrder;
                particle.material.depthTest = false;
                particle.material.depthWrite = false;

                particle.userData.isFree = true;
                this.arrowPool.push(particle);
            }
            {
                const particle = new THREE.Mesh(geometry, material);
                particle.name = "particle" + i;

                //application needs
                particle.renderOrder = Globals.currentRenderOrder;
                particle.material.depthTest = false;
                particle.material.depthWrite = false;


                particle.userData.isFree = true;
                this.particlePool.push(particle);
            }

        }
    }



    getParticle(mode: RenderMode = Globals.renderMode): THREE.Mesh {

        let pool: THREE.Mesh[];
        if (mode === 'arrow') {
            pool = this.arrowPool;
        }
        else {
            pool = this.particlePool;
        }

        for (const particle of pool) {
            if (particle.userData.isFree) {
                particle.userData.isFree = false;
                return particle;
            }
        }
        console.warn("pool: expand pool : " + pool.length);
        this.expandPool(100);
        return this.getParticle(mode);
    }


    releaseGroup(group: THREE.Group) {
        // console.log("current pool size: " + this.particlePool.length);
        // console.log("to release group size: " + group.children.length);

        group.children.forEach((child) => {
            child.userData.isFree = true;
            child.position.set(0, 0, 0);
        });
        group.clear();

    }

}


export class SCurrentRenderSystem extends System {
    public running = true;

    private spacing = 0.05;
    private speedScale = 0.02;

    private particlePool = new particlePool(Globals.particlePoolSize);

    private groupMap: Map<number, THREE.Group> = new Map(); //<id, group>

    static queries = {

        resistors: { components: [COMP.CResistance], listen: { added: true, removed: true, changed: [COMP.CResistance] } },
        voltages: { components: [COMP.CDCVoltage], listen: { added: true, removed: true, changed: [COMP.CDCVoltage] } },
        ACVoltages: { components: [COMP.CACVoltage], listen: { added: true, removed: true, changed: [COMP.CACVoltage] } },
        inductors: { components: [COMP.CInductance], listen: { added: true, removed: true, changed: [COMP.CInductance] } },
        capacitors: { components: [COMP.CCapacitance], listen: { added: true, removed: true, changed: [COMP.CCapacitance] } },

        elements: { components: [COMP.CElement, COMP.CTransform], listen: { added: true, removed: true, changed: [COMP.CTransform] } },
        nodes: { components: [COMP.CNode], listen: { added: true, removed: true, changed: [COMP.CNode] } },
    };



    onModeChange(mode: RenderMode) {
        //dump old particles
        this.queries.elements.results.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive");
                return;
            }

            const cObject = entity.getComponent(COMP.CObject3D)!;
            const particles = cObject.group.getObjectByName("particleGroup") as THREE.Group;
            if (particles) { this.particlePool.releaseGroup(particles); }

            this.spawnParticles(entity, particles);
        });
    }

    init(): void {
        console.log("init current render system");

    }

    execute(delta: number, time: number): void {
        //console.log("current render system");   

        this.queries.elements.added!.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive: " + entity.id + "/time: " + time);
                return;
            }
            const particles = new THREE.Group();
            particles.name = "particleGroup";

            const cObject = entity.getComponent(COMP.CObject3D)!;
            cObject.group.add(particles);
            this.groupMap.set(entity.id, particles);

            this.spawnParticles(entity, particles);

        });

        this.queries.elements.removed!.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive: " + entity.id + "/time: " + time);
                return;
            }

            console.log("remove particles: id=" + entity.id);
            const group = this.groupMap.get(entity.id);
            if (group) {
                this.particlePool.releaseGroup(group);
                this.groupMap.delete(entity.id);
            }
        });

        //new: now narrowd down transform changed as node changed;
        //new: skip update particles if height is driven by potential
        if (!Globals.heightByPotential) {
            this.queries.elements.changed!.forEach(entity => {
                if (!entity.alive) {
                    console.error("entity is not alive: " + entity.id + "/time: " + time);
                    return;
                }

                //remove old particles if any  
                const cObject = entity.getComponent(COMP.CObject3D)!;
                const particles = cObject.group.getObjectByName("particleGroup") as THREE.Group;
                if (particles) { this.particlePool.releaseGroup(particles); }

                this.spawnParticles(entity, particles);

                console.log("respawn particles: " + particles.children.length);
            });
        }


        this.queries.capacitors.added!.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive: " + entity.id + "/time: " + time);
                return;
            }
            const chargeGroup = new THREE.Group();
            chargeGroup.name = "chargeGroup";

            const cObject = entity.getComponent(COMP.CObject3D)!;
            cObject.group.add(chargeGroup);
            //console.log("spawn charges for capacitor");
        });


        this.queries.capacitors.changed!.forEach(entity => {
            if (!entity.alive) {
                console.error("entity is not alive: " + entity.id + "/time: " + time);
                return;
            }
            //spawn new charges
            this.updateCharges(entity);
        });

        //warn: turns out this is not what world.execute passes, just skip it
        //console.log("current delta: " + delta);  
        if (this.running) {
            this.updateCurrent(delta);
            this.updateColorBySubsystem();
        }



    }


    updateCharges(entity: Entity) {

        const cElement = entity.getComponent(COMP.CElement)!;
        const cCapacitance = entity.getComponent(COMP.CCapacitance)!;
        const charge = cCapacitance.charge;
        const edge = cCapacitance.edge;
        const size = cCapacitance.spacing;

        const chargeGroup = entity.getComponent(COMP.CObject3D)!.group.getObjectByName("chargeGroup") as THREE.Group;
        this.particlePool.releaseGroup(chargeGroup);

        //spawn particles based on charge density;
        let chargeNumX = Math.ceil(Math.abs(cElement.voltage) * Globals.capactiorChargeDensity);
        //new: cap the number of charges; todo: don't hard code
        if (chargeNumX > 10) chargeNumX = 10;


        const spacing = edge / (chargeNumX - 1);

        const offsetX = ENTT.Dir.LEFT * size / 2 * Math.sign(charge);
        const offsetYZ = -edge / 2;

        for (let i = 0; i < chargeNumX; i++) {
            for (let j = 0; j < chargeNumX; j++) {
                const x = offsetX;
                const y = i * spacing + offsetYZ;
                const z = j * spacing + offsetYZ;

                const particle = this.particlePool.getParticle('particles');
                particle.position.set(x, y, z);
                chargeGroup.add(particle);


            }
        }

        //console.log("update charges: " + chargeGroup.children.length);

    }




    updateCurrent(delta: number) {

        this.queries.elements.results.forEach(element => {
            if (!element.alive) {
                console.error("element is not alive");
                return;
            }

            //const element = elements[id];
            //this.updateParticles(entity);  
            const cElement = element.getComponent(COMP.CElement)!;
            const size = cElement.elementSize;
            const length = cElement.length;

            let current = cElement.current;
            current = Math.round(current * 100) / 100;

            const group = element.getComponent(COMP.CObject3D)!.group as THREE.Group;
            const particles = group.getObjectByName("particleGroup") as THREE.Group;
            if (!particles) {
                console.error("current: particles not found");
                return;
            }

            // Update particles 
            particles.children.forEach((ptcMesh, i) => {

                const pos = ptcMesh.position;
                let dist = delta * this.speedScale * current;

                // console.log("current: " + current + " dist: " + dist);

                if (Globals.renderMode === 'particles') {
                    dist *= -1.0;
                }

                if (abs(dist) < 1e-6) {
                    dist = 0;  //prevent numerical jitter
                    Field.pointArrowToDir(ptcMesh as THREE.Mesh, new THREE.Vector3(0, 1.0, 0));
                    //particles.visible = false;
                    //return;
                    //console.log("dist is set zero");
                }
                else {
                    Field.pointArrowToDir(ptcMesh as THREE.Mesh, new THREE.Vector3(dist, 0, 0));
                }



                // console.log("delta: " + delta + " speed: " + this.speed + " current: " + current);
                // console.log("move dist: " + dist);

                //set to be invisible if overlap with elements
                if (pos.x > -size / 2 && pos.x < size / 2) {
                    if (element.hasComponent(COMP.CInductance)) {
                        //const localPos = pos.x - size / 2;
                        const helix = element.getComponent(COMP.CInductance)!.helix!;
                        const coilMesh = group.getObjectByName("coil") as THREE.Mesh;

                        const matrix = coilMesh.matrix;

                        //turn into local space of the coil
                        //const lPos = coilMesh.worldToLocal(pos.clone());
                        const lPos = pos.clone().applyMatrix4(matrix.clone().invert());

                        const newPos = helix.incrementPos(lPos, dist);

                        //back to world space 
                        //pos.copy(coilMesh.localToWorld(newPos));
                        pos.copy(newPos.applyMatrix4(matrix));

                        const lastTangDir = helix.getTangentByPos(lPos);
                        const gDir = lastTangDir.applyMatrix4(matrix);
                        if (dist < 0) { gDir.negate(); }
                        Field.pointArrowToDir(ptcMesh as THREE.Mesh, gDir);

                    }
                    else {
                        ptcMesh.visible = false;

                        pos.x += dist;
                    }
                }
                else {

                    ptcMesh.visible = true;

                    pos.x += dist;

                    //new: reset displacement from the center
                    pos.y = 0;
                    pos.z = 0;
                }

                if (pos.x > length / 2) {
                    pos.x = - length / 2;
                }
                if (pos.x < -length / 2) {
                    pos.x = +length / 2;
                }

            });


        }); //end of elements loop

    }


    spawnParticles(entity: Entity, particles: THREE.Group): void {

        // Compute direction and spacing   
        //for inductance, spawn particles on the coil
        if (entity.hasComponent(COMP.CInductance)) {
            const cInductance = entity.getComponent(COMP.CInductance)!;
            const helix = cInductance.helix!;
            const coilMesh = entity.getComponent(COMP.CObject3D)!.group.getObjectByName("coil") as THREE.Mesh;

            const numParticles = helix.totalLength / this.spacing;
            const lPoints = helix.getPoints(numParticles);

            lPoints.forEach(point => {
                const particle = this.particlePool.getParticle(Globals.renderMode) as THREE.Mesh;
                particle.position.copy(point.applyMatrix4(coilMesh.matrix));
                particles.add(particle);
            });
        }


        const length = entity.getComponent(COMP.CElement)!.length;
        const size = entity.getComponent(COMP.CElement)!.elementSize;
        const numParticles = Math.floor(length / this.spacing);
        const physicalSpacing = length / numParticles;
        // //reduce one particle to avoid overlap

        for (let i = 0; i < numParticles; i++) {
            //new: skip the middle if it is inductor
            const posX = i * physicalSpacing - length / 2;

            if (entity.hasComponent(COMP.CInductance) && posX > -size / 2 && posX < size / 2) {
                continue;
            }
            // Calculate particle position along the line  
            // Spawn a particle 
            const particle = this.particlePool.getParticle(Globals.renderMode) as THREE.Mesh;
            particle.position.x = posX;

            particles.add(particle);
        }


    }

    updateColorBySubsystem() {

        const systemManager = this.world.getSystem(SSimulateSystem).systemManager;
        if (systemManager) {
            // this.showDebugGUI();  
            for (const [key, system] of systemManager.subsystems) {

                this.updateColors(this.queries.elements.results, system.gEdgeIDs);
            }
        }
    }

    updateColors(elements: Array<Entity>, ids: Array<number>) {

        //collect min and max voltage
        let minVoltage = Number.MAX_VALUE;
        let maxVoltage = -Number.MAX_VALUE;

        ids.forEach(id => {
            const element = elements[id];
            if (!element || !element.hasComponent(COMP.CElement)) {
                console.error("behaivor: element not found");
                return;
            }

            const voltL = element.getComponent(COMP.CElement)!.nodeL.getComponent(COMP.CNodeSim)!.voltage;
            const voltR = element.getComponent(COMP.CElement)!.nodeR.getComponent(COMP.CNodeSim)!.voltage;

            minVoltage = Math.min(minVoltage, voltL, voltR);
            maxVoltage = Math.max(maxVoltage, voltL, voltR);
        });
        maxVoltage += 1e-6; //avoid division by zero
        if (minVoltage < Globals.potentialOffset) {
            Globals.potentialOffset = minVoltage;
        }
        //console.log("minVoltage: " + minVoltage + " maxVoltage: " + maxVoltage);


        ids.forEach(id => {
            const element = elements[id];
            if (!element || !element.hasComponent(COMP.CElement)) {
                console.error("behaivor: element not found");
                return;
            }

            const cObject = element.getComponent(COMP.CObject3D)!;
            const wireLMesh = cObject.group.getObjectByName("wireL") as THREE.Mesh;
            const wireRMesh = cObject.group.getObjectByName("wireR") as THREE.Mesh;

            if (!wireLMesh || !wireRMesh) {
                console.error("behaivor: missing wire model");
                return;
            }

            const nodeL = element.getComponent(COMP.CElement)!.nodeL;
            const nodeR = element.getComponent(COMP.CElement)!.nodeR;

            const voltageL = nodeL.getComponent(COMP.CNodeSim)!.voltage;
            const voltageR = nodeR.getComponent(COMP.CNodeSim)!.voltage;

            const colorL: THREE.Color = colorMap(voltageL, minVoltage, maxVoltage);
            const colorR: THREE.Color = colorMap(voltageR, minVoltage, maxVoltage);

            (wireLMesh.material as THREE.MeshStandardMaterial).color.set(colorL);
            (wireRMesh.material as THREE.MeshStandardMaterial).color.set(colorR);

            const nodeLMesh = nodeL.getComponent(COMP.CObject3D)!.group.getObjectByName("nodeL") as THREE.Mesh;
            const nodeRMesh = nodeR.getComponent(COMP.CObject3D)!.group.getObjectByName("nodeR") as THREE.Mesh;


            (nodeLMesh.material as THREE.MeshStandardMaterial).color.set(colorL);
            (nodeRMesh.material as THREE.MeshStandardMaterial).color.set(colorR);

            //new: set emmisive color
            // (nodeLMesh.material as THREE.MeshStandardMaterial).emissive.set(colorL);
            // (nodeRMesh.material as THREE.MeshStandardMaterial).emissive.set(colorR);




            //how elements are colored

            if (element.hasComponent(COMP.CWire)) {
            }

            if (element.hasComponent(COMP.CCapacitance)) {
                const cCapacitance = element.getComponent(COMP.CCapacitance)!;

                const plateMeshL = cObject.group.getObjectByName("plateL") as THREE.Mesh;
                const plateMeshR = cObject.group.getObjectByName("plateR") as THREE.Mesh;

                (plateMeshL.material as THREE.MeshStandardMaterial).color.set(colorL);
                (plateMeshR.material as THREE.MeshStandardMaterial).color.set(colorR);
            }


            if (element.hasComponent(COMP.CDCVoltage)) {
                const plateMeshL = cObject.group.getObjectByName("plateL") as THREE.Mesh;
                const plateMeshR = cObject.group.getObjectByName("plateR") as THREE.Mesh;

                (plateMeshL.material as THREE.MeshStandardMaterial).color.set(colorL);
                (plateMeshR.material as THREE.MeshStandardMaterial).color.set(colorR);

            }

            if (element.hasComponent(COMP.CInductance)) {
                // const cInductance = element.getComponent(COMP.CInductance)!;

                // const coilMesh = cObject.group.getObjectByName("coil") as THREE.Mesh;
                // (coilMesh.material as THREE.MeshStandardMaterial).color.set(colorL);
            }

            if (element.hasComponent(COMP.CResistance)) {
                // const resistorMesh = cObject.group.getObjectByName("resistor") as THREE.Mesh;
                // (resistorMesh.material as THREE.MeshStandardMaterial).color.set(colorL);
                //todo: driven by both sides
            }


            if (element.hasComponent(COMP.CACVoltage)) {

                // const mesh = cObject.group.getObjectByName("sphere") as THREE.Mesh;
                // (mesh.material as THREE.MeshStandardMaterial).color.set(colorL);
            }


        });



    }



}