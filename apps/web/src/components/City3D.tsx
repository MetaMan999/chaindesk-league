import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  CITY_CAREER_KEY,
  careerLevel,
  createCityCareer,
  programsForLocation,
  runCityProgram,
  type CityCareerState,
  type CityLocation,
  type ProgramResult,
} from "../lib/cityPrograms";

type CameraMode = "THIRD PERSON" | "FIRST PERSON";

type City3DProps = {
  bankerName: string;
  marketState: string;
  onProgramComplete: (result: ProgramResult) => void;
};

type Zone = { location: CityLocation; label: string; x: number; z: number; color: number };
type Footprint = { x: number; z: number; halfX: number; halfZ: number };

const zones: Zone[] = [
  { location: "EXCHANGE", label: "THE EXCHANGE", x: -18, z: -8.5, color: 0xe0b54e },
  { location: "BANK", label: "FIRST BULL BANK", x: 18, z: -8.5, color: 0x63c680 },
  { location: "BROKERAGE", label: "LEDGER & CO.", x: 18, z: 8.5, color: 0x5b8fe8 },
  { location: "COFFEE", label: "BULL & BEAN", x: -18, z: 8.5, color: 0xc76955 },
  { location: "SUBWAY", label: "BROAD STREET STATION", x: 0, z: 23, color: 0x7295d2 },
  { location: "OTC", label: "OTC ALLEY", x: 28, z: 0, color: 0xa98967 },
];

const footprints: Footprint[] = [
  { x: -18, z: -16, halfX: 8, halfZ: 5.5 },
  { x: 18, z: -16, halfX: 8, halfZ: 5.5 },
  { x: 18, z: 16, halfX: 8, halfZ: 5.5 },
  { x: -18, z: 16, halfX: 8, halfZ: 5.5 },
  { x: -29, z: -18, halfX: 3.5, halfZ: 8 },
  { x: 29, z: -18, halfX: 3.5, halfZ: 8 },
  { x: -29, z: 18, halfX: 3.5, halfZ: 8 },
  { x: 29, z: 18, halfX: 3.5, halfZ: 8 },
  { x: -10.8, z: 9.5, halfX: 2.7, halfZ: 1.7 },
];

function loadCareer(): CityCareerState {
  try {
    const parsed = JSON.parse(localStorage.getItem(CITY_CAREER_KEY) ?? "null") as CityCareerState | null;
    if (parsed && typeof parsed.energy === "number" && typeof parsed.shiftXp === "number") return parsed;
  } catch {
    // A damaged local save falls back to a clean career state.
  }
  return createCityCareer();
}

function labelSprite(text: string, color: string, scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(17,31,23,.96)");
  gradient.addColorStop(1, "rgba(3,9,6,.96)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = color;
  context.lineWidth = 5;
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.font = "800 30px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(7.5 * scale, 1.4 * scale, 1);
  return sprite;
}

function addBox(parent: THREE.Object3D, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBuilding(scene: THREE.Scene, name: string, x: number, z: number, width: number, depth: number, height: number, color: number, signColor: string) {
  const group = new THREE.Group();
  const facade = new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.06 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xb6a989, roughness: 0.88 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x27352d, roughness: 0.9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb88a35, roughness: 0.28, metalness: 0.72 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x7fa69a, emissive: 0x163f31, emissiveIntensity: 1.35, roughness: 0.2, metalness: 0.32 });
  addBox(group, [width, height, depth], [0, height / 2, 0], facade);
  addBox(group, [width + 0.55, 0.7, depth + 0.55], [0, 0.35, 0], darkStone);
  addBox(group, [width + 0.7, 0.48, depth + 0.7], [0, height - 0.25, 0], stone);
  addBox(group, [width + 0.2, 0.25, depth + 0.2], [0, height - 0.75, 0], brass);

  for (let floor = 2.2; floor < height - 1.3; floor += 2.05) {
    addBox(group, [width + 0.08, 0.12, depth + 0.08], [0, floor - 0.72, 0], stone);
    for (let column = -width / 2 + 1.25; column < width / 2 - 0.35; column += 2.05) {
      addBox(group, [1.05, 0.92, 0.13], [column, floor, depth / 2 + 0.075], glass);
      addBox(group, [1.05, 0.92, 0.13], [column, floor, -depth / 2 - 0.075], glass);
    }
    for (let column = -depth / 2 + 1.25; column < depth / 2 - 0.35; column += 2.05) {
      addBox(group, [0.13, 0.92, 1.05], [width / 2 + 0.075, floor, column], glass);
      addBox(group, [0.13, 0.92, 1.05], [-width / 2 - 0.075, floor, column], glass);
    }
  }

  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x10231b, emissive: 0x082119, emissiveIntensity: 0.8, metalness: 0.55, roughness: 0.3 });
  addBox(group, [2.3, 3.2, 0.3], [0, 1.6, depth / 2 + 0.18], doorMaterial);
  addBox(group, [3.35, 0.22, 1.35], [0, 3.35, depth / 2 + 0.68], brass);
  addBox(group, [3.7, 0.22, 1.8], [0, 0.18, depth / 2 + 0.85], stone);
  for (const columnX of [-1.55, 1.55]) addBox(group, [0.28, 3.25, 0.28], [columnX, 1.65, depth / 2 + 0.33], stone);

  if (name === "THE EXCHANGE") {
    addBox(group, [10.5, 1.15, 0.55], [0, 8.1, depth / 2 + 0.35], stone);
    for (const columnX of [-5.1, -3.05, -1.02, 1.02, 3.05, 5.1]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 5.2, 8), stone);
      column.position.set(columnX, 4.9, depth / 2 + 0.45);
      column.castShadow = true;
      group.add(column);
    }
  }

  const roofUnit = addBox(group, [Math.min(4.5, width * 0.38), 1.3, Math.min(3.8, depth * 0.4)], [0, height + 0.65, 0], darkStone);
  roofUnit.castShadow = true;
  const sign = labelSprite(name, signColor, width > 12 ? 1.1 : 0.85);
  sign.position.set(0, Math.min(height - 1.35, 7.4), depth / 2 + 0.45);
  group.add(sign);
  group.position.set(x, 0, z);
  if (z > 0) group.rotation.y = Math.PI;
  scene.add(group);
}

function createPerson(suitColor: number, skinColor = 0xc98e68, accentColor = 0xd9b44a) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.65 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111b18, roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe7dfc9, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.62 });
  const body = addBox(group, [0.82, 1.18, 0.47], [0, 1.3, 0], suit);
  addBox(group, [0.3, 0.75, 0.05], [0, 1.46, 0.265], white);
  addBox(group, [0.09, 0.63, 0.07], [0, 1.38, 0.31], accent);
  const head = addBox(group, [0.62, 0.66, 0.58], [0, 2.25, 0], skin);
  addBox(group, [0.66, 0.2, 0.61], [0, 2.58, -0.01], dark);
  addBox(group, [0.1, 0.08, 0.04], [-0.16, 2.28, 0.305], dark);
  addBox(group, [0.1, 0.08, 0.04], [0.16, 2.28, 0.305], dark);
  const leftLeg = addBox(group, [0.28, 0.82, 0.32], [-0.21, 0.47, 0], dark);
  const rightLeg = addBox(group, [0.28, 0.82, 0.32], [0.21, 0.47, 0], dark);
  addBox(group, [0.33, 0.16, 0.48], [-0.21, 0.08, 0.08], dark);
  addBox(group, [0.33, 0.16, 0.48], [0.21, 0.08, 0.08], dark);
  const leftArm = addBox(group, [0.25, 0.95, 0.3], [-0.55, 1.35, 0], suit);
  const rightArm = addBox(group, [0.25, 0.95, 0.3], [0.55, 1.35, 0], suit);
  group.userData.rig = { body, head, leftLeg, rightLeg, leftArm, rightArm };
  group.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
  return group;
}

function createCar(color: number, taxi = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x477271, emissive: 0x102b2a, emissiveIntensity: 0.55, metalness: 0.72, roughness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c100f, roughness: 0.95 });
  const headlight = new THREE.MeshStandardMaterial({ color: 0xffedb2, emissive: 0xffbd55, emissiveIntensity: 2.6 });
  addBox(group, [1.75, 0.56, 3.4], [0, 0.48, 0], paint);
  addBox(group, [1.42, 0.63, 1.72], [0, 0.99, -0.12], glass);
  addBox(group, [1.5, 0.18, 0.8], [0, 0.85, 1.18], paint);
  for (const x of [-0.86, 0.86]) for (const z of [-1.08, 1.08]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 10), rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.3, z);
    group.add(wheel);
  }
  addBox(group, [0.42, 0.2, 0.08], [-0.47, 0.56, 1.73], headlight);
  addBox(group, [0.42, 0.2, 0.08], [0.47, 0.56, 1.73], headlight);
  if (taxi) addBox(group, [0.7, 0.25, 0.38], [0, 1.43, 0], headlight);
  group.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
  return group;
}

function addStreetLamp(scene: THREE.Scene, x: number, z: number) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x18392d, metalness: 0.7, roughness: 0.3 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffe5a0, emissive: 0xffb743, emissiveIntensity: 2.4 });
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 4.6, 10), metal);
  pole.position.y = 2.3;
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glow);
  crown.position.y = 4.45;
  group.add(pole, crown);
  group.position.set(x, 0, z);
  scene.add(group);
}

function addTree(scene: THREE.Scene, x: number, z: number) {
  const trunk = new THREE.MeshStandardMaterial({ color: 0x4b3521, roughness: 1 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x315c3b, roughness: 0.92 });
  const group = new THREE.Group();
  addBox(group, [0.42, 2.4, 0.42], [0, 1.2, 0], trunk);
  for (const [dx, dy, dz, scale] of [[0, 3, 0, 1.25], [-0.65, 2.8, 0.1, 0.85], [0.62, 2.75, -0.12, 0.9]] as const) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 1), leaf);
    crown.position.set(dx, dy, dz);
    crown.castShadow = true;
    group.add(crown);
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

function addBullStatue(scene: THREE.Scene) {
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8f6322, metalness: 0.88, roughness: 0.25 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x62675c, roughness: 0.9 });
  const group = new THREE.Group();
  addBox(group, [4.8, 0.5, 2.8], [0, 0.25, 0], stone);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 9), bronze);
  body.scale.set(1.55, 0.9, 0.82);
  body.position.y = 1.45;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), bronze);
  head.scale.set(0.9, 0.9, 1.1);
  head.position.set(0, 1.3, 1.45);
  group.add(head);
  for (const x of [-0.75, 0.75]) for (const z of [-0.55, 0.62]) addBox(group, [0.28, 1.1, 0.28], [x, 0.86, z], bronze);
  for (const x of [-0.58, 0.58]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 8), bronze);
    horn.rotation.z = x < 0 ? -0.9 : 0.9;
    horn.position.set(x, 1.65, 1.72);
    group.add(horn);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.08, 8, 16, Math.PI * 1.2), bronze);
  tail.position.set(0, 1.6, -1.45);
  tail.rotation.x = Math.PI / 2;
  group.add(tail);
  group.position.set(-10.8, 0, 9.5);
  group.rotation.y = -0.42;
  group.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
  scene.add(group);
}

export function City3D({ bankerName, marketState, onProgramComplete }: City3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const interactRef = useRef<() => void>(() => undefined);
  const callbackRef = useRef(onProgramComplete);
  const [cameraMode, setCameraMode] = useState<CameraMode>("THIRD PERSON");
  const cameraModeRef = useRef<CameraMode>(cameraMode);
  const [location, setLocation] = useState<CityLocation>("STREET");
  const locationRef = useRef<CityLocation>(location);
  const [locationLabel, setLocationLabel] = useState("WALL STREET");
  const [career, setCareer] = useState<CityCareerState>(() => loadCareer());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [notice, setNotice] = useState("Walk the city. Find a glowing work marker and press F.");
  const [webglError, setWebglError] = useState(false);
  const actions = useMemo(() => programsForLocation(location), [location]);

  useEffect(() => { callbackRef.current = onProgramComplete; }, [onProgramComplete]);
  useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);
  useEffect(() => { locationRef.current = location; }, [location]);

  function runProgram(programId: string) {
    const result = runCityProgram(programId, career, Date.now());
    setNotice(result.message);
    if (!result.allowed) return;
    setCareer(result.state);
    localStorage.setItem(CITY_CAREER_KEY, JSON.stringify(result.state));
    callbackRef.current(result);
    setActionsOpen(false);
  }

  function setTouchKey(key: string, active: boolean) {
    keysRef.current[key] = active;
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setWebglError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const darkSession = marketState.includes("AFTER") || marketState.includes("CLOSED");
    scene.background = new THREE.Color(darkSession ? 0x344d50 : 0x8eb5b3);
    scene.fog = new THREE.FogExp2(darkSession ? 0x304849 : 0x718f84, 0.0095);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    const ambient = new THREE.HemisphereLight(darkSession ? 0x9fc5c3 : 0xe5f1dd, 0x1a2922, darkSession ? 1.6 : 2.25);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(darkSession ? 0xffb276 : 0xffe0a1, darkSession ? 3.15 : 4.15);
    sun.position.set(-28, 38, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    scene.add(sun);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(darkSession ? 0x183147 : 0x6f9fae) },
          bottomColor: { value: new THREE.Color(darkSession ? 0xc27955 : 0xf3c983) },
        },
        vertexShader: "varying vec3 vWorld; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
        fragmentShader: "uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorld; void main(){ float h=normalize(vWorld).y; float f=pow(max(0.0,h),0.55); gl_FragColor=vec4(mix(bottomColor,topColor,f),1.0); }",
      }),
    );
    scene.add(sky);
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(3.2, 18, 12), new THREE.MeshBasicMaterial({ color: darkSession ? 0xff9d61 : 0xffe6a6 }));
    sunDisc.position.set(-70, 38, -105);
    scene.add(sunDisc);

    for (const [x, z, color] of [[-18, -9, 0xe6b64f], [18, -9, 0x6ee091], [-18, 9, 0xef866e], [18, 9, 0x79a8ff]] as const) {
      const glow = new THREE.PointLight(color, darkSession ? 15 : 9, 13, 2);
      glow.position.set(x, 3, z);
      scene.add(glow);
    }

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x677565, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: darkSession ? 0x171e1e : 0x242a28, roughness: 0.88, metalness: 0.08 });
    const verticalRoad = new THREE.Mesh(new THREE.BoxGeometry(10, 0.14, 80), roadMaterial);
    const horizontalRoad = new THREE.Mesh(new THREE.BoxGeometry(80, 0.14, 10), roadMaterial);
    verticalRoad.position.y = horizontalRoad.position.y = 0.07;
    verticalRoad.receiveShadow = horizontalRoad.receiveShadow = true;
    scene.add(verticalRoad, horizontalRoad);
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xd4b85d, roughness: 0.75, emissive: darkSession ? 0x221600 : 0x000000, emissiveIntensity: 0.4 });
    for (let position = -36; position <= 36; position += 6) {
      const verticalStripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 3), stripeMaterial);
      verticalStripe.position.set(0, 0.16, position);
      const horizontalStripe = new THREE.Mesh(new THREE.BoxGeometry(3, 0.03, 0.15), stripeMaterial);
      horizontalStripe.position.set(position, 0.16, 0);
      scene.add(verticalStripe, horizontalStripe);
    }
    const crosswalkMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d4bb, roughness: 0.82 });
    for (let offset = -3.9; offset <= 3.9; offset += 1.3) {
      addBox(scene, [0.72, 0.035, 3.1], [offset, 0.17, -6.2], crosswalkMaterial);
      addBox(scene, [0.72, 0.035, 3.1], [offset, 0.17, 6.2], crosswalkMaterial);
      addBox(scene, [3.1, 0.035, 0.72], [-6.2, 0.17, offset], crosswalkMaterial);
      addBox(scene, [3.1, 0.035, 0.72], [6.2, 0.17, offset], crosswalkMaterial);
    }

    addBuilding(scene, "THE EXCHANGE", -18, -16, 16, 11, 15, 0x3d5547, "#e6bd55");
    addBuilding(scene, "FIRST BULL BANK", 18, -16, 16, 11, 18, 0x455b4a, "#73d08c");
    addBuilding(scene, "LEDGER AND CO.", 18, 16, 16, 11, 13, 0x314c5e, "#83b5ff");
    addBuilding(scene, "BULL AND BEAN", -18, 16, 16, 11, 9, 0x68483b, "#ef947c");
    addBuilding(scene, "NORTHSTAR", -29, -18, 7, 16, 24, 0x313e37, "#d9b65e");
    addBuilding(scene, "OBSIDIAN", 29, -18, 7, 16, 28, 0x292f2b, "#d1c6a4");
    addBuilding(scene, "HUDSON RISK", -29, 18, 7, 16, 19, 0x455044, "#73c58b");
    addBuilding(scene, "APEX AND CO.", 29, 18, 7, 16, 22, 0x503b38, "#e18070");

    const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: 0xaaa58c, roughness: 0.92 });
    const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x777968, roughness: 1 });
    for (const footprint of footprints.slice(0, 4)) {
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(footprint.halfX * 2 + 1.4, 0.18, footprint.halfZ * 2 + 1.4), sidewalkMaterial);
      sidewalk.position.set(footprint.x, 0.09, footprint.z);
      sidewalk.receiveShadow = true;
      scene.add(sidewalk);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(footprint.halfX * 2 + 1.7, 0.22, footprint.halfZ * 2 + 1.7), curbMaterial);
      curb.position.set(footprint.x, 0.08, footprint.z);
      curb.receiveShadow = true;
      scene.add(curb);
      sidewalk.position.y = 0.2;
    }

    for (const [x, z] of [[-7.1, -7.1], [7.1, -7.1], [-7.1, 7.1], [7.1, 7.1], [-24.5, -7.1], [24.5, -7.1], [-24.5, 7.1], [24.5, 7.1]] as const) addStreetLamp(scene, x, z);
    for (const [x, z] of [[-11.5, -8], [11.5, -8], [-23, 8], [23, 8], [-8, 22], [8, 22]] as const) addTree(scene, x, z);
    addBullStatue(scene);

    const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x5f3b21, roughness: 0.8 });
    const benchMetal = new THREE.MeshStandardMaterial({ color: 0x1d3028, metalness: 0.65, roughness: 0.35 });
    for (const [x, z, rotation] of [[-10, -8, 0], [10, -8, 0], [-24, 7.6, Math.PI / 2]] as const) {
      const bench = new THREE.Group();
      addBox(bench, [2.3, 0.18, 0.48], [0, 0.65, 0], benchMaterial);
      addBox(bench, [2.3, 0.18, 0.2], [0, 1.05, -0.26], benchMaterial);
      addBox(bench, [0.14, 0.62, 0.14], [-0.85, 0.32, 0], benchMetal);
      addBox(bench, [0.14, 0.62, 0.14], [0.85, 0.32, 0], benchMetal);
      bench.position.set(x, 0, z);
      bench.rotation.y = rotation;
      scene.add(bench);
    }

    const zoneRings: THREE.Mesh[] = [];
    for (const zone of zones) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 10, 32), new THREE.MeshStandardMaterial({ color: zone.color, emissive: zone.color, emissiveIntensity: 2.2, metalness: 0.45, roughness: 0.24 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(zone.x, 0.28, zone.z);
      scene.add(ring);
      zoneRings.push(ring);
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.22, 3.6, 18, 1, true), new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      beacon.position.set(zone.x, 1.9, zone.z);
      scene.add(beacon);
      const label = labelSprite(zone.label, `#${zone.color.toString(16).padStart(6, "0")}`, 0.75);
      label.position.set(zone.x, 3.15, zone.z);
      scene.add(label);
    }

    const subwayGroup = new THREE.Group();
    const subwayMetal = new THREE.MeshStandardMaterial({ color: 0x1f4237, metalness: 0.72, roughness: 0.3 });
    const subwayDark = new THREE.MeshStandardMaterial({ color: 0x09110f, roughness: 0.9 });
    addBox(subwayGroup, [5.6, 0.35, 3], [0, 0.18, 0], subwayMetal);
    addBox(subwayGroup, [4.4, 0.3, 2.2], [0, 0.42, 0], subwayDark);
    for (const x of [-2.35, 2.35]) addBox(subwayGroup, [0.14, 2.3, 0.14], [x, 1.25, 0], subwayMetal);
    addBox(subwayGroup, [5.1, 0.16, 0.16], [0, 2.35, 0], subwayMetal);
    subwayGroup.position.set(0, 0, 25);
    scene.add(subwayGroup);
    const subwaySign = labelSprite("BROAD ST STATION", "#9cbcf2", 0.8);
    subwaySign.position.set(0, 3, 25);
    scene.add(subwaySign);

    const player = createPerson(0x244c75);
    player.position.set(0, 0, 10);
    const caseMaterial = new THREE.MeshStandardMaterial({ color: 0x5a351d, metalness: 0.18, roughness: 0.62 });
    addBox(player, [0.52, 0.46, 0.2], [0.68, 0.86, 0], caseMaterial);
    addBox(player, [0.24, 0.12, 0.12], [0.68, 1.16, 0], caseMaterial);
    scene.add(player);
    const playerLabel = labelSprite(bankerName.toUpperCase(), "#f1d070", 0.62);
    playerLabel.position.y = 3.2;
    player.add(playerLabel);

    const npcs = [
      { group: createPerson(0x6b3140, 0xc98763, 0xc9574d), radius: 8, speed: 0.18, offset: 0 },
      { group: createPerson(0x355c3f, 0x9e664e, 0x69a8d9), radius: 12, speed: -0.12, offset: 2 },
      { group: createPerson(0x5e5430, 0xd2a17d, 0xe0b94b), radius: 17, speed: 0.09, offset: 4 },
      { group: createPerson(0x3f4269, 0xa96e50, 0x925dcc), radius: 22, speed: -0.075, offset: 1 },
      { group: createPerson(0x604233, 0xd6a785, 0x63b981), radius: 27, speed: 0.06, offset: 5 },
    ];
    npcs.forEach((npc, index) => {
      const label = labelSprite(["CHADWICK", "MIRA", "RISK CLERK", "TAPE READER", "FUND PM"][index], "#d9c68e", 0.5);
      label.position.y = 3.05;
      npc.group.add(label);
      scene.add(npc.group);
    });

    const cars = Array.from({ length: 4 }, (_, index) => {
      const car = createCar([0x9d3c32, 0xd4a526, 0x274b70, 0x30463b][index], index === 1);
      scene.add(car);
      return car;
    });

    let yaw = 0;
    let pitch = -0.18;
    let dragging = false;
    let previousX = 0;
    let previousY = 0;
    let animationFrame = 0;
    const animationStartTime = performance.now();
    let previousFrameTime = animationStartTime;
    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysRef.current[key] = true;
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
      if (key === "v") setCameraMode((mode) => mode === "THIRD PERSON" ? "FIRST PERSON" : "THIRD PERSON");
      if (key === "f" || key === "enter") interactRef.current();
    };
    const onKeyUp = (event: KeyboardEvent) => { keysRef.current[event.key.toLowerCase()] = false; };
    const onPointerDown = (event: PointerEvent) => { dragging = true; previousX = event.clientX; previousY = event.clientY; };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      yaw -= (event.clientX - previousX) * 0.006;
      pitch = Math.max(-0.55, Math.min(0.22, pitch - (event.clientY - previousY) * 0.003));
      previousX = event.clientX;
      previousY = event.clientY;
    };
    const onPointerUp = () => { dragging = false; };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    interactRef.current = () => {
      if (locationRef.current === "STREET") {
        setNotice("Walk closer to a glowing workplace marker.");
        return;
      }
      setActionsOpen(true);
    };

    const collides = (x: number, z: number) => footprints.some((footprint) =>
      Math.abs(x - footprint.x) < footprint.halfX + 0.55
      && Math.abs(z - footprint.z) < footprint.halfZ + 0.55,
    );

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const frameTime = performance.now();
      const delta = Math.min(0.04, (frameTime - previousFrameTime) / 1000);
      const elapsed = (frameTime - animationStartTime) / 1000;
      previousFrameTime = frameTime;
      if (keysRef.current.q) yaw += delta * 1.7;
      if (keysRef.current.e) yaw -= delta * 1.7;
      const forwardInput = Number(keysRef.current.w || keysRef.current.arrowup) - Number(keysRef.current.s || keysRef.current.arrowdown);
      const sideInput = Number(keysRef.current.d || keysRef.current.arrowright) - Number(keysRef.current.a || keysRef.current.arrowleft);
      if (forwardInput || sideInput) {
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const direction = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput)).normalize();
        const speed = keysRef.current.shift ? 8.5 : 5.2;
        const nextX = player.position.x + direction.x * speed * delta;
        const nextZ = player.position.z + direction.z * speed * delta;
        if (Math.abs(nextX) < 37 && !collides(nextX, player.position.z)) player.position.x = nextX;
        if (Math.abs(nextZ) < 37 && !collides(player.position.x, nextZ)) player.position.z = nextZ;
        player.rotation.y = Math.atan2(direction.x, direction.z);
        player.position.y = Math.abs(Math.sin(elapsed * 9)) * 0.065;
        const rig = player.userData.rig;
        const stride = Math.sin(elapsed * (keysRef.current.shift ? 15 : 10)) * 0.42;
        rig.leftLeg.rotation.x = stride;
        rig.rightLeg.rotation.x = -stride;
        rig.leftArm.rotation.x = -stride * 0.7;
        rig.rightArm.rotation.x = stride * 0.7;
      } else {
        player.position.y = 0;
        const rig = player.userData.rig;
        rig.leftLeg.rotation.x *= 0.72;
        rig.rightLeg.rotation.x *= 0.72;
        rig.leftArm.rotation.x *= 0.72;
        rig.rightArm.rotation.x *= 0.72;
      }

      let closest: Zone | undefined;
      let closestDistance = 5.5;
      zones.forEach((zone) => {
        const distance = Math.hypot(player.position.x - zone.x, player.position.z - zone.z);
        if (distance < closestDistance) { closest = zone; closestDistance = distance; }
      });
      const nextLocation = closest?.location ?? "STREET";
      if (nextLocation !== locationRef.current) {
        locationRef.current = nextLocation;
        setLocation(nextLocation);
        setLocationLabel(closest?.label ?? "WALL STREET");
        setActionsOpen(false);
      }

      zoneRings.forEach((ring, index) => {
        ring.rotation.z = elapsed * 0.45 + index;
        const pulse = 1 + Math.sin(elapsed * 2 + index) * 0.1;
        ring.scale.setScalar(pulse);
      });
      npcs.forEach((npc) => {
        const angle = elapsed * npc.speed + npc.offset;
        npc.group.position.set(Math.sin(angle) * npc.radius, 0, Math.cos(angle) * npc.radius);
        npc.group.rotation.y = angle + (npc.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
        const rig = npc.group.userData.rig;
        const stride = Math.sin(elapsed * 7 + npc.offset) * 0.28;
        rig.leftLeg.rotation.x = stride;
        rig.rightLeg.rotation.x = -stride;
        rig.leftArm.rotation.x = -stride * 0.65;
        rig.rightArm.rotation.x = stride * 0.65;
        npc.group.position.y = Math.abs(Math.sin(elapsed * 7 + npc.offset)) * 0.035;
      });
      cars.forEach((car, index) => {
        const travel = ((elapsed * (3.5 + index * 0.25) + index * 17) % 76) - 38;
        if (index < 2) {
          car.position.set(index === 0 ? -2.4 : 2.4, 0.14, index === 0 ? travel : -travel);
          car.rotation.y = 0;
        } else {
          car.position.set(index === 2 ? travel : -travel, 0.14, index === 2 ? -2.4 : 2.4);
          car.rotation.y = Math.PI / 2;
        }
      });

      if (cameraModeRef.current === "FIRST PERSON") {
        camera.position.set(player.position.x, player.position.y + 2.25, player.position.z);
        const look = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(-pitch), -Math.cos(yaw) * Math.cos(pitch));
        camera.lookAt(camera.position.clone().add(look));
        player.visible = false;
      } else {
        player.visible = true;
        const distance = 9.5;
        camera.position.set(
          player.position.x + Math.sin(yaw) * distance,
          player.position.y + 5.8 + pitch * 4,
          player.position.z + Math.cos(yaw) * distance,
        );
        camera.lookAt(player.position.x, player.position.y + 1.35, player.position.z);
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if ("map" in material && material.map instanceof THREE.Texture) material.map.dispose();
            material.dispose();
          });
        }
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [bankerName, marketState]);

  if (webglError) return <div className="city3d-fallback"><b>3D renderer unavailable</b><p>This browser or device could not start WebGL. Return to the 2D district and try a WebGL-capable browser.</p></div>;

  return (
    <div className="city3d-shell">
      <div ref={mountRef} className="city3d-canvas" />
      <div className="city3d-topbar">
        <span><i />3D WALL STREET</span><b>{locationLabel}</b><em>{marketState}</em>
      </div>
      <section className="city3d-career">
        <small>{career.job}</small><b>CAREER LV. {careerLevel(career.shiftXp)}</b><span>XP {career.shiftXp}</span><label>ENERGY <i><b style={{ width: `${career.energy}%` }} /></i> {career.energy}</label>
      </section>
      <button className="camera-toggle" onClick={() => setCameraMode((mode) => mode === "THIRD PERSON" ? "FIRST PERSON" : "THIRD PERSON")}>{cameraMode} · V</button>
      <div className="city3d-notice">{notice}</div>
      {location !== "STREET" && !actionsOpen && <button className="city3d-interact" onClick={() => setActionsOpen(true)}><kbd>F</kbd> WORK AT {locationLabel}</button>}
      {actionsOpen && (
        <section className="city3d-programs">
          <header><div><small>PROGRAMMABLE WORKPLACE</small><b>{locationLabel}</b></div><button onClick={() => setActionsOpen(false)}>×</button></header>
          {actions.map((program) => <button key={program.id} onClick={() => runProgram(program.id)}><i>{program.hook ? "⌁" : "◆"}</i><span><b>{program.label}</b><small>{program.description}</small></span><em>{program.energyDelta > 0 ? `+${program.energyDelta}` : program.energyDelta} EN</em></button>)}
        </section>
      )}
      <div className="city3d-controls">WASD WALK · SHIFT RUN · DRAG LOOK · Q/E TURN · V CAMERA · F WORK</div>
      <div className="city3d-touch">
        <button onPointerDown={() => setTouchKey("w", true)} onPointerUp={() => setTouchKey("w", false)}>▲</button>
        <button onPointerDown={() => setTouchKey("a", true)} onPointerUp={() => setTouchKey("a", false)}>◀</button>
        <button onPointerDown={() => setTouchKey("s", true)} onPointerUp={() => setTouchKey("s", false)}>▼</button>
        <button onPointerDown={() => setTouchKey("d", true)} onPointerUp={() => setTouchKey("d", false)}>▶</button>
        <button className="touch-work" onClick={() => interactRef.current()}>WORK</button>
      </div>
    </div>
  );
}
