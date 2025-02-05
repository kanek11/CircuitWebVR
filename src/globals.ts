import { run } from "node:test";
import * as THREE from "three";
import { transferableAbortSignal } from "util";


export type RenderMode = 'arrow' | 'particles';
export const Globals = {
    debugMode: false,

    timeScale: 0.5,

    gridNum: 20,
    gridSize: 1.0,
    gridSpacing: 1.0 / 20,

    XRMode: false,

    //defaultCanvasSize: { width: 800, height: 600 },  
    backGroundColor: 'rgb(175, 175, 175)',

    renderMode: 'arrow' as RenderMode,


    labelRenderOrder: 999,

    nodeRenderOrder: 998,

    tableRenderOrder: 997,

    gridRenderOrder: 996,

    currentRenderOrder: 995,


    //dark:  
    baseColor: new THREE.Color(0x303030),
    //cyan: 0x00ffff,
    hightlightColor: new THREE.Color(0x00ffff),

    conductColor: new THREE.Color(0x00ff00),


    metallic: 0.5,
    roughness: 0.7,

    labelCanvasSize: { width: 768, height: 384 },
    labelColor: 'rgba(0, 0, 0, 0.0)',
    textScale: new THREE.Vector3(0.4, 0.2, 0.2),
    textOffset: new THREE.Vector3(0.0, 0.075, 0.0),
    nodeSize: 0.025,
    wireRadius: 0.007,
    wireLength: 0.05,


    currentColor: 'rgb(0, 217, 255)',
    currentSize: 0.004,//0.7,

    arrowSize: new THREE.Vector3(0.05, 0.05, 0.05),

    particlePoolSize: 200,

    tubeRadius: 0.005,

    capacitorFieldRange: 2.0,
    capactiorChargeDensity: 5.0, // 5 charge per volt
    inductorFieldRange: 1.0,

    heightByPotential: false,
    potentialOffset: 0.0,
    potentialScale: 0.05,


    showSimInfo: false,

};