
import * as THREE from 'three';
import { World, System, Component, Entity, Types } from 'ecsy';

import * as COMP from "./components";
import * as ENTT from "./entities";



export class SSerializeSystem extends System {

    static queries = {
        elements: { components: [COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CElement] } },
    };

    init(): void {
        console.log("init serialize system");
    }

    execute(delta: number, time: number): void {
        //console.log("execute serialize system");
    }

    getEntts(): any {
        return this.queries.elements.results;
    }

}


