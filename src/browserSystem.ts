
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
    public gui: GUI = new GUI({ title: 'Browser', width: 150 });

    private bDragging: boolean = false;
    private currentFactory: ENTT.EntityFactory2<any> | null = null;

    private interactSystemRef: SInteractSystem | null = null;

    static queries = {
    };

    init(): void {
        console.log("init browser system");

        this.interactSystemRef = this.world.getSystem(SInteractSystem);

        for (const key in Utils.elementFactoryMap) {
            this.registerPrototype(key, Utils.elementFactoryMap[key as keyof typeof Utils.elementFactoryMap]());
        }
    }

    //manually add prototypes here for now， todo: more cohesive;
    registerPrototype(_name: string, _factory: ENTT.EntityFactory2<any>): void {

        //the event can capture the required context
        const controller = this.gui.add({ asset: _name }, 'asset').name(_name);

        const img = document.createElement('img');
        img.src = './assets/textures/' + _name + '.png';
        img.style.width = '100%'; // 图片宽度适应容器宽度，不然会保持原分辨率
        img.style.height = 'auto'; //  
        img.addEventListener('pointerdown', (event) => {
            //console.log("img pointer down");
            //event.stopPropagation();
            event.preventDefault();  //原img element有默认行为，会导致pointerup事件不触发
        });


        controller.domElement.innerHTML = '';
        controller.domElement.style.flexDirection = 'column';

        // const text = document.createElement('div');
        // text.textContent = _name;
        // text.style.textAlign = 'center';
        // text.style.marginTop = '10px';
        // text.style.fontSize = '14px';
        // controller.domElement.appendChild(text);

        controller.domElement.appendChild(img);

        controller.domElement.addEventListener('pointerdown', (event) => {
            this.currentFactory = _factory;
            this.onPointerdown(event);
        });

        // controller.domElement.addEventListener('pointermove', (event) => {
        //     console.log("pointer move: x=" + event.clientX + ", y=" + event.clientY);
        // });

        this.gui.add({ spawn: () => { ENTT.spawnEntity2(this.world, _factory); } }, 'spawn').name('spawn ' + _name);
    }


    changeGUIForXR(): void {

        this.gui.children.forEach((controller) => {
            controller.destroy();
        });

    }


    execute(delta: number, time: number): void {
    }

    onPointerdown(event: PointerEvent): void {

        //console.log("browser: trigger pointer down");
        this.bDragging = true;

        const interactSystem = this.world.getSystem(SInteractSystem);
        const worldPosition = interactSystem.getIntersectionWithPlane();

        const entity = ENTT.spawnEntity2(this.world, this.currentFactory!, worldPosition);

        this.interactSystemRef!.onHoverEntity(entity);
        this.interactSystemRef!.onPointerDown(event);
    }




}