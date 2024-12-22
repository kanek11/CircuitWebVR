import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { World, Component, Entity, System, Types } from 'ecsy';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { Vector2, Vector3 } from 'three';
import { SRenderSystem } from './renderSystem';





//alias of factory
export type EntityFactory = (world: World) => Entity;

export class PrototypeManager {
    public prototypes: Map<string, EntityFactory> = new Map();

    public addPrototype = (name: string, factory: EntityFactory) => {
        this.prototypes.set(name, factory);
    }

    public getPrototype = (name: string): EntityFactory | undefined => {
        return this.prototypes.get(name);
    }
}


export class SBrowserSystem extends System {
    public gui: GUI = new GUI();

    private prototypeManager: PrototypeManager = new PrototypeManager();

    private bDragging: boolean = false;
    private currentPrototype: Entity | null = null;


    static queries = {
        sceneObjects: {
            components: [COMP.CPrototype],
            listen: { added: true, removed: true }
        },
    };

    init(): void {

        //move the gui to the top left  
        this.gui.domElement.style.left = '0px';
        // this.gui.domElement.style.top = '50px';


        document.addEventListener('pointermove', (event) => this.onDrag(event));
        document.addEventListener('pointerup', (event) => this.onDrop(event));


        //manually add prototypes here for now， todo: more cohesive;
        this.prototypeManager.addPrototype('box', ENTT.createBox);


    }


    addToBrowser(entity: Entity): void {

        this.currentPrototype = entity;
        const proxy = entity.getComponent(COMP.CPrototype) as COMP.CPrototype;
        const controller = this.gui.add({ asset: proxy.name }, 'asset').name(proxy.name);

        //add event listener
        controller.domElement.addEventListener('pointerdown', (event) => {
            this.triggerDrag(event);
        });

        //console.log("browser added: " + name); 

    }

    execute(delta: number, time: number): void {
        //query all resources/entities registered in the world 
        this.queries.sceneObjects.added!.forEach(entity => {
            this.addToBrowser(entity);
        });
    }

    triggerDrag(event: PointerEvent): void {
        console.log("drag");
        //console.log("select: " + name);
        this.bDragging = true;
    }

    onDrag(event: PointerEvent): void {
        if (!this.bDragging) return;
        console.log("on drag " + event.clientX + " " + event.clientY);
    }

    onDrop(event: PointerEvent): void {
        if (!this.bDragging) return;
        console.log("drop");

        //spawn a new entity
        const instance = ENTT.spawnEntity(this.world, this.prototypeManager.getPrototype('box')!);

        const worldPosition = this.mouseToWorldPosition(event);
        console.log("pointer position: " + event.clientX + " " + event.clientY);
        console.log("world position: " + worldPosition.x + " " + worldPosition.y + " " + worldPosition.z);

        instance.getMutableComponent(COMP.CTransform)!.position = worldPosition;



        //clear the state.
        this.bDragging = false;
        this.currentPrototype = null;
    }

    mouseToWorldPosition(event: MouseEvent): Vector3 {

        const camera = this.world.getSystem(SRenderSystem).top_camera!;

        // Step 1: Convert screen coordinates to NDC
        const ndc = new Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,  // X: [0, window.width] -> [-1, 1]
            -(event.clientY / window.innerHeight) * 2 + 1 // Y: [0, window.height] -> [-1, 1]
        );

        // Step 2: Map NDC to world space using the orthographic camera
        const worldPosition = new Vector3(
            ndc.x * (camera.right - camera.left) / 2 + (camera.right + camera.left) / 2, // Map X
            0, // Y = 0 because it's a horizontal plane
            -(ndc.y * (camera.top - camera.bottom) / 2 + (camera.top + camera.bottom) / 2) // Map Z, also flip it
        );

        return worldPosition;


    }



}