import { World, System, Component, Types, Entity } from 'ecsy';
import * as THREE from 'three';
import { Vector3, Vector2, Camera } from 'three';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';


export function ScreenToWorld(event: MouseEvent, camera: THREE.OrthographicCamera): Vector3 {
    //const camera = this.world.getSystem(SRenderSystem).top_camera!;

    // Step 1: Convert screen coordinates to NDC
    const ndc = new Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,  // X: [0, window.width] -> [-1, 1]
        -(event.clientY / window.innerHeight) * 2 + 1 // Y: [0, window.height] -> [-1, 1]
    );

    // Step 2: Map NDC to world space using the orthographic camera
    const worldPosition = new Vector3(
        -(ndc.x * (camera.right - camera.left) / 2 + (camera.right + camera.left) / 2), // Map X
        0, // Y = 0 because it's a horizontal plane
        ndc.y * (camera.top - camera.bottom) / 2 + (camera.top + camera.bottom) / 2 // Map Z, also flip it
    );

    return worldPosition;

}



// Function: Display entity's component properties in a GUI
// Function to display properties in GUI
export function showPropertiesGUI(entity: Entity, gui: GUI) {


    const components = entity.getComponents();

    Object.entries(components).forEach(([componentName, componentInstance]) => {
        const className = componentInstance.constructor.name;
        //console.log('gui class:' + className);

        //get schema, static member of the type
        const BaseType = componentInstance.constructor as typeof Component;
        const schema = BaseType.schema;

        //add folder for each component
        const folder = gui.addFolder(className);

        for (const key in schema) {
            //type of schema
            const typedKey = key as keyof typeof schema;
            const fieldSchema = schema[typedKey];

            //if (componentInstance.hasOwnProperty(key)) { 

            // if (fieldSchema.type === Types.JSON) {
            //     const subfolder = folder.addFolder(key);
            //     for (const subkey in fieldSchema.default) {
            //         subfolder.add(componentInstance[key], subkey, fieldSchema.min, fieldSchema.max).name(subkey);
            //     }
            // }

            if (fieldSchema.type === Types.Ref && componentInstance[key] instanceof THREE.Vector3) {
                // Handle THREE.Vector3 type
                const vector = componentInstance[key] as THREE.Vector3;
                const subfolder = folder.addFolder(key);
                subfolder.add(vector, 'x', fieldSchema.min, fieldSchema.max).name('x');
                subfolder.add(vector, 'y', fieldSchema.min, fieldSchema.max).name('y');
                subfolder.add(vector, 'z', fieldSchema.min, fieldSchema.max).name('z');
            }
            else if (fieldSchema.type === Types.Boolean) {
                folder.add(componentInstance, key).name(key);
            }
            else if (fieldSchema.type === Types.Number) {
                folder.add(componentInstance, key, fieldSchema.min, fieldSchema.max).name(key);
            }
            else {
                //add a text says it's not supported
                folder.add({ message: 'type not handled' }, 'message').name(key);
            }

        };
    });

}




