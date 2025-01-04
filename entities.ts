import * as THREE from 'three';
import { WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';
import { BoxLineGeometry } from 'three/examples/jsm/geometries/BoxLineGeometry.js';

import { World, System, Component, Types, Entity } from 'ecsy';

import * as COMP from "./components";

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import * as MyGUI from './BrowserSystem';
import { create } from 'domain';



export const spawnEntity = (world: World, factory: (world: World) => Entity, position: THREE.Vector3): Entity => {

    const entt = factory(world);

    entt.addComponent(COMP.CInteractable);
    entt.addComponent(COMP.CRenderable);

    if (entt.hasComponent(COMP.CTransform)) { entt.getMutableComponent(COMP.CTransform)!.position = position; }


    if (entt.hasComponent(COMP.CElement)) {

        const setNode = (node: Entity, offset: number) => {

            node.addComponent(COMP.CInteractable);
            node.addComponent(COMP.CRenderable);

            node.addComponent(COMP.CNode, { element: entt });

            if (node.hasComponent(COMP.CTransform)) {
                const pos = node.getMutableComponent(COMP.CTransform)!.position;
                pos.x = position.x + offset;
                pos.y = position.y;
                pos.z = position.z;
            }
        }

        const nodeL = entt.getComponent(COMP.CElement)!.nodeL;
        setNode(nodeL, +0.1);

        const nodeR = entt.getComponent(COMP.CElement)!.nodeR;
        setNode(nodeR, -0.1);

    }

    return entt;
}


export const createCapacitor = (world: World): Entity => {

    const entity = createElement(world);
    entity.addComponent(COMP.CCapacitance, { value: 1 });

    return entity;
}


export const createInductor = (world: World): Entity => {

    const entity = createElement(world);
    entity.addComponent(COMP.CInductance, { value: 1 });

    return entity;
}



export const createResistor = (world: World): Entity => {

    const entity = createElement(world);
    entity.addComponent(COMP.CResistance, { value: 1 });

    return entity;
}

export const createDCVoltage = (world: World): Entity => {

    const entity = createElement(world);
    entity.addComponent(COMP.CVoltage, { value: 1 });

    return entity;
}



export const createElement = (world: World): Entity => {

    const boxGeometry = new BoxGeometry(1, 1, 1);
    const boxMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
    const boxMesh = new Mesh(boxGeometry, boxMaterial);

    const element = world.createEntity();
    element.addComponent(COMP.CObject3D, { object: boxMesh });

    const nodeSize = 0.05;

    element.addComponent(COMP.CTransform, {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(0, 0, 0),
        scale: new THREE.Vector3(nodeSize * 1.5, nodeSize, nodeSize)
    });


    const node = () => {
        const node = world.createEntity();

        const boxGeometry = new BoxGeometry(1, 1, 1);
        const boxMaterial = new MeshBasicMaterial({ color: 0xff0000 });
        const boxMesh = new Mesh(boxGeometry, boxMaterial);

        node.addComponent(COMP.CObject3D, { object: boxMesh });

        node.addComponent(COMP.CTransform, {
            position: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Vector3(0, 0, 0),
            scale: new THREE.Vector3(nodeSize, nodeSize, nodeSize)
        });
        return node;
    }


    const _nodeL = node();
    const _nodeR = node();

    element.addComponent(COMP.CElement, { nodeL: _nodeL, nodeR: _nodeR });


    return element;
}



export const createFloor = (world: World) => {

    const floorGeometry = new BoxGeometry(10, -0.1, 10);
    const floorMaterial = new MeshBasicMaterial({ color: 0x000000 });
    const floorMesh = new Mesh(floorGeometry, floorMaterial);

    const entity = world.createEntity();
    entity.addComponent(COMP.CTransform, {
        position: new THREE.Vector3(0, -0.1, 0),
        rotation: new THREE.Vector3(0, 0, 0),
        scale: new THREE.Vector3(1, 1, 1)
    });
    entity.addComponent(COMP.CObject3D, { object: floorMesh });


    entity.addComponent(COMP.CRenderable);
}





