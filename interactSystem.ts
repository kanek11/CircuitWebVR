
import * as THREE from "three";
import { System } from "ecsy";
import * as COMP from "./components";
import { SRenderSystem } from "./renderSystem";


export class SInteractSystem extends System {
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private pointer: THREE.Vector2 = new THREE.Vector2();


    static queries = {
        interactive: {
            components: [COMP.CInteractable],
            listen: { added: true, removed: true }
        }
    };

    init(): void {
        console.log("init interact system");
        document.addEventListener('pointermove', this.onPointerMove.bind(this));
    }

    execute(delta: number, time: number): void {
        //console.log("execute interact system");

        this.raycaster.setFromCamera(this.pointer, this.world.getSystem(SRenderSystem).top_camera!);

        const objs = this.queries.interactive.results;

        //handle intersection;
        objs.forEach(entity => {
            const cObj = entity.getComponent(COMP.CObject3D) as COMP.CObject3D;
            const obj = cObj.object;

            if (obj instanceof THREE.Mesh) {
                const intersects = this.raycaster.intersectObject(obj);

                if (intersects.length > 0) {
                    //console.log("intersected");
                    const material = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
                    material.color.set(0x0000ff);
                }
                else {
                    const material = (obj as THREE.Mesh).material as THREE.MeshBasicMaterial;
                    material.color.set(0xff0000);
                }

            }
        });
    }

    onPointerMove(event: PointerEvent): void {
        //console.log("pointer move");
        this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
    }



}