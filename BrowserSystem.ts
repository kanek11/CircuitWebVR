import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { World, Component, Entity, System, Types } from 'ecsy';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { Vector2, Vector3 } from 'three';
import { SRenderSystem } from './renderSystem';
import { SInteractSystem } from './interactSystem';

import * as Utils from './utils';





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
    private currentFactory: EntityFactory | null = null;


    static queries = {
        prototypes: {
            components: [COMP.CPrototype],
            listen: { added: true, removed: true }
        },
    };

    init(): void {
        console.log("init browser system");

        //move the gui to the top left  
        this.gui.domElement.style.left = '0px';

        document.addEventListener('pointermove', (event) => this.onDrag(event));
        document.addEventListener('pointerup', (event) => this.onDrop(event));


        this.registerPrototype('wire', ENTT.createElement);
        this.registerPrototype('resistor', ENTT.createResistor);
        this.registerPrototype('voltage', ENTT.createDCVoltage);

        this.registerPrototype('inductor', ENTT.createInductor);
        this.registerPrototype('capacitor', ENTT.createCapacitor);
    }



    //manually add prototypes here for now， todo: more cohesive;
    registerPrototype(_name: string, factory: EntityFactory): void {

        // entity.addComponent(COMP.CPrototype, { name: _name });

        const controller = this.gui.add({ asset: _name }, 'asset').name(_name);
        controller.domElement.addEventListener('pointerdown', (event) => {
            this.currentFactory = factory;
            this.triggerDrag(event);
        });
        this.prototypeManager.addPrototype(_name, factory);
    }


    execute(delta: number, time: number): void {
    }

    triggerDrag(event: PointerEvent): void {
        console.log("browser: trigger drag");
        //console.log("select: " + name);
        this.bDragging = true;
    }

    onDrag(event: PointerEvent): void {
        if (!this.bDragging) return;
        //console.log("on drag " + event.clientX + " " + event.clientY);
    }

    onDrop(event: PointerEvent): void {
        if (!this.bDragging) return;
        console.log("browser: drop");

        //spawn a new entity

        //const worldPosition = this.mouseToWorldPosition(event);   
        const worldPosition = Utils.ScreenToWorld(event, this.world.getSystem(SRenderSystem).top_camera!);

        const instance = ENTT.spawnEntity(this.world, this.currentFactory!, worldPosition);
        //todo: more debug info?


        //new:
        const interactSystem = this.world.getSystem(SInteractSystem);
        interactSystem.snapElement(instance);

        //clear the state.
        this.bDragging = false;
        this.currentFactory = null;
    }


}