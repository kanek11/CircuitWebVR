//import * as THREE from '/node_modules/three/build/three.module.js'; //local path
import * as THREE from 'three';  //vite + modern ES6 modules 

import { Scene, Camera, Renderer } from 'three';
//import boxline:
import { BoxLineGeometry } from 'three/examples/jsm/geometries/BoxLineGeometry.js';

const process = {
    stdout: {
        write: (str: string) => console.log(str)
    }
};

export class URenderer {
    public renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene | null = null;
    private camera: THREE.PerspectiveCamera | null = null;
    //private currenSession: XRSession | null = null;

    private cube: THREE.Mesh | null = null;

    private lastFrameTime: number = 0;
    private currentFrameTime: number = 0;


    constructor() {

        this.renderer = new THREE.WebGLRenderer();
        document.body.appendChild(this.renderer.domElement);

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.sceneBuilder();
        this.renderer.setAnimationLoop((time, frame) => this.animationLoop(time, frame));
        this.renderer.xr.enabled = true;

    }

    // public startRender(session: XRSession | null): void {

    //     if (!session) {
    //         console.warn("render: no valid session attached");
    //         return;
    //     }
    //     this.currenSession = session;
    // }


    private animationLoop(t: DOMHighResTimeStamp, frame: XRFrame): void {
        //if (!this.currenSession) { console.warn("no valid session attached"); return; }

        const deltaTime = t - this.lastFrameTime;
        this.lastFrameTime = t;

        this.updateScene();

        //set clear color  
        this.renderer.setClearColor(0x505050);
        this.renderer.render(this.scene!, this.camera!);
    }

    private sceneBuilder() {


        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.6, 3); //override by vr


        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(0, 0, -2);
        this.cube.rotation.set(Math.random(), Math.random(), Math.random());
        this.scene.add(this.cube);

        const room = new THREE.LineSegments(
            new BoxLineGeometry(6, 6, 6, 10, 10, 10).translate(0, 3, 0),
            new THREE.LineBasicMaterial({ color: 0xbcbcbc })
        );
        this.scene.add(room);


        const light = new THREE.DirectionalLight(0xffffff, 3);
        light.position.set(1, 1, 1).normalize();
        this.scene.add(light);
    }

    private updateScene() {
        this.cube!.rotation.x += 0.01;
    }

}



