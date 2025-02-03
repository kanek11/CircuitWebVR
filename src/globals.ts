import { run } from "node:test";
import * as THREE from "three";

// globals.ts




export type RenderMode = 'arrow' | 'particles';
export const Globals = {
    debugMode: false,

    timeScale: 1.0,

    gridNum: 20,
    gridSize: 1.0,
    gridSpacing: 1.0 / 20,

    isXRMode: false,

    //defaultCanvasSize: { width: 800, height: 600 },  
    backGroundColor: 'rgb(175, 175, 175)',

    renderMode: 'arrow' as RenderMode,


    //dark:  
    baseColor: new THREE.Color(0x303030),
    //cyan: 0x00ffff,
    hightlightColor: new THREE.Color(0x00ffff),

    conductColor: new THREE.Color(0x00ff00),


    metallic: 0.5,
    roughness: 0.7,

    labelCanvasSize: { width: 512, height: 256 },
    labelColor: 'rgba(0, 0, 0, 0.0)',
    textScale: new THREE.Vector3(0.2, 0.1, 0.1),
    textOffset: new THREE.Vector3(0.0, 0.05, 0.02),
    labelRenderOrder: 999,

    nodeSize: 0.025,
    nodeRenderOrder: 998,

    wireRadius: 0.007,
    wireLength: 0.05,


    currentColor: 'rgb(0, 217, 255)',
    currentSize: 0.004,//0.7,
    currentRenderOrder: 997,

    arrowSize: new THREE.Vector3(0.05, 0.05, 0.05),

    particlePoolSize: 300,

    tubeRadius: 0.005,


    capacitorFieldRange: 2.0,
    inductorFieldRange: 1.0,

};