
import * as THREE from "three";
import { Vector3 } from "three";
import { World, Entity, System } from "ecsy";
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as COMP from "./components";
import { SRenderSystem } from "./renderSystem";
import { SSimulateSystem } from "./simulateSystem";

import * as Utils from "./utils";

/**
 * 
 * threejs up direction is y
 * so we use xz plane ;
 * 
 * todo: maybe extract the grid thing;
 */


const createGrid = (world: World, gridSize: number, gridNum: number) => {

    //inherit from LineSegments
    // const grid = new THREE.LineSegments(
    //     new BoxLineGeometry(6, 6, 6, 10, 10, 10).translate(0, 3, 0),
    //     new THREE.LineBasicMaterial({ color: 0xbcbcbc })
    // ); 
    const grid = new THREE.GridHelper(gridSize, gridNum, 0x000000, 0x000000);

    const entity = world.createEntity();
    entity.addComponent(COMP.CTransform, {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Vector3(0, 0, 0),
    });

    entity.addComponent(COMP.CObject3D, { object: grid });

    entity.addComponent(COMP.CRenderable);

}



export class SInteractSystem extends System {
    private gui: GUI = new GUI();

    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private pointerNDC: THREE.Vector2 = new THREE.Vector2();

    private selectedEntity: Entity | null = null;
    private bDragging: boolean = false;


    private gridSize: number = 1;
    private gridNum: number = 20;
    private gridSpacing: number = 1 / this.gridNum;


    // 
    static queries = {
        interactives: {
            components: [COMP.CInteractable],
            listen: { added: true, removed: true }
        }
    };

    init(): void {
        console.log("init interact system");

        document.addEventListener('pointermove', (event) => this.onPointerMove(event));
        document.addEventListener('pointerdown', (event) => this.onPointerDown(event));
        document.addEventListener('pointerup', (event) => this.onPointerUp(event));

        //document.addEventListener('click', () => this.onClick());

        createGrid(this.world, this.gridSize, this.gridNum);
    }

    execute(delta: number, time: number): void {

    }


    onPointerDown(event: PointerEvent): void {
        console.log("interact: pointer down");
        this.bDragging = true;

        //console.log("pointer move");
        this.pointerNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointerNDC.y = - (event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.pointerNDC, this.world.getSystem(SRenderSystem).top_camera!);


        const scene = this.world.getSystem(SRenderSystem).scene!;

        const intersects = this.raycaster.intersectObjects(scene.children);
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            //this.selectedObject = obj;
            //console.log("interact: intersected with uuid: " + obj.uuid);

            //todo: only consider mesh for now
            if (obj instanceof THREE.Mesh) {
                // const material = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
                // material.color.set(0xff0000);
            }
            else {
                console.log("interact: unhandled: not a mesh");
            }

            //find the entity

            let found: boolean = false;
            const objs = this.queries.interactives.results;
            objs.forEach(entity => {

                if (entity.hasComponent(COMP.CObject3D)) {
                    const cObj = entity.getComponent(COMP.CObject3D)!;

                    if (cObj.object.uuid === obj.uuid) {
                        //console.log("found entity!");

                        this.selectedEntity = entity;
                        this.hightlightObject(obj);
                        found = true;
                    }

                }
                else { console.log("interact:  unhandled entity without object3D component"); }
            });

            if (!found) {
                console.log("interact: not found entity!");
                this.deSelectObject();
            }

        }

    }


    //drag
    onPointerMove(event: PointerEvent): void {
        if (this.selectedEntity && this.bDragging) {
            //update the position of the object 

            const worldPosition = Utils.ScreenToWorld(event, this.world.getSystem(SRenderSystem).top_camera!);

            //
            if (this.selectedEntity.hasComponent(COMP.CNode)) {

                const nodePos = this.selectedEntity.getMutableComponent(COMP.CTransform)!.position;
                nodePos.x = worldPosition.x;
                nodePos.z = worldPosition.z;

                this.snapNode(this.selectedEntity);

                this.syncElementModel(this.selectedEntity.getComponent(COMP.CNode)!.element);

            }

            //
            if (this.selectedEntity.hasComponent(COMP.CElement)) {

                const elementTransform = this.selectedEntity.getMutableComponent(COMP.CTransform)!.position;

                //save the offset from original position 
                const offsetX = worldPosition.x - elementTransform.x;
                const offsetZ = worldPosition.z - elementTransform.z;

                // update the position of the element
                const cElement = this.selectedEntity.getComponent(COMP.CElement)!;
                const nodeLPos = cElement.nodeL.getMutableComponent(COMP.CTransform)!.position;

                nodeLPos.x += offsetX;
                nodeLPos.z += offsetZ;


                const nodeRPos = cElement.nodeR.getMutableComponent(COMP.CTransform)!.position;
                nodeRPos.x += offsetX;
                nodeRPos.z += offsetZ;


                this.snapNode(cElement.nodeL);
                this.snapNode(cElement.nodeR);
                this.syncElementModel(this.selectedEntity);

            }

        }
    }



    //todo:xyz is kinda messy here
    snapPosToGrid(position: THREE.Vector3): number {

        //grid node index: 
        const gridIndexX = Math.round(position.x / this.gridSpacing);
        const gridIndexY = Math.round(position.y / this.gridSpacing);
        const gridIndexZ = Math.round(position.z / this.gridSpacing);

        position.x = gridIndexX * this.gridSpacing;
        position.y = gridIndexY * this.gridSpacing;
        position.z = gridIndexZ * this.gridSpacing;

        const slotID = gridIndexX + gridIndexZ * this.gridNum;
        //console.log("interact: slotID: " + slotID);
        return slotID;
    }

    snapNode(thisNode: Entity): void {

        const position = thisNode.getMutableComponent(COMP.CTransform)!.position;

        const slotID = this.snapPosToGrid(position);

        const node = thisNode.getMutableComponent(COMP.CNode)!;
        node.slotID = slotID;

    }

    snapElement(thisElement: Entity): void {

        if (!thisElement.hasComponent(COMP.CElement)) {
            console.warn("not a element!.");
            return;
        }
        const cElement = thisElement.getComponent(COMP.CElement)!;

        this.snapNode(cElement.nodeL);
        this.snapNode(cElement.nodeR);

        this.syncElementModel(thisElement);
    }


    syncElementModel(element: Entity): void {
        // 检查 element 是否包含必要组件
        if (!element.hasComponent(COMP.CElement)) {
            console.warn("not a element!.");
            return;
        }

        const cElement = element.getComponent(COMP.CElement)!;
        const cTransform = element.getMutableComponent(COMP.CTransform)!;


        const nodeL = cElement.nodeL;
        const nodeR = cElement.nodeR;
        const posL = nodeL.getComponent(COMP.CTransform)!.position;
        const posR = nodeR.getComponent(COMP.CTransform)!.position;

        cTransform.position.x = (posL.x + posR.x) / 2;
        //cTransform.position.y = (posL.y + posR.y) / 2;
        cTransform.position.z = (posL.z + posR.z) / 2;

        const direction = new THREE.Vector3(posR.x - posL.x, 0, posR.z - posL.z);
        const length = direction.length();

        const angleY = Math.atan2(direction.z, -direction.x);

        cTransform.rotation.y = angleY;

        cTransform.scale.x = length * 0.5;
        //cTransform.scale.y = cTransform.scale.y;
        cTransform.scale.z = cTransform.scale.z;
    }



    onPointerUp(event: PointerEvent): void {
        console.log("interact: pointer up");

        if (this.bDragging) {
            console.log("interact: drop");

            //click logic

            this.onClick();
            //clear the state.
            this.bDragging = false;
            this.selectedEntity = null;
        }
    }

    //don't use document because of uncertain order;
    onClick(): void {
        console.log("interact: click");

        if (this.selectedEntity) {
            this.gui.destroy();
            this.gui = new GUI();
            Utils.showPropertiesGUI(this.selectedEntity!, this.gui!);
        }
    }


    //todo: not mesh?
    hightlightObject(obj: THREE.Object3D): void {

        const outlinePass = this.world.getSystem(SRenderSystem).outlinePass!;
        outlinePass.selectedObjects = [obj as THREE.Mesh];

        console.log("interact: highlighted object");
    }


    deSelectObject(): void {

        const outlinePass = this.world.getSystem(SRenderSystem).outlinePass!;
        outlinePass.selectedObjects = [];
        console.log("interact: deselected object");
    }


}