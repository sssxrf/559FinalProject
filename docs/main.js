// Basic Three.js starter scene for CS559 final project.
// This uses ES modules from a CDN so you don't need any bundler.

// You can bump this version later if needed.
import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js';

// ---------------------------
// 1. Basic setup
// ---------------------------

const canvas = document.getElementById('three-canvas');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

// Scene and camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  60,                                 // fov
  window.innerWidth / window.innerHeight, // aspect
  0.1,                                // near
  1000                                // far
);
camera.position.set(3, 3, 6);

// Controls (mouse / touch)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// ---------------------------
// 2. Lights
// ---------------------------

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// ---------------------------
// 3. Simple prototype geometry
// ---------------------------

// Ground plane
const planeGeom = new THREE.PlaneGeometry(20, 20);
const planeMat = new THREE.MeshStandardMaterial({
  color: 0x222222,
  roughness: 0.9,
  metalness: 0.0,
});
const plane = new THREE.Mesh(planeGeom, planeMat);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1;
plane.receiveShadow = true;
scene.add(plane);

// A basic cube that we’ll treat as the "player" object (to move later)
const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
const cubeMat = new THREE.MeshStandardMaterial({ color: 0x3fa9f5 });
const playerCube = new THREE.Mesh(cubeGeom, cubeMat);
playerCube.position.y = -0.5;
scene.add(playerCube);

// Extra primitive shapes
const sphereGeom = new THREE.SphereGeometry(0.5, 32, 16);
const sphereMat = new THREE.MeshStandardMaterial({ color: 0xf54291 });
const sphere = new THREE.Mesh(sphereGeom, sphereMat);
sphere.position.set(-2, -0.3, 1.5);
scene.add(sphere);

const coneGeom = new THREE.ConeGeometry(0.5, 1, 16);
const coneMat = new THREE.MeshStandardMaterial({ color: 0x7ed957 });
const cone = new THREE.Mesh(coneGeom, coneMat);
cone.position.set(2, -0.5, -1.5);
scene.add(cone);

// ---------------------------
// 4. Basic keyboard controls
// ---------------------------

const keysPressed = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  a: false,
  s: false,
  d: false,
};

window.addEventListener('keydown', (event) => {
  if (event.key in keysPressed) {
    keysPressed[event.key] = true;
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key in keysPressed) {
    keysPressed[event.key] = false;
  }
});

const moveSpeed = 2.0; // units per second

function updatePlayer(deltaTime) {
  let dx = 0;
  let dz = 0;

  if (keysPressed.ArrowUp || keysPressed.w) dz -= 1;
  if (keysPressed.ArrowDown || keysPressed.s) dz += 1;
  if (keysPressed.ArrowLeft || keysPressed.a) dx -= 1;
  if (keysPressed.ArrowRight || keysPressed.d) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
  }

  playerCube.position.x += dx * moveSpeed * deltaTime;
  playerCube.position.z += dz * moveSpeed * deltaTime;
}

// ---------------------------
// 5. Animation loop
// ---------------------------

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);

  const dt = (now - lastTime) / 1000; // seconds
  lastTime = now;

  sphere.position.y = -0.3 + Math.sin(now * 0.001) * 0.3;
  cone.rotation.y += dt * 1.0;

  updatePlayer(dt);

  controls.update();
  renderer.render(scene, camera);
}

animate(performance.now());

if (statusEl) {
  statusEl.textContent = 'Scene loaded. Use mouse to orbit and arrows/WASD to move the cube.';
}

// ---------------------------
// 6. Handle window resize
// ---------------------------

window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
