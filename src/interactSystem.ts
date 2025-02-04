
import * as THREE from "three";
import { Vector3 } from "three";
import { World, Entity, System } from "ecsy";
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import * as COMP from "./components";
import * as ENTT from "./entities";
import { SRenderSystem } from "./renderSystem";

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
    grid.renderOrder = Globals.gridRenderOrder;

    world.getSystem(SRenderSystem).addToSupportGroup(grid);

    //new: a table model under the grid
    const table = new THREE.Mesh(
        new THREE.BoxGeometry(gridSize, 0.1, gridSize),
        new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1.0, metalness: 0.0 })
    );

    //for now, depend on node size
    table.receiveShadow = true;
    table.name = "table";
    table.renderOrder = Globals.tableRenderOrder;
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
    public gui: GUI = new GUI({ title: 'Properties' });
    public dynamicFolder: GUI | null = null;

    public raycaster: THREE.Raycaster = new THREE.Raycaster();
    private pointerNDC: THREE.Vector2 = new THREE.Vector2();

    public bDragging: boolean = false;
    public hoveredEntity: Entity | null = null;
    public rayDistance: number = 0;

    public renderSystemRef: SRenderSystem | null = null;
    public basePlane: THREE.Plane | null = null;

    public dirtyFolder: boolean = false;

    public bMovingTopCamera: boolean = false;
    public lastMousePos: THREE.Vector2 = new THREE.Vector2();

    // 
    static queries = {
        interactives: {
            components: [COMP.CObject3D],
            listen: { added: true, removed: true, changed: [COMP.CObject3D] }
        },
    };

    init(): void {
        console.log("init interact system");

        //this.dynamicFolder = this.gui.addFolder('No object');

        this.renderSystemRef = this.world.getSystem(SRenderSystem)!;
        this.basePlane = this.renderSystemRef.basePlane;

        if (this.renderSystemRef.viewMode != 'VR') {
            document.addEventListener('pointermove', (event) => this.onPointermove(event));
            document.addEventListener('pointerdown', (event) => this.onPointerDown(event));
            document.addEventListener('pointerup', (event) => this.onPointerUp(event));


        }

    }

    execute(delta: number, time: number): void {

    }

    onPointerDown(event: PointerEvent): void {

        if (event.button === 2 && this.renderSystemRef!.viewMode == 'top') { // 右键按下

            this.bMovingTopCamera = true;
            this.lastMousePos.x = event.clientX;
            this.lastMousePos.y = event.clientY;


            console.log("interact: right click");
        }


        else if (event.button === 0) { // 左键按下

            if (this.hoveredEntity) {
                this.bDragging = true;
            }
            else {
                this.deClick();
            }
        }

    }

    onPointerUp(event: PointerEvent): void {

        if (this.bMovingTopCamera && this.renderSystemRef!.viewMode == 'top') { // 右键抬起
            //console.log("interact: right click up");
            this.bMovingTopCamera = false;
        }

        else
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
    onPointermove(event: PointerEvent, needUpdateRay: boolean = true): void {
        //console.log("interact: pointer move"); 

        if (this.bMovingTopCamera && this.renderSystemRef!.viewMode == 'top') {

            const deltaX = event.clientX - this.lastMousePos.x;
            const deltaY = event.clientY - this.lastMousePos.y;

            const camera = this.renderSystemRef!.top_camera!;
            const worldOffset = Utils.PixelOffsetToWorld(deltaX, deltaY, camera);
            camera.position.x += worldOffset.x;
            camera.position.z += worldOffset.z;

            this.lastMousePos.x = event.clientX;
            this.lastMousePos.y = event.clientY;
            return;
        }



        //note event and animation is not in sync,so we need to update the raycaster here
        if (needUpdateRay) {
            this.updateRaycaster(event);
        }

        //you don't need to hit test if you are dragging,
        //wich also allows non-perfect sync between the object and the cursor
        if (!this.bDragging) {
            this.hitTest();
            this.renderSystemRef!.enableCameraControl();

        }
        else {
            if (!this.hoveredEntity) { console.error("interact: unexpected that dragging without hovered entity"); return; }

            const worldPosition = this.getIntersectionWithPlane();
            this.moveEntity(worldPosition, this.hoveredEntity);
            this.renderSystemRef!.disableCameraControl();
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
            const [group, nodeL, nodeR] = ENTT.getElementAndNode(targetEntity);

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

        //new: destroy all children folders of the gui
        this.gui.children.forEach((child) => {
            child.domElement.dispatchEvent(new CustomEvent('destroy'));
            child.destroy();
        });

        //this.folder = new GUI({ title: 'Properties' });\
        let name: string = "Prop";
        if (entity.hasComponent(COMP.CElement)) {
            name = this.hoveredEntity!.getComponent(COMP.CElementMetaInfo)!.name;
        }
        else if (entity.hasComponent(COMP.CNode)) {
            name = "Node";
        }
        this.dynamicFolder = this.gui.addFolder(name);

        Utils.showPropertiesGUI2(entity, this.dynamicFolder!, this.world);

        this.dirtyFolder = true;
    }

    deClick(): void {
        // if (!this.dynamicFolder) {
        //     return;
        // }
        // this.dynamicFolder.domElement.dispatchEvent(new CustomEvent('destroy'));
        // this.dynamicFolder.destroy();
        // this.dynamicFolder = null;
    }


    onHoverEntity(entity: Entity): void {
        //console.log("interact: highlighted object");
        //for correct state transition
        //if there is a previous hovered entity, dehighlight it;   
        if (this.hoveredEntity === entity) return;
        else {
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
        //console.log("interact: intersection: " + intersection.x + " " + intersection.y + " " + intersection.z); 

        //todo: don't hardcode
        if (this.renderSystemRef!.viewMode == 'VR') {
            intersection.z += 0.6;
        }
        return intersection;
    }


}


export class SXRInteractSystemL extends SInteractSystem {

    public handPointer: OculusHandPointerModel | null = null;

    public guiMesh: HTMLMesh | null = null;

    init(): void {
        super.init();
        console.log("init xr interact system");

        this.dynamicFolder?.domElement.addEventListener('destroy', () => {

            if (this.guiMesh) {
                this.guiMesh.removeFromParent();
                this.guiMesh.geometry.dispose();
                this.guiMesh.material.dispose();
                console.log("interact:destroy prop mesh");
            }
        });

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

        this.onPointermove(new PointerEvent('pointermove'), false);

        //new: update cursor 
        if (this.hoveredEntity) {
            hp.setCursor(this.rayDistance);
        }
        else {
            hp.setCursor(5);
        }

        if (hp.isPinched()) {
            this.onPointerDown(new PointerEvent('pointerdown'));
        }
        else if (!hp.isPinched() && this.bDragging) {
            this.onPointerUp(new PointerEvent('pointerup'));
        }


        if (this.dirtyFolder) {
            this.dirtyFolder = false;

            this.dynamicFolder?.domElement.addEventListener('destroy', () => {
                if (this.dynamicFolder) {
                    this.dynamicFolder.destroy();
                    this.dynamicFolder = null;
                }

                if (this.guiMesh) {
                    this.guiMesh.removeFromParent();
                    this.guiMesh.geometry.dispose();
                    this.guiMesh.material.dispose();
                    console.log("interact:destroy prop mesh");
                }
            });

            this.guiMesh = this.renderSystemRef!.domElementToHTMLMesh(this.dynamicFolder!.domElement);
            this.guiMesh.position.set(0.4, 0.3, 0);
            this.guiMesh.material.side = THREE.DoubleSide;

            console.log("interact:update prop mesh");

        }

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



