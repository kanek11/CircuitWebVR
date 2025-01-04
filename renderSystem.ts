//import * as THREE from '/node_modules/three/build/three.module.js'; //local path
import * as THREE from 'three';  //vite + modern ES6 modules 
import { WebGLRenderer, Scene } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';


import Stats from 'three/examples/jsm/libs/stats.module.js';


import { World, System, Component, Entity, Types } from 'ecsy';

import * as COMP from "./components";

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';



// // Remove destroyed renderable entities from the scene
// this.queries.removed.results.forEach(entity => {
//     const renderable = entity.getComponent(Renderable);
//     //this.scene.remove(renderable.mesh); 
// });


export class SRenderSystem extends System {
    public renderer: WebGLRenderer = new THREE.WebGLRenderer();

    //it needs correct resolution, so init is delayed
    private composer: EffectComposer | null = null;
    public renderPass: RenderPass | null = null;
    public outlinePass: OutlinePass | null = null;

    public scene: Scene = new THREE.Scene();


    private stats: Stats = new Stats();
    private gui: GUI = new GUI();


    public main_camera: THREE.PerspectiveCamera | null = null;
    public top_camera: THREE.OrthographicCamera | null = null;

    static queries = {
        renderables: {
            components: [COMP.CRenderable],
            listen: { added: true, removed: true }
        }
    };


    init(): void {

        console.log("init render system");

        //this.renderer = new THREE.WebGLRenderer();
        //this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // 确保 WebXR 的 canvas 不覆盖 Three.js
        this.renderer.domElement.style.position = "absolute";
        this.renderer.domElement.style.top = "0px";
        this.renderer.domElement.style.left = "0px";


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

        const width = 1.5;
        const height = width / aspect;
        this.top_camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, - height / 2, 0.1, 1000);
        this.top_camera.position.set(0, 5, 0);
        this.top_camera.up.set(0, 0, 1);
        this.top_camera.lookAt(0, 0, 0);
        //up being +y

        const axesHelper = new THREE.AxesHelper(1);
        this.scene.add(axesHelper);

        //new:
        //document.body.appendChild(this.stats.dom); 


        //composer
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.top_camera);
        this.composer.addPass(this.renderPass);

        this.outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            this.scene,
            this.top_camera
        );

        this.composer.addPass(this.outlinePass);
        this.outlinePass.selectedObjects = [];

        this.outlinePass.edgeStrength = 3; // 边缘强度
        this.outlinePass.edgeGlow = 0.5;  // 边缘光晕
        this.outlinePass.edgeThickness = 2; // 边缘厚度
        this.outlinePass.pulsePeriod = 0; // 呼吸效果（0 表示关闭）
        this.outlinePass.visibleEdgeColor.set('#ffffff'); // 描边颜色
        this.outlinePass.hiddenEdgeColor.set('#000000'); // 被遮挡的边缘颜色

        //disable depth buffer
        this.outlinePass.depthMaterial.depthTest = false; // 避免深度测试
        this.outlinePass.depthMaterial.depthWrite = false; // 避免写入深度缓冲区

        // const outputPass = new OutputPass();
        // this.composer.addPass(outputPass); 

    }


    execute(delta: number, elapsed: number): void {
        // Render the scene
        //console.log("execute");

        // Add newly created renderable entities to the scene
        this.queries.renderables.added!.forEach(entity => {

            if (entity.hasComponent(COMP.CObject3D)) {
                const cObj = entity.getComponent(COMP.CObject3D) as COMP.CObject3D;
                this.scene!.add(cObj.object);
                console.log("Entity with object3D added:" + entity.id);
            }

        });


        this.queries.renderables.results.forEach(entity => {
            const cTransform = entity.getComponent(COMP.CTransform) as COMP.CTransform;

            if (entity.hasComponent(COMP.CObject3D)) {
                const obj = entity.getComponent(COMP.CObject3D)!.object;

                obj!.position.set(cTransform.position.x, cTransform.position.y, cTransform.position.z);
                obj!.rotation.set(cTransform.rotation.x, cTransform.rotation.y, cTransform.rotation.z);
                obj!.scale.set(cTransform.scale.x, cTransform.scale.y, cTransform.scale.z);
            }

        });

        //new:
        //this.stats.update();  ..off for now

        // Render the scene
        this.renderer!.setClearColor(0x808080);
        //this.renderer!.render(this.scene!, this.main_camera!);
        //this.renderer!.render(this.scene!, this.top_camera!);
        this.composer!.render();
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



