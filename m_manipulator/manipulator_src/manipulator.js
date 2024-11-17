window.addEventListener('load', init);

// Window size
const width = 960;
const height = 540;

var c0 = new THREE.Vector3(); // center of body
var c1 = new THREE.Vector3(); // center of arm1
var c2 = new THREE.Vector3(); // center of arm2
var c3 = new THREE.Vector3(); // center of arm3
var q01 = new THREE.Quaternion(); // 0A1 matrix
var q02 = new THREE.Quaternion(); // 0A2 matrix
var q03 = new THREE.Quaternion(); // 0A3 matrix
var p0 = new THREE.Vector3(); // position of base origin
var p1 = new THREE.Vector3(); // position of joint 1
var p2 = new THREE.Vector3(); // position of joint 2
var p3 = new THREE.Vector3(); // position of joint 3
var pe = new THREE.Vector3(); // position of hand
var l = [1, 1, 1, 1]; // arm length
var phi = [0, 45, 90];

function init() {
  // renderer 
  const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#myCanvas')
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

  // parallel light
  const directionalLight = new THREE.DirectionalLight( 0xFFFFFF, 0.7 );
  directionalLight.position.set(0, 1, 1);
  scene.add( directionalLight );

  // ambient light
  const ambientLight = new THREE.AmbientLight( 0xf0f0f0 ); // soft white light
  scene.add(ambientLight);

  // floor mesh
  createFloor();

  function createFloor() {
    var geometry = new THREE.Geometry();
    var N = 10;
    var w = 1;
    for( var i=0; i<N; i++){
      for( var j=0; j<=N; j++){
        geometry.vertices.push( new THREE.Vector3((i - N/2 ) * w, (j - N/2 ) * w, 0) );
        geometry.vertices.push( new THREE.Vector3(((i+1) - N/2 ) * w, (j - N/2 ) * w, 0) );
      }
      for( var j=0; j<=N; j++){
        geometry.vertices.push( new THREE.Vector3((j - N/2 ) * w, (i - N/2 ) * w, 0) );
        geometry.vertices.push( new THREE.Vector3((j - N/2 ) * w, ((i+1) - N/2 ) * w, 0) );
      }
    }
    var material = new THREE.LineBasicMaterial({ color: 0x000000, transparent:true, opacity:0.5 });
    lines = new THREE.LineSegments(geometry, material);
    scene.add(lines);

    for( var i=0; i<3; i++){
      var geometry = new THREE.Geometry();
      geometry.vertices.push( new THREE.Vector3(0, 0, 0) );
      if (i  == 0) {
        geometry.vertices.push( new THREE.Vector3(N*w/4, 0, 0) );
        var material = new THREE.LineBasicMaterial({ color: 0xFF0000, transparent:true, opacity:0.5 });
      } else if (i == 1) {
        geometry.vertices.push( new THREE.Vector3(0, N*w/4, 0) );
        var material = new THREE.LineBasicMaterial({ color: 0x00FF00, transparent:true, opacity:0.5 });
      } else {
        geometry.vertices.push( new THREE.Vector3(0, 0, N*w/4) );
        var material = new THREE.LineBasicMaterial({ color: 0x0000FF, transparent:true, opacity:0.5 });
      }
      axis = new THREE.Line(geometry, material);
      scene.add(axis);
    }
  }

  // base
  createBase();

  function createBase() {
    var geometry_base = new THREE.BoxGeometry(1, 1, l[0]);
    var material_base = new THREE.MeshStandardMaterial({color: 0xff0000, side: THREE.DoubleSide});
    base = new THREE.Mesh(geometry_base, material_base);
    scene.add(base);
  }

  // arm 1
  createArm1();

  function createArm1() {
    var geometry = new THREE.BoxGeometry(0.2, 0.2, l[1]);
    var material = new THREE.MeshStandardMaterial({color: 0x00ff00, side: THREE.DoubleSide});
    arm1 = new THREE.Mesh(geometry, material);
    scene.add(arm1);
  }

  // arm 2
  createArm2();

  function createArm2() {
    var geometry = new THREE.BoxGeometry(l[2], 0.2, 0.2);
    var material = new THREE.MeshStandardMaterial({color: 0x0000ff, side: THREE.DoubleSide});
    arm2 = new THREE.Mesh(geometry, material);
    scene.add(arm2);
  }

  // arm 3
  createArm3();

  function createArm3() {
    var geometry = new THREE.BoxGeometry(l[3], 0.2, 0.2);
    var material = new THREE.MeshStandardMaterial({color: 0xff00ff, side: THREE.DoubleSide});
    arm3 = new THREE.Mesh(geometry, material);
    scene.add(arm3);
  }

  DK();

  // rendering
  tick();

  // keyboad control
  var RotSpeed = 1;

  document.addEventListener("keydown", onDocumentKeyDown, false);
  function onDocumentKeyDown(event) {
    var keyCode = event.which;
    if (keyCode == 90) {
      // z
      phi[0] += RotSpeed;
    } else if (keyCode == 88) {
      // x
      phi[0] -= RotSpeed;
    } else if (keyCode == 65) {
      // a
      phi[1] += RotSpeed;
    } else if (keyCode == 83) {
      // s
      phi[1] -= RotSpeed;
    } else if (keyCode == 81) {
      // q
      phi[2] += RotSpeed;
    } else if (keyCode == 87) {
      // w
      phi[2] -= RotSpeed;
    } else if (keyCode == 32) {
      phi[0] =  0.0;
      phi[1] = 45.0;
      phi[2] = 90.0;
    }
    DK();
  }


  function DK() {
    //Insert code for DK here

  }

  function IK() {
    //Insert code for IK here

  }

  function calcJacobi() {
    //Insert code for jacobian calculation here

  }

  function tick() {

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


}