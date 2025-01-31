
import { World, Component, Entity, System, Types } from 'ecsy';
import * as THREE from 'three';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { SRenderSystem } from './renderSystem';
import { SInteractSystem } from './interactSystem';

import * as Utils from './utils';
import { Globals } from "./globals";


/**
 * Browser System will be decoupled from details of interaction methods.
 */

export class SBrowserSystem extends System {
    public gui: GUI = new GUI({ title: 'Browser' });

    private bDragging: boolean = false;
    private currentFactory: ENTT.EntityFactory2<any> | null = null;

    static queries = {
    };

    init(): void {
        console.log("init browser system");

        document.addEventListener('pointermove', (event) => this.onPointermove(event));
        document.addEventListener('pointerup', (event) => this.onPointerUp(event));

        for (const key in Utils.elementFactoryMap) {
            this.registerPrototype(key, Utils.elementFactoryMap[key as keyof typeof Utils.elementFactoryMap]());
        }
    }

    //manually add prototypes here for now， todo: more cohesive;
    registerPrototype(_name: string, _factory: ENTT.EntityFactory2<any>): void {

        //the event can capture the required context
        const controller = this.gui.add({ asset: _name }, 'asset').name(_name);
        controller.domElement.addEventListener('pointerdown', (event) => {
            this.currentFactory = _factory;
            this.triggerDrag(event);
        });

        // const img = document.createElement('img');
        // img.src = './lighting.jpg';
        // img.style.width = '100%'; // 图片宽度适应容器宽度，不然会保持原分辨率
        // img.style.height = 'auto'; //  
        // img.addEventListener('pointerdown', (event) => {
        //     console.log("img pointer down");
        //     //event.stopPropagation();
        //     event.preventDefault();  //原img element有默认行为，会导致pointerup事件不触发
        // });


        // controller.domElement.innerHTML = '';
        // controller.domElement.style.flexDirection = 'column';

        // const text = document.createElement('div');
        // text.textContent = 'Lighting Preview'; // 替换为你的文字
        // text.style.textAlign = 'center';
        // text.style.marginTop = '10px';
        // text.style.fontSize = '14px';
        // controller.domElement.appendChild(text);

        // controller.domElement.appendChild(img);


    }


    execute(delta: number, time: number): void {
    }

    triggerDrag(event: PointerEvent): void {

        console.log("browser: trigger drag");
        this.bDragging = true;
    }

    onPointermove(event: PointerEvent): void {
        if (!this.bDragging) return;

        //todo: show a preview of the object
    }

    onPointerUp(event: PointerEvent): void {
        if (!this.bDragging) return;
        console.log("browser: drop");

        //new logic: won't drop if the mouse is still in the gui
        if (this.gui.domElement.contains(event.target as Node)) {
            console.log("mouse still in gui, cancel drop");
            return;
        }

        //spawn a new entity
        //const worldPosition = this.mouseToWorldPosition(event);   
        //const worldPosition = Utils.PixelToWorld(event, this.world.getSystem(SRenderSystem).top_camera!);

        const interactSystem = this.world.getSystem(SInteractSystem);
        const worldPosition = interactSystem.getIntersectionWithPlane(event);

        const instance = ENTT.spawnEntity2(this.world, this.currentFactory!, worldPosition);
        //todo: more debug info?  

        //clear the state.
        this.bDragging = false;
        this.currentFactory = null;

    }


}