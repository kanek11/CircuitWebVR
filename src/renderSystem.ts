//import * as THREE from '/node_modules/three/build/three.module.js'; //local path
import * as THREE from 'three';  //vite + modern ES6 modules 
import { WebGLRenderer, Scene, Group, Vector3 } from 'three';
import { BoxLineGeometry } from 'three/examples/jsm/geometries/BoxLineGeometry.js';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { OculusHandModel } from 'three/examples/jsm/webxr/OculusHandModel.js';
import { OculusHandPointerModel } from 'three/examples/jsm/webxr/OculusHandPointerModel.js';

import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js';
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js';

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';


import Stats from 'three/examples/jsm/libs/stats.module.js';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';


import { World, System, Component, Entity, Types } from 'ecsy';

import * as COMP from "./components";
import * as ENTT from "./entities";
import { Globals } from "./globals";


// // Remove destroyed renderable entities from the scene
// this.queries.removed.results.forEach(entity => {
//     const renderable = entity.getComponent(Renderable);
//     //this.scene.remove(renderable.mesh); 
// });

export type ViewMode = "3D" | "top" | "VR";

export class SRenderSystem extends System {
    public renderer: WebGLRenderer = new THREE.WebGLRenderer({ antialias: true });

    //it needs correct resolution, so init is delayed  

    public scene: Scene = new THREE.Scene();
    public interactiveGroup: Group = new THREE.Group();  //for saving and loading
    public supportGroup: Group = new THREE.Group();  //not saved but relevant
    public basePlane = new THREE.Plane(new Vector3(0, 1, 0), 0);  //pure math

    public stats: Stats = new Stats();

    public viewMode: ViewMode = "top";
    public main_camera: THREE.PerspectiveCamera | null = null;
    public top_camera: THREE.OrthographicCamera | null = null;

    public cameraControl: OrbitControls | null = null;
    public transformControl: TransformControls | null = null;

    public width = 1.5;

    public envMap: THREE.Texture | null = null;

    public guiGroup: InteractiveGroup | null = null;
    public handPointers: OculusHandPointerModel[] = [];

    public vrButton: HTMLElement | null = null;

    public messageMesh: THREE.Mesh | null = null;
    public messageCanvas: HTMLCanvasElement | null = null;
    public messageTexture: THREE.Texture | null = null;



    static queries = {
        renderables: {
            components: [COMP.CObject3D],
            listen: { added: true, removed: true, changed: true },
        }
    };


    replaceInteractiveGroup(obj: THREE.Group) {

        this.interactiveGroup.clear();
        this.scene.remove(this.interactiveGroup);

        this.interactiveGroup = obj;
        this.scene.add(obj);
    }

    addToInteractiveGroup(obj: THREE.Object3D) {
        this.interactiveGroup.add(obj);
    }

    addToSupportGroup(obj: THREE.Object3D) {
        this.supportGroup.add(obj);
    }



    disableCameraControl() {
        if (this.cameraControl !== null) {
            this.cameraControl.enabled = false;
        }
    }

    enableCameraControl() {
        if (this.cameraControl !== null) {
            this.cameraControl.enabled = true;
        }
    }



    //new:
    setViewMode(mode: ViewMode) {
        this.viewMode = mode;

        // if (mode === "3D") { }
        // else if (mode === "top") { }
        // else if (mode === "VR") { }

    }


    getViewMode(): ViewMode {
        return this.viewMode;
    }

    getCurrentCamera(): THREE.Camera {
        if (this.viewMode === "3D") {
            return this.main_camera!;
        } else if (this.viewMode === "top") {
            return this.top_camera!;
        }

        return this.main_camera!;
    }

    init(): void {
        console.log("init render system");

        this.scene.name = "threejs top-level scene";


        this.interactiveGroup.name = "streamming group";
        this.supportGroup.name = "support group";
        this.scene.add(this.interactiveGroup);
        this.scene.add(this.supportGroup);

        //this.renderer = new THREE.WebGLRenderer();
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // this.renderer.domElement.style.position = "absolute";
        this.renderer.domElement.style.top = "0px";
        this.renderer.domElement.style.left = "0px";
        this.renderer.domElement.style.zIndex = "1"; // 确保 WebGLRenderer 的层级较低

        document.body.appendChild(this.renderer.domElement);


        //enable shadow
        this.renderer.shadowMap.enabled = true; // default THREE.PCFShadowMap


        //events
        window.addEventListener('resize', () => this.onWindowResized());

        //this.scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        this.main_camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.main_camera.position.set(-0.1, 0.4, -0.4);
        this.main_camera.lookAt(0, 0, 0);


        const height = this.width / aspect;
        this.top_camera = new THREE.OrthographicCamera(- this.width / 2, this.width / 2, height / 2, - height / 2, 0.1, 1000);
        this.top_camera.position.set(0, 5, 0);
        this.top_camera.up.set(0, 0, 1);
        this.top_camera.lookAt(0, 0, 0);
        //up being +y 

        //new:
        const axesHelper = new THREE.AxesHelper(1);

        axesHelper.name = "axesHelper";
        axesHelper.raycast = () => null;

        //add light for better 3D understanding
        const light = new THREE.DirectionalLight(0xffffff, 5);
        light.name = "directionalLight";

        light.position.set(-0.5, 0.7, -1);
        this.scene.add(light);

        light.castShadow = true;
        light.shadow.camera.top = 2;
        light.shadow.camera.bottom = - 2;
        light.shadow.camera.right = 2;
        light.shadow.camera.left = - 2;
        light.shadow.mapSize.set(2048, 2048);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        ambientLight.name = "ambientLight";
        this.scene.add(ambientLight);


        //new: stats
        document.body.appendChild(this.stats.dom);

        //new: orbit controls
        this.cameraControl = new OrbitControls(this.main_camera, this.renderer.domElement);
        // 限制相机的旋转角度，防止 sink into y < 0
        this.cameraControl.maxPolarAngle = Math.PI / 2; // 限制最大仰角，90度即水平
        this.cameraControl.minPolarAngle = 0; // 最大允许从上方俯视 


        const debugRoom = new THREE.LineSegments(
            new BoxLineGeometry(6, 6, 6, 10, 10, 10).translate(0, 2.9, 0),
            new THREE.LineBasicMaterial({ color: 0xbcbcbc })
        );
        debugRoom.name = "debugRoom";
        debugRoom.renderOrder = -1;
        debugRoom.raycast = () => null;

        this.scene.add(debugRoom);


        //
        //this.loadEnvMap(); 

        this.createMessagePrompt("test");
        this.updateMessage("test");
    }



    loadEnvMap() {

        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const hdrLoader = new RGBELoader();

        //warn: relative path should be resolved correctly
        hdrLoader.setPath('./assets/textures/')
            .load('env.hdr', (texture) => {
                // 生成 PMREM
                const renderTarget = pmremGenerator.fromEquirectangular(texture);
                this.envMap = renderTarget.texture;

                this.scene.environment = this.envMap;  //auto set for all physical materials
                this.scene.background = this.envMap;  //for skybox view

                //ok to dispose the texture
                texture.dispose();

            }, undefined, (error) => {
                console.error('Error loading HDR:', error);
            });
    }


    execute(delta: number, elapsed: number): void {


        // Add newly created renderable entities to the scene
        this.queries.renderables.added!.forEach(entity => {

            if (entity.hasComponent(COMP.CObject3D)) {
                const cObj = entity.getComponent(COMP.CObject3D)!;
                this.interactiveGroup!.add(cObj.group);
            }

        });


        this.queries.renderables.results.forEach(entity => {
            const cTransform = entity.getComponent(COMP.CTransform) as COMP.CTransform;

            if (entity.hasComponent(COMP.CObject3D)) {
                const obj = entity.getComponent(COMP.CObject3D)!.group!;

                obj.position.copy(cTransform.position);
                obj.rotation.set(cTransform.rotation.x, cTransform.rotation.y, cTransform.rotation.z);
                obj.scale.copy(cTransform.scale);
            }

        });

        this.render();
    }

    render(): void {
        //new: 
        this.stats.update();

        // Render the scene
        this.renderer!.setClearColor(Globals.backGroundColor);

        if (this.viewMode === "3D") {
            this.renderer!.render(this.scene!, this.main_camera!);
        } else if (this.viewMode === "top") {
            this.renderer!.render(this.scene!, this.top_camera!);
        }
        else if (this.viewMode === "VR") {
            this.updateXR();
            this.renderer!.render(this.scene!, this.main_camera!);
        }

        // this.renderer!.render(this.scene!, this.main_camera!);
        //this.renderer!.render(this.scene!, this.top_camera!);
        //this.composer!.render();
    }


    onWindowResized(): void {

        this.renderer!.setSize(window.innerWidth, window.innerHeight);

        const aspect = window.innerWidth / window.innerHeight;
        this.main_camera!.aspect = aspect;
        this.main_camera!.updateProjectionMatrix();

        const height = this.width / aspect;
        this.top_camera!.left = this.width / - 2;
        this.top_camera!.right = this.width / 2;
        this.top_camera!.top = height / 2;
        this.top_camera!.bottom = height / - 2;
        this.top_camera!.updateProjectionMatrix();

    }


    updateXR(): void {

        this.renderer.xr.updateCamera(this.main_camera!);
    }



    initXR(): void {
        console.log("init XR");

        //
        const height = 0.6;
        const forward = 0.6;
        this.interactiveGroup.position.y = height;
        this.interactiveGroup.position.z = -forward;
        this.supportGroup.position.y = height;
        this.supportGroup.position.z = -forward;
        this.basePlane.constant = -height; //warn: negative y goes the normal direction


        this.renderer.xr.enabled = true;
        this.renderer.xr.cameraAutoUpdate = false;

        const sessionInit = {
            requiredFeatures: ['hand-tracking']
        };

        const vrButton = VRButton.createButton(this.renderer, sessionInit);
        this.vrButton = vrButton;

        document.body.appendChild(vrButton);
        ['pointerdown', 'pointerup'].forEach(eventType => {
            vrButton.addEventListener(eventType, (event) => {
                event.stopPropagation();
            });
        });


        this.main_camera!.position.y = height + 0.2;
        this.main_camera!.position.z = 0;
        this.main_camera!.lookAt(0, height, -forward);

        // todo: adjust camera control as camera update
        this.cameraControl!.target.set(0, height, -forward);


        this.initXRControls();
    }

    setVRButtonClickCallback(callback: () => void) {

        if (this.vrButton !== null) {
            this.vrButton.addEventListener('click', callback);
        }
    }

    getHandPointerByIndex(handIndex: number): OculusHandPointerModel | null {
        if (handIndex < this.handPointers.length) {
            return this.handPointers[handIndex];
        }

        return null;
    }

    initXRControls(): void {

        const renderer = this.renderer;
        const scene = this.scene;


        //ray line
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)]);

        // controllers
        const controller1 = renderer.xr.getController(0);
        controller1.name = "controller1";
        controller1.add(new THREE.Line(geometry));


        const controller2 = renderer.xr.getController(1);
        controller2.name = "controller2";
        controller2.add(new THREE.Line(geometry));


        //models
        const controllerModelFactory = new XRControllerModelFactory();

        // Hand 1
        const controllerGrip1 = renderer.xr.getControllerGrip(0);
        controllerGrip1.name = "controllerGrip1";
        controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));


        const hand1 = renderer.xr.getHand(0);
        hand1.name = "hand1";
        hand1.add(new OculusHandModel(hand1));
        const handPointer1 = new OculusHandPointerModel(hand1, controller1);
        hand1.add(handPointer1);
        this.handPointers.push(handPointer1);

        // Hand 2
        const controllerGrip2 = renderer.xr.getControllerGrip(1);
        controllerGrip2.name = "controllerGrip2";
        controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));

        const hand2 = renderer.xr.getHand(1);
        hand2.name = "hand2";
        hand2.add(new OculusHandModel(hand2));
        const handPointer2 = new OculusHandPointerModel(hand2, controller2);
        hand2.add(handPointer2);
        this.handPointers.push(handPointer2);



        scene.add(controller1);
        scene.add(controller2);
        scene.add(controllerGrip1);
        scene.add(controllerGrip2);
        scene.add(hand1);
        scene.add(hand2);


        const guiGroup = new InteractiveGroup();
        this.guiGroup = guiGroup;
        scene.add(guiGroup);

        guiGroup.listenToPointerEvents(renderer, this.main_camera!);
        guiGroup.listenToXRControllerEvents(controller1);
        guiGroup.listenToXRControllerEvents(controller2);


        this.interactiveGroup.add(guiGroup);


    }


    domElementToHTMLMesh(domElement: HTMLElement): HTMLMesh {

        const mesh = new HTMLMesh(domElement);
        //mesh.addEventListener

        this.guiGroup!.add(mesh);

        return mesh;

    }


    createMessagePrompt(message: string): void {

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        canvas.style.position = "absolute";
        canvas.style.top = "90%";
        canvas.style.left = "50%";
        canvas.style.transform = "translate(-50%, -50%)";
        canvas.style.zIndex = "2";

        document.body.appendChild(canvas);

        this.messageCanvas = canvas;

    }

    updateMessage(message: string): void {


        const ctx = this.messageCanvas!.getContext('2d')!;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = '24px Arial';
        ctx.fillText(message, 10, 50);

        //console.log("update message: ", message);

        if (this.messageTexture !== null) {
            this.messageTexture.needsUpdate = true;
        }

    }

    messageCanvasToTexture(): THREE.Mesh {


        const texture = new THREE.CanvasTexture(this.messageCanvas!);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });

        const geometry = new THREE.PlaneGeometry(0.2, 0.1);
        const mesh = new THREE.Mesh(geometry, material);

        this.messageMesh = mesh;
        this.messageTexture = texture;

        return mesh;
    }


}




