import { debug } from 'console';
import { World, System, Component, Entity, Types, TagComponent, JSONPropType } from 'ecsy';
import { LineSegments, Mesh, Object3D } from 'three';
import * as THREE from 'three';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';


/*
todo: rotation range?
*/




/**
 * entt that can be added to the scene
 */
export class CPrototype extends Component<CPrototype> {
    name!: string;

    static schema = {
        name: { type: Types.String, default: 'defaultObject' },
    } as const;

}

export class CInteractable extends Component<CInteractable> {
    // static schema = {
    //     interactable: { type: Types.Boolean, default: true }
    // };
}

export class CRenderable extends TagComponent { }


// Transform component to store position and rotation
export class CTransform extends Component<CTransform> {
    position!: THREE.Vector3;
    rotation!: THREE.Vector3;
    scale!: THREE.Vector3;

    static schema = {
        position: { type: Types.Ref, default: new THREE.Vector3(0, 0, 0) },
        rotation: { type: Types.Ref, default: new THREE.Vector3(0, 0, 0) },
        scale: { type: Types.Ref, default: new THREE.Vector3(1, 1, 1) },
    } as const;
}


//three objects added to the scene
export class CObject3D extends Component<CObject3D> {
    object!: Mesh | LineSegments;

    static schema = {
        object: { type: Types.Ref, default: null }
    } as const;
}


export class CElement extends Component<CElement> {
    nodeL!: Entity;
    nodeR!: Entity;
    current!: number;
    debugID!: number;
    static schema = {
        nodeL: { type: Types.Ref, default: null },
        nodeR: { type: Types.Ref, default: null },
        current: { type: Types.Number, default: 0 },
        debugID: { type: Types.Number, default: -1 },
    };
}

//alias of max possible value 
export const INVALID_SLOT = Number.MAX_VALUE;

export class CNode extends Component<CNode> {
    element!: Entity;
    slotID!: number;
    voltage!: number;

    debugID!: number;
    static schema = {
        element: { type: Types.Ref, default: null },
        slotID: { type: Types.Number, default: INVALID_SLOT },
        voltage: { type: Types.Number, default: 0 },
        debugID: { type: Types.Number, default: -1 },
    };
}

export class CResistance extends Component<CResistance> {
    value!: number;

    static schema = {
        value: { type: Types.Number, default: 1 }
    } as const;
}


export class CVoltage extends Component<CVoltage> {
    value!: number;

    static schema = {
        value: { type: Types.Number, default: 1 }
    } as const;
}


export class CInductance extends Component<CInductance> {
    value!: number;

    static schema = {
        value: { type: Types.Number, default: 1 }
    } as const;
}

export class CCapacitance extends Component<CCapacitance> {
    value!: number;

    static schema = {
        value: { type: Types.Number, default: 1 }
    } as const;
}

