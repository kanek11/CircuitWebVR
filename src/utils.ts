import { World, System, Component, Types, Entity } from 'ecsy';
import * as THREE from 'three';
import { Vector3, Vector2, Camera } from 'three';

import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { SGraphSystem } from './graphSystem';
import { Globals } from "./globals";


//ts expect all possible keys to be defined
export const elementComponentMap: Record<COMP.ElementTypeName, string> = {
    'wire': 'CWire',
    'resistor': 'CResistance',
    'DC voltage': 'CDCVoltage',
    'inductor': 'CInductance',
    'capacitor': 'CCapacitance',
    'AC voltage': 'CACVoltage',
} as const;


export const elementFactoryMap: Record<COMP.ElementTypeName, () => any> = {
    'wire': () => ENTT.createWire,
    'resistor': () => ENTT.createResistor,
    'DC voltage': () => ENTT.createDCVoltage,
    'inductor': () => ENTT.createInductor,
    'capacitor': () => ENTT.createCapacitor,
    'AC voltage': () => ENTT.createACVoltage,
} as const;



export function PixelCoordToWorld(x: number, y: number, camera: THREE.OrthographicCamera): Vector3 {
    // Step 1: Convert screen coordinates to NDC
    const ndc = new Vector2(
        (x / window.innerWidth) * 2 - 1,  // X: [0, window.width] -> [-1, 1]
        -(y / window.innerHeight) * 2 + 1 // Y: [0, window.height] -> [-1, 1]
    );

    // Step 2: Map NDC to world space using the orthographic camera
    const worldPosition = new Vector3(
        -(ndc.x * (camera.right - camera.left) / 2 + (camera.right + camera.left) / 2), // Map X
        0, // Y = 0 because it's a horizontal plane
        ndc.y * (camera.top - camera.bottom) / 2 + (camera.top + camera.bottom) / 2 // Map Z, also flip it
    );

    return worldPosition;

}

export function PixelOffsetToWorld(x: number, y: number, camera: THREE.OrthographicCamera): Vector3 {

    const dx = x * (camera.right - camera.left) / window.innerWidth;
    const dy = y * (camera.top - camera.bottom) / window.innerHeight;

    return new Vector3(dx, 0, dy);

}



// Function: Display entity's component properties in a GUI
// Function to display properties in GUI
export function showPropertiesGUI2(entity: Entity, gui: GUI, world: World) {

    //new: 
    const graphSystem = world.getSystem(SGraphSystem);


    const controlFolder = gui.addFolder('Control');

    let entityName = 'Entity';
    if (entity.hasComponent(COMP.CElementMetaInfo)) {
        entityName = entity.getComponent(COMP.CElementMetaInfo)!.name;
        controlFolder.add({ remove: () => ENTT.removeEntity(world, entity), }, 'remove').name('remove');
    }
    else {
        //console.warn("GUI: not an element entity"); 
        if (!Globals.debugMode) {
            return;
        }

    }


    //[componentName: string]: Component‹any›
    const components = entity.getComponents();

    const monitorFolder = gui.addFolder('Monitor Properties');



    Object.entries(components).forEach(([componentName, componentInstance]) => {
        //console.log("componentName: ", componentName); //tested, useless ids;

        // console.log("type: ", typeof (componentInstance));
        const typeName = componentInstance.constructor.name;

        if (typeName === 'CLabel3D') {
            return;
        }


        //get schema, static member of the type 
        const schema = (componentInstance.constructor as any).schema;

        //add folder for each component
        const compFolder = gui.addFolder(typeName);

        //schema defines props of interest, without those inherited from Component<T>
        for (const key in schema) {
            //make sure schema matches the actual fields
            const schemaKey = key as keyof typeof schema;
            const compKey = key as keyof typeof componentInstance;
            const fieldSchema = schema[schemaKey];

            if (fieldSchema.type === Types.Ref && componentInstance[compKey] instanceof THREE.Vector3) {
                if (Globals.debugMode) {
                    const vector = componentInstance[compKey] as THREE.Vector3;
                    const subfolder = compFolder.addFolder(key);
                    subfolder.add(vector, 'x').name('x').disable().listen();
                    subfolder.add(vector, 'y').name('y').disable().listen();
                    subfolder.add(vector, 'z').name('z').disable().listen();

                    //collapse the folder at start
                    subfolder.close();
                }


            }

            else if (fieldSchema.type === Types.Ref && componentInstance[compKey] instanceof THREE.Group) {

                if (Globals.debugMode) {
                    const group = componentInstance[compKey] as THREE.Group;
                    compFolder.add({ message: group.name }, 'message').name(key).disable();
                }

            }

            else if (fieldSchema.type === Types.String) {
                const stringSchema = fieldSchema as COMP.ComponentSchemaProp_String;
                const controller = compFolder.add(componentInstance, key).name(key).listen();
                if (stringSchema.readonly) {
                    controller.disable();
                }
            }

            else if (fieldSchema.type === Types.Boolean) {
                if (Globals.debugMode) {
                    compFolder.add(componentInstance, key).name(key).listen();
                }
            }
            else if (fieldSchema.type === Types.Number) {
                const numberSchema = fieldSchema as COMP.ComponentSchemaProp_Number;


                const controller = compFolder.add(componentInstance, key, numberSchema.min, numberSchema.max).name(key).listen();
                if (numberSchema.readonly) {
                    controller.disable();
                }
                if (numberSchema.step) {
                    controller.step(numberSchema.step);
                }


                if (numberSchema.monitorable) {
                    const lineName = entityName + '.' + key;
                    const hasKey = graphSystem.hasMonitored(lineName);
                    monitorFolder.add({ monitor: hasKey }, 'monitor').name(key).onChange((value) => {
                        if (value) {
                            graphSystem.addLine(lineName, () => {
                                return componentInstance[compKey] as unknown as number;
                            });
                        }
                        else {
                            graphSystem.removeLine(lineName);
                        }
                    });
                }
            }
            else {
                //add a text says it's not supported
                if (Globals.debugMode)
                    compFolder.add({ message: 'type not handled' }, 'message').name(key).disable();
            }


        }; //iterate over schema



        //if no controllers, delete the folder
        if (!Globals.debugMode)
            if (compFolder.children.length === 0) {
                compFolder.destroy();
            }


    }); //iterate over components

}




// function saveWorld(world: World) {
//     const worldData = world.serialize();
//     saveToFile(worldData);
// }

function saveToFile(data: any, filename: string = "data.json") {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}



export function saveObject3D(scene: THREE.Object3D) {
    const sceneData = scene.toJSON();
    saveToFile(sceneData, "scene.json");
    //console.log("Scene saved, children num: ", scene.children.length);
    //console.log(JSON.stringify(scene.toJSON(), null, 2));
}




function readFileAsParsedJson(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result as string;
                const data = JSON.parse(result);
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

export async function loadObject3D(fileInput: HTMLInputElement): Promise<THREE.Group | undefined> {
    if (fileInput.files && fileInput.files.length > 0) {
        try {
            const file = fileInput.files[0];
            const sceneData = await readFileAsParsedJson(file);
            const loader = new THREE.ObjectLoader();
            const loadedScene = loader.parse(sceneData) as THREE.Group;

            console.log("Scene loaded successfully");
            //console.log(": ", loadedScene);

            return loadedScene;

        } catch (error) {
            console.error("Fail loading scene:", error);
        }
    } else {
        console.warn("No file selected");
    }
}




export function saveWorld(entts: Array<Entity>): any {
    const entitiesData: any[] = [];



    entts.forEach((entity) => {
        const entityId = entity.id;
        const componentsData: any[] = [];

        const components = entity.getComponents();

        Object.entries(components).forEach(([componentId, componentInstance]) => {
            const compName = componentInstance.constructor.name;

            const schema = (componentInstance.constructor as any).schema;
            if (!schema) return;

            // 将组件字段整理成可序列化的对象
            const data: Record<string, any> = {};
            for (const key of Object.keys(schema)) {

                const value = (componentInstance as any)[key];
                if (schema[key].type === Types.Ref && value instanceof THREE.Vector3) {
                    data[key] = value;
                }
                else if (schema[key].type === Types.Number) {
                    data[key] = value;
                }
                else if (schema[key].type === Types.String) {
                    data[key] = value;
                }
                else if (schema[key].type === Types.Boolean) {
                    data[key] = value;
                }
            }

            componentsData.push({
                type: compName,
                data,
            });

        });

        entitiesData.push({
            id: entityId,
            elementType: "entity",
            components: componentsData
        });


    });


    const date = new Date();
    const fileName = 'circuit' + date.toISOString().slice(0, -5).
        replace(/:/g, '-').replace(/\./g, '-').replace('T', '_') + '.json';
    saveToFile({ entities: entitiesData }, fileName);
    return { entities: entitiesData };

}

export async function loadWorldFromFileInput(fileInput: HTMLInputElement, world: World): Promise<void> {
    if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const data = await readFileAsParsedJson(file);
        await processWorldFile(data, world);

    } else {
        console.error("No file selected.");
    }
}


//untested
export async function loadWorldFromFilePath(filePath: string, world: World): Promise<void> {
    if (!filePath) {
        console.error("Invalid file path");
        return;
    }

    const response = await fetch(filePath);
    const data = await response.json();

    await processWorldFile(data, world);

}

async function processWorldFile(data: any, world: World): Promise<void> {
    try {
        //console.log("entitiesData: ", data);

        if (!data || !data.entities) {
            console.error('Invalid world data');
            return;
        }

        data.entities.forEach((entityData: any) => {
            // const entity = world.createEntity();
            const components = entityData.components;

            let position: Vector3;
            let rotation: Vector3;
            let length: number = 0.2;
            let params: any;

            if (components.some((comp: any) => comp.type === 'CTransform')) {
                const cTransform = components.find((comp: any) => comp.type === 'CTransform');
                position = new Vector3(cTransform.data.position.x, cTransform.data.position.y, cTransform.data.position.z);
                rotation = new Vector3(cTransform.data.rotation.x, cTransform.data.rotation.y, cTransform.data.rotation.z);
            }
            else {
                position = new Vector3(0, 0, 0);
                rotation = new Vector3(0, 0, 0);
                console.warn("load entt: No transform component found");
            }

            if (components.some((comp: any) => comp.type === 'CElementMetaInfo')) {
                const cMeta = components.find((comp: any) => comp.type === 'CElementMetaInfo');
                const elementType = cMeta.data.elementType as COMP.ElementTypeName;

                if (components.some((comp: any) => comp.type === 'CElement')) {
                    const cElement = components.find((comp: any) => comp.type === 'CElement');
                    length = cElement.data.length;
                }

                const factory = elementFactoryMap[elementType]();
                // console.log("element type: ", elementType);
                // console.log("factory: ", factory);
                const compName = elementComponentMap[elementType];

                if (components.some((comp: any) => comp.type === compName)) {
                    const cElementComp = components.find((comp: any) => comp.type === compName);
                    params = cElementComp.data;
                }
                const entity = ENTT.spawnEntity2(world, factory, position, rotation, length, params);

            }
            else {
                console.warn("load entt: No meta component found");
            }
        });
    } catch (error) {
        console.error("Fail loading world:", error);
    }
}



