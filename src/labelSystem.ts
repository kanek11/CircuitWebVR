import * as THREE from 'three';
import { World, System, Component, Entity, Types } from 'ecsy';

import * as COMP from "./components";
import * as ENTT from "./entities";

import { Globals } from "./globals";





// export class CLabel3D extends Component<CLabel3D> {
//     text!: string;
//     font!: string;
//     backgroundColor!: string;
//     sprite!: THREE.Sprite;

//     static schema = {
//         text: { type: Types.String, default: 'emptyText' },
//         font: { type: Types.String, default: '48px Arial' },
//         backgroundColor: { type: Types.String, default: Globals.labelColor },
//         sprite: { type: Types.Ref, default: null },
//     } as const;

//     dispose(): void {
//     }
// }

export class SLabelSystem extends System {

    static queries = {
        labels: { components: [COMP.CLabel3D], listen: { added: true, removed: true, changed: [COMP.CLabel3D] } },

        elements: { components: [COMP.CElement], listen: { added: true, removed: true, changed: [COMP.CElement] } },
        resistors: { components: [COMP.CResistance], listen: { added: true, removed: true, changed: [COMP.CResistance] } },
        DCVoltages: { components: [COMP.CDCVoltage], listen: { added: true, removed: true }, changed: [COMP.CDCVoltage] },
        ACVoltages: { components: [COMP.CACVoltage], listen: { added: true, removed: true, changed: [COMP.CACVoltage] } },
        inductors: { components: [COMP.CInductance], listen: { added: true, removed: true }, changed: [COMP.CInductance] },
        capacitors: { components: [COMP.CCapacitance], listen: { added: true, removed: true }, changed: [COMP.CCapacitance] },
    };

    init(): void {
        console.log("init label render system");
    }

    execute(delta: number, elapsed: number): void {

        this.queries.elements.added!.forEach(entity => {
            entity.addComponent(COMP.CLabel3D, { text: '', });
        });


        //define the label
        this.queries.labels.added!.forEach(entity => {
            const cLabel = entity.getMutableComponent(COMP.CLabel3D)!;

            // createCanvasTexture
            const canvas = document.createElement('canvas');
            canvas.width = Globals.labelCanvasSize.width;
            canvas.height = Globals.labelCanvasSize.height;
            const context = canvas.getContext('2d')!;
            this.updateCanvasTexture(context, cLabel.text, cLabel.font, cLabel.backgroundColor);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.name = "labelTexture";
            sprite.renderOrder = Globals.labelRenderOrder;
            sprite.material.depthTest = false;
            sprite.material.depthWrite = false;
            sprite.raycast = () => { };

            //hardcoded for now
            sprite.scale.set(Globals.textScale.x, Globals.textScale.y, Globals.textScale.z);
            sprite.position.set(Globals.textOffset.x, Globals.textOffset.y, Globals.textOffset.z);

            const cObject = entity.getComponent(COMP.CObject3D)!;
            cObject.group.add(sprite);

            cLabel.sprite = sprite;
        });


        this.queries.labels.removed!.forEach(entity => {
        });

        //reset the text;  otherwise element might be appended with the previous text infinitely
        this.queries.elements.results.forEach(entity => {
            const element = entity.getComponent(COMP.CElement)!;
            const label = entity.getMutableComponent(COMP.CLabel3D)!;
            label.text = '';
        });

        this.queries.resistors.results.forEach(entity => {
            const resistor = entity.getComponent(COMP.CResistance)!;
            const label = entity.getMutableComponent(COMP.CLabel3D)!;
            label.text = `${resistor.resistance.toFixed(2)}Ω`;

        });

        this.queries.DCVoltages.results.forEach(entity => {
            const voltage = entity.getComponent(COMP.CDCVoltage)!;
            const label = entity.getMutableComponent(COMP.CLabel3D)!;
            label.text = `${voltage.voltage.toFixed(2)}V`;
        });

        this.queries.inductors.results.forEach(entity => {
            const inductor = entity.getMutableComponent(COMP.CInductance)!;
            const label = entity.getMutableComponent(COMP.CLabel3D)!;
            label.text = `${inductor.inductance.toFixed(2)}H`;
            label.text += `\nLI²/2=${inductor.energy.toFixed(2)}J`;
        });


        this.queries.capacitors.results.forEach(entity => {
            const capacitor = entity.getMutableComponent(COMP.CCapacitance)!;
            const label = entity.getMutableComponent(COMP.CLabel3D)!;
            label.text = `${capacitor.capacitance.toFixed(2)}F`;
            label.text += `\nCV²/2=${capacitor.energy.toFixed(2)}J`;
        });



        this.queries.labels.results.forEach(entity => {
            const cLabel = entity.getMutableComponent(COMP.CLabel3D)!;

            const cElement = entity.getComponent(COMP.CElement)!;
            //some elements has no label
            if (Globals.showSimInfo) {
                //append to the label text  
                cLabel.text += `\nV/R=${Math.abs(cElement.current).toFixed(2)}A`;
                cLabel.text += `\nVd=${Math.abs(cElement.voltage).toFixed(2)}V`;

            }

            //update canvas 
            const canvas = cLabel.sprite.material.map!.image as HTMLCanvasElement;
            const context = canvas.getContext('2d')!;
            this.updateCanvasTexture(context, cLabel.text, cLabel.font, cLabel.backgroundColor);

            cLabel.sprite.material.map!.needsUpdate = true;

        });


    }



    updateCanvasTexture(ctx: CanvasRenderingContext2D, text: string, font: string, backgroundColor: string) {

        //glClear
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.font = font;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        //ctx.textBaseline = 'middle';

        //new: recognize newline
        //ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2); 

        const lines = text.split('\n');
        //10 means parse decimal;  otherwise fallback to 20
        const lineHeight = parseInt(font, 10) || 20;

        const x = ctx.canvas.width / 2;
        let y = ctx.canvas.height / 2;

        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, y);
            y -= lineHeight;
        }

    }

}