/*
*bootstrapping the app
*/

import * as THREE from 'three';
import { WebGLRenderer, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';

import { World, System, Component, Entity, Types } from 'ecsy';

import * as COMP from "./components";
import { SRenderSystem } from "./renderSystem";
import { SInteractSystem } from "./interactSystem";
import * as ENTT from "./entities";

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import * as MyGUI from './GUISystem';


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
      .registerComponent(COMP.CSceneProxy)
      .registerSystem(SRenderSystem)
      .registerSystem(SInteractSystem)
      .registerSystem(MyGUI.SBrowserSystem);


    ENTT.createBox(this.world);
    ENTT.createGrid(this.world);
    ENTT.createFloor(this.world);


  }

}



const app = new App();

function animate() {
  app.world.execute(0.016); // 16ms per frame (60FPS)
  requestAnimationFrame(animate);
}
animate();
