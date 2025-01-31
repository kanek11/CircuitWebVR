
import * as THREE from "three";
import { Vector3 } from "three";
import { World, Entity, System } from "ecsy";
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as COMP from "./components";
import * as ENTT from "./entities";
import { SRenderSystem } from "./renderSystem";
import { SSimulateSystem } from "./simulateSystem";

import { Globals } from "./globals";
import * as Utils from "./utils";

/**
 * 
 * threejs up direction is y
 * so we use xz plane ;
 * 
 * todo: maybe extract the grid thing;
 */

import { OculusHandPointerModel } from 'three/examples/jsm/webxr/OculusHandPointerModel.js';
import { on } from "events";
import { i } from "mathjs";


function getElementAndNode(entity: Entity): [Entity, Entity, Entity] {
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


// const grid = new THREE.LineSegments(
//     new BoxLineGeometry(6, 6, 6, 10, 10, 10).translate(0, 3, 0),
//     new THREE.LineBasicMaterial({ color: 0xbcbcbc })
// ); 
export const createGrid = (world: World, gridSize: number, gridNum: number) => {

    //inherit from LineSegments
    const grid = new THREE.GridHelper(gridSize, gridNum, 0xff0000, 0x000000);
    grid.name = "grid";
    //disable raycast
    grid.raycast = () => [];

    world.getSystem(SRenderSystem).addToSupportGroup(grid);

    //new: a table model under the grid
    const table = new THREE.Mesh(
        new THREE.BoxGeometry(gridSize, 0.1, gridSize),
        new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1.0, metalness: 0.0 })
    );

    //for now, depend on node size
    table.name = "table";
    table.raycast = () => [];

    table.position.y = -0.05 - 0.0125;

    world.getSystem(SRenderSystem).addToSupportGroup(table);

}



//todo:xyz is kinda messy here
function snapPosToGrid(position: THREE.Vector3): number {

    const spacing = Globals.gridSpacing;
    const gridNum = Globals.gridNum;

    //grid node index: 
    const gridIndexX = Math.round(position.x / spacing);
    const gridIndexY = Math.round(position.y / spacing);
    const gridIndexZ = Math.round(position.z / spacing);

    position.x = gridIndexX * spacing;
    position.y = gridIndexY * spacing;
    position.z = gridIndexZ * spacing;

    const slotID = gridIndexX + gridIndexZ * gridNum;
    return slotID;
}

function snapNode(thisNode: Entity): void {

    const position = thisNode.getMutableComponent(COMP.CTransform)!.position;
    const slotID = snapPosToGrid(position);

    const node = thisNode.getMutableComponent(COMP.CNode)!;
    node.slotID = slotID;

}



export function snapElement(thisElement: Entity): void {
    if (!thisElement.hasComponent(COMP.CElement)) {
        console.error("intersect:not a element!.");
        return;
    }
    const cElement = thisElement.getComponent(COMP.CElement)!;

    snapNode(cElement.nodeL);
    snapNode(cElement.nodeR);

    ENTT.OnNodesChange(thisElement);
}




export class SInteractSystem extends System {
    public gui: GUI = new GUI({ autoPlace: true, title: 'Properties' });

    public raycaster: THREE.Raycaster = new THREE.Raycaster();
    private pointerNDC: THREE.Vector2 = new THREE.Vector2();

    public bDragging: boolean = false;
    public hoveredEntity: Entity | null = null;
    public rayDistance: number = 0;

    private renderSystemRef: SRenderSystem | null = null;
    public basePlane: THREE.Plane | null = null;

    // 
    static queries = {
        interactives: {
            components: [COMP.CObject3D],
            listen: { added: true, removed: true, changed: [COMP.CObject3D] }
        },
    };

    init(): void {
        console.log("init interact system");

        this.renderSystemRef = this.world.getSystem(SRenderSystem)!;
        this.basePlane = this.renderSystemRef.basePlane;

        if (this.renderSystemRef.viewMode != 'VR') {
            document.addEventListener('pointermove', (event) => this.onPointerMove(event));
            document.addEventListener('pointerdown', (event) => this.onPointerDown(event));
            document.addEventListener('pointerup', (event) => this.onPointerUp(event));
        }

    }

    execute(delta: number, time: number): void {

    }


    onPointerDown(event: PointerEvent): void {

        if (this.hoveredEntity) {
            this.bDragging = true;
        }
        else {
            this.deClick();
        }

    }


    onPointerUp(event: PointerEvent): void {
        if (this.bDragging) {

            //you can add condition for click here;
            this.onClick(this.hoveredEntity!);
            this.bDragging = false;
        }
    }

    updateRaycaster(event: PointerEvent): void {

        //new: always make sure the raycaster is updated
        this.pointerNDC.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointerNDC.y = - (event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.pointerNDC, this.world.getSystem(SRenderSystem).getCurrentCamera());
    }


    //drag
    onPointerMove(event: PointerEvent, needUpdateRay: boolean = true): void {
        //console.log("interact: pointer move");

        if (needUpdateRay)
            this.updateRaycaster(event);

        const renderSystem = this.world.getSystem(SRenderSystem);

        //you don't need to hit test if you are dragging,
        //wich also allows non-perfect sync between the object and the cursor
        if (!this.bDragging) {
            this.hitTest();
            renderSystem.enableCameraControl();

        }
        else {
            if (!this.hoveredEntity) { console.error("interact: unexpected that dragging without hovered entity"); return; }

            const worldPosition = this.getIntersectionWithPlane();
            this.moveEntity(worldPosition, this.hoveredEntity);
            renderSystem.disableCameraControl();
        }
    }



    hitTest() {
        //this.raycaster.setFromCamera(this.pointerNDC, this.world.getSystem(SRenderSystem).top_camera!);

        //new logic: 
        // selective hit test objs,
        // if already selected, prioritize the selected context and neighbors 
        let intersects: THREE.Intersection[] = [];
        const targetEntity = this.hoveredEntity;
        if (targetEntity) {

            //console.log("interact: hit logic with element");
            const [group, nodeL, nodeR] = getElementAndNode(targetEntity);

            intersects = this.raycaster.intersectObjects([group.getComponent(COMP.CObject3D)!.group, nodeL.getComponent(COMP.CObject3D)!.group, nodeR.getComponent(COMP.CObject3D)!.group], true);

        }

        //if no hit, then check the whole scene
        if (intersects.length == 0) {

            const streamGroup = this.world.getSystem(SRenderSystem).interactiveGroup;

            //arg2 st the test is recursive;
            intersects = this.raycaster.intersectObjects(streamGroup.children, true);
        }

        //if still no hit, a miss.
        if (intersects.length == 0) {
            //console.log("interact: hit no object");
            this.deHoverEntity();
            return;
        }


        //console.log("interact: hit objects num: " + intersects.length);
        const intersection = intersects[0];
        // console.log("interact: hit object name: " + intersection.object.name);
        // console.log("interact: hit object position: " + intersection.point.x + " " + intersection.point.y + " " + intersection.point.z);
        this.rayDistance = intersection.distance;
        const hitObj = intersects[0].object;

        //utilize Array.find
        const hitEntity = this.queries.interactives.results.find(e => {
            if (!e.hasComponent(COMP.CObject3D)) {
                return false;
            }
            const group = e.getComponent(COMP.CObject3D)!.group;
            const bHit = group === hitObj || group.children.includes(hitObj);
            return bHit;
        });


        if (hitEntity) {
            //console.log("interact: hit entity id: " + hitEntity.id + " name: " + hitObj.name);

            this.onHoverEntity(hitEntity);


        } else {
            //console.log("interact: hit invalid object: " + hitObj.name);

            this.deHoverEntity();

        }
    }

    moveEntity(movedToPos: Vector3, entity: Entity): void {

        //
        if (entity.hasComponent(COMP.CNode)) {
            //new: skip if the node is not movable 

            const cThisNode = entity.getComponent(COMP.CNode)!;
            if (!cThisNode.moveable) {
                console.log("interact: node not movable");
                return;
            }


            const cElement = cThisNode.element.getComponent(COMP.CElement)!;
            const size = cElement.elementSize;

            const thisNodePos = entity.getMutableComponent(COMP.CTransform)!.position;
            const otherNodePos = cThisNode.other.getComponent(COMP.CTransform)!.position;

            // new logic: set a minimum distance;  with a little offset  
            const new_dist = movedToPos.distanceTo(otherNodePos);
            // console.log("interact: new dist: " + new_dist);
            if (new_dist < size + 0.05) {
                return;
            }

            thisNodePos.x = movedToPos.x;
            thisNodePos.z = movedToPos.z;

            snapNode(entity);

            ENTT.OnNodesChange(entity.getComponent(COMP.CNode)!.element);

        }
        else if (entity.hasComponent(COMP.CElement)) {

            const elementTransform = entity.getMutableComponent(COMP.CTransform)!.position;

            //save the offset from original position 
            const offsetX = movedToPos.x - elementTransform.x;
            const offsetZ = movedToPos.z - elementTransform.z;

            // update the position of the element
            const cElement = entity.getComponent(COMP.CElement)!;
            const nodePosL = cElement.nodeL.getMutableComponent(COMP.CTransform)!.position;

            nodePosL.x += offsetX;
            nodePosL.z += offsetZ;

            const nodePosR = cElement.nodeR.getMutableComponent(COMP.CTransform)!.position;
            nodePosR.x += offsetX;
            nodePosR.z += offsetZ;

            snapNode(cElement.nodeL);
            snapNode(cElement.nodeR);

            ENTT.OnNodesChange(entity);

        }

    }


    //don't use document click because of uncertain order;
    onClick(entity: Entity): void {
        if (!entity) {
            console.error("interact: invalid entity");
            return;
        }

        //console.log("interact: click");   
        this.gui!.destroy();
        this.gui = new GUI({ autoPlace: true, title: 'Properties' });

        ['pointerdown', 'pointermove', 'pointerup'].forEach(eventType => {
            this.gui!.domElement.addEventListener(eventType, (event) => {
                event.stopPropagation();
            });
        });

        Utils.showPropertiesGUI2(entity, this.gui!, this.world);
    }

    deClick(): void {
        this.gui!.destroy();
    }


    onHoverEntity(entity: Entity): void {
        //console.log("interact: highlighted object");

        if (this.hoveredEntity === entity) return;
        else {
            //if there is a previous hovered entity, dehighlight it;
            this.deHoverEntity();
        }

        this.hoveredEntity = entity;

        const group = entity.getComponent(COMP.CObject3D)!.group;
        group.children.forEach((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            material.emissive.set(0x00ffff);
            material.emissiveIntensity = 1;
        });


    }


    deHoverEntity(): void {
        if (this.hoveredEntity) {
            //console.log("interact: dehighlighted object");

            const entity = this.hoveredEntity;

            const group = entity.getComponent(COMP.CObject3D)!.group;
            group.children.forEach((child) => {
                if (!(child instanceof THREE.Mesh)) return;
                const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
                material.emissive.set(0x000000);
                material.emissiveIntensity = 0.0;
            });
        }


        this.hoveredEntity = null;
        //console.log("interact: deselected object");
    }



    getIntersectionWithPlane(): THREE.Vector3 {

        //utilize built-in ray-plane intersection

        const intersection = new THREE.Vector3();
        if (!this.basePlane) {
            console.error("interact: no intersect plane");
            return intersection;
        }

        this.raycaster.ray.intersectPlane(this.basePlane, intersection);
        console.log("interact: intersection: " + intersection.x + " " + intersection.y + " " + intersection.z);


        if (this.renderSystemRef!.viewMode == 'VR') {
            intersection.z += 0.6;
        }
        return intersection;
    }


}


export class SXRInteractSystemL extends SInteractSystem {

    public handPointer: OculusHandPointerModel | null = null;

    init(): void {
        super.init();
        //this.basePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
        console.log("init xr interact system");
    }

    execute(delta: number, time: number): void {
        //super.execute(delta, time);
        if (!this.handPointer) {
            console.error("interact: xr no hand pointer");
            return;
        }

        this.updateXR();
    }

    setHandPointer(handPointer: OculusHandPointerModel): void {
        this.handPointer = handPointer;
    }
    updateXR(): void {
        //console.log("interact: update xr");

        const hp = this.handPointer!;

        this.raycaster = this.handPointer!.raycaster;
        //this.updateRaycasterXR();
        //this.getIntersectionWithPlane();

        this.onPointerMove(new PointerEvent('pointermove'), false);

        //new: update cursor 
        if (this.hoveredEntity) {
            hp.setCursor(this.rayDistance);
        }
        else {
            hp.setCursor(0.5);
        }

        if (hp.isPinched()) {
            this.onPointerDown(new PointerEvent('pointerdown'));
        }
        else if (!hp.isPinched() && this.bDragging) {
            this.onPointerUp(new PointerEvent('pointerup'));
        }


    }

    updateRaycasterXR(): void {


        // console.log("interact: ray origin: " + this.raycaster.ray.origin.x + " " + this.raycaster.ray.origin.y + " " + this.raycaster.ray.origin.z);
        // console.log("interact: ray direction: " + this.raycaster.ray.direction.x + " " + this.raycaster.ray.direction.y + " " + this.raycaster.ray.direction.z);
    }

}

export class SXRInteractSystemR extends SXRInteractSystemL {

    // init(): void {
    //     super.init();
    //     console.log("init xr interact system");
    // }

    // execute(delta: number, time: number): void {
    //     super.execute(delta, time);
    // }


}



