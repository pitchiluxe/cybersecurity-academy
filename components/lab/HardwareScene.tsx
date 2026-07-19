"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, GizmoHelper, GizmoViewport, Grid } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { HardwareScenario, HardwarePart, HardwareSlot, RequiredInstall, PartKind, SlotKind } from "@/lib/hardwareLab";

// Bench layout: motherboard on the left, drive cage on the right, parts tray in front.
const BOARD_CENTER: [number, number, number] = [-1.2, 0.35, -0.4];
const BOARD_W = 6.2;
const BOARD_D = 5.2;
const CAGE_X = 3.9;
const TRAY_Z = 3.6;

interface SceneColors { bg: string; floor: string; grid: string; gridStrong: string; label: string }
const DEFAULT_SCENE_COLORS: SceneColors = { bg: "#0b1220", floor: "#0d1526", grid: "#1e293b", gridStrong: "#334155", label: "#e2e8f0" };

// The 3D room follows the active theme via the --scene-* CSS variables.
function useSceneColors(): SceneColors {
  const [colors, setColors] = useState<SceneColors>(DEFAULT_SCENE_COLORS);
  useEffect(() => {
    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      const pick = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
      setColors({
        bg: pick("--scene-bg", DEFAULT_SCENE_COLORS.bg),
        floor: pick("--scene-floor", DEFAULT_SCENE_COLORS.floor),
        grid: pick("--scene-grid", DEFAULT_SCENE_COLORS.grid),
        gridStrong: pick("--scene-grid-strong", DEFAULT_SCENE_COLORS.gridStrong),
        label: pick("--scene-label", DEFAULT_SCENE_COLORS.label),
      });
    };
    readColors();
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

function CameraRig({ controls }: { controls: React.MutableRefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0.5, 7.5, 8.5);
    camera.near = 0.1;
    camera.far = 200;
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.set(0.4, 0.3, 0.6);
      controls.current.update();
    }
  }, [camera, controls]);
  return null;
}

// Arrow-key panning bound to the canvas, mirroring the wiring lab controls.
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
    const refocus = () => el.focus();
    el.addEventListener("pointerenter", refocus);
    el.addEventListener("pointerdown", refocus);
    return () => {
      el.removeEventListener("pointerenter", refocus);
      el.removeEventListener("pointerdown", refocus);
      c?.stopListenToKeyEvents?.();
    };
  }, [gl, controls]);
  return null;
}

// ---- Slot placement --------------------------------------------------------
// Slots are grouped by kind and placed at fixed motherboard-anatomy positions,
// so any AI-generated scenario lands on a plausible-looking board.

interface Placement { pos: THREE.Vector3; alongX: boolean }

function placeSlots(slots: HardwareSlot[]): Map<string, Placement> {
  const [bx, by, bz] = BOARD_CENTER;
  const map = new Map<string, Placement>();
  const byKind = (kind: SlotKind) => slots.filter((s) => s.kind === kind);

  byKind("cpu-socket").forEach((s, i) => {
    map.set(s.id, { pos: new THREE.Vector3(bx - 1.1, by, bz - 0.7 + i * 1.4), alongX: true });
  });
  byKind("ram-slot").forEach((s, i) => {
    map.set(s.id, { pos: new THREE.Vector3(bx + 0.5 + i * 0.42, by, bz - 0.55), alongX: false });
  });
  byKind("m2-slot").forEach((s, i) => {
    map.set(s.id, { pos: new THREE.Vector3(bx - 1.5, by, bz + 1.5 + i * 0.6), alongX: true });
  });
  byKind("pcie-slot").forEach((s, i) => {
    map.set(s.id, { pos: new THREE.Vector3(bx + 0.4, by, bz + 1.7 + i * 0.55), alongX: true });
  });
  byKind("atx-power").forEach((s, i) => {
    map.set(s.id, { pos: new THREE.Vector3(bx + 2.6, by, bz - 0.5 + i * 1.2), alongX: false });
  });
  byKind("drive-bay").forEach((s, i) => {
    map.set(s.id, { pos: new THREE.Vector3(CAGE_X, 0.45 + i * 0.85, -0.4), alongX: true });
  });
  return map;
}

function trayPos(index: number, total: number): THREE.Vector3 {
  const spread = Math.max(total - 1, 1) * 1.55;
  return new THREE.Vector3(-spread / 2 + index * 1.55, 0.05, TRAY_Z);
}

// ---- Part meshes -----------------------------------------------------------

const RAM_COLORS = ["#dc2626", "#2563eb", "#0d9488", "#7c3aed"];

function CpuMesh() {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.9, 0.1, 0.9]} />
        <meshStandardMaterial color="#166534" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.62, 0.06, 0.62]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[0.94, 0.015, 0.94]} />
        <meshStandardMaterial color="#eab308" metalness={0.95} roughness={0.3} />
      </mesh>
    </group>
  );
}

function RamMesh({ tint }: { tint: string }) {
  return (
    <group>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.09, 0.9, 1.9]} />
        <meshStandardMaterial color={tint} roughness={0.45} metalness={0.3} />
      </mesh>
      {[-0.65, -0.22, 0.22, 0.65].map((z, i) => (
        <mesh key={i} position={[0.055, 0.5, z]}>
          <boxGeometry args={[0.02, 0.42, 0.3]} />
          <meshStandardMaterial color="#0b1220" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.06, 0.06, 1.86]} />
        <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

function M2Mesh() {
  return (
    <group>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[1.15, 0.06, 0.34]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
      </mesh>
      {[-0.3, 0.05, 0.4].map((x, i) => (
        <mesh key={i} position={[x, 0.085, 0]}>
          <boxGeometry args={[0.24, 0.03, 0.24]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>
      ))}
    </group>
  );
}

function DriveMesh({ kind }: { kind: "hdd" | "ssd" }) {
  const isHdd = kind === "hdd";
  return (
    <group>
      <mesh position={[0, isHdd ? 0.24 : 0.1, 0]} castShadow>
        <boxGeometry args={isHdd ? [1.25, 0.48, 1.7] : [1.05, 0.2, 1.45]} />
        <meshStandardMaterial color={isHdd ? "#64748b" : "#111827"} metalness={isHdd ? 0.85 : 0.4} roughness={0.4} />
      </mesh>
      {isHdd ? (
        <mesh position={[0.1, 0.49, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.02, 28]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.15} />
        </mesh>
      ) : (
        <mesh position={[0, 0.21, 0.4]}>
          <boxGeometry args={[0.7, 0.012, 0.4]} />
          <meshStandardMaterial color="#334155" roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

function GpuMesh({ spinning }: { spinning: boolean }) {
  const fanA = useRef<THREE.Mesh>(null);
  const fanB = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!spinning) return;
    if (fanA.current) fanA.current.rotation.y += delta * 9;
    if (fanB.current) fanB.current.rotation.y += delta * 9;
  });
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[2.3, 1.0, 0.14]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, 0.11]}>
        <boxGeometry args={[2.24, 0.94, 0.06]} />
        <meshStandardMaterial color="#1e293b" roughness={0.55} />
      </mesh>
      {[-0.55, 0.55].map((x, i) => (
        <mesh key={i} ref={i === 0 ? fanA : fanB} position={[x, 0.5, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.05, 9]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[1.6, 0.06, 0.08]} />
        <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

function PowerMesh() {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.34, 0.4, 0.95]} />
        <meshStandardMaterial color="#111827" roughness={0.55} />
      </mesh>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[0, 0.42, -0.35 + i * 0.14]}>
          <boxGeometry args={[0.26, 0.05, 0.09]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      <mesh position={[0, 0.55, -0.2]} rotation={[0.5, 0, 0.3]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.8, 10]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
    </group>
  );
}

function PartMesh({ part, tintIndex, spinning }: { part: HardwarePart; tintIndex: number; spinning: boolean }) {
  switch (part.kind) {
    case "cpu": return <CpuMesh />;
    case "ram": return <RamMesh tint={RAM_COLORS[tintIndex % RAM_COLORS.length]} />;
    case "m2": return <M2Mesh />;
    case "hdd": return <DriveMesh kind="hdd" />;
    case "ssd": return <DriveMesh kind="ssd" />;
    case "gpu": return <GpuMesh spinning={spinning} />;
    case "power": return <PowerMesh />;
  }
}

// ---- Slot meshes -----------------------------------------------------------

const SLOT_COLORS: Record<SlotKind, string> = {
  "cpu-socket": "#94a3b8",
  "ram-slot": "#0f172a",
  "m2-slot": "#334155",
  "drive-bay": "#475569",
  "pcie-slot": "#1e293b",
  "atx-power": "#111827",
};

function SlotMesh({ kind, alongX }: { kind: SlotKind; alongX: boolean }) {
  const rot: [number, number, number] = alongX ? [0, 0, 0] : [0, Math.PI / 2, 0];
  if (kind === "cpu-socket") {
    return (
      <group rotation={rot}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[1.1, 0.06, 1.1]} />
          <meshStandardMaterial color={SLOT_COLORS[kind]} metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.045, 0]}>
          <boxGeometry args={[0.86, 0.04, 0.86]} />
          <meshStandardMaterial color="#0b1220" />
        </mesh>
      </group>
    );
  }
  if (kind === "drive-bay") {
    return (
      <group rotation={rot}>
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[1.5, 0.06, 1.95]} />
          <meshStandardMaterial color={SLOT_COLORS[kind]} metalness={0.7} roughness={0.4} />
        </mesh>
        {[-0.72, 0.72].map((x, i) => (
          <mesh key={i} position={[x, 0.02, 0]}>
            <boxGeometry args={[0.06, 0.6, 1.95]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
    );
  }
  const dims: [number, number, number] =
    kind === "ram-slot" ? [0.16, 0.1, 2.0]
    : kind === "m2-slot" ? [1.25, 0.05, 0.4]
    : kind === "pcie-slot" ? [2.4, 0.09, 0.2]
    : [0.4, 0.12, 1.0]; // atx-power
  return (
    <group rotation={kind === "ram-slot" || kind === "atx-power" ? [0, 0, 0] : rot}>
      <mesh position={[0, dims[1] / 2, 0]}>
        <boxGeometry args={dims} />
        <meshStandardMaterial color={SLOT_COLORS[kind]} roughness={0.5} />
      </mesh>
    </group>
  );
}

// Pulsing highlight ring shown on empty slots while a part is selected.
function SlotHighlight({ active, bad }: { active: boolean; bad: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    if (bad) {
      mat.color.set("#ef4444"); mat.emissive.set("#ef4444");
      mat.emissiveIntensity = 2.2;
      mat.opacity = 0.9;
    } else if (active) {
      mat.color.set("#facc15"); mat.emissive.set("#facc15");
      mat.emissiveIntensity = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.6;
      mat.opacity = 0.75;
    } else {
      mat.opacity = 0;
    }
  });
  return (
    <mesh ref={ref} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.55, 0.72, 32]} />
      <meshStandardMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function useCursor(hovered: boolean) {
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "auto";
    return () => { document.body.style.cursor = "auto"; };
  }, [hovered]);
}

function TrayPart({
  part, position, tintIndex, selected, onClick,
}: {
  part: HardwarePart; position: THREE.Vector3; tintIndex: number; selected: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const mat = ring.current.material as THREE.MeshStandardMaterial;
    mat.opacity = selected ? 0.85 : hovered ? 0.4 : 0;
    if (selected) mat.emissiveIntensity = 1.2 + Math.sin(clock.getElapsedTime() * 5) * 0.6;
  });
  return (
    <group position={position}>
      <mesh
        position={[0, 0.55, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.5, 1.4, 2.1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <PartMesh part={part} tintIndex={tintIndex} spinning={false} />
      <mesh ref={ring} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 0.92, 36]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Billboard position={[0, 1.45, 0]}>
        <Text fontSize={0.17} color={selected ? "#facc15" : "#e2e8f0"} anchorX="center" anchorY="middle" maxWidth={1.7} textAlign="center" outlineWidth={0.01} outlineColor="#0b1220">
          {part.name}
        </Text>
      </Billboard>
    </group>
  );
}

// Green power LEDs that pulse once the build is complete.
function PowerLeds({ on }: { on: boolean }) {
  const refs = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = on ? 1.2 + Math.abs(Math.sin(t * 3 + i)) * 1.6 : 0.15;
    });
  });
  const [bx, by, bz] = BOARD_CENTER;
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { if (el) refs.current[i] = el; }} position={[bx + 2.75, by + 0.06, bz + 1.6 + i * 0.25]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color={on ? "#22c55e" : "#475569"} emissive="#22c55e" emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

export default function HardwareScene({
  scenario, made, poweredOn, onAttempt, flashSlot,
}: {
  scenario: HardwareScenario;
  made: RequiredInstall[];
  poweredOn: boolean;
  onAttempt: (partId: string, slotId: string) => void;
  flashSlot: { slot: string; ok: boolean } | null;
}) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const scene = useSceneColors();

  const placements = useMemo(() => placeSlots(scenario.slots), [scenario]);
  const partById = useMemo(() => new Map(scenario.parts.map((p) => [p.id, p])), [scenario]);
  const tintIndex = useMemo(() => new Map(scenario.parts.map((p, i) => [p.id, i])), [scenario]);
  const installedBySlot = useMemo(() => new Map(made.map((m) => [m.slot, m.part])), [made]);
  const installedParts = useMemo(() => new Set(made.map((m) => m.part)), [made]);
  const trayParts = scenario.parts.filter((p) => !installedParts.has(p.id));

  function clickSlot(slotId: string) {
    if (!selected) return;
    onAttempt(selected, slotId);
    setSelected(null);
  }

  const [bx, by, bz] = BOARD_CENTER;

  return (
    <Canvas shadows camera={{ position: [0.5, 7.5, 8.5], fov: 42 }} style={{ background: scene.bg }}>
      <CameraRig controls={controls} />
      <KeyControls controls={controls} />
      <hemisphereLight args={["#dbeafe", "#0b1220", 0.6]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 8]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={scene.floor} roughness={0.9} />
      </mesh>
      <Grid
        position={[0, 0, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={scene.grid}
        sectionSize={4}
        sectionThickness={1}
        sectionColor={scene.gridStrong}
        fadeDistance={40}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Anti-static bench mat under the board */}
      <mesh position={[bx, 0.02, bz]} receiveShadow>
        <boxGeometry args={[BOARD_W + 1.6, 0.04, BOARD_D + 1.6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.95} />
      </mesh>

      {/* Motherboard PCB with mounting standoffs */}
      <mesh position={[bx, by - 0.1, bz]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_W, 0.12, BOARD_D]} />
        <meshStandardMaterial color="#14532d" roughness={0.55} metalness={0.15} />
      </mesh>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[bx + sx * (BOARD_W / 2 - 0.3), 0.14, bz + sz * (BOARD_D / 2 - 0.3)]}>
          <cylinderGeometry args={[0.08, 0.1, 0.26, 8]} />
          <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      <Billboard position={[bx, 2.1, bz - BOARD_D / 2 - 0.3]}>
        <Text fontSize={0.26} color={scene.label} anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor={scene.bg}>
          Motherboard
        </Text>
      </Billboard>

      {/* Drive cage frame */}
      {scenario.slots.some((s) => s.kind === "drive-bay") && (
        <Billboard position={[CAGE_X, 2.1, -0.4]}>
          <Text fontSize={0.26} color={scene.label} anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor={scene.bg}>
            Drive cage
          </Text>
        </Billboard>
      )}

      <PowerLeds on={poweredOn} />

      {/* Slots */}
      {scenario.slots.map((slot) => {
        const placement = placements.get(slot.id);
        if (!placement) return null;
        const occupiedBy = installedBySlot.get(slot.id);
        return (
          <group key={slot.id} position={placement.pos}>
            <SlotMesh kind={slot.kind} alongX={placement.alongX} />
            <SlotHighlight
              active={!!selected && !occupiedBy}
              bad={flashSlot?.slot === slot.id && !flashSlot.ok}
            />
            {!occupiedBy && (
              <mesh
                position={[0, 0.35, 0]}
                onClick={(e) => { e.stopPropagation(); clickSlot(slot.id); }}
              >
                <boxGeometry args={slot.kind === "drive-bay" ? [1.6, 0.8, 2.0] : [1.2, 0.7, 1.2]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
            {occupiedBy && partById.get(occupiedBy) && (
              <PartMesh part={partById.get(occupiedBy)!} tintIndex={tintIndex.get(occupiedBy) ?? 0} spinning={poweredOn} />
            )}
            <Billboard position={[0, slot.kind === "drive-bay" ? -0.35 : -0.02, slot.kind === "drive-bay" ? 1.15 : 0.85]}>
              <Text fontSize={0.14} color={scene.label} anchorX="center" anchorY="middle" outlineWidth={0.008} outlineColor={scene.bg}>
                {slot.label}
              </Text>
            </Billboard>
          </group>
        );
      })}

      {/* Parts tray */}
      <Billboard position={[0, 1.95, TRAY_Z]}>
        <Text fontSize={0.22} color={scene.label} anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor={scene.bg}>
          {trayParts.length > 0 ? "Parts tray — click a part, then its slot" : "Tray empty"}
        </Text>
      </Billboard>
      {trayParts.map((part, i) => (
        <TrayPart
          key={part.id}
          part={part}
          position={trayPos(i, trayParts.length)}
          tintIndex={tintIndex.get(part.id) ?? 0}
          selected={selected === part.id}
          onClick={() => setSelected(selected === part.id ? null : part.id)}
        />
      ))}

      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="#e2e8f0" />
      </GizmoHelper>
    </Canvas>
  );
}
