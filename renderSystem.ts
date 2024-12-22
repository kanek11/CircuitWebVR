//import * as THREE from '/node_modules/three/build/three.module.js'; //local path
import * as THREE from 'three';  //vite + modern ES6 modules 
import { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';


import { World, System, Component, Entity, Types } from 'ecsy';

import * as COMP from "./components";

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';



export class SRenderSystem extends System {
    public renderer: WebGLRenderer = new THREE.WebGLRenderer();
    public scene: Scene = new THREE.Scene();
    private stats: Stats = new Stats();
    private gui: GUI = new GUI();


    public main_camera: PerspectiveCamera | null = null;
    public top_camera: THREE.OrthographicCamera | null = null;

    static queries = {
        renderables: {
            components: [COMP.CRenderable],
            listen: { added: true, removed: true }
        }
    };


    init(): void {

        //this.renderer = new THREE.WebGLRenderer();
        //this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);


        document.body.appendChild(this.renderer.domElement);


        //resize
        window.addEventListener('resize', () => this.onWindowResized());

        // //this.renderer.xr.enabled = true;
        // //this.renderer.xr.cameraAutoUpdate = false; 

        // const sessionInit = {
        //   requiredFeatures: ['hand-tracking']
        // };
        //document.body.appendChild(VRButton.createButton(this.renderer, sessionInit));

        //this.scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        this.main_camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.main_camera.position.set(0, 1.7, 4); //override by vr   
        this.main_camera.lookAt(0, 0, 0);

        const width = 2.0;
        const height = width / aspect;
        this.top_camera = new THREE.OrthographicCamera(width / - 2, width / 2, height / 2, height / - 2, 0.1, 1000);
        this.top_camera.position.set(0, 5, 0);
        this.top_camera.lookAt(0, 0, 0);


        //new:
        //document.body.appendChild(this.stats.dom);

    }


    execute(delta: number, elapsed: number): void {
        // Render the scene
        //console.log("execute");

        // Add newly created renderable entities to the scene
        this.queries.renderables.added!.forEach(entity => {
            const cObj = entity.getComponent(COMP.CObject3D) as COMP.CObject3D;

            this.scene!.add(cObj.object);
            console.log("Entity added:" + entity.id);
        });

        // // Remove destroyed renderable entities from the scene
        // this.queries.removed.results.forEach(entity => {
        //     const renderable = entity.getComponent(Renderable);
        //     //this.scene.remove(renderable.mesh); 
        // });

        this.queries.renderables.results.forEach(entity => {
            const cTransform = entity.getComponent(COMP.CTransform) as COMP.CTransform;
            const obj = entity.getComponent(COMP.CObject3D)?.object;

            // // Update properties for mesh
            // if (obj instanceof THREE.Mesh) {
            //     obj.rotation.x += 0.01;
            //     obj.rotation.y += 0.01;
            // }

            obj!.position.set(cTransform.position.x, cTransform.position.y, cTransform.position.z);
            obj!.rotation.set(cTransform.rotation.x, cTransform.rotation.y, cTransform.rotation.z);
            obj!.scale.set(cTransform.scale.x, cTransform.scale.y, cTransform.scale.z);

        });

        //new:
        //this.stats.update();  ..off for now

        // Render the scene
        this.renderer!.setClearColor(0x505050);
        //this.renderer!.render(this.scene!, this.main_camera!);
        this.renderer!.render(this.scene!, this.top_camera!);
    }


    onWindowResized(): void {


        this.renderer!.setSize(window.innerWidth, window.innerHeight);

        const aspect = window.innerWidth / window.innerHeight;
        this.main_camera!.aspect = aspect;
        this.main_camera!.updateProjectionMatrix();


        const width = 2.0;
        const height = width / aspect;
        this.top_camera!.left = width / - 2;
        this.top_camera!.right = width / 2;
        this.top_camera!.top = height / 2;
        this.top_camera!.bottom = height / - 2;
        this.top_camera!.updateProjectionMatrix();



    }


}



