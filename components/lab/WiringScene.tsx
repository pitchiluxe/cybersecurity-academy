"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, GizmoHelper, GizmoViewport, Grid } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { WiringScenario, RequiredConnection, PortRef, LabDevice, DeviceKind } from "@/lib/wiringLab";

// Grid cell the layout reserves per device; individual chassis are smaller and centred in it.
const CELL_W = 4.0;
const ROW_D = 3.6;

interface DeviceProfile {
  w: number;
  h: number;
  d: number;
  body: string;      // chassis colour
  accent: string;    // bezel / trim colour
  shape: "rack" | "desktop" | "tower" | "puck";
}

const PROFILES: Record<DeviceKind, DeviceProfile> = {
  router:     { w: 3.0, h: 0.5, d: 1.5, body: "#1e293b", accent: "#2563eb", shape: "rack" },
  switch:     { w: 3.2, h: 0.42, d: 1.4, body: "#0f172a", accent: "#0891b2", shape: "rack" },
  firewall:   { w: 3.0, h: 0.5, d: 1.5, body: "#1a1414", accent: "#dc2626", shape: "rack" },
  patchpanel: { w: 3.2, h: 0.5, d: 0.7, body: "#334155", accent: "#94a3b8", shape: "rack" },
  modem:      { w: 1.5, h: 0.55, d: 1.2, body: "#111827", accent: "#7c3aed", shape: "desktop" },
  pc:         { w: 1.0, h: 1.7, d: 1.5, body: "#1f2937", accent: "#64748b", shape: "tower" },
  ap:         { w: 1.7, h: 0.3, d: 1.7, body: "#e2e8f0", accent: "#059669", shape: "puck" },
};

const PORT_COLORS: Record<string, string> = {
  wan: "#3b82f6", lan: "#22c55e", uplink: "#f59e0b", console: "#a855f7",
};

function profileOf(kind: DeviceKind): DeviceProfile {
  return PROFILES[kind] ?? PROFILES.switch;
}

function devicePos(index: number, total: number): [number, number, number] {
  const row = Math.floor(index / 4);
  const inRow = index % 4;
  const rowCount = Math.min(4, total - row * 4);
  const x = (inRow - (rowCount - 1) / 2) * CELL_W;
  const rows = Math.ceil(total / 4);
  const z = row * ROW_D - ((rows - 1) * ROW_D) / 2;
  return [x, 0, z];
}

// A port sits on the front face (+z) of its device, in a neat row near the lower bezel.
function portPos(device: LabDevice, deviceIndex: number, total: number, portIndex: number): THREE.Vector3 {
  const [dx, , dz] = devicePos(deviceIndex, total);
  const p = profileOf(device.kind);
  const n = device.ports.length;
  const bankW = Math.min(p.w - 0.5, n * 0.42);
  const px = dx - bankW / 2 + ((portIndex + 0.5) * bankW) / n;
  const py = p.shape === "tower" ? p.h * 0.35 : p.h * 0.45;
  const pz = dz + p.d / 2 + 0.03;
  return new THREE.Vector3(px, py, pz);
}

function usePortIndex(scenario: WiringScenario) {
  return useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    scenario.devices.forEach((d, di) => {
      d.ports.forEach((p, pi) => {
        map.set(`${d.id}:${p.id}`, portPos(d, di, scenario.devices.length, pi));
      });
    });
    return map;
  }, [scenario]);
}

// Frame the whole rig on load and whenever the scenario changes so every device is visible.
function CameraRig({
  center, radius, controls,
}: {
  center: THREE.Vector3;
  radius: number;
  controls: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const dist = radius * 2.9 + 4;
    camera.position.set(center.x, center.y + radius * 1.3 + 2, center.z + dist);
    camera.near = 0.1;
    camera.far = 200;
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(center);
      controls.current.update();
    }
  }, [center, radius, camera, controls]);
  return null;
}

// Arrow-key panning. Bound to the canvas (not window) so typing in the
// FortiGate console never moves the camera; auto-focused so arrows work at once.
function KeyControls({ controls }: { controls: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    el.tabIndex = 0;
    el.style.outline = "none";
    const c = controls.current;
    if (c) {
      c.keyPanSpeed = 28;
      c.keys = { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" };
      c.listenToKeyEvents(el);
    }
    el.focus();
    return () => { c?.stopListenToKeyEvents?.(); };
  }, [gl, controls]);
  return null;
}

function Cable({ from, to, cable, animate }: { from: THREE.Vector3; to: THREE.Vector3; cable: string; animate: boolean }) {
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += Math.max(0.7, from.distanceTo(to) * 0.28);
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [from, to]);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 48, 0.05, 10, false), [curve]);
  const indexCount = geometry.index ? geometry.index.count : 0;
  const progress = useRef(animate ? 0 : 1);
  const color = cable === "fiber" ? "#f59e0b" : cable === "console" ? "#a855f7" : "#eab308";

  useFrame((_, delta) => {
    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta * 1.8);
      geometry.setDrawRange(0, Math.floor(indexCount * progress.current));
    }
  });
  if (animate && progress.current === 0) geometry.setDrawRange(0, 0);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
    </mesh>
  );
}

function Packet({ curve, offset }: { curve: THREE.QuadraticBezierCurve3; offset: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * 0.35 + offset) % 1;
    ref.current?.position.copy(curve.getPoint(t));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={2.4} />
    </mesh>
  );
}

function PacketFlow({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += Math.max(0.7, from.distanceTo(to) * 0.28);
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [from, to]);
  return (
    <>
      <Packet curve={curve} offset={0} />
      <Packet curve={curve} offset={0.5} />
    </>
  );
}

// ---- Realistic device chassis --------------------------------------------

function VentSlits({ w, y, z }: { w: number; y: number; z: number }) {
  const slits = Math.max(3, Math.round(w * 2));
  return (
    <group>
      {Array.from({ length: slits }).map((_, i) => (
        <mesh key={i} position={[-w / 2 + 0.2 + (i * (w - 0.4)) / (slits - 1), y, z]}>
          <boxGeometry args={[0.02, 0.12, 0.02]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>
      ))}
    </group>
  );
}

function RackEar({ x, h, d }: { x: number; h: number; d: number }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.18, h * 0.9, d * 0.5]} />
        <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.4} />
      </mesh>
      {[-h * 0.22, h * 0.22].map((oy, i) => (
        <mesh key={i} position={[0, oy, d * 0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.24, 12]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}
    </group>
  );
}

// A blinking activity LED strip on the front bezel.
function StatusLeds({ w, y, z }: { w: number; y: number; z: number }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const count = 4;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.abs(Math.sin(t * (2 + i * 0.7) + i)) * 1.8;
    });
  });
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) refs.current[i] = el; }}
          position={[w / 2 - 0.18 - i * 0.13, y, z]}
        >
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial
            color={i === 0 ? "#22c55e" : "#38bdf8"}
            emissive={i === 0 ? "#22c55e" : "#38bdf8"}
            emissiveIntensity={1}
          />
        </mesh>
      ))}
    </group>
  );
}

function DeviceChassis({ device }: { device: LabDevice }) {
  const p = profileOf(device.kind);
  const { w, h, d, body, accent, shape } = p;

  if (shape === "puck") {
    // Ceiling AP — a rounded white disc with a status ring.
    return (
      <group>
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[w / 2, w / 2 + 0.05, h, 40]} />
          <meshStandardMaterial color={body} roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh position={[0, h + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[w / 2 - 0.18, w / 2 - 0.05, 40]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, h + 0.002, 0]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
        </mesh>
      </group>
    );
  }

  if (shape === "tower") {
    // Desktop PC tower.
    return (
      <group>
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={body} roughness={0.55} metalness={0.35} />
        </mesh>
        {/* front panel */}
        <mesh position={[0, h / 2, d / 2 + 0.01]}>
          <boxGeometry args={[w * 0.92, h * 0.94, 0.03]} />
          <meshStandardMaterial color="#0b1220" roughness={0.6} />
        </mesh>
        {/* power LED */}
        <mesh position={[w * 0.28, h * 0.8, d / 2 + 0.04]}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={1.6} />
        </mesh>
        <VentSlits w={w * 0.7} y={h * 0.55} z={d / 2 + 0.03} />
      </group>
    );
  }

  if (shape === "desktop") {
    // Small SOHO modem/gateway — rounded glossy box with two stub antennas.
    return (
      <group>
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={body} roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, h * 0.55, d / 2 + 0.01]}>
          <boxGeometry args={[w * 0.9, h * 0.5, 0.03]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} roughness={0.4} />
        </mesh>
        <StatusLeds w={w} y={h * 0.78} z={d / 2 + 0.03} />
        {[-w * 0.32, w * 0.32].map((ax, i) => (
          <mesh key={i} position={[ax, h + 0.35, -d / 2 + 0.15]} rotation={[0.25, 0, i === 0 ? 0.18 : -0.18]} castShadow>
            <cylinderGeometry args={[0.045, 0.06, 0.7, 12]} />
            <meshStandardMaterial color="#0b1220" roughness={0.5} />
          </mesh>
        ))}
      </group>
    );
  }

  // Rackmount chassis (router / switch / firewall / patch panel).
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={body} metalness={0.8} roughness={0.38} />
      </mesh>
      {/* front bezel */}
      <mesh position={[0, h / 2, d / 2 + 0.015]}>
        <boxGeometry args={[w - 0.1, h - 0.08, 0.04]} />
        <meshStandardMaterial color="#0b1220" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* accent trim line */}
      <mesh position={[0, h * 0.82, d / 2 + 0.04]}>
        <boxGeometry args={[w - 0.3, 0.04, 0.02]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} />
      </mesh>
      <RackEar x={-w / 2 - 0.02} h={h} d={d} />
      <RackEar x={w / 2 + 0.02} h={h} d={d} />
      {device.kind !== "patchpanel" && <StatusLeds w={w} y={h * 0.55} z={d / 2 + 0.045} />}
      {device.kind !== "patchpanel" && <VentSlits w={w * 0.5} y={h * 0.55} z={-d / 2 - 0.01} />}
      {/* router antennas */}
      {device.kind === "router" &&
        [-w * 0.35, 0, w * 0.35].map((ax, i) => (
          <mesh key={i} position={[ax, h + 0.4, -d / 2 + 0.1]} rotation={[0.2, 0, (i - 1) * 0.22]} castShadow>
            <cylinderGeometry args={[0.04, 0.055, 0.8, 12]} />
            <meshStandardMaterial color="#0b1220" roughness={0.5} />
          </mesh>
        ))}
    </group>
  );
}

// ---- Interactive RJ45 port ------------------------------------------------

function PortSocket({
  position, color, selected, connected, flashState, onClick, label,
}: {
  position: THREE.Vector3; color: string; selected: boolean; connected: boolean;
  flashState: "ok" | "bad" | null; onClick: () => void; label: string;
}) {
  const ledRef = useRef<THREE.Mesh>(null);
  const bezelRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => { document.body.style.cursor = "auto"; };
  }, [hovered]);

  useFrame(({ clock }) => {
    if (ledRef.current) {
      const mat = ledRef.current.material as THREE.MeshStandardMaterial;
      if (connected) {
        mat.emissiveIntensity = 1.2 + Math.sin(clock.getElapsedTime() * 8) * 0.8;
        mat.emissive.set("#22c55e"); mat.color.set("#22c55e");
      } else if (flashState === "bad") {
        mat.emissive.set("#ef4444"); mat.color.set("#ef4444"); mat.emissiveIntensity = 2.5;
      } else if (selected) {
        mat.emissive.set("#facc15"); mat.color.set("#facc15"); mat.emissiveIntensity = 2;
      } else {
        mat.emissive.set("#1e293b"); mat.color.set("#475569"); mat.emissiveIntensity = 0.2;
      }
    }
    if (bezelRef.current) {
      const target = hovered || selected ? 1.35 : 1;
      bezelRef.current.scale.setScalar(THREE.MathUtils.lerp(bezelRef.current.scale.x, target, 0.25));
    }
  });

  return (
    <group position={position}>
      {/* enlarged invisible hit area for easy clicking */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.42, 0.42, 0.32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* RJ45 housing */}
      <mesh ref={bezelRef}>
        <boxGeometry args={[0.24, 0.2, 0.12]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
      </mesh>
      {/* recessed jack mouth */}
      <mesh position={[0, -0.01, 0.065]}>
        <boxGeometry args={[0.15, 0.11, 0.03]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
      {/* link LED above the jack */}
      <mesh ref={ledRef} position={[0, 0.17, 0.02]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#475569" emissive="#1e293b" />
      </mesh>
      <Text position={[0, -0.22, 0.03]} fontSize={0.1} color="#cbd5e1" anchorX="center" outlineWidth={0.004} outlineColor="#020617">
        {label}
      </Text>
    </group>
  );
}

export default function WiringScene({
  scenario, made, packetsActive, onAttempt, flash,
}: {
  scenario: WiringScenario;
  made: RequiredConnection[];
  packetsActive: boolean;
  onAttempt: (a: PortRef, b: PortRef) => void;
  flash: { key: string; ok: boolean } | null;
}) {
  const portIndex = usePortIndex(scenario);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const [selected, setSelected] = useState<PortRef | null>(null);

  const total = scenario.devices.length;

  // Bounding sphere of the whole layout, used to auto-frame the camera.
  const { center, radius } = useMemo(() => {
    const box = new THREE.Box3();
    scenario.devices.forEach((d, di) => {
      const [x, , z] = devicePos(di, total);
      const p = profileOf(d.kind);
      box.expandByPoint(new THREE.Vector3(x - p.w / 2, 0, z - p.d / 2));
      box.expandByPoint(new THREE.Vector3(x + p.w / 2, p.h + 0.8, z + p.d / 2));
    });
    const c = new THREE.Vector3();
    box.getCenter(c);
    const r = Math.max(3, box.getBoundingSphere(new THREE.Sphere()).radius);
    return { center: c, radius: r };
  }, [scenario, total]);

  function clickPort(ref: PortRef) {
    if (!selected) { setSelected(ref); return; }
    if (selected.device === ref.device && selected.port === ref.port) { setSelected(null); return; }
    onAttempt(selected, ref);
    setSelected(null);
  }

  const connectedPorts = useMemo(() => {
    const s = new Set<string>();
    for (const c of made) {
      s.add(`${c.fromDevice}:${c.fromPort}`);
      s.add(`${c.toDevice}:${c.toPort}`);
    }
    return s;
  }, [made]);

  return (
    <Canvas shadows camera={{ position: [0, 6, 10], fov: 42 }} style={{ background: "#0b1220" }}>
      <CameraRig center={center} radius={radius} controls={controls} />
      <KeyControls controls={controls} />
      <hemisphereLight args={["#dbeafe", "#0b1220", 0.6]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#60a5fa" />

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        panSpeed={0.8}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.05}
      />

      {/* floor + reference grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#0d1526" roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#1e293b"
        sectionSize={4}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={40}
        fadeStrength={1.5}
        infiniteGrid
      />

      {scenario.devices.map((d, di) => {
        const [x, y, z] = devicePos(di, total);
        return (
          <group key={d.id} position={[x, y, z]}>
            <DeviceChassis device={d} />
            <Text
              position={[0, profileOf(d.kind).h + 0.5, 0]}
              fontSize={0.22}
              color="#e2e8f0"
              anchorX="center"
              outlineWidth={0.006}
              outlineColor="#020617"
            >
              {d.name}
            </Text>
            {d.ports.map((pt, pi) => {
              const key = `${d.id}:${pt.id}`;
              const world = portPos(d, di, total, pi);
              // convert to local (group already at device pos)
              const local = world.clone().sub(new THREE.Vector3(x, y, z));
              return (
                <PortSocket
                  key={key}
                  position={local}
                  color={PORT_COLORS[pt.kind] ?? "#475569"}
                  label={pt.label}
                  selected={selected?.device === d.id && selected?.port === pt.id}
                  connected={connectedPorts.has(key)}
                  flashState={flash && !flash.ok && flash.key.includes(key) ? "bad" : null}
                  onClick={() => clickPort({ device: d.id, port: pt.id })}
                />
              );
            })}
          </group>
        );
      })}

      {made.map((c) => {
        const from = portIndex.get(`${c.fromDevice}:${c.fromPort}`);
        const to = portIndex.get(`${c.toDevice}:${c.toPort}`);
        if (!from || !to) return null;
        const key = `${c.fromDevice}:${c.fromPort}|${c.toDevice}:${c.toPort}`;
        const isNewest = made[made.length - 1] === c;
        return (
          <group key={key}>
            <Cable from={from} to={to} cable={c.cable} animate={isNewest} />
            {packetsActive && <PacketFlow from={from} to={to} />}
          </group>
        );
      })}

      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="#e2e8f0" />
      </GizmoHelper>
    </Canvas>
  );
}
