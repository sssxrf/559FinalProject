import * as THREE from 'three';

// --------------------------------------------------------
// 1. SCENE & UI SETUP
// --------------------------------------------------------
const canvas = document.getElementById('three-canvas');
const statusEl = document.getElementById('status');

// --- UI: Scoreboard ---
const scoreEl = document.createElement('div');
Object.assign(scoreEl.style, {
    position: 'fixed', top: '10px', right: '20px',
    color: '#fff', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace'
});
scoreEl.innerText = "SCORE: 0";
document.body.appendChild(scoreEl);

// --- UI: Mode Switcher ---
const modeContainer = document.createElement('div');
// CHANGED: Moved from top:10px to bottom:10px to avoid overlapping with Group Name
Object.assign(modeContainer.style, {
    position: 'fixed', bottom: '10px', left: '10px', zIndex: '20',
    background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '4px'
});
document.body.appendChild(modeContainer);

const modeLabel = document.createElement('span');
modeLabel.innerText = "MODE: ";
modeLabel.style.color = "white";
modeLabel.style.fontFamily = "sans-serif";
modeContainer.appendChild(modeLabel);

const modeSelect = document.createElement('select');
modeSelect.innerHTML = `
    <option value="PROTOTYPE">Prototype</option>
    <option value="FULL">Full Version (Cartoon)</option>
`;
modeSelect.addEventListener('change', (e) => setGameMode(e.target.value));
modeContainer.appendChild(modeSelect);

// --- UI: PIP Label ---
const pipLabel = document.createElement('div');
Object.assign(pipLabel.style, {
    position: 'fixed', bottom: '10px', right: '10px',
    color: '#ffff00', fontSize: '14px', fontFamily: 'monospace', zIndex: '10'
});
pipLabel.innerText = "[ SIDE VIEW ]";
document.body.appendChild(pipLabel);

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.Fog(0x111111, 10, 60);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1, 12);

const pipCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
pipCamera.position.set(8, 2, 4);
pipCamera.lookAt(0, -2, -5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// --------------------------------------------------------
// 2. GAME STATE & ASSETS
// --------------------------------------------------------
let gameMode = "PROTOTYPE"; 
let gameState = "CALIB_OPEN"; 
let handLandmarks = null;
let score = 0;

// Asset Factory
const Assets = {
    prototype: {
        limbGeo: new THREE.BoxGeometry(0.3, 1.5, 0.3),
        armMat: new THREE.MeshStandardMaterial({ color: 0xff5555 }),
        legMat: new THREE.MeshStandardMaterial({ color: 0x32CD32 }),
        bodyMat: new THREE.MeshStandardMaterial({ color: 0x3fa9f5 }),
        wallMat: new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.4 })
    },
    full: {
        robotSkin: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
        robotJoint: new THREE.MeshStandardMaterial({ color: 0x333333 }), 
        robotEye: new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 0.8 }), 
        wallMat: new THREE.MeshStandardMaterial({ 
            color: 0xff00ff, 
            roughness: 0.2,
            emissive: 0x440044, 
            emissiveIntensity: 0.5
        })
    }
};

function getAsset(type, isLeg) {
    if (gameMode === "PROTOTYPE") {
        const a = Assets.prototype;
        if (type === 'limbGeo') return a.limbGeo;
        if (type === 'limbMat') return isLeg ? a.legMat : a.armMat;
        if (type === 'bodyMat') return a.bodyMat;
        if (type === 'wallMat') return a.wallMat;
    } else {
        const a = Assets.full;
        if (type === 'wallMat') return a.wallMat;
        return null; 
    }
}

// --------------------------------------------------------
// 3. BUILD THE MARIONETTE
// --------------------------------------------------------
const puppet = new THREE.Group();
puppet.position.y = -2;
scene.add(puppet);

const torsoGroup = new THREE.Group(); puppet.add(torsoGroup);
const headGroup = new THREE.Group(); puppet.add(headGroup);
const leftArmGroup = new THREE.Group(); puppet.add(leftArmGroup);
const rightArmGroup = new THREE.Group(); puppet.add(rightArmGroup);
const leftLegGroup = new THREE.Group(); puppet.add(leftLegGroup);
const rightLegGroup = new THREE.Group(); puppet.add(rightLegGroup);

leftArmGroup.position.set(-0.7, 1.8, 0);
rightArmGroup.position.set(0.7, 1.8, 0);
leftLegGroup.position.set(-0.3, 0, 0);
rightLegGroup.position.set(0.3, 0, 0);

let collisionMeshes = []; 

function updatePuppetSkin() {
    [torsoGroup, headGroup, leftArmGroup, rightArmGroup, leftLegGroup, rightLegGroup].forEach(g => {
        while(g.children.length > 0) g.remove(g.children[0]);
    });
    collisionMeshes = [];

    if (gameMode === "PROTOTYPE") {
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 16), getAsset('bodyMat'));
        torso.position.y = 1; torsoGroup.add(torso);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.6), getAsset('bodyMat'));
        head.position.y = 2.4; headGroup.add(head);

        const addLimb = (group, isLeg) => {
            const mesh = new THREE.Mesh(getAsset('limbGeo'), getAsset('limbMat', isLeg));
            mesh.position.y = -0.75; group.add(mesh); collisionMeshes.push(mesh);
        };
        addLimb(leftArmGroup, false); addLimb(rightArmGroup, false);
        addLimb(leftLegGroup, true); addLimb(rightLegGroup, true);
    } 
    else {
        const matSkin = Assets.full.robotSkin;
        const matJoint = Assets.full.robotJoint;
        const matEye = Assets.full.robotEye;

        const headGeo = new THREE.CapsuleGeometry(0.5, 0.4, 4, 8);
        const headMesh = new THREE.Mesh(headGeo, matSkin);
        headMesh.position.y = 2.4;
        
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.12), matEye);
        leftEye.position.set(-0.2, 0.1, 0.45);
        const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.12), matEye);
        rightEye.position.set(0.2, 0.1, 0.45);
        headMesh.add(leftEye); headMesh.add(rightEye);
        
        const antStick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5), matJoint);
        antStick.position.y = 0.6;
        const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.08), matEye);
        antBall.position.y = 0.25;
        antStick.add(antBall);
        headMesh.add(antStick);
        headGroup.add(headMesh);

        const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 1.8, 12);
        const bodyMesh = new THREE.Mesh(bodyGeo, matSkin);
        bodyMesh.position.y = 1.0;
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.2), matJoint);
        plate.position.set(0, 0.2, 0.45);
        bodyMesh.add(plate);
        torsoGroup.add(bodyMesh);

        const addRobotLimb = (group) => {
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 1.5, 8), matSkin);
            upper.position.y = -0.75;
            const joint = new THREE.Mesh(new THREE.SphereGeometry(0.2), matJoint);
            joint.position.y = 0.75; upper.add(joint);
            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.2), matJoint);
            hand.position.y = -0.75; upper.add(hand);
            group.add(upper);

            const hitbox = new THREE.Mesh(Assets.prototype.limbGeo, new THREE.MeshBasicMaterial({ visible: false }));
            hitbox.position.y = -0.75;
            group.add(hitbox);
            collisionMeshes.push(hitbox);
        };

        addRobotLimb(leftArmGroup); addRobotLimb(rightArmGroup);
        addRobotLimb(leftLegGroup); addRobotLimb(rightLegGroup);
    }
}

updatePuppetSkin();

function setGameMode(mode) {
    gameMode = mode;
    updatePuppetSkin();
}

// --------------------------------------------------------
// 4. VIRTUAL HAND & STRINGS
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
// 5. WALL MANAGER (DEBRIS & EXPLOSIONS)
// --------------------------------------------------------
const walls = []; 
const debris = []; // Array to store broken wall pieces
const wallSpeed = 10.0;
let lastWallTime = 0;
const wallInterval = 4000;
let calibData = { open: [-0.5,-0.5,-0.5,-0.5], closed: [-0.1,-0.1,-0.1,-0.1] };

function safeMapRange(value, inMin, inMax, outMin, outMax) {
    let range = inMax - inMin;
    if (Math.abs(range) < 0.001) range = 0.1; 
    let normalized = (value - inMin) / range;
    normalized = Math.max(0.0, Math.min(1.0, normalized));
    return outMin + (normalized * (outMax - outMin));
}

function isHole(x, y, type) {
    if (Math.abs(x) < 0.9 && y > -1.5 && y < 3.2) return true;
    if (type === "ARMS_UP") {
        if (x < -0.7 && x > -3.0 && y > 1 && y < 3.5) return true;
        if (x > 0.7 && x < 3.0 && y > 1 && y < 3.5) return true;
        if (y <0 && y > -2 && x > -0.7 && x < 0.7) return true;
    }
    if (type === "SPLITS") {
        if (y < 2) {
            if (x < -0.2 && x > -2.5) return true;
            if (x > 0.2 && x < 2.5) return true;
        }
    }
    return false;
}

function spawnWall() {
    const wallGroup = new THREE.Group();
    const blockSize = 0.25; 
    const wallWidth = 10; const wallHeight = 7; 
    const cols = Math.floor(wallWidth / blockSize);
    const rows = Math.floor(wallHeight / blockSize);
    const type = Math.random() > 0.5 ? "ARMS_UP" : "SPLITS";

    const boxGeo = new THREE.BoxGeometry(blockSize, blockSize, 1);
    const boxMat = getAsset('wallMat').clone(); 

    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < cols; c++) {
            const centerX = (c * blockSize) - (wallWidth / 2) + (blockSize / 2);
            const centerY = (r * blockSize) - (wallHeight / 2) + (blockSize / 2);

            if (!isHole(centerX, centerY, type)) {
                const brick = new THREE.Mesh(boxGeo, boxMat);
                brick.position.set(centerX, centerY, 0);
                wallGroup.add(brick);
            }
        }
    }
    wallGroup.position.set(0, -2, -50); 
    wallGroup.userData = { active: true };
    scene.add(wallGroup);
    walls.push(wallGroup);
}

// NEW: Physics-based Explosion System
function createExplosion(wallGroup, hitBricks) {
    const explosionRadius = 1.0; 
    const bricksToBreak = new Set();

    // Identify all bricks to break around ALL hit points
    hitBricks.forEach(centerBrick => {
        const centerPos = centerBrick.position.clone();
        for (let i = 0; i < wallGroup.children.length; i++) {
            const b = wallGroup.children[i];
            if (b.position.distanceTo(centerPos) < explosionRadius) {
                bricksToBreak.add(b);
            }
        }
    });

    // Detach and animate
    bricksToBreak.forEach(b => {
        // Get world transform
        const worldPos = new THREE.Vector3();
        b.getWorldPosition(worldPos);
        const worldQuat = new THREE.Quaternion();
        b.getWorldQuaternion(worldQuat);

        // Remove from wall hierarchy
        wallGroup.remove(b);

        // Add to scene as standalone debris
        b.position.copy(worldPos);
        b.quaternion.copy(worldQuat);
        // Make it look "hot" or damaged
        b.material = b.material.clone();
        b.material.color.setHex(0xffaa00);
        b.material.emissive.setHex(0xff0000);
        
        scene.add(b);

        // Physics properties
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 5, // Spread X
            (Math.random() - 0.5) * 5, // Spread Y
            (Math.random() * 5) + 8    // Forward Z (keep momentum)
        );

        debris.push({
            mesh: b,
            velocity: velocity,
            rotAxis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
            rotSpeed: Math.random() * 10
        });
    });
}

function updateDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        // Apply Gravity
        d.velocity.y -= 15.0 * dt;
        
        // Move
        d.mesh.position.addScaledVector(d.velocity, dt);
        // Rotate
        d.mesh.rotateOnAxis(d.rotAxis, d.rotSpeed * dt);

        // Despawn
        if (d.mesh.position.y < -10) {
            scene.remove(d.mesh);
            debris.splice(i, 1);
        }
    }
}

function updateWalls(dt) {
    if(gameState !== "PLAYING") return;
    for (let i = walls.length - 1; i >= 0; i--) {
        const wall = walls[i];
        wall.position.z += wallSpeed * dt;

        if (wall.userData.active && wall.position.z > -1 && wall.position.z < 1) {
            // Check collision and get ALL hit bricks
            const hitBricks = checkCollision(wall);
            if (hitBricks.length > 0) {
                wall.userData.active = false;
                handleCrash(wall, hitBricks);
                score -= 1; updateScore();
            }
        }
        if (wall.userData.active && wall.position.z > 2) {
            wall.userData.active = false;
            score += 5; updateScore();
            wall.children.forEach(c => c.material.color.setHex(0x00ff00));
        }
        if (wall.position.z > 15) {
            scene.remove(wall);
            walls.splice(i, 1);
        }
    }
}

function checkCollision(wallGroup) {
    if (collisionMeshes.length === 0) return []; // Returns empty array
    const limbBoxes = collisionMeshes.map(mesh => new THREE.Box3().setFromObject(mesh));
    const wallZ = wallGroup.position.z;
    if (Math.abs(wallZ) > 1.0) return [];

    const hits = [];
    for(let brick of wallGroup.children) {
        const brickWorldZ = wallZ + brick.position.z; 
        if (brickWorldZ < -1 || brickWorldZ > 1) continue;
        const brickBox = new THREE.Box3().setFromObject(brick);
        for(let limbBox of limbBoxes) {
            if(brickBox.intersectsBox(limbBox)) {
                hits.push(brick);
                break; // Don't add the same brick twice
            }
        }
    }
    return hits;
}

function handleCrash(wallGroup, hitBricks) {
    if (gameMode === "FULL" && hitBricks.length > 0) {
        // Trigger Explosion for all hit bricks
        createExplosion(wallGroup, hitBricks);
        statusEl.textContent = "SMASH! -1 Point";
    } else {
        // Prototype behavior (Color change)
        wallGroup.children.forEach(brick => brick.material.color.setHex(0xff0000));
        statusEl.textContent = "CRASH! -1 Point";
    }
    setTimeout(() => { if(gameState==="PLAYING") statusEl.textContent = "GAME ON! Dodge the walls!"; }, 1000);
}

function updateScore() {
    scoreEl.innerText = `SCORE: ${score}`;
    scoreEl.style.color = score >= 0 ? '#fff' : '#ff5555';
}

// --------------------------------------------------------
// 6. INPUT HANDLING & LOOP
// --------------------------------------------------------
const videoElement = document.getElementsByClassName('input_video')[0];

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'c' && handLandmarks) {
        const fingerIndices = [8, 12, 16, 20];
        if (gameState === "CALIB_OPEN") {
            fingerIndices.forEach((tipIdx, i) => calibData.open[i] = handLandmarks[tipIdx].y - handLandmarks[0].y);
            gameState = "CALIB_CLOSED"; 
        } else if (gameState === "CALIB_CLOSED") {
            fingerIndices.forEach((tipIdx, i) => calibData.closed[i] = handLandmarks[tipIdx].y - handLandmarks[0].y);
            gameState = "WAITING_START"; 
        }
    }
});

function onResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handLandmarks = results.multiHandLandmarks[0];
        try { updateGameLogic(); } catch (e) { console.error(e); }
    } else {
        handGroup.visible = false;
        Object.values(strings).forEach(s => s.visible = false);
        if (gameState.includes("CALIB")) statusEl.textContent = "Hand lost! Please show hand.";
    }
}

function updateGameLogic() {
    if (!handLandmarks) return;
    handGroup.visible = true;

    const wristRaw = handLandmarks[0];
    const fixedWristPos = new THREE.Vector3(0, 3.5, 0);
    const scale = 8;
    handLandmarks.forEach((lm, i) => {
        jointMeshes[i].position.set(fixedWristPos.x - ((lm.x - wristRaw.x) * scale), fixedWristPos.y - ((lm.y - wristRaw.y) * scale), fixedWristPos.z - ((lm.z) * scale));
    });

    if (gameState === "CALIB_OPEN") statusEl.innerHTML = `STEP 1: Stretch fingers <b>OPEN</b>.<br>Press <b>'c'</b>.`;
    else if (gameState === "CALIB_CLOSED") statusEl.innerHTML = `STEP 2: Clench <b>FIST</b>.<br>Press <b>'c'</b>.`;
    else if (gameState === "WAITING_START") {
        statusEl.textContent = "Calibration Done! Show THUMB UP to Start.";
        if (handLandmarks[4].y < handLandmarks[3].y && handLandmarks[8].y > handLandmarks[3].y) {
            gameState = "PLAYING";
            statusEl.textContent = "GAME STARTED! Dodge the Walls!";
            score = 0; updateScore();
        }
    }
    else if (gameState === "PLAYING") {
        Object.values(strings).forEach(s => s.visible = true);
        const fingerIndices = [8, 12, 16, 20];
        const currentVals = fingerIndices.map(idx => handLandmarks[idx].y - handLandmarks[0].y);

        leftArmGroup.rotation.z = -safeMapRange(currentVals[0], calibData.open[0], calibData.closed[0], 0.2, 2.0);
        rightArmGroup.rotation.z = safeMapRange(currentVals[1], calibData.open[1], calibData.closed[1], 0.2, 2.0);
        leftLegGroup.rotation.z = -safeMapRange(currentVals[2], calibData.open[2], calibData.closed[2], 0.0, 0.8);
        rightLegGroup.rotation.z = safeMapRange(currentVals[3], calibData.open[3], calibData.closed[3], 0.0, 0.8);

        // Update strings to first child (the mesh)
        updateString(strings.index, jointMeshes[8], leftArmGroup.children[0]);
        updateString(strings.middle, jointMeshes[12], rightArmGroup.children[0]);
        updateString(strings.ring, jointMeshes[16], leftLegGroup.children[0]);
        updateString(strings.pinky, jointMeshes[20], rightLegGroup.children[0]);
    }
}

function updateString(lineObj, fingerMesh, limbMesh) {
    if (!limbMesh) return;
    const start = fingerMesh.position;
    const end = new THREE.Vector3(0, -0.75, 0); 
    end.applyMatrix4(limbMesh.matrixWorld);
    lineObj.geometry.setFromPoints([start, end]);
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5 });
hands.onResults(onResults);
const cameraUtils = new Camera(videoElement, { onFrame: async () => { await hands.send({image: videoElement}); }, width: 1280, height: 720 });
cameraUtils.start();

let lastTime = performance.now();
function animate(time) {
    requestAnimationFrame(animate);
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    if (gameState === "PLAYING") {
        if (time > lastWallTime + wallInterval) {
            spawnWall();
            lastWallTime = time;
        }
    }
    
    // Update logic
    updateWalls(dt);
    updateDebris(dt); // Physics update

    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setViewport(0, 0, width, height);
    renderer.setScissor(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.clear(); 
    renderer.render(scene, camera);

    const mapWidth = width * 0.3;
    const mapHeight = height * 0.3;
    renderer.setViewport(width - mapWidth, 0, mapWidth, mapHeight);
    renderer.setScissor(width - mapWidth, 0, mapWidth, mapHeight);
    renderer.setScissorTest(true);
    renderer.clearDepth(); 
    renderer.render(scene, pipCamera);
}
animate(performance.now());

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pipCamera.aspect = w / h;
    pipCamera.updateProjectionMatrix();
    renderer.setSize(w, h);
});