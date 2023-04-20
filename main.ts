import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* Scene and renderer */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8f8f8f);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

/* Camera and controls */
const aspectr = window.innerHeight / window.innerWidth;
const scale = 3;
const camera = new THREE.OrthographicCamera(
    -scale, scale,
    scale * aspectr, -scale * aspectr,
    0.1, 100
);
const controls = new OrbitControls(camera, renderer.domElement);

camera.position.x = 5;
camera.position.y = 5;
camera.position.z = 5;
camera.lookAt(0, 0, 0);
camera.position.y = 3;
controls.update();

/* Lighting */
const skyColor = 0xB1E1FF;  // light blue
const groundColor = 0xB97A20;  // brownish orange
const intensity = 1;
const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
scene.add(light);

/* Box set state & settings */
let rowCount = 10;
let boxSet = {
    entries: new Array(rowCount)
                    .fill(0)
                    .map(() => new Array(rowCount)
                        .fill(0)),
    position: new THREE.Vector3(-0.5, -1, -0.5),
    size: .1
};

function boxPos(u: number, v: number): THREE.Vector3 {

    let pos = new THREE.Vector3(u, boxSet.entries[u][v], v);
    pos.multiplyScalar(boxSet.size);
    pos.add(boxSet.position);

    return pos;
}

function insertBox(u: number, v: number) {

    let l = Math.random();
    let cube = new THREE.Mesh(
        new THREE.BoxGeometry(boxSet.size, boxSet.size, boxSet.size),
        new THREE.MeshPhongMaterial( { color: new  THREE.Color(l, l, l) } )
    );


    let pos = boxPos(u, v);
    cube.position.set(pos.x, pos.y, pos.z);
    scene.add(cube)

    boxSet.entries[u][v]++;
}

function testBoxInsertion() {
    insertBox(4, 5);
    insertBox(5, 5);
    insertBox(5, 5);
    insertBox(5, 5);
    insertBox(5, 5);
    insertBox(2, 3);
    insertBox(8, 6);
    insertBox(8, 6);
}

/* Inverse Kinematics */

class IK {
    joints: THREE.Vector3[];
    lengths:number[];
    readonly joint_count: number; 
    draw_data: THREE.Line;

    constructor (color: THREE.Color, joints: THREE.Vector3[], lengths: number[]) {

        if (joints.length !== lengths.length + 1) {
            throw new Error("'joints[]' must be 1 more than 'lengths[]' in length!")
        }

        this.joints = joints;
        this.lengths = lengths;
        this.joint_count = joints.length;

        this.draw_data = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(joints),
            new THREE.LineBasicMaterial( {color: color } )
        );
        
        scene.add(this.draw_data);
    }

    updateGeometry() {

        this.draw_data.geometry.setFromPoints(this.joints);
        this.draw_data.geometry.attributes.position.needsUpdate = true;
    }

    reach(target: THREE.Vector3): void {

        let base = new THREE.Vector3();
        base.copy(this.joints[0]);

        this.joints[this.joint_count - 1].copy(target);
        for (let i = this.joint_count - 2; i >= 0; i--) {
            
            let v = new THREE.Vector3();
            v.copy(this.joints[i]);
            v.sub(this.joints[i + 1]);
            v.normalize();
            v.multiplyScalar(this.lengths[i]);
            v.add(this.joints[i + 1]); 

            this.joints[i].copy(v);
        }

        this.joints[0].copy(base);
        for (let i = 1; i < this.joint_count - 1; i++) {
            
            let v = new THREE.Vector3();
            v.copy(this.joints[i]);
            v.sub(this.joints[i - 1]);
            v.normalize();
            v.multiplyScalar(this.lengths[i - 1]);
            v.add(this.joints[i - 1]); 

            this.joints[i].copy(v);
        }
    }

    reachN(target: THREE.Vector3, steps: number): void {

        for (let i = 0; i < steps; i++) {

            this.reach(target);
        }
    }
}

let ik: IK;
function testIK() {

    let joints_count = 10;
    let arm_length = 2;
    let joints = Array<THREE.Vector3>(joints_count)
        .fill(new THREE.Vector3())
        .map(
        (j, i) => new THREE.Vector3(0, i * arm_length / joints_count, 0)
    );
    let lengths = Array<number>(joints_count - 1).fill(arm_length / joints_count);

    console.log(joints);
    console.log(lengths);

    ik = new IK(
        new THREE.Color(0, 0, 0),
        joints,
        lengths
    );

    ik.reach(new THREE.Vector3(1, 1, 1));
    ik.updateGeometry();
}

/* Robot */

class Robot {

    ik: IK;
    insertTarget: THREE.Vector3;
    uTarget: number;
    vTarget: number;
    prevTarget: THREE.Vector3;
    t: number;

    constructor() {
        
        let joints_count = 4;
        let arm_length = 2;
        let joints = new Array(joints_count)
            .fill(new THREE.Vector3())
            .map((j, i) => new THREE.Vector3(0, -i * arm_length / joints_count), 0);
        let lengths = new Array(joints_count - 1).fill(arm_length / joints_count);

        this.ik = new IK(
            new THREE.Color(0, 0, 0),
            joints,
            lengths
        );

        this.insertTarget = joints[joints.length - 1];
        this.prevTarget = new THREE.Vector3(0, 0, 0);
        this.prevTarget.copy(this.insertTarget);
        this.uTarget = 0;
        this.vTarget = 0;
        this.t = 0;
        this.pickNewTarget();
    }  

    pickNewTarget() {

        this.prevTarget = this.insertTarget;

        this.uTarget = Math.floor(Math.random() * rowCount);
        this.vTarget = Math.floor(Math.random() * rowCount);

        this.insertTarget = boxPos(
            this.uTarget,
            this.vTarget
        );

        this.t = 0;
    }

    update() {

        this.t += 0.03;

        if (this.t >= 1.0) {

            insertBox(
                this.uTarget,
                this.vTarget
            );
            this.pickNewTarget();
        }

        let t = 0.5 * (1 - Math.cos(this.t * Math.PI));
        let ikTarget = new THREE.Vector3();
        ikTarget.copy(this.insertTarget);
        ikTarget.sub(this.prevTarget);
        ikTarget.multiplyScalar(t);
        ikTarget.add(this.prevTarget);
        ikTarget.y += 0.5 * (1 - (2 * t - 1) * (2 * t - 1));

        this.ik.reachN(ikTarget, 4);
        this.ik.updateGeometry();
    }
};

let robot = new Robot();
console.log(robot);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    controls.update();
    robot.update();
}

animate();