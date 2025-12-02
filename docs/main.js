import * as THREE from 'three';

// --------------------------------------------------------
// 1. SCENE SETUP
// --------------------------------------------------------
const canvas = document.getElementById('three-canvas');
const statusEl = document.getElementById('status');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1, 9);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// --------------------------------------------------------
// 2. BUILD THE MARIONETTE
// --------------------------------------------------------
const puppet = new THREE.Group();
puppet.position.y = -1;
scene.add(puppet);

// Torso
const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2, 16),
    new THREE.MeshStandardMaterial({ color: 0x3fa9f5 })
);
torso.position.y = 1;
puppet.add(torso);

// Head
const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.6),
    new THREE.MeshStandardMaterial({ color: 0x3fa9f5 })
);
head.position.y = 2.4;
puppet.add(head);

// Helper function for Limbs
function createLimb(isLeft, isLeg) {
    const limbGroup = new THREE.Group();
    const limbGeo = new THREE.BoxGeometry(0.3, 1.5, 0.3);
    // FIX 2: Changed leg color to bright Lime Green for better visibility
    const color = isLeg ? 0x32CD32 : 0xff5555; 
    const limbMat = new THREE.MeshStandardMaterial({ color: color }); 
    const limbMesh = new THREE.Mesh(limbGeo, limbMat);
    
    // Pivot Point Adjustment (Important for Line Attachment later)
    // The mesh center is moved down by 0.75, so the top of the geometry is at (0,0,0)
    limbMesh.position.y = -0.75; 
    limbGroup.add(limbMesh);
    
    if (isLeg) {
        limbGroup.position.set(isLeft ? -0.3 : 0.3, 0, 0);
    } else {
        limbGroup.position.set(isLeft ? -0.7 : 0.7, 1.8, 0);
    }
    
    // Return mesh too so we can get world position later
    return { group: limbGroup, mesh: limbMesh };
}

const leftArm = createLimb(true, false);
const rightArm = createLimb(false, false);
const leftLeg = createLimb(true, true);
const rightLeg = createLimb(false, true);

puppet.add(leftArm.group);
puppet.add(rightArm.group);
puppet.add(leftLeg.group);
puppet.add(rightLeg.group);

// --------------------------------------------------------
// 3. FIXED VIRTUAL HAND & STRINGS
// --------------------------------------------------------
const handGroup = new THREE.Group();
scene.add(handGroup);
const jointMeshes = [];
const jointMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
for (let i = 0; i < 21; i++) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), jointMat);
    handGroup.add(sphere);
    jointMeshes.push(sphere);
}

const stringMat = new THREE.LineBasicMaterial({ color: 0xffff00, opacity: 0.6, transparent: true });
function createString() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)]);
    const line = new THREE.Line(geo, stringMat);
    scene.add(line);
    return line;
}
const strings = { index: createString(), middle: createString(), ring: createString(), pinky: createString() };

// --------------------------------------------------------
// 4. LOGIC & CONSTRAINTS
// --------------------------------------------------------
let gameState = "WAITING"; 
let handLandmarks = null;
const videoElement = document.getElementsByClassName('input_video')[0];

// FIX 3: Helper function to map input values to exact realistic angles
// Takes a value, an expected input range, and maps it to a constrained output range.
function mapRange(value, inMin, inMax, outMin, outMax) {
    // 1. Normalize input to 0.0 - 1.0 range
    let normalized = (value - inMin) / (inMax - inMin);
    // 2. Clamp to prevent joints breaking beyond limits
    normalized = Math.max(0.0, Math.min(1.0, normalized));
    // 3. Map to output angles
    return outMin + (normalized * (outMax - outMin));
}

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handLandmarks = results.multiHandLandmarks[0];
        updateGameLogic();
    } else {
        handGroup.visible = false;
        Object.values(strings).forEach(s => s.visible = false);
    }
}

function updateGameLogic() {
    if (!handLandmarks) return;
    handGroup.visible = true;

    // --- A. STABILIZE HAND POSITION ---
    const wristRaw = handLandmarks[0];
    const fixedWristPos = new THREE.Vector3(0, 3.5, 0);
    const scale = 8;
    handLandmarks.forEach((lm, i) => {
        const finalX = fixedWristPos.x - ((lm.x - wristRaw.x) * scale);
        const finalY = fixedWristPos.y - ((lm.y - wristRaw.y) * scale);
        const finalZ = fixedWristPos.z - ((lm.z) * scale);
        jointMeshes[i].position.set(finalX, finalY, finalZ);
    });

    // --- B. GAME STATES ---
    if (gameState === "WAITING") {
        statusEl.textContent = "Show THUMB UP to Start";
        if (handLandmarks[4].y < handLandmarks[3].y && handLandmarks[8].y > handLandmarks[3].y) {
            gameState = "PLAYING";
            statusEl.textContent = "Control: Index/Middle=Arms, Ring/Pinky=Legs";
        }
    }

    if (gameState === "PLAYING") {
        Object.values(strings).forEach(s => s.visible = true);

        // --- C. REALISTIC PUPPET CONTROL ---
        // We calculate how "curled" a finger is by comparing tip Y vs wrist Y.
        // Standard input range: ~0.05 (finger extended) to ~0.25 (finger curled)
        const wristY = handLandmarks[0].y;
        const indexCurl = handLandmarks[8].y - wristY;
        const middleCurl = handLandmarks[12].y - wristY;
        const ringCurl = handLandmarks[16].y - wristY;
        const pinkyCurl = handLandmarks[20].y - wristY;

        // Define Realistic Angle Constraints (in radians)
        const ARM_DOWN = Math.PI / 12; // approx 15 degrees
        const ARM_UP = Math.PI / 1.8;  // approx 100 degrees
        const LEG_DOWN = 0;            // 0 degrees
        const LEG_OUT = Math.PI / 4;   // 45 degrees

        // Apply mapping to limbs
        leftArm.group.rotation.z = mapRange(indexCurl, 0.05, 0.25, ARM_DOWN, ARM_UP);
        // Right side needs negative rotation for symmetry
        rightArm.group.rotation.z = -mapRange(middleCurl, 0.05, 0.25, ARM_DOWN, ARM_UP);
        
        leftLeg.group.rotation.z = mapRange(ringCurl, 0.05, 0.25, LEG_DOWN, LEG_OUT);
        rightLeg.group.rotation.z = -mapRange(pinkyCurl, 0.05, 0.25, LEG_DOWN, LEG_OUT);

        // --- D. UPDATE STRINGS ---
        updateString(strings.index, jointMeshes[8], leftArm.mesh);
        updateString(strings.middle, jointMeshes[12], rightArm.mesh);
        updateString(strings.ring, jointMeshes[16], leftLeg.mesh);
        updateString(strings.pinky, jointMeshes[20], rightLeg.mesh);
    }
}

function updateString(lineObj, fingerMesh, limbMesh) {
    const start = fingerMesh.position;
    
    // FIX 1: Correctly calculate the bottom tip of the limb geometry.
    // The geometry is 1.5 high. The mesh is offset by -0.75 inside its group.
    // Therefore, the bottom tip in local space is exactly at Y = -0.75.
    const end = new THREE.Vector3(0, -0.75, 0); 
    end.applyMatrix4(limbMesh.matrixWorld); // Convert local tip to world space

    lineObj.geometry.setFromPoints([start, end]);
}

// MediaPipe & Camera Config
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
hands.onResults(onResults);
const cameraUtils = new Camera(videoElement, { onFrame: async () => { await hands.send({image: videoElement}); }, width: 1280, height: 720 });
cameraUtils.start();

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});