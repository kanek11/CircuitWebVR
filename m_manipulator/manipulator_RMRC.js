window.addEventListener('load', init);   //event listener for page "load" (all elements are loaded)


// Window size
const width = window.innerWidth; //960;
const height = window.innerHeight;  //540;


var jacobi = new THREE.Matrix3(); // Jacobian 


var c0 = new THREE.Vector3(); // center of body
var c1 = new THREE.Vector3(); // center of arm1
var c2 = new THREE.Vector3(); // center of arm2
var c3 = new THREE.Vector3(); // center of arm3 

c0 = new THREE.Vector3(0, 0, 0.5);
c1 = new THREE.Vector3(0, 0, 1.5);
c2 = new THREE.Vector3(0, 0, 2.5);
c3 = new THREE.Vector3(0, 0, 3.5);


var q01 = new THREE.Quaternion(); // 0A1 matrix
var q02 = new THREE.Quaternion(); // 0A2 matrix
var q03 = new THREE.Quaternion(); // 0A3 matrix

var p0 = new THREE.Vector3(); // position of base origin
var p1 = new THREE.Vector3(); // position of joint 1
var p2 = new THREE.Vector3(); // position of joint 2
var p3 = new THREE.Vector3(); // position of joint 3
var pe = new THREE.Vector3(); // position of hand /end effector

var l = [1, 1, 1, 1]; // arm length ;  center at centroid.

//var phi = [0, 0, 0];
var phi = [0, 45, 90];

//IK: keyboad control
var PosSpeed = 0.1;

//DK: keyboad control
var RotSpeed = 5;

//curve control:  
var ve = new THREE.Vector3(); // velocity of hand

var start = new THREE.Vector3(); // start position
var end = new THREE.Vector3(); // end position

var dt = 0.1;

var T = 5;  //duration 
var t = 0;  //elapsed
var isMoving = 0;


function init() {
  // renderer 
  const renderer = new THREE.WebGLRenderer({
    //canvas: document.querySelector('#myCanvas')
    canvas: document.getElementById("myCanvas")
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.setClearColor(0xffffff);

  // scene
  const scene = new THREE.Scene();

  // camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
  camera.up.x = 0; camera.up.y = 0; camera.up.z = 1;
  camera.position.set(7, 7, 7);

  // camera controller
  const controls = new THREE.OrbitControls(camera);
  controls.enableDamping = true;
  controls.dampingFactor = 0.2;


  //==========lighting

  //directional light
  const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.7);
  directionalLight.position.set(0, 1, 1);
  scene.add(directionalLight);

  // ambient light
  const ambientLight = new THREE.AmbientLight(0xf0f0f0); // soft white light
  scene.add(ambientLight);


  //=========objects


  // floor 
  createFloor();

  function createFloor() {
    var geometry = new THREE.Geometry();
    var N = 10;
    var w = 1;
    for (var i = 0; i < N; i++) {
      for (var j = 0; j <= N; j++) {
        geometry.vertices.push(new THREE.Vector3((i - N / 2) * w, (j - N / 2) * w, 0));
        geometry.vertices.push(new THREE.Vector3(((i + 1) - N / 2) * w, (j - N / 2) * w, 0));
      }
      for (var j = 0; j <= N; j++) {
        geometry.vertices.push(new THREE.Vector3((j - N / 2) * w, (i - N / 2) * w, 0));
        geometry.vertices.push(new THREE.Vector3((j - N / 2) * w, ((i + 1) - N / 2) * w, 0));
      }
    }
    var material = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    lines = new THREE.LineSegments(geometry, material);
    scene.add(lines);

    for (var i = 0; i < 3; i++) {
      var geometry = new THREE.Geometry();
      geometry.vertices.push(new THREE.Vector3(0, 0, 0));
      if (i == 0) {
        geometry.vertices.push(new THREE.Vector3(N * w / 4, 0, 0));
        var material = new THREE.LineBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0.5 });
      } else if (i == 1) {
        geometry.vertices.push(new THREE.Vector3(0, N * w / 4, 0));
        var material = new THREE.LineBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.5 });
      } else {
        geometry.vertices.push(new THREE.Vector3(0, 0, N * w / 4));
        var material = new THREE.LineBasicMaterial({ color: 0x0000FF, transparent: true, opacity: 0.5 });
      }
      axis = new THREE.Line(geometry, material);
      scene.add(axis);
    }
  }


  createBase();

  function createBase() {
    var geometry_base = new THREE.BoxGeometry(1, 1, l[0]);
    var material_base = new THREE.MeshStandardMaterial({ color: 0xff0000, side: THREE.DoubleSide });
    base = new THREE.Mesh(geometry_base, material_base);
    scene.add(base);
  }

  // arm 1
  createArm1();

  function createArm1() {
    var geometry = new THREE.BoxGeometry(0.2, 0.2, l[1]);
    var material = new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    arm1 = new THREE.Mesh(geometry, material);
    scene.add(arm1);
  }

  // arm 2
  createArm2();

  function createArm2() {
    var geometry = new THREE.BoxGeometry(l[2], 0.2, 0.2);
    var material = new THREE.MeshStandardMaterial({ color: 0x0000ff, side: THREE.DoubleSide });
    arm2 = new THREE.Mesh(geometry, material);
    scene.add(arm2);
  }

  // arm 3
  createArm3();

  function createArm3() {
    var geometry = new THREE.BoxGeometry(l[3], 0.2, 0.2);
    var material = new THREE.MeshStandardMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
    arm3 = new THREE.Mesh(geometry, material);
    scene.add(arm3);
  }


  if (false) {
    // base
    createBase();

    function createBase() {
      var geometry_base = new THREE.BoxGeometry(1, 1, l[0]);
      var material_base = new THREE.MeshStandardMaterial({ color: 0xff0000, side: THREE.DoubleSide });
      base = new THREE.Mesh(geometry_base, material_base);
      scene.add(base);
    }

    // arm 1
    createArm1();

    function createArm1() {
      var geometry = new THREE.BoxGeometry(0.2, 0.2, l[1]);
      var material = new THREE.MeshStandardMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
      arm1 = new THREE.Mesh(geometry, material);
      scene.add(arm1);
    }

    // arm 2
    createArm2();

    function createArm2() {
      var geometry = new THREE.BoxGeometry(0.2, 0.2, l[2]);
      var material = new THREE.MeshStandardMaterial({ color: 0x0000ff, side: THREE.DoubleSide });
      arm2 = new THREE.Mesh(geometry, material);
      scene.add(arm2);
    }

    // arm 3
    createArm3();

    function createArm3() {
      var geometry = new THREE.BoxGeometry(0.2, 0.2, l[3]);
      var material = new THREE.MeshStandardMaterial({ color: 0xff00ff, side: THREE.DoubleSide });
      arm3 = new THREE.Mesh(geometry, material);
      scene.add(arm3);
    }

  }


  //TODO: 
  DK();

  // rendering
  tick();



  document.addEventListener("keydown", m_onKeyDownDK, false);


  function m_onKeyDownDK(event) {
    switch (event.key) {
      case 'z':
      case 'Z':
        phi[0] -= RotSpeed;
        break;
      case 'x':
      case 'X':
        phi[0] += RotSpeed;
        break;
      case 'a':
      case 'A':
        phi[1] += RotSpeed;
        break;
      case 's':
      case 'S':
        phi[1] -= RotSpeed;
        break;
      case 'q':
      case 'Q':
        phi[2] += RotSpeed;
        break;
      case 'w':
      case 'W':
        phi[2] -= RotSpeed;
        break;
      case ' ':
        phi[0] = 0.0;
        phi[1] = 0.0;
        phi[2] = 0.0;
        //phi[1] = 45.0;
        //phi[2] = 90.0;
        break;


      //curve control
      //set start
      case 'c':
      case 'C':
        start.copy(pe);
        ve.set(0, 0, 0);
        console.log("Set start " + start.x + "  " + start.y + "  " + start.z);
        break;

      case 'v':
      case 'V':
        end.copy(pe);
        isMoving = 1;
        t = 0;
        ve.set(0, 0, 0);

        pe.copy(start);
        IK();
        DK();
        console.log("Set end " + end.x + "  " + end.y + "  " + end.z);
        console.log("start moving");
        break;


      default:
        // Do nothing for other keys
        console.log("do nothing");
        break;
    }
    DK();
  }


  function onKeyDownIK(event) {
    var keyCode = event.which;
    if (keyCode == 90) {
      // z
      pe.z += PosSpeed;
    } else if (keyCode == 88) {
      // x
      pe.z -= PosSpeed;
    } else if (keyCode == 65) {
      // a
      pe.y += PosSpeed;
    } else if (keyCode == 83) {
      // s
      pe.y -= PosSpeed;
    } else if (keyCode == 81) {
      // q
      pe.x += PosSpeed;
    } else if (keyCode == 87) {
      // w
      pe.x -= PosSpeed;
    } else if (keyCode == 32) {
      phi[0] = 0.0;
      phi[1] = 45.0;
      phi[2] = 90.0;
      DK();
    }
    IK();
    DK();
  }



  function DK() {
    var l0 = new THREE.Vector3(0, 0, l[0]);
    var l1 = new THREE.Vector3(0, 0, l[1]);
    var l2 = new THREE.Vector3(l[2], 0, 0);
    var l3 = new THREE.Vector3(l[3], 0, 0);
    var h0 = new THREE.Vector3(0, 0, l[0] / 2.0);
    var h1 = new THREE.Vector3(0, 0, l[1] / 2.0);
    var h2 = new THREE.Vector3(l[2] / 2.0, 0, 0);
    var h3 = new THREE.Vector3(l[3] / 2.0, 0, 0);

    var x_axis = new THREE.Vector3(1, 0, 0);
    var y_axis = new THREE.Vector3(0, 1, 0);
    var z_axis = new THREE.Vector3(0, 0, 1);

    var q1 = new THREE.Quaternion().setFromAxisAngle(x_axis, -Math.PI / 2.0);
    var q2 = new THREE.Quaternion().setFromAxisAngle(z_axis, -Math.PI / 2.0);
    var q3 = new THREE.Quaternion().setFromAxisAngle(z_axis, phi[1] * Math.PI / 180.0);
    var q12 = new THREE.Quaternion().multiplyQuaternions(q1, q2).multiply(q3);
    var q23 = new THREE.Quaternion().setFromAxisAngle(z_axis, phi[2] * Math.PI / 180.0);

    q01.setFromAxisAngle(z_axis, phi[0] * Math.PI / 180.0);
    q02 = q01.clone();
    q02.multiply(q12);
    q03 = q02.clone();
    q03.multiply(q23);

    p0.set(0, 0, 0);
    p1 = l0.clone();
    p2 = p1.clone();
    p2.add(l1.applyQuaternion(q01));
    p3 = p2.clone();
    p3.add(l2.applyQuaternion(q02));
    pe = p3.clone();
    pe.add(l3.applyQuaternion(q03));

    c0 = h0.clone();
    c1 = p1.clone();
    c1.add(h1.applyQuaternion(q01));
    c2 = p2.clone();
    c2.add(h2.applyQuaternion(q02));
    c3 = p3.clone();
    c3.add(h3.applyQuaternion(q03));

    //    console.log(pe)
  }





  //DK or forward kinetics
  function m_DK() {
    //Insert code for DK here

    console.log("execute DK");

    //world coord
    var x_axis = new THREE.Vector3(1, 0, 0);
    var y_axis = new THREE.Vector3(0, 1, 0);
    var z_axis = new THREE.Vector3(0, 0, 1);


    //local offset;  initial pose;
    var l0 = new THREE.Vector3(0, 0, l[0]);
    var l1 = new THREE.Vector3(0, 0, l[1]);
    var l2 = new THREE.Vector3(0, 0, l[2]);
    var l3 = new THREE.Vector3(0, 0, l[3]);

    //local rotations Q;
    var q0 = new THREE.Quaternion();
    var q1 = new THREE.Quaternion().setFromAxisAngle(z_axis, phi[0] * Math.PI / 180.0);
    var q2 = new THREE.Quaternion().setFromAxisAngle(y_axis, phi[1] * Math.PI / 180.0);
    var q3 = new THREE.Quaternion().setFromAxisAngle(y_axis, phi[2] * Math.PI / 180.0);


    //global rotations = orientation of each link;
    var q12 = new THREE.Quaternion().multiplyQuaternions(q1, q2);
    var q123 = new THREE.Quaternion().multiplyQuaternions(q12, q3);


    //joints;
    p0.set(0, 0, 0);   //joint 0
    p1 = l0.clone();   //joint 1
    //joint n+1 = joint n + rotation * offset,  recursive so on;
    p2 = p1.clone().add(l1.clone().applyQuaternion(q1));
    p3 = p2.clone().add(l2.clone().applyQuaternion(q12));
    pe = p3.clone().add(l3.clone().applyQuaternion(q123));


    //for visualization as boxes;
    q01 = q1.clone();
    q02 = q12.clone();
    q03 = q123.clone();

    c0 = p0.clone().add(p1).divideScalar(2.0);
    c1 = p1.clone().add(p2).divideScalar(2.0);
    c2 = p2.clone().add(p3).divideScalar(2.0);
    c3 = p3.clone().add(pe).divideScalar(2.0);

    //console.log("c0={0}", c0);
    //console.log("c1={0}", c1);
    //console.log("c2={0}", c2);
    //console.log("c3={0}", c3);


  }

  function IK() {
    //Insert code for IK here
    console.log("execute IK");

    function sqr(x) {
      return x * x;
    }

    phi[0] = Math.atan2(pe.y, pe.x);

    r = Math.sqrt(sqr(pe.x / Math.cos(phi[0])) + sqr(pe.z - l[0] - l[1]));
    p = Math.atan2(pe.z - l[0] - l[1], pe.x / Math.cos(phi[0]));
    d = 1.0 / (2.0 * l[2]) * (sqr(pe.x / Math.cos(phi[0]))
      + sqr(pe.z - l[0] - l[1]) + sqr(l[2]) - sqr(l[3]));

    if (d > r) {

      console.log("Out of region\n");
      return;
    }

    phi[1] = Math.atan2(d / r, Math.sqrt(1.0 - sqr(d / r))) - p;
    phi[2] = Math.atan2(pe.x / Math.cos(phi[0]) - Math.sin(phi[1]) * l[2],
      pe.z - l[0] - l[1] - Math.cos(phi[1]) * l[2]) - phi[1];

    phi[0] = phi[0] * 180.0 / Math.PI;
    phi[1] = phi[1] * 180.0 / Math.PI;
    phi[2] = phi[2] * 180.0 / Math.PI;

    //    console.log("phi[0] " + phi[0]);
    //    console.log("phi[1] " + phi[1]);
    //    console.log("phi[2] " + phi[2]);

  }

  function calcJacobi() {
    //Insert code for jacobian calculation here

    var C1 = Math.cos(phi[0] * Math.PI / 180.0);
    var S1 = Math.sin(phi[0] * Math.PI / 180.0);
    var C2 = Math.cos(phi[1] * Math.PI / 180.0);
    var S2 = Math.sin(phi[1] * Math.PI / 180.0);
    var C3 = Math.cos(phi[2] * Math.PI / 180.0);
    var S3 = Math.sin(phi[2] * Math.PI / 180.0);
    var C23 = Math.cos((phi[1] + phi[2]) * Math.PI / 180.0);
    var S23 = Math.sin((phi[1] + phi[2]) * Math.PI / 180.0);

    jacobi.set(
      -S1 * (S2 * l[2] + S23 * l[3]), C1 * (C2 * l[2] + C23 * l[3]), C1 * C23 * l[3],
      C1 * (S2 * l[2] + S23 * l[3]), S1 * (C2 * l[2] + C23 * l[3]), S1 * C23 * l[3],
      0, -S2 * l[2] - S23 * l[3], -S23 * l[3]);


  }

  function tick() {

    //query time difference
    var time = performance.now();
    time *= 0.001;  //ms to sec 


    //trajectory planning; 
    // by : v of end = Jacobian * v of angles;

    if (isMoving == 1) {
      console.log("control update");

      //velocity of endpoint;
      ve.x = - 3 * 2 / (T * T * T) * (end.x - start.x) * (t * t) + 2 * 3 / (T * T) * (end.x - start.x) * t;
      ve.y = - 3 * 2 / (T * T * T) * (end.y - start.y) * (t * t) + 2 * 3 / (T * T) * (end.y - start.y) * t;
      ve.z = - 3 * 2 / (T * T * T) * (end.z - start.z) * (t * t) + 2 * 3 / (T * T) * (end.z - start.z) * t;

      t = t + dt;

      //reset
      if (t > T) {
        console.log("t>T , reset state");
        pe.copy(start);
        ve.set(0, 0, 0);
        IK();
        DK();
        isMoving = 1;
        t = 0;
      }

      calcJacobi();

      var det = jacobi.determinant();
      if (Math.abs(det) < 0.1) {
        console.error("jacobian < 0.1; Out of region\n");
        //ve.set(0, 0, 0);
      }

      //console.log("determine " + det);
      var invJacobi = new THREE.Matrix3();
      invJacobi.getInverse(jacobi);

      //velocity of angles;
      var phid = new THREE.Vector3();
      phid = ve.applyMatrix3(invJacobi);

      console.log("ve: " + ve.x + " " + ve.y + " " + ve.z);

      console.log("invJac: " + invJacobi.elements);
      console.log("phid: " + phid.x + " " + phid.y + " " + phid.z);

      //yn+1 = yn+ v*Δt
      phi[0] = phi[0] + phid.x / Math.PI * 180.0 * dt;
      phi[1] = phi[1] + phid.y / Math.PI * 180.0 * dt;
      phi[2] = phi[2] + phid.z / Math.PI * 180.0 * dt;


      DK();

    }


    //========routine: 

    //update the boxes
    base.position.copy(c0);

    arm1.position.copy(c1);
    arm1.quaternion.copy(q01);

    arm2.position.copy(c2);
    arm2.quaternion.copy(q02);

    arm3.position.copy(c3);
    arm3.quaternion.copy(q03);

    // update camera controller
    controls.update();

    // rendering
    renderer.render(scene, camera);

    // console.log("phi " + phi[0] + " " + phi[1] + " " + phi[2]);
    requestAnimationFrame(tick);
  }


}  // end of init()