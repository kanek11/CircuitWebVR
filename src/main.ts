/*
*bootstrapping the app
*/

import * as THREE from 'three';
import { WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';

import { World, System, Component, Entity, Types } from 'ecsy';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as math from 'mathjs';
import { exp, complex, pi } from 'mathjs'

import * as COMP from "./components";
import * as ENTT from "./entities";

import { SRenderSystem, ViewMode } from "./renderSystem";
import { SInteractSystem, SXRInteractSystemL, SXRInteractSystemR, createGrid } from "./interactSystem";
import { SSimulateSystem } from "./simulateSystem";
import { SElementBehaviorSystem, SCurrentRenderSystem } from './behaviorSystem';
import { SLabelSystem } from './labelSystem';
import { SBrowserSystem } from './browserSystem';
import { SGraphSystem } from './graphSystem';

import { Globals } from "./globals";

import * as Utils from "./utils";
import * as Field from "./field";


const Samples = {
  'none': '',
  '2024': './samples/circuit2024.json',
  '2023_1': './samples/circuit2023_1.json',
  '2023_2': './samples/circuit2023_2.json',
  '2021': './samples/circuit2021.json',
};

class Timer {
  private startTime: number;
  private lastTime: number;
  private delta: number = 0;

  public accumlatedTime: number = 0;

  private paused: boolean = false;
  private pauseStartTime: number = 0;

  constructor() {
    this.startTime = performance.now();
    this.lastTime = this.startTime;
  }

  update(): void {
    if (this.paused) {
      this.delta = 0;
      this.lastTime = performance.now();
      return;
    }
    const currentTime = performance.now();
    this.delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    this.accumlatedTime += this.delta;
  }

  getDelta(): number {
    return this.delta;
  }

  getTime(): number {
    return (performance.now() - this.startTime) / 1000;
  }


  pause() {
    this.paused = true;
    this.pauseStartTime = performance.now();
  }

  resume() {
    this.paused = false;
    this.startTime += performance.now() - this.pauseStartTime;  //add back the duration
  }

}





function initEditor(world: World) {
  world
    .registerComponent(COMP.CTransform)
    .registerComponent(COMP.CObject3D)
    .registerComponent(COMP.CElementMetaInfo)
    .registerComponent(COMP.CElement)
    .registerComponent(COMP.CNode)
    .registerComponent(COMP.CResistance)
    .registerComponent(COMP.CDCVoltage)
    .registerComponent(COMP.CACVoltage)
    .registerComponent(COMP.CInductance)
    .registerComponent(COMP.CCapacitance)
    .registerComponent(COMP.CWire)
    .registerComponent(COMP.CLabel3D)
    .registerSystem(SRenderSystem)
    .registerSystem(SInteractSystem)
    .registerSystem(SSimulateSystem)
    .registerSystem(SBrowserSystem)
    .registerSystem(SElementBehaviorSystem)
    .registerSystem(SCurrentRenderSystem)
    .registerSystem(SLabelSystem)
    .registerSystem(SGraphSystem)
    ;

}



function printSceneInfo(scene: THREE.Object3D) {
  console.log("scene info: ");
  scene.traverse((child) => {
    console.log("child: ", child);
  });
}




function debugView(world: World) {

  world
    .registerComponent(COMP.CTransform)
    .registerComponent(COMP.CObject3D)
    .registerComponent(COMP.CElementMetaInfo)
    .registerComponent(COMP.CElement)
    .registerComponent(COMP.CNode)
    .registerComponent(COMP.CResistance)
    .registerComponent(COMP.CDCVoltage)
    .registerComponent(COMP.CInductance)
    .registerComponent(COMP.CCapacitance)
    .registerComponent(COMP.CWire)
    .registerComponent(COMP.CLabel3D)
    .registerSystem(SRenderSystem)
    //.registerSystem(SInteractSystem)
    //.registerSystem(SSimulateSystem)
    .registerSystem(SBrowserSystem)
    //.registerSystem(SElementBehaviorSystem)
    //.registerSystem(SCurrentRenderSystem)
    //.registerSystem(SLabelSystem)
    ;

}






class App {
  //public renderer: WebGLRenderer;
  public world: World = new World({ entityPoolSize: 100 });

  public timer: Timer = new Timer();
  public running: boolean = true;

  public systemGUI: GUI | null = null;

  constructor() {
  }

  //stepup needs to have initialized systems, could be done here.
  init() {

    initEditor(this.world);
    //debugView(this.world);   


    const renderSystem = this.world.getSystem(SRenderSystem);
    renderSystem.renderer.setAnimationLoop(animate);


    createGrid(this.world, Globals.gridSize, Globals.gridNum);

    this.initGUIs();

    //stop propagation of pointer events on the lil-gui elements
    const guiList = document.querySelectorAll('.lil-gui');
    guiList.forEach(gui => {
      ['pointerdown', 'pointerup'].forEach(eventType => {
        gui.addEventListener(eventType, (event) => {
          event.stopPropagation();
        });
      });
    });


    const browserSystem = this.world.getSystem(SBrowserSystem);


    //this.capturePreviews();



  }

  capturePreviews() {

    const width = 0.12;
    const height = 0.05;

    const aspect = 0.05 / 0.12;
    const _width = 256;
    const _height = _width * aspect;

    const renderSystem = this.world.getSystem(SRenderSystem);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(_width, _height);

    const scene = renderSystem.scene;
    const camera = new THREE.OrthographicCamera(-width, width, height, -height, 0.01, 10);
    camera.position.y = 1;
    camera.lookAt(0, 0, 0);


    const previews: Record<string, string> = {};
    Object.keys(Utils.elementFactoryMap).forEach((key, index) => {
      //if (index > 1) return;

      const factory = Utils.elementFactoryMap[key as keyof typeof Utils.elementFactoryMap]();
      const entity = ENTT.spawnEntity2(this.world, factory);

      //world execute is needed to mimic a frame
      this.world.execute(0, 0);
      renderer.setClearColor(0x808080, 1);
      renderer.render(scene, camera);

      ENTT.removeEntity(this.world, entity);
      //scene.clear();

      previews[key] = renderer.domElement.toDataURL();

    });

    //console.log(previews); 

    //download the images
    Object.keys(previews).forEach((key, index) => {
      const link = document.createElement('a');
      link.href = previews[key]; //base64
      link.download = key + '.png';
      link.click();
    });


  }


  stop() {
    this.timer.pause();

    this.world.getSystem(SGraphSystem).enabled = false;
    this.world.getSystem(SCurrentRenderSystem).running = false;
    this.world.getSystem(SSimulateSystem).running = false;

    console.log("app stop");
  }

  resume() {
    this.timer.resume();

    this.world.getSystem(SGraphSystem).enabled = true;
    this.world.getSystem(SCurrentRenderSystem).running = true;
    this.world.getSystem(SSimulateSystem).running = true;

    console.log("app resume");
  }



  runStop() {

    this.running = !this.running;
    if (this.running) {
      app.resume();
    } else {
      app.stop();
    }

  }


  initXR() {

    const renderSystem = this.world.getSystem(SRenderSystem);
    renderSystem.initXR();

    const interactSystem = this.world.getSystem(SInteractSystem);

    renderSystem.setVRButtonClickCallback(() => {

      const hp0 = renderSystem.getHandPointerByIndex(0);
      const hp1 = renderSystem.getHandPointerByIndex(1);

      if (!hp0 || !hp1) {
        console.error("hand pointers not found");
        return;
      }

      this.world.registerSystem(SXRInteractSystemL);
      const XRinteractSystemL = this.world.getSystem(SXRInteractSystemL);
      XRinteractSystemL.setHandPointer(hp0!);
      XRinteractSystemL.gui = XRinteractSystemL.gui;


      this.world.registerSystem(SXRInteractSystemR);
      const XRinteractSystemR = this.world.getSystem(SXRInteractSystemR);
      XRinteractSystemR.setHandPointer(hp1!);
      XRinteractSystemR.gui = XRinteractSystemR.gui;

    });


    this.setupGUIXR();

  }



  setupGUIXR() {

    //set thatbackface is not culled 
    const renderSystem = this.world.getSystem(SRenderSystem);
    const browserSystem = this.world.getSystem(SBrowserSystem);
    const currentSystem = this.world.getSystem(SCurrentRenderSystem);
    const interactSystem = this.world.getSystem(SInteractSystem);

    const XRinteractSystemL = this.world.getSystem(SXRInteractSystemL);
    const XRinteractSystemR = this.world.getSystem(SXRInteractSystemR);

    const graphSystem = this.world.getSystem(SGraphSystem);


    const statsDom = renderSystem.stats.dom;
    const statsMesh = renderSystem.domElementToHTMLMesh(statsDom);
    statsMesh.position.set(0, 0.6, 0);


    const browserGUI = browserSystem.gui.domElement;
    const browserMesh = renderSystem.domElementToHTMLMesh(browserGUI);
    browserMesh.position.set(-0.4, 0.3, 0);
    browserMesh.material.side = THREE.DoubleSide;

    const systemGUI = this.systemGUI!.domElement;
    const systemMesh = renderSystem.domElementToHTMLMesh(systemGUI);
    systemMesh.position.set(0.4, 0.2, 0);
    systemMesh.material.side = THREE.DoubleSide;


    const group = renderSystem.interactiveGroup;
    const graphMesh = graphSystem.graph.canvasAsTexture();
    group.add(graphMesh);

    graphMesh.position.set(0, 0.3, 0);
    graphMesh.scale.set(0.5, 0.5, 0.5);
    // graphMesh.material.side = THREE.DoubleSide;  


    //dynamic GUIs needs to be handed within the system



  }




  initGUIs() {

    const renderSystem = this.world.getSystem(SRenderSystem);
    const browserSystem = this.world.getSystem(SBrowserSystem);
    const currentSystem = this.world.getSystem(SCurrentRenderSystem);
    const interactSystem = this.world.getSystem(SInteractSystem);
    const graphSystem = this.world.getSystem(SGraphSystem);
    const simulateSystem = this.world.getSystem(SSimulateSystem);


    //browser system gui:  
    const browserGUI = browserSystem.gui.domElement;
    //move the gui to the top left    

    browserGUI.style.left = '0px';
    browserGUI.style.width = '15%';
    //browserGUI.style.height = '70%';

    //get width, height of the gui
    const browserWidth = browserGUI.clientWidth;


    const graphCanvas = graphSystem.graph.canvas;
    // graphCanvas.style.left = browserWidth + 'px'; 
    //corner置于中心，  自身大小的一半translate实现centered
    graphCanvas.style.left = "50%";
    graphCanvas.style.top = "0%";
    graphCanvas.style.width = '40%';
    graphCanvas.style.height = 'auto';
    graphCanvas.style.transform = "translate(-50%, 0%)";

    //get render system gui:
    const systemGUI = new GUI({ title: 'General' });
    this.systemGUI = systemGUI;


    //new: gui that toggles views
    systemGUI.add({ view: 'top' }, 'view', ['3D', 'top', 'VR']).onChange((value: string) => {
      if (value === '3D') {
        renderSystem.setViewMode('3D');

        console.log("toggle 3D view");

      } else if (value === 'top') {
        renderSystem.setViewMode('top');
        console.log("toggle top view");
      }
      else if (value === 'VR') {
        renderSystem.setViewMode('VR');
        app.initXR();
        console.log("toggle VR view");
      }

    });

    //new:

    systemGUI.add(app, 'runStop').name('Run/Stop Simulation');

    systemGUI.add(Globals, 'timeScale', 0.1, 1).step(0.1).name('Time Scale').onChange((value: number) => {
      graphSystem.graph.setTimeScale(value);
    });

    //systemGUI.add(app.timer, 'accumlatedTime').name('Time (s)').disable().listen();

    systemGUI.add({ range: 1 }, 'range', 1, 10).name('Graph Range').step(1).onChange((value: number) => {
      graphSystem.graph.setYRange(value);
    });

    systemGUI.add(Globals, 'renderMode', ['particles', 'arrow']).name('currentRender').onChange((value: string) => {
      Globals.renderMode = value as 'particles' | 'arrow';
      console.log("currentRender: ", Globals.renderMode);
      currentSystem.onModeChange(value as 'particles' | 'arrow');
    });



    const group = renderSystem.interactiveGroup;

    systemGUI.add({ saveWorld: () => Utils.saveWorld(simulateSystem.getAllElements()), }, 'saveWorld').name('Save Circuit');

    const input2 = document.createElement('input');
    input2.type = 'file';
    input2.id = 'fileInput';
    input2.addEventListener('change', (event) => {
      (async () => {
        console.log("load world");
        await Utils.loadWorldFromFileInput(event.target as HTMLInputElement, this.world);
      })().catch(console.error);

    });
    //systemGUI.domElement.appendChild(input2);


    systemGUI.add({ loadWorld: () => input2.click(), }, 'loadWorld').name('Load Circuit');

    systemGUI.add({ circuits: 'none' }, 'circuits', Object.keys(Samples)).name('Select Circuit').onChange((value: string) => {
      console.log("load circuit: ", value);

      (async () => {
        const path = Samples[value as keyof typeof Samples];
        if (path) {
          await Utils.loadWorldFromFilePath(path, this.world);
        }
      })().catch(console.error);
    });



    const systemGUIWidth = systemGUI.domElement.clientWidth;
    const systemGUIHeight = systemGUI.domElement.clientHeight;

    const offset = 10;
    const propGUI = interactSystem.gui.domElement;
    propGUI.style.top = systemGUIHeight + offset + 'px';

  }





  test() {
    console.log("test");

    //const entt = ENTT.spawnEntity2(this.world, ENTT.createWire);


    // this.bootstrapXR();

    // const renderSystem = this.world.getSystem(SRenderSystem);
    // renderSystem.renderer.setAnimationLoop(animate);


    // const graphSystem = this.world.getSystem(SGraphSystem);
    // graphSystem.enabled = true;
    // const scene = this.world.getSystem(SRenderSystem).scene;

    // console.log("wire component: ", Utils.elementComponentMap['wire']);

    // const myElement: Utils.ElementTypeString = 'resistor';
    // const invalidElement: Utils.ElementTypeString = 'battery'; 


    //const entt = ENTT.spawnEntity(this.world, ENTT.createCapacitor, new THREE.Vector3(0, 0, 0));


    //const entt = ENTT.spawnEntity(this.world, ENTT.createInductor, new THREE.Vector3(0, 0, 0));


    // const arrow = new Field.Arrow();
    // arrow.mesh.rotation.z = Math.PI / 2;

    // scene.add(arrow.mesh); 


    //this.graph.drawAxies();

    // console.log("keyOfTransform: ", Object.keys(COMP.CTransform));

    // const dir = new THREE.Vector3(1, 0, 0); // 方向向量 (x, y, z)
    // dir.normalize(); // 确保方向向量归一化

    // const origin = new THREE.Vector3(0, 0, 0); // 箭头起点
    // const length = 0.2; // 箭头长度
    // const color = 0xff0000; // 箭头颜色（红色）

    // // 创建 ArrowHelper
    // const arrowHelper = new THREE.ArrowHelper(dir, origin, length, color);
    // arrowHelper.line.visible = false; // 隐藏箭头的线

    // // 添加到场景中
    // scene.add(arrowHelper);
    // console.log("arrowHelper: ", arrowHelper); 


    // interface ComponentTypeMap {
    //   CTransform: COMP.CTransform,
    //   CResistance: COMP.CResistance,
    // }

    // const typeName = 'CTransform';
    // const compType = COMP[typeName as keyof ComponentTypeMap];
    // console.log("compType: ", compType);


    // const key = 'position';

    // function isMoveComponent(
    //   comp: Component<any>
    // ): comp is COMP.CTransform {
    //   return comp instanceof COMP.CTransform;
    // }


    // const curve = new ENTT.Helix(Globals.coilRadius, Globals.tubeTurns, Globals.coilHeight);

    // console.log("numeric length: ", curve.getLength());
    // console.log("my length: ", curve.totalLength);



    // //the GUI:
    // const gui = new GUI();
    // Utils.showPropertiesGUI(entt, gui);



    // 创建一个图片元素
    // const img = document.createElement('img');
    // img.src = './lighting.jpg';
    // img.style.width = '100%';
    // img.style.height = 'auto';

    //put the image to left top corner
    // img.style.position = 'absolute';
    // img.style.top = '0px';
    // img.style.left = '0px';

    // 添加到 DOM 中
    //document.body.appendChild(img);


    //
    // const gui = new GUI({ title: 'test' });
    // const testFoler = gui.addFolder('Custom UI');
    // // 添加图片到 GUI
    // testFoler.domElement.appendChild(img);

    // testFoler.domElement.addEventListener('pointerdown', (event) => {
    //   console.log("pointer down");
    // });

    // const foler2 = gui.addFolder('Custom UI2');  


    // const test = 0.5e+9 / ((0.5 + 1.0e-9) * 1.0e+9);
    // const testA = math.matrix([[2, -1], [-1, 1]]);
    // const testb = math.matrix([1, 0]);
    // const testx = math.lusolve(testA, testb);
    // console.log("test: " + testx);

    // const testA = math.matrix([[1, -1], [-1, 1]]);
    // const testb = math.matrix([-1, 1]);
    // const testx = math.lusolve(testA, testb);
    // console.log("test: " + testx);

    // const test = math.complex(2, 3);
    // console.log("test: " + test.toString());
    // //get its real part
    // console.log("test: " + test.re);
    // console.log("test: " + test.im);
    // //its magnitude
    // console.log("test: " + math.abs(test));
    // //its phase
    // console.log("test: " + math.arg(test));

    // let expr = exp(complex(0, pi));
    // let real = expr.re;
    // let imag = expr.im;
    // console.log("real: " + real);
    // console.log("imag: " + imag);


    // const mat1 = math.matrix([7]);
    // console.log("matrix type: " + math.typeOf(mat1));

    // const mat2 = math.matrix([2]);

    // const div = math.divide(mat1, mat2);
    // console.log("div: " + div);
    // console.log("matrix type: " + math.typeOf(div));

    // const mat3 = math.matrix([div as number]); 

  }

}


const app = new App();
app.init();
app.test();


// 16ms per frame (60FPS)   
function animate() {
  try {

    app.timer.update();
    const time = app.timer.getTime() * Globals.timeScale;
    const delta = app.timer.getDelta() * Globals.timeScale;
    //console.log("app delta: ", delta);
    app.world.execute(delta, time);

  }
  catch (e: unknown) {
    if (e instanceof Error) {
      console.error("An error occurred:", e.message);
      console.error("Stack trace:", e.stack);
    }
  }
}


