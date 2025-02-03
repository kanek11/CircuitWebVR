
import * as THREE from 'three';
import { Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

import { Line2 } from 'three/examples/jsm/lines/Line2';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial';


import { World, System, Component, Entity, Types } from 'ecsy';
import * as COMP from "./components";
import * as ENTT from "./entities";
import { Globals } from './globals';

/**
 * warn:
 * for now,
 *  
 * E field is owned by component group,  follow the transform; 
 */


export function pointArrowToDir(mesh: THREE.Mesh, direction: THREE.Vector3): void {

    const upVector = new THREE.Vector3(0, 1, 0);  // 默认Y朝上
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(upVector, direction.normalize());
    mesh.quaternion.copy(quaternion);
}



//basically two cylinders , with a cone on top
export class Arrow {
    public mesh;

    constructor() {

        const length = 0.2;

        const bodyGeometry = new THREE.CylinderGeometry(0.02, 0.02, length, 32);
        const coneGeometry = new THREE.ConeGeometry(0.1, 0.2, 32);
        coneGeometry.translate(0, length / 2, 0);

        //merge the two geometries:
        const mergedGeometry = mergeGeometries([bodyGeometry, coneGeometry]);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true });

        this.mesh = new THREE.Mesh(mergedGeometry, material);
        this.mesh.raycast = () => { /* no-op */ };


    }

}


export function getUnscaledChargeDistribution(_chargeDensity: number): Vector3[] {

    const chargeNumX = _chargeDensity;
    if (chargeNumX <= 1) {
        return [];
    }

    let posArray: Vector3[] = [];
    const spacingYZ = 1 / (chargeNumX - 1);

    for (let i = 0; i < chargeNumX; i++) {
        for (let j = 0; j < chargeNumX; j++) {

            const x = 0;
            const y = i * spacingYZ - 1 / 2;
            const z = j * spacingYZ - 1 / 2;

            posArray.push(new Vector3(x, y, z));
        }
    }

    return posArray;
}

export class EField {
    private fieldLines: Line2[] = [];
    private arrows: THREE.Mesh[] = [];
    public fieldGroup: THREE.Group = new THREE.Group();
    public arrowGroup: THREE.Group = new THREE.Group();

    private rawPosArray: Vector3[] = [];

    private currentChargeLevel = 5;

    constructor(entity: Entity, scene: THREE.Scene) {

        this.fieldGroup.name = "EFieldLines";
        this.arrowGroup.name = "EFieldArrows";

        this.onChargeDensityChange();

    }


    onChargeDensityChange(): void {

        //important: clear the previous field
        this.clear();

        this.rawPosArray = getUnscaledChargeDistribution(this.currentChargeLevel);

        const material = new LineMaterial({
            color: 0xffffff,
            linewidth: 1,
            transparent: true, //make transparency work

        });

        this.rawPosArray.forEach((pos, index) => {
            //console.log("pos: ", pos);

            const geometry = new LineGeometry();
            geometry.setPositions([
                ENTT.Dir.LEFT * 0.5,
                0 + pos.y,
                0 + pos.z,
                ENTT.Dir.RIGHT * 0.5,
                0 + pos.y,
                0 + pos.z,
            ]);

            const line = new Line2(geometry, material);
            line.computeLineDistances(); // 计算线段距离，确保正确渲染

            const arrow = new Arrow().mesh;
            arrow.name = "EFieldArrow_" + index;
            arrow.rotation.z = Math.PI / 2;

            this.fieldLines.push(line);
            this.fieldGroup.add(line);

            this.arrows.push(arrow);
            this.arrowGroup.add(arrow);
        });

    }


    clear(): void {
        this.fieldLines.forEach((line) => {
            line.geometry.dispose();
            line.material.dispose();
        });
        this.fieldLines.length = 0;

        this.arrows.forEach((arrow) => {
            arrow.geometry.dispose();
            (arrow.material as THREE.MeshBasicMaterial).dispose();
        });
        this.arrows.length = 0;
    }


    dispose(): void {

        this.clear();

        this.fieldGroup.clear();
        this.fieldGroup.removeFromParent();

        this.arrowGroup.clear();
        this.arrowGroup.removeFromParent();

        console.log("EField disposed");
    }


    chargeToDensityLevel(charge: number): number {
        return Math.ceil(Math.abs(charge));
    }


    update(entity: Entity): void {
        if (!entity.hasComponent(COMP.CCapacitance)) {
            console.error("EField: Entity does not have CCapacitance component");
            return;
        }
        const cCapacitance = entity.getComponent(COMP.CCapacitance)!;
        const cElement = entity.getComponent(COMP.CElement)!;
        const edge = cCapacitance.edge;
        const size = cCapacitance.spacing;
        const charge = cCapacitance.charge;

        //we think rebuild field is too heavy for now
        // if (this.currentChargeLevel != this.chargeToDensityLevel(charge)) {
        //     this.currentChargeLevel = this.chargeToDensityLevel(charge);
        //     this.onChargeDensityChange();
        // }

        //flip
        let intensity = Math.abs(cElement.voltage) / Globals.capacitorFieldRange;
        let dir = charge >= 0 ? 1 : -1;

        this.fieldGroup.scale.x = size;
        this.fieldGroup.scale.y = edge;
        this.fieldGroup.scale.z = edge;

        this.fieldLines.forEach((line, index) => {
            const material = line.material as LineMaterial;
            material.opacity = intensity;//+ 0.1;
            material.needsUpdate = true;
        });

        this.arrows.forEach((arrow, index) => {
            const chargePos = this.rawPosArray[index];
            arrow.position.set(0, chargePos.y * edge, chargePos.z * edge);
            arrow.scale.set(0.05, 0.05 * dir, 0.05);  //arrow is y-up, so we need to flip it 
            const material = arrow.material as THREE.MeshBasicMaterial;
            material.opacity = intensity;//+ 0.1;
        });



    }

}





// const outerLength = 0.6;
// const excludedNum = numSegments * (1 - outerLength);
// //eg:  10 * (1 - 0.6) = 4

// for(let i = 0; i <this.numLinesOutside; i++) {
// const alpha_i = (2 * Math.PI / this.numLinesOutside) * i;
class ExternalCurve extends THREE.Curve<THREE.Vector3> {

    private R0 = 1.0;
    private A = 2.0;
    private alpha_i;


    constructor(alpha_i: number) {
        super();
        this.alpha_i = alpha_i;
    }

    getPoint(t: number): THREE.Vector3 {
        const zVal = 1 - 2 * t;     // -1 ~ 1
        const rVal = this.R0 + this.A * (1 - 2 * t) * (1 - 2 * t);

        const xVal = rVal * Math.cos(this.alpha_i);
        const yVal = rVal * Math.sin(this.alpha_i);

        return new THREE.Vector3(xVal, yVal, zVal);
    }

}




export class BField {
    public scene: THREE.Scene;
    public fieldGroup: THREE.Group = new THREE.Group();        // 外部可访问此 group 
    private fieldLines: Line2[] = [];  // 存储所有 B 场线，便于内部统一管理

    private numLinesInside: number;
    private numLinesOutside: number;
    private lineWidth: number = 1;

    public markArray: Array<THREE.Vector3> = [];

    private arrows: THREE.Mesh[] = [];
    public arrowGroup: THREE.Group = new THREE.Group();

    private curves: ExternalCurve[] = [];



    constructor(scene: THREE.Scene, numLinesInside = 5, numLinesOutside = 10) {
        this.scene = scene;

        this.fieldGroup.name = "BField";
        //this.fieldGroup.add(this.markGroup);

        this.numLinesInside = numLinesInside;
        this.numLinesOutside = numLinesOutside;

        this.createInsideLines();

        this.createOutsideLines();
    }

    dispose(): void {
        this.fieldLines.forEach((line) => {
            line.geometry.dispose();
            line.material.dispose();
        });
        this.fieldLines.length = 0;

        this.fieldGroup.clear();
        this.fieldGroup.removeFromParent();

        this.arrows.forEach((arrow) => {

            arrow.geometry.dispose();
            (arrow.material as THREE.MeshBasicMaterial).dispose();
        });
        this.arrows.length = 0;

        this.arrowGroup.clear();
        this.arrowGroup.removeFromParent();


        console.log("BField disposed");
    }

    /** 
     */
    private createInsideLines(): void {
        const radii = [1, 0.7, 0.3]; //

        const innerLength = 0.8;

        for (let r = 0; r < radii.length; r++) {
            for (let i = 0; i < this.numLinesInside; i++) {
                const theta = (i / this.numLinesInside) * Math.PI * 2;

                const points: THREE.Vector3[] = [];
                for (let t = -innerLength; t <= +innerLength; t += 0.1) {
                    const x = radii[r] * Math.cos(theta);
                    const y = radii[r] * Math.sin(theta);
                    const z = t;
                    points.push(new THREE.Vector3(x, y, z));
                }

                const positions: number[] = [];
                points.forEach((p) => {
                    positions.push(p.x, p.y, p.z);
                });

                const geometry = new LineGeometry();
                geometry.setPositions(positions);

                const material = new LineMaterial({
                    color: 0xffffff,
                    linewidth: 1,
                    transparent: true,
                    opacity: 0.5,
                    // resolution: 在实际应用中，看情况会需要设置 camera 的分辨率 
                });

                const line = new Line2(geometry, material);
                line.computeLineDistances();

                // 命名 & 禁用 raycast
                line.name = "BFieldInside_" + i;
                line.raycast = () => { /* no-op */ };

                this.fieldLines.push(line);
                this.fieldGroup.add(line);
            }
        }
    }

    private createOutsideLines(): void {
        const numSegments = 20;
        const R0 = 1.0;
        const A = 2.0;

        const outerLength = 0.8;
        const excludedNum = numSegments * (1 - outerLength);
        //eg:  10 * (1 - 0.6) = 4

        for (let i = 0; i < this.numLinesOutside; i++) {
            const alpha_i = (2 * Math.PI / this.numLinesOutside) * i;
            const curve = new ExternalCurve(alpha_i);
            this.curves.push(curve);


            const points: THREE.Vector3[] = [];

            // 这里把最边上的 segment 去掉 2 段，来调整线的长度 
            for (let j = excludedNum / 2; j <= numSegments - excludedNum / 2; j++) {
                const t = j / numSegments;  // 0 ~ 1 

                const pos = curve.getPoint(t);
                points.push(pos);

                //new: spawn arrows
                if (j == numSegments - excludedNum / 2 - 1 || j == excludedNum / 2 + 1) {
                    const arrow = new Arrow().mesh;
                    this.arrows.push(arrow);
                    this.arrowGroup.add(arrow);

                    // const mark = new THREE.Mesh(new THREE.SphereGeometry(0.02), new THREE.MeshBasicMaterial({ color: 0xff0000 })); //simply dummy mark
                    // mark.visible = false;
                    // mark.raycast = () => { /* no-op */ };
                    // mark.position.copy(pos);
                    this.markArray.push(pos);
                }


            }

            const positions: number[] = [];
            points.forEach((p) => {
                positions.push(p.x, p.y, p.z);
            });

            const geometry = new LineGeometry();
            geometry.setPositions(positions);

            const material = new LineMaterial({
                color: 0xffffff,
                linewidth: 1,
                transparent: true,
                opacity: 0.5,
            });

            const line = new Line2(geometry, material);
            line.computeLineDistances();

            line.name = "BFieldOutside_" + i;
            line.raycast = () => { /* no-op */ };

            this.fieldLines.push(line);
            this.fieldGroup.add(line);
        }
    }

    /**
     * 如果需要根据某个实体或强度等，动态更新 B 场
     */
    public update(entity: Entity): void {
        if (!entity.hasComponent(COMP.CInductance)) {
            console.error("BField: Entity does not have CInductance component");
            return;
        }

        const cInductance = entity.getComponent(COMP.CInductance)!;
        const cElement = entity.getComponent(COMP.CElement)!;

        const intensity = Math.abs(cElement.current) / Globals.inductorFieldRange;

        this.fieldLines.forEach((line) => {
            const material = line.material as LineMaterial;
            material.opacity = intensity;  //+ 0.3;
            material.needsUpdate = true;
        });

        this.fieldGroup.scale.x = cInductance.radius * 0.5;
        this.fieldGroup.scale.y = cInductance.radius * 0.5;
        this.fieldGroup.scale.z = cInductance.length;


        const _origin = new THREE.Vector3();
        const _dir = new THREE.Vector3();

        this.markArray.forEach((mark, index) => {
            const arrow = this.arrows[index];

            arrow.scale.set(0.03, 0.03, 0.03);
            arrow.position.x = mark.x * cInductance.radius * 0.5;
            arrow.position.y = mark.y * cInductance.radius * 0.5;
            arrow.position.z = mark.z * cInductance.length;
            // mark.getWorldPosition(arrow.position);
            //mark.getWorldQuaternion(arrow.quaternion);  

            if (mark.z < 0) {
                _dir.subVectors(arrow.position, _origin);
            }
            else {
                _dir.subVectors(_origin, arrow.position);
            }
            // console.log("arrow.y: ", arrow.position.y);
            // console.log("dir y: ", _dir.y);

            if (cElement.voltage < 0) {
                _dir.negate();
            }
            pointArrowToDir(arrow, _dir);

            const material = arrow.material as THREE.MeshBasicMaterial;
            material.opacity = intensity == 0 ? 0.0 : 0.9;

        });

    }
}

