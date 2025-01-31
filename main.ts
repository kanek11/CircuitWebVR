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
import { SSerializeSystem } from './serializeSystem';

import { Globals } from "./globals";

import * as Utils from "./utils";
import * as Field from "./field";


const Circuits = {
  'Ohm\'s Law': 'file1',
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





function editor(world: World, app: App) {
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
    .registerSystem(SSerializeSystem)
    ;

}



function setupGlobalControls(world: World, app: App) {

  const renderSystem = world.getSystem(SRenderSystem);

  //browser system gui: 
  const browser = world.getSystem(SBrowserSystem).gui.domElement;
  //move the gui to the top left    
  browser.style.left = '0px';
  browser.style.zIndex = '1000';
  //make the size adaptive to children elements 
  browser.style.height = '70%';

  //get width, height of the gui
  const width = browser.clientWidth;
  const height = browser.clientHeight;


  //get render system gui:
  const systemGUI = new GUI({ title: 'General' });

  systemGUI.domElement.style.left = `${width}px`;


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

  systemGUI.add(Globals, 'timeScale', 0.1, 1).step(0.1).name('Time Scale');

  //systemGUI.add(app.timer, 'accumlatedTime').name('Time (s)').disable().listen();


  const currentSystem = world.getSystem(SCurrentRenderSystem);
  systemGUI.add(Globals, 'renderMode', ['particles', 'arrow']).name('currentRender').onChange((value: string) => {
    Globals.renderMode = value as 'particles' | 'arrow';
    console.log("currentRender: ", Globals.renderMode);
    currentSystem.onModeChange(value as 'particles' | 'arrow');
  });


  const serializeSystem = world.getSystem(SSerializeSystem);

  const group = renderSystem.interactiveGroup;

  // systemGUI.add({ saveScene: () => Utils.saveObject3D(group), }, 'saveScene').name('Save Scene');

  // const input = document.createElement('input');
  // input.type = 'file';
  // input.id = 'fileInput1';
  // systemGUI.domElement.appendChild(input);

  // input.addEventListener('change', (event) => {
  //   (async () => {
  //     //printSceneInfo(group);  // 打印旧场景信息

  //     const newGroup = await Utils.loadObject3D(event.target as HTMLInputElement);
  //     if (newGroup) {
  //       renderSystem.replaceStreamGroup(newGroup);
  //     }

  //     // console.log("scene after: ",);
  //     // printSceneInfo(group);  // 打印新场景信息
  //   })().catch(console.error);

  // });


  systemGUI.add({ saveWorld: () => Utils.saveWorld(serializeSystem.getEntts()), }, 'saveWorld').name('Save World');

  const input2 = document.createElement('input');
  input2.type = 'file';
  input2.id = 'fileInput';
  input2.addEventListener('change', (event) => {
    (async () => {
      console.log("load world");
      await Utils.loadWorldFromFileInput(event.target as HTMLInputElement, world);
    })().catch(console.error);

  });
  //systemGUI.domElement.appendChild(input2);


  systemGUI.add({ loadWorld: () => input2.click(), }, 'loadWorld').name('Load World');

  systemGUI.add({ circuits: 'none' }, 'circuits', Object.keys(Circuits)).name('select Circuit').onChange((value: string) => {
    console.log("load circuit: ", value);
  });



}

function printSceneInfo(scene: THREE.Object3D) {
  console.log("scene info: ");
  scene.traverse((child) => {
    console.log("child: ", child);
  });
}




function debugView(world: World, app: App) {

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

  setupGlobalControls(world, app);

}




class App {
  //public renderer: WebGLRenderer;
  public world: World = new World({ entityPoolSize: 100 });

  public timer: Timer = new Timer();
  public running: boolean = true;

  constructor() {
  }

  init() {

    editor(this.world, this);
    //debugView(this.world, this);  


    createGrid(this.world, Globals.gridSize, Globals.gridNum);

    //stop propagation of pointer events on the lil-gui elements
    const guiList = document.querySelectorAll('.lil-gui');
    guiList.forEach(gui => {
      ['pointerdown', 'pointermove', 'pointerup'].forEach(eventType => {
        gui.addEventListener(eventType, (event) => {
          event.stopPropagation();
        });
      });
    });

    setupGlobalControls(this.world, this);

    const renderSystem = this.world.getSystem(SRenderSystem);
    renderSystem.renderer.setAnimationLoop(animate);
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

    renderSystem.setVRButtonClickCallback(() => {


      this.world.registerSystem(SXRInteractSystemL);

      const hp0 = renderSystem.getHandPointerByIndex(0);
      if (hp0) {
        console.log("hand pointer0 found");
        this.world.getSystem(SXRInteractSystemL).setHandPointer(hp0);
      }
      else {
        console.error("no hand pointer found");
      }


      this.world.registerSystem(SXRInteractSystemR);

      const hp1 = renderSystem.getHandPointerByIndex(1);
      if (hp1) {
        console.log("hand pointer1 found:");
        this.world.getSystem(SXRInteractSystemR).setHandPointer(hp1);
      }
      else {
        console.error("no hand pointer found");
      }
    });

  }



  test() {
    console.log("test");

    const entt = ENTT.spawnEntity2(this.world, ENTT.createWire);


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


