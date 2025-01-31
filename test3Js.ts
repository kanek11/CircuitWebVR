import * as THREE from 'three';


function createFieldLines(center: THREE.Vector3, numLines: number): THREE.Group {
    const group = new THREE.Group();
    const radius = 0.5; // 场线的初始半径

    for (let i = 0; i < numLines; i++) {
        const theta = (i / numLines) * Math.PI * 2;
        const points: THREE.Vector3[] = [];
        for (let t = -2; t <= 2; t += 0.1) { // t表示高度，控制轨迹
            const x = radius * Math.cos(theta);
            const y = t;
            const z = radius * Math.sin(theta);
            points.push(new THREE.Vector3(x, y, z).add(center));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.Line(geometry, material);
        group.add(line);
    }
    return group;
}





function createField(L = 10, numLinesInside = 10, numLinesOutside = 20) {
    const group = new THREE.Group();

    // 1. 绘制内部场线
    // for (let i = 0; i < numLinesInside; i++) {
    //     // 选一个半径 R_i 和角度 alpha_i
    //     const R_i = 0.2 * i;                // 示例：从 0.0, 0.2, 0.4, ...
    //     const alpha_i = 0;                  // 只画在 x 轴上，也可以换成别的分布

    //     const pointsInside = [];
    //     const numSegments = 10;
    //     for (let j = 0; j <= numSegments; j++) {
    //         const t = j / numSegments;
    //         const zVal = -L / 2 + t * L;
    //         const xVal = R_i * Math.cos(alpha_i);
    //         const yVal = R_i * Math.sin(alpha_i);
    //         pointsInside.push(new THREE.Vector3(xVal, yVal, zVal));
    //     }

    //     const geometryInside = new THREE.BufferGeometry().setFromPoints(pointsInside);
    //     const materialInside = new THREE.LineBasicMaterial({ color: 0xffff00 });
    //     group.add(new THREE.Line(geometryInside, materialInside));
    // }


    // 2. 绘制外部场线
    for (let i = 0; i < numLinesOutside; i++) {
        // 让外部多条线在 azimuth angle 上均匀分布
        const alpha_i = (2 * Math.PI / numLinesOutside) * i;

        const pointsOutside = [];
        const numSegments = 50;
        const R0 = 1.0;
        const A = 2.0;

        for (let j = 0; j <= numSegments; j++) {
            const t = j / numSegments;
            const zVal = (L / 2) - t * L;
            const rVal = R0 + A * (1 - 2 * t) * (1 - 2 * t);

            const xVal = rVal * Math.cos(alpha_i);
            const yVal = rVal * Math.sin(alpha_i);

            pointsOutside.push(new THREE.Vector3(xVal, yVal, zVal));
        }

        const geometryOutside = new THREE.BufferGeometry().setFromPoints(pointsOutside);
        const materialOutside = new THREE.LineBasicMaterial({ color: 0xff0000 });
        group.add(new THREE.Line(geometryOutside, materialOutside));
    }

    return group;
}



const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// const geometry = new THREE.BoxGeometry(1, 1, 1);
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);


const fieldLines = createField();
fieldLines.rotation.y = Math.PI / 2;
scene.add(fieldLines);


camera.position.z = 5;

//new raycaster
const raycaster = new THREE.Raycaster();
raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

function animate() {

    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;

    // const intersects = raycaster.intersectObjects(scene.children);
    // if (intersects.length > 0) {
    //     //set material color:
    //     intersects[0].object.material.color.set(0xffffff);
    // }

    renderer.render(scene, camera);

}