/*
*bootstrapping the app
*/

import * as THREE from 'three';
import { WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';

import { World, System, Component, Entity, Types } from 'ecsy';


import * as COMP from "./components";

import * as ENTT from "./entities";

import { SRenderSystem } from "./renderSystem";
import { SInteractSystem } from "./interactSystem";
import { SSimulateSystem } from "./simulateSystem";

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import * as MyGUI from './BrowserSystem';


class App {
  //public renderer: WebGLRenderer;
  public world: World;

  constructor() {

    this.world = new World({ entityPoolSize: 100 });
    this.world
      .registerComponent(COMP.CRenderable)
      .registerComponent(COMP.CTransform)
      .registerComponent(COMP.CObject3D)
      .registerComponent(COMP.CInteractable)
      .registerComponent(COMP.CPrototype)
      .registerComponent(COMP.CElement)
      .registerComponent(COMP.CNode)
      .registerComponent(COMP.CResistance)
      .registerComponent(COMP.CVoltage)
      .registerComponent(COMP.CInductance)
      .registerComponent(COMP.CCapacitance)
      .registerSystem(SRenderSystem)
      .registerSystem(SInteractSystem)
      .registerSystem(SSimulateSystem)
      .registerSystem(MyGUI.SBrowserSystem);


    //ENTT.createFloor(this.world); 

  }

}


const app = new App();
animate();

function animate() {

  try {
    app.world.execute(0.016); // 16ms per frame (60FPS)
    requestAnimationFrame(animate);
  }
  catch (e: unknown) {
    if (e instanceof Error) {
      console.error("An error occurred:", e.message);
      console.error("Stack trace:", e.stack);
    }
  }
}


