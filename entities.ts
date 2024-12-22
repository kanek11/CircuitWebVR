import * as THREE from 'three';
import { WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';
import { BoxLineGeometry } from 'three/examples/jsm/geometries/BoxLineGeometry.js';

import { World, System, Component, Types, Entity } from 'ecsy';

import * as COMP from "./components";

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import * as MyGUI from './GUISystem';
import { create } from 'domain';



export const spawnEntity = (world: World, factory: (world: World) => Entity): Entity => {

    const entt = factory(world);

    entt.addComponent(COMP.CInteractable);
    entt.addComponent(COMP.CRenderable);

    return entt;
}

export const createBoxPrototype = (world: World): Entity => {

    const entity = createBox(world);
    entity.addComponent(COMP.CPrototype, { name: 'box' });
    return entity;
}



export const createBox = (world: World): Entity => {

    const boxGeometry = new BoxGeometry(1, 1, 1);
    const boxMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
    const boxMesh = new Mesh(boxGeometry, boxMaterial);

    const entity = world.createEntity();
    entity.addComponent(COMP.CObject3D, { object: boxMesh });
    entity.addComponent(COMP.CTransform, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.1, y: 0.1, z: 0.1 }
    });


    return entity;
    //const gui = new GUI();
    //MyGUI.showPropertiesGUI(entity, gui); 
}



export const createFloor = (world: World) => {

    const floorGeometry = new BoxGeometry(10, -0.1, 10);
    const floorMaterial = new MeshBasicMaterial({ color: 0x000000 });
    const floorMesh = new Mesh(floorGeometry, floorMaterial);

    const entity = world.createEntity();
    entity.addComponent(COMP.CTransform, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    });
    entity.addComponent(COMP.CObject3D, { object: floorMesh });


    entity.addComponent(COMP.CRenderable);
}






export const createGrid = (world: World) => {

    // const grid = new THREE.LineSegments(
    //     new BoxLineGeometry(6, 6, 6, 10, 10, 10).translate(0, 3, 0),
    //     new THREE.LineBasicMaterial({ color: 0xbcbcbc })
    // );
    const grid = new THREE.GridHelper(1, 20, 0xff0000, 0x808080);

    const entity = world.createEntity();
    entity.addComponent(COMP.CTransform, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    });

    entity.addComponent(COMP.CObject3D, { object: grid });


    entity.addComponent(COMP.CRenderable);

}