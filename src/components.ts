
import { World, System, Component, Entity, Types, TagComponent, JSONPropType, ComponentSchemaProp } from 'ecsy';
import { LineSegments, Mesh, Group, Vector3 } from 'three';
import * as THREE from 'three';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as math from 'mathjs';
import { exp, complex, pi } from 'mathjs'

import * as Field from "./field";
import { Globals } from "./globals";


export type ElementTypeName = 'wire' | 'resistor' | 'DC voltage' | 'inductor' | 'capacitor' | 'AC voltage';


/**
 * let omega=1,
 * st, 
 * total angle = time T = 2 pi turns
 * vk = Height/T;
 * 
 * travel speed = sqrt(radius^2 + vk^2)
 * total length = sqrt(radius^2 + vk^2) * T
 */

//todo: check length formula
export class Helix extends THREE.Curve<THREE.Vector3> {
    public radius: number;
    public turns: number;
    public height: number;

    //new:
    public vk: number;
    public totalAngle: number;
    public totalLength: number;

    // private v_scale: number;

    constructor(radius: number, turns: number, height: number) {
        super();
        this.radius = radius;
        this.turns = turns;
        this.height = height;

        this.totalAngle = 2 * Math.PI * turns;
        this.vk = height / this.totalAngle;
        this.totalLength = Math.sqrt(radius * radius + this.vk * this.vk) * this.totalAngle;

        // this.v_scale = this.vk / Math.sqrt(radius * radius + this.vk * this.vk);
    }

    incrementPos(_pos: THREE.Vector3, _increment: number): THREE.Vector3 {
        const _t = (_pos.z + this.height / 2) / this.height;
        const t = _t + _increment / this.totalLength;
        return this.getPoint(t);
    }

    getTangentByPos(_pos: THREE.Vector3): THREE.Vector3 {
        const _t = (_pos.z + this.height / 2) / this.height;
        return this.getTangent(_t);
    }


    //parameter range, derived by [0, 1]
    getPoint(t: number): Vector3 {
        const angle = this.totalAngle * t;
        return new THREE.Vector3(
            this.radius * Math.cos(angle),
            this.radius * Math.sin(angle),
            t * this.height - this.height / 2,  //thus it is centered
        );
    }
}



export class CElementMetaInfo extends Component<CElementMetaInfo> {
    elementType!: ElementTypeName;
    name!: string;
    // globalID!: number;

    static schema = {
        elementType: { type: Types.String, default: 'invalid element tag', readonly: true },
        name: { type: Types.String, default: 'default element' },
    } as const;
}


export type ComponentSchemaProp_Number = ComponentSchemaProp & {
    min?: number;
    max?: number;
    step?: number;
    readonly?: boolean;
    monitorable?: boolean;
};

export type ComponentSchemaProp_String = ComponentSchemaProp & {
    readonly?: boolean;
};

// export type ComponentSchemaProp_Ref = ComponentSchemaProp & {
//     readonly?: boolean;
// };


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

    dispose(): void {
    }
}



//three objects added to the scene
//Group,Mesh,LineSegments,Sprite  
export class CObject3D extends Component<CObject3D> {
    group!: Group;

    static schema = {
        group: { type: Types.Ref, default: null },
    } as const;


    dispose(): void {
        //if it's a group
        if (this.group instanceof Group) {
            this.group.children.forEach((child) => {

                if (child instanceof Mesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                    console.log('mesh disposed: ' + child.name);
                }
                else if (child instanceof LineSegments) {
                    child.geometry.dispose();
                    child.material.dispose();
                    console.log('linesegments disposed: ' + child.name);
                }
                else if (child instanceof THREE.Sprite) {
                    child.material.dispose();
                    console.log('sprite disposed: ' + child.name);
                }
                else if (child instanceof Group) {

                }

            });
            this.group.removeFromParent();
            console.log('group disposed:' + this.group.name);
        }
    }
}

export class CWire extends Component<CWire> {
}


export class CElement extends Component<CElement> {
    nodeL!: Entity;
    nodeR!: Entity;
    //geometry
    elementSize!: number;
    length!: number;
    //simulation 
    current!: number;
    voltage!: number;
    static schema = {
        nodeL: { type: Types.Ref, default: null },
        nodeR: { type: Types.Ref, default: null },
        current: { type: Types.Number, default: 0, readonly: true, monitorable: true },
        voltage: { type: Types.Number, default: 0, readonly: true, monitorable: true },
        elementSize: { type: Types.Number, default: 0, readonly: true },
        length: { type: Types.Number, default: 0, readonly: true },
    };

    dispose(): void {
    }
}

//alias of max possible value 
export const INVALID_SLOT = Number.MAX_VALUE;

export class CNode extends Component<CNode> {
    element!: Entity;
    other!: Entity;  //needed for deriving temp distance for interactions
    slotID!: number;
    static schema = {
        element: { type: Types.Ref, default: null },
        other: { type: Types.Ref, default: null },
        slotID: { type: Types.Number, default: INVALID_SLOT, readonly: true },
    };

    dispose(): void {
        //see the reference as weak
    }
}

export class CNodeSim extends Component<CNodeSim> {
    voltage!: number;
    static schema = {
        voltage: { type: Types.Number, default: 0, readonly: true, monitorable: true },
    };

    dispose(): void {
    }
}



export class CResistance extends Component<CResistance> {
    resistance!: number;
    heat!: number;

    static schema = {
        resistance: { type: Types.Number, default: 1, min: 0.1, max: 1000, monitorable: true },
        heat: { type: Types.Number, default: 0, readonly: true, monitorable: true },
    } as const;

    /*
    * heat loss = I^2 * R * dt
    */
    updateHeat(current: number, dt: number): void {
        const currentAbs = Math.abs(current);
        this.heat += this.resistance * currentAbs * currentAbs * dt;
    }

    dispose(): void {
    }
}


export class CDCVoltage extends Component<CDCVoltage> {
    voltage!: number;

    static schema = {
        voltage: { type: Types.Number, default: 1, min: -10, max: 10, step: 1 },
    } as const;

    dispose(): void {
    }
}

export class CACVoltage extends Component<CACVoltage> {
    amp!: number;
    freq!: number;

    static schema = {
        amp: { type: Types.Number, default: 1 },
        freq: { type: Types.Number, default: 1 },
    } as const;

    dispose(): void {
    }
}


export class CInductance extends Component<CInductance> {
    inductance!: number;
    turns !: number;
    radius !: number;
    area !: number;
    length !: number;
    constant !: number;

    energy!: number;

    field!: Field.BField | null;
    helix!: Helix | null;

    static schema = {
        inductance: { type: Types.Number, default: 1, readonly: true, monitorable: true },
        turns: { type: Types.Number, default: 1, min: 3, max: 10, step: 1 },
        radius: { type: Types.Number, default: 1, min: 0.02, max: 0.05, step: 0.01 },
        area: { type: Types.Number, default: 1, readonly: true },
        length: { type: Types.Number, default: 1, min: 0.05, max: 0.2, step: 0.01 },
        energy: { type: Types.Number, default: 0, readonly: true, monitorable: true },
        constant: { type: Types.Number, default: 1 },
        field: { type: Types.Ref, default: null },
        helix: { type: Types.Ref, default: null },
    } as const;


    /**
     * L = μ * N^2* S / l
     */
    updateInductance(): void {
        this.area = pi * this.radius * this.radius;
        this.inductance = this.constant * this.turns * this.turns * this.area / this.length;
    }

    /*
    * W = 0.5 * L * I^2
    */
    updateEnergy(current: number): void {
        this.energy = 0.5 * this.inductance * current * current;
    }

    dispose(): void {
        if (this.field) {
            this.field.dispose();
        }
    }
}

export class CCapacitance extends Component<CCapacitance> {
    capacitance!: number;

    spacing!: number;
    edge!: number;
    constant!: number;

    //driven by simulation
    charge!: number;
    energy!: number;

    //auxiliary information
    field!: Field.EField | null;

    static schema = {
        capacitance: { type: Types.Number, default: 1, readonly: true, monitorable: true },
        spacing: { type: Types.Number, default: 1, min: 0.02, max: 0.1 },
        edge: { type: Types.Number, default: 1, min: 0.02, max: 0.2 },
        constant: { type: Types.Number, default: 0.1 },
        energy: { type: Types.Number, default: 0, readonly: true, monitorable: true },

        charge: { type: Types.Number, default: 0, readonly: true, monitorable: true },

        field: { type: Types.Ref, default: null },
    } as const;

    /**
     * Q = CV
     */
    updateCharge(voltage: number): void {
        this.charge = this.capacitance * voltage;
    }


    /**
     *  W = 0.5 * C * V^2
     */
    updateEnergy(voltage: number): void {
        this.energy = 0.5 * this.capacitance * voltage * voltage;
    }

    /**
     * C = εA/d
    */
    updateCapacitance(): void {
        this.capacitance = this.constant * this.edge * this.edge / this.spacing;
    }

    dispose(): void {
        if (this.field) {
            this.field.dispose();
        }
    }

}


export class CLabel3D extends Component<CLabel3D> {
    text!: string;
    font!: string;
    backgroundColor!: string;
    sprite!: THREE.Sprite;

    static schema = {
        text: { type: Types.String, default: 'emptyText' },
        font: { type: Types.String, default: '48px Arial' },
        backgroundColor: { type: Types.String, default: Globals.labelColor },
        sprite: { type: Types.Ref, default: null },
    } as const;

    dispose(): void {
    }
}