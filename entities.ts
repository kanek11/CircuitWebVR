import * as THREE from 'three';
import { WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';
import { BoxLineGeometry } from 'three/examples/jsm/geometries/BoxLineGeometry.js';

import { World, System, Component, Types, Entity } from 'ecsy';

import * as COMP from "./components";

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import * as MyGUI from './GUISystem';

export const createBox = (world: World) => {

    const boxGeometry = new BoxGeometry(1, 1, 1);
    const boxMaterial = new MeshBasicMaterial({ color: 0x00ff00 });
    const boxMesh = new Mesh(boxGeometry, boxMaterial);

    const entity = world.createEntity();
    entity.addComponent(COMP.CRenderable);
    entity.addComponent(COMP.CTransform, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 }
    });
    entity.addComponent(COMP.CObject3D, { object: boxMesh });

    entity.addComponent(COMP.CInteractable);
    entity.addComponent(COMP.CSceneProxy, { name: 'box' });


    //const gui = new GUI();
    //MyGUI.showPropertiesGUI(entity, gui); 
}



export const createFloor = (world: World) => {

    const floorGeometry = new BoxGeometry(10, -0.1, 10);
    const floorMaterial = new MeshBasicMaterial({ color: 0x000000 });
    const floorMesh = new Mesh(floorGeometry, floorMaterial);

    const entity = world.createEntity();
    entity.addComponent(COMP.CRenderable);
    entity.addComponent(COMP.CTransform, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    });
    entity.addComponent(COMP.CObject3D, { object: floorMesh });
}






export const createGrid = (world: World) => {

    // const grid = new THREE.LineSegments(
    //     new BoxLineGeometry(6, 6, 6, 10, 10, 10).translate(0, 3, 0),
    //     new THREE.LineBasicMaterial({ color: 0xbcbcbc })
    // );
    const grid = new THREE.GridHelper(1, 10, 0xff0000, 0x808080);

    const entity = world.createEntity();
    entity.addComponent(COMP.CRenderable);
    entity.addComponent(COMP.CTransform, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
    });

    entity.addComponent(COMP.CObject3D, { object: grid });

}