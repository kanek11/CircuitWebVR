import * as THREE from 'three';
import { WebGLRenderer, BoxGeometry, MeshStandardMaterial, Mesh, Vector3 } from 'three';

import { World, System, Component, Types, Entity } from 'ecsy';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as COMP from "./components";

import { SInteractSystem, snapElement } from './interactSystem';

import { Globals } from "./globals";



// Counter map to track the number of elements created
const elementCounters: { [key: string]: number } = {};

export const generateUniqueName = (elementType: COMP.ElementTypeName): string => {
    if (!elementCounters[elementType]) {
        elementCounters[elementType] = 0;
    }
    const name = `${elementType}${elementCounters[elementType]++}`;
    return name;
};



export function getElementAndNode(entity: Entity): [Entity, Entity, Entity] {
    if (entity.hasComponent(COMP.CElement)) {
        const cElement = entity.getComponent(COMP.CElement)!;
        return [entity, cElement.nodeL, cElement.nodeR];

    }
    if (entity.hasComponent(COMP.CNode)) {
        const element = entity.getComponent(COMP.CNode)!.element;
        const cElement = element.getComponent(COMP.CElement)!;
        return [element, cElement.nodeL, cElement.nodeR];
    }
    else
        throw new Error("get invalid entity");

}



//x axis for left, right;  left = +x;
//z for front, back;  front= +z;
export enum Dir {
    LEFT = 1,
    RIGHT = -1
}



// export interface IEntityFactory {
//     (world: World): Entity;
// } 


export type EntityFactory2<T> = (world: World, params?: T) => Entity;

export const spawnEntity2 = (world: World, _factory: EntityFactory2<any>,
    _position: Vector3 = new Vector3(),
    _rotation: Vector3 = new Vector3(),
    _elementLength: number = 0.2,
    _params?: any): Entity => {
    const entt = _factory(world, _params);

    if (entt.hasComponent(COMP.CTransform)) {
        const cTransform = entt.getMutableComponent(COMP.CTransform)!;
        cTransform.position = _position;
        cTransform.rotation = _rotation;
        //console.log("rotation: ", _rotation.x, _rotation.y, _rotation.z);
    }

    if (entt.hasComponent(COMP.CElement)) {

        //compute the position of the nodes based on the length, rotation
        const cElement = entt.getMutableComponent(COMP.CElement)!;

        const offset = new Vector3(_elementLength / 2, 0, 0);
        offset.applyEuler(new THREE.Euler(_rotation.x, _rotation.y, _rotation.z));
        const posR = new Vector3().subVectors(_position, offset);
        const posL = new Vector3().addVectors(_position, offset);

        cElement.nodeL.getMutableComponent(COMP.CTransform)!.position = posL;
        cElement.nodeR.getMutableComponent(COMP.CTransform)!.position = posR;
    }

    //new logic: snap the element to the grid
    const interactSystem = world.getSystem(SInteractSystem);
    if (interactSystem) { snapElement(entt); }
    else {
        console.warn("no interact system found");
    }


    console.log("spawn entity:" + entt.id);

    return entt;
}



export const removeEntity = (world: World, entity: Entity) => {

    //somehow we could not relay on the dispose() to be synchronous
    if (entity.hasComponent(COMP.CElement)) {
        const element = entity.getComponent(COMP.CElement)!;
        element.nodeL.removeAllComponents();
        element.nodeL.remove();
        element.nodeR.removeAllComponents();
        element.nodeR.remove();
    }

    //remove all components
    entity.removeAllComponents();

    //remove itself from the world
    entity.remove();

    // console.log("entity is alive?: ", entity.alive);

}





export type ICapacitorParams = Partial<COMP.CCapacitance>;

export const createCapacitor: EntityFactory2<ICapacitorParams> = (
    world: World,
    params: ICapacitorParams = {
        spacing: 0.1,
        edge: 0.1,
        constant: 1
    }
): Entity => {
    const entity = createElement(world);
    entity.addComponent(COMP.CElementMetaInfo, {
        elementType: 'capacitor', name: generateUniqueName('capacitor')
    });

    //initial parameters
    const spacing = params.spacing ?? 0.1;
    const edge = params.edge ?? 0.1;
    const constant = params.constant ?? 1;
    const area = edge * edge;

    const capacitance = constant * area / spacing;

    //new:
    entity.getMutableComponent(COMP.CElement)!.elementSize = spacing;

    entity.addComponent(COMP.CCapacitance,
        {
            capacitance: capacitance,
            spacing: spacing,
            edge: edge,
            constant: constant,
        });


    const BoxMeshFactory = () => {
        const geometry = new BoxGeometry(1, 1, 1);
        const material = new MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
        const mesh = new Mesh(geometry, material);
        return mesh;
    }

    const plateLMesh = BoxMeshFactory();
    plateLMesh.name = "plateL"; //"anode";
    plateLMesh.position.x = Dir.LEFT * spacing / 2;
    plateLMesh.scale.set(0.01, edge, edge);

    const plateRMesh = BoxMeshFactory();
    plateRMesh.name = "plateR";
    plateRMesh.position.x = Dir.RIGHT * spacing / 2;
    plateRMesh.scale.set(0.01, edge, edge);


    const wireLMesh = wireMeshFactory(world);
    wireLMesh.name = "wireL";

    const wireRMesh = wireMeshFactory(world);
    wireRMesh.name = "wireR";

    const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
    group.add(plateLMesh);
    group.add(plateRMesh);

    group.add(wireLMesh);
    group.add(wireRMesh);

    return entity;
}



export type IInductorParams = Partial<COMP.CInductance>;

export const createInductor: EntityFactory2<IInductorParams> = (world: World,
    params: IInductorParams = {
        radius: 0.025,
        turns: 5,
        length: 0.1
    }
): Entity => {

    const entity = createElement(world);
    entity.addComponent(COMP.CElementMetaInfo, { elementType: 'inductor', name: generateUniqueName('inductor') });

    const radius = params.radius ?? 0.025;
    const turns = params.turns ?? 5;
    const length = params.length ?? 0.1;

    entity.getMutableComponent(COMP.CElement)!.elementSize = length;

    const helixCurve = new COMP.Helix(radius, turns, length);

    entity.addComponent(COMP.CInductance,
        {
            inductance: 1,
            turns: turns,
            radius: radius,
            length: length,
            helix: helixCurve,
        });


    const geometry = new THREE.TubeGeometry(helixCurve, 100, Globals.tubeRadius, 10, false);
    const material = new THREE.MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
    const coilMesh = new THREE.Mesh(geometry, material);
    coilMesh.name = "coil";

    // const scaleXY = Globals.coilRadius;
    // const scaleZ = Globals.coilHeight / tubeHeight;
    // coil.scale.set(scaleXY, scaleXY, scaleZ);
    coilMesh.rotation.y = Math.PI / 2;
    coilMesh.rotation.x = -Math.PI / 2;  //for the phase 
    coilMesh.position.y = radius;


    const wireLMesh = wireMeshFactory(world);
    wireLMesh.name = "wireL";

    const wireRMesh = wireMeshFactory(world);
    wireRMesh.name = "wireR";

    const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
    group.add(coilMesh);
    group.add(wireLMesh);
    group.add(wireRMesh);




    return entity;
}



export type IResistorParams = Partial<COMP.CResistance>;

export const createResistor: EntityFactory2<IResistorParams> = (world: World,
    params: IResistorParams = {
        resistance: 1
    }
): Entity => {
    //const entity = createElement(world);
    const entity = createElement(world);

    entity.addComponent(COMP.CElementMetaInfo, { elementType: 'resistor', name: generateUniqueName('resistor') });

    const size = 0.1;
    entity.getMutableComponent(COMP.CElement)!.elementSize = size;

    entity.addComponent(COMP.CResistance, { resistance: params.resistance });

    const boxGeometry = new BoxGeometry(1, 1, 1);
    const boxMaterial = new MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
    const boxMesh = new Mesh(boxGeometry, boxMaterial);
    boxMesh.name = "resistor";
    boxMesh.scale.set(size, Globals.nodeSize, 0.05);

    const wireLMesh = wireMeshFactory(world);
    wireLMesh.name = "wireL";

    const wireRMesh = wireMeshFactory(world);
    wireRMesh.name = "wireR";

    const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;

    group.add(boxMesh);
    group.add(wireLMesh);
    group.add(wireRMesh);


    return entity;
}


export type IACVoltageParams = Partial<COMP.CACVoltage>;

export const createACVoltage: EntityFactory2<IACVoltageParams> = (world: World, params: IACVoltageParams = { amp: 1, freq: 3 }): Entity => {

    const entity = createElement(world);
    entity.addComponent(COMP.CElementMetaInfo, { elementType: "AC voltage", name: generateUniqueName('AC voltage') });

    entity.addComponent(COMP.CACVoltage, { amp: params.amp, freq: params.freq });

    const size = 0.05;
    const radius = size / 2;
    entity.getMutableComponent(COMP.CElement)!.elementSize = size;

    //say represent as a sphere
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
    const sphereMesh = new Mesh(sphereGeometry, sphereMaterial);

    sphereMesh.name = "sphere";
    sphereMesh.scale.set(radius, radius, radius);

    const wireLMesh = wireMeshFactory(world);
    wireLMesh.name = "wireL";

    const wireRMesh = wireMeshFactory(world);
    wireRMesh.name = "wireR";

    const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
    group.add(sphereMesh);

    group.add(wireLMesh);
    group.add(wireRMesh);


    return entity;
}



export type IDCVoltageParams = Partial<COMP.CDCVoltage>;

export const createDCVoltage: EntityFactory2<IDCVoltageParams> = (world: World,
    params: IDCVoltageParams = { voltage: 1 }
): Entity => {

    const entity = createElement(world);
    entity.addComponent(COMP.CElementMetaInfo, { elementType: "DC voltage", name: generateUniqueName('DC voltage') });

    entity.getMutableComponent(COMP.CElement)!.elementSize = 0.1;

    entity.addComponent(COMP.CDCVoltage, { voltage: params.voltage });

    const spacing = 0.05;
    const edge = 0.1;

    const plateLGeometry = new BoxGeometry(1, 1, 1);
    const plateLMaterial = new MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
    const plateLMesh = new Mesh(plateLGeometry, plateLMaterial);
    plateLMesh.name = "plateL";
    plateLMesh.position.x = Dir.LEFT * spacing / 2;
    plateLMesh.scale.set(0.01, Globals.nodeSize, edge);

    const plateRGeometry = new BoxGeometry(1, 1, 1);
    const plateRMaterial = new MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
    const plateRMesh = new Mesh(plateRGeometry, plateRMaterial);
    plateRMesh.name = "plateR";
    plateRMesh.position.x = Dir.RIGHT * spacing / 2;
    plateRMesh.scale.set(0.01, Globals.nodeSize, 0.8 * edge);

    const wireLMesh = wireMeshFactory(world);
    wireLMesh.name = "wireL";

    const wireRMesh = wireMeshFactory(world);
    wireRMesh.name = "wireR";

    const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
    group.add(plateLMesh);
    group.add(plateRMesh);

    group.add(wireLMesh);
    group.add(wireRMesh);


    return entity;
}





//define wire object
function wireMeshFactory(world: World): THREE.Mesh {
    //cyliner geometry is defined local in xz plane, y up;
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1);
    const material = new THREE.MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
    const wireMesh = new THREE.Mesh(geometry, material);
    //rotate it to lay down;

    wireMesh.scale.set(Globals.wireRadius, 1, Globals.wireRadius);
    wireMesh.rotation.z = Math.PI / 2;

    return wireMesh;
}


export interface IWireParams {
}

export const createWire: EntityFactory2<IWireParams> = (world: World, params: IWireParams = {}): Entity => {
    const entity = createElement(world);
    entity.addComponent(COMP.CWire);
    entity.addComponent(COMP.CElementMetaInfo, { elementType: "wire", name: generateUniqueName('wire') });

    const wireLMesh = wireMeshFactory(world);
    wireLMesh.name = "wireL";

    const wireRMesh = wireMeshFactory(world);
    wireRMesh.name = "wireR";

    const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
    group.add(wireLMesh);
    group.add(wireRMesh);

    return entity;
}



export const createElement = (world: World): Entity => {
    const entity = world.createEntity();

    const group = new THREE.Group();
    group.name = "elementGroup" + entity.id;
    //the logical node for the element
    entity.addComponent(COMP.CObject3D, { group: group });

    entity.addComponent(COMP.CTransform, {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(0, 0, 0),
        scale: new THREE.Vector3(1, 1, 1),
    });


    //define nodes
    const node = (_meshName: string, _groupName: string) => {
        const node = world.createEntity();

        const boxGeometry = new BoxGeometry(1, 1, 1);
        const boxMaterial = new MeshStandardMaterial({ color: Globals.baseColor, roughness: Globals.roughness, metalness: Globals.metallic });;
        const boxMesh = new Mesh(boxGeometry, boxMaterial);
        boxMesh.renderOrder = Globals.nodeRenderOrder;
        boxMesh.name = _meshName;

        const group = new THREE.Group();
        group.name = _groupName;
        group.add(boxMesh);
        node.addComponent(COMP.CObject3D, { group: group });

        node.addComponent(COMP.CTransform, {
            position: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Vector3(0, 0, 0),
            scale: new THREE.Vector3(Globals.nodeSize, Globals.nodeSize, Globals.nodeSize),
        });

        return node;
    }

    const _nodeL = node('nodeL', 'nodeGroupL');
    const _nodeR = node('nodeR', 'nodeGroupR');

    _nodeL.addComponent(COMP.CNode, { element: entity, other: _nodeR, moveable: true });
    _nodeR.addComponent(COMP.CNode, { element: entity, other: _nodeL, moveable: true });

    entity.addComponent(COMP.CElement, { nodeL: _nodeL, nodeR: _nodeR });

    return entity;
}





export function OnNodesChange(element: Entity): void {
    if (!element.hasComponent(COMP.CElement)) {
        console.error("nodeChange: sync for not a element!");
        return;
    }

    syncElementTransform(element);

    if (element.hasComponent(COMP.CWire)) {
        syncWireElementModel(element);
    }

    if (element.hasComponent(COMP.CResistance)) {
        syncResistorModel(element);
    }

    if (element.hasComponent(COMP.CDCVoltage)) {
        syncDCVoltageModel(element);
    }

    if (element.hasComponent(COMP.CCapacitance)) {
        syncCapacitorModel(element);
    }

    if (element.hasComponent(COMP.CInductance)) {

        syncInductanceModel(element);
    }

    if (element.hasComponent(COMP.CACVoltage)) {
        syncACVoltageModel(element);
    }

}




export function syncElementTransform(element: Entity): void {
    if (!element.hasComponent(COMP.CElement)) {
        console.error("sync model: not a element!");
        return;
    }

    const cElement = element.getMutableComponent(COMP.CElement)!;
    const cTransform = element.getMutableComponent(COMP.CTransform)!;

    const termL = cElement.nodeL.getComponent(COMP.CTransform)!.position;
    const termR = cElement.nodeR.getComponent(COMP.CTransform)!.position;

    cTransform.position = new Vector3().addVectors(termL, termR).multiplyScalar(0.5);

    const offset = new Vector3().subVectors(termR, termL);
    cElement.length = offset.length();

    const angleY = Math.atan2(offset.z, -offset.x);
    cTransform.rotation.y = angleY;

}


export function syncWireElementModel(element: Entity): void {
    if (!element.hasComponent(COMP.CWire)) {
        console.error("sync model: not a wire!");
        return;
    }

    const cElement = element.getComponent(COMP.CElement)!;
    const length = cElement.length;

    const group = element.getComponent(COMP.CObject3D)!.group as THREE.Group;
    const wireMeshL = group.getObjectByName("wireL") as THREE.Mesh;
    const wireMeshR = group.getObjectByName("wireR") as THREE.Mesh;

    //syncWireModels(element, size / 2, -size / 2, 0.1, length);
    syncWireModel(wireMeshL, Dir.LEFT * length / 2, 0);
    syncWireModel(wireMeshR, 0, Dir.RIGHT * length / 2);

    //console.log("sync wire model");
}



export function syncResistorModel(element: Entity, elementChanged: boolean = false): void {
    if (!element.hasComponent(COMP.CResistance)) {
        console.error("sync model: not a resistor!");
        return;
    }

    const cElement = element.getMutableComponent(COMP.CElement)!;

    const size = cElement.elementSize;
    const length = cElement.length;

    const group = element.getComponent(COMP.CObject3D)!.group as THREE.Group;
    const wireMeshL = group.getObjectByName("wireL") as THREE.Mesh;
    const wireMeshR = group.getObjectByName("wireR") as THREE.Mesh;

    //syncWireModels(element, size / 2, -size / 2, 0.1, length);
    syncWireModel(wireMeshL, Dir.LEFT * length / 2, Dir.LEFT * size / 2);
    syncWireModel(wireMeshR, Dir.RIGHT * size / 2, Dir.RIGHT * length / 2);

    //console.log("sync resistor model");

}


export function syncACVoltageModel(element: Entity, elementChanged: boolean = false): void {
    if (!element.hasComponent(COMP.CACVoltage)) {
        console.error("sync model: not a AC!");
        return;
    }

    const cElement = element.getMutableComponent(COMP.CElement)!;

    const size = cElement.elementSize;
    const length = cElement.length;

    const group = element.getComponent(COMP.CObject3D)!.group as THREE.Group;
    const wireMeshL = group.getObjectByName("wireL") as THREE.Mesh;
    const wireMeshR = group.getObjectByName("wireR") as THREE.Mesh;

    //syncWireModels(element, size / 2, -size / 2, 0.1, length);
    syncWireModel(wireMeshL, Dir.LEFT * length / 2, Dir.LEFT * size / 2);
    syncWireModel(wireMeshR, Dir.RIGHT * size / 2, Dir.RIGHT * length / 2);

}




export function syncDCVoltageModel(element: Entity, elementChanged: boolean = false): void {
    if (!element.hasComponent(COMP.CDCVoltage)) {
        console.error("sync model: not a DC!");
        return;
    }


    const cElement = element.getComponent(COMP.CElement)!;
    const length = cElement.length;
    const size = cElement.elementSize;

    const group = element.getComponent(COMP.CObject3D)!.group as THREE.Group;
    const plateMeshL = group.getObjectByName("plateL") as THREE.Mesh;
    const plateMeshR = group.getObjectByName("plateR") as THREE.Mesh;
    const wireMeshL = group.getObjectByName("wireL") as THREE.Mesh;
    const wireMeshR = group.getObjectByName("wireR") as THREE.Mesh;


    if (elementChanged) {
        const cVoltage = element.getComponent(COMP.CDCVoltage)!;
        const voltage = cVoltage.voltage;

        const edge = 0.1;
        //flip the model if negative
        if (voltage > 0) {
            plateMeshL.scale.set(0.01, 0.02, edge);
            plateMeshR.scale.set(0.01, 0.02, 0.8 * edge);
        }
        else {
            plateMeshL.scale.set(0.01, 0.02, 0.8 * edge);
            plateMeshR.scale.set(0.01, 0.02, edge);

        }

    }

    //syncWireModels(element, plateL.position.x, plateR.position.x, 0.05, length);
    syncWireModel(wireMeshL, Dir.LEFT * length / 2, plateMeshL.position.x);
    syncWireModel(wireMeshR, plateMeshR.position.x, Dir.RIGHT * length / 2);

}


export function syncCapacitorModel(entity: Entity, elementChanged: boolean = false): void {
    if (!entity.hasComponent(COMP.CCapacitance)) {
        console.error("sync model: not a capacitor!");
        return;
    }

    const cElement = entity.getComponent(COMP.CElement)!;
    const length = cElement.length;
    const size = cElement.elementSize; //or spacing

    const group = entity.getComponent(COMP.CObject3D)!.group as THREE.Group;
    const plateMeshL = group.getObjectByName("plateL") as THREE.Mesh;
    const plateMeshR = group.getObjectByName("plateR") as THREE.Mesh;
    const wireMeshL = group.getObjectByName("wireL") as THREE.Mesh;
    const wireMeshR = group.getObjectByName("wireR") as THREE.Mesh;


    if (elementChanged) {

        const cCapacitor = entity.getComponent(COMP.CCapacitance)!;

        plateMeshL.position.x = Dir.LEFT * cCapacitor.spacing / 2;
        plateMeshR.position.x = Dir.RIGHT * cCapacitor.spacing / 2;

        plateMeshL.scale.set(plateMeshL.scale.x, cCapacitor.edge, cCapacitor.edge);
        plateMeshR.scale.set(plateMeshR.scale.x, cCapacitor.edge, cCapacitor.edge);
    }

    //syncWireModels(element, plateL.position.x, plateR.position.x, 0.05, length);
    syncWireModel(wireMeshL, Dir.LEFT * length / 2, plateMeshL.position.x);
    syncWireModel(wireMeshR, plateMeshR.position.x, Dir.RIGHT * length / 2);
}



export function syncInductanceModel(element: Entity, elementChanged: boolean = false): void {
    if (!element.hasComponent(COMP.CInductance)) {
        console.error("sync model: not a inductor!");
        return;
    }
    const cElement = element.getComponent(COMP.CElement)!;
    const cInductance = element.getMutableComponent(COMP.CInductance)!;

    const size = cElement.elementSize;
    const length = cElement.length;
    const group = element.getComponent(COMP.CObject3D)!.group as THREE.Group;
    const wireMeshL = group.getObjectByName("wireL") as THREE.Mesh;
    const wireMeshR = group.getObjectByName("wireR") as THREE.Mesh;


    if (elementChanged) {

        const newHelix = new COMP.Helix(cInductance.radius, cInductance.turns, cInductance.length);
        cInductance.helix = newHelix;

        const geometry = new THREE.TubeGeometry(newHelix, 100, Globals.tubeRadius, 10, false);
        const coilMesh = group.getObjectByName("coil") as THREE.Mesh;
        coilMesh.geometry.dispose();
        coilMesh.geometry = geometry;
    }



    //syncWireModels(element, size / 2, -size / 2, 0.1, length);
    syncWireModel(wireMeshL, Dir.LEFT * length / 2, Dir.LEFT * size / 2);
    syncWireModel(wireMeshR, Dir.RIGHT * size / 2, Dir.RIGHT * length / 2);

}




export function syncWireModel(wireMesh: Mesh, lPosX: number, rPosX: number): void {

    const mid = (lPosX + rPosX) / 2;
    const length = Math.abs(rPosX - lPosX);

    //set local    
    wireMesh.position.x = mid;
    wireMesh.scale.y = length;
}