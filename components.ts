import { World, System, Component, Entity, Types, TagComponent, JSONPropType } from 'ecsy';
import { LineSegments, Mesh, Object3D } from 'three';

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
    position!: { x: number; y: number; z: number };
    rotation!: { x: number; y: number; z: number };
    scale!: { x: number; y: number; z: number };

    static schema = {
        position: { type: Types.JSON, default: { x: 'name', y: 0, z: 0 }, min: -1, max: 1 },
        rotation: { type: Types.JSON, default: { x: 0, y: 0, z: 0 }, min: 0, max: 2 * 3.14 },
        scale: { type: Types.JSON, default: { x: 1, y: 1, z: 1 }, min: 0.1, max: 1 },
    } as const;
}


//three objects added to the scene
export class CObject3D extends Component<CObject3D> {
    object!: Mesh | LineSegments;

    static schema = {
        object: { type: Types.Ref, default: null }
    } as const;
}


class CImpendance extends Component<CImpendance> {
    value!: number;

    static schema = {
        value: { type: Types.JSON, default: 0 }
    } as const;
}

class CDCVoltage extends Component<CDCVoltage> {
    value!: number;

    static schema = {
        value: { type: Types.JSON, default: 0 }
    } as const;
}


