"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import type { WiringScenario, RequiredConnection, PortRef, LabDevice } from "@/lib/wiringLab";

const DEVICE_W = 2.6;
const DEVICE_H = 0.9;
const DEVICE_D = 1.1;
const GAP = 1.0;

const KIND_COLORS: Record<string, string> = {
  modem: "#7c3aed", router: "#2563eb", switch: "#0891b2",
  patchpanel: "#475569", pc: "#334155", ap: "#059669", firewall: "#dc2626",
};
const PORT_COLORS: Record<string, string> = {
  wan: "#3b82f6", lan: "#22c55e", uplink: "#f59e0b", console: "#a855f7",
};

function devicePos(index: number, total: number): [number, number, number] {
  const row = Math.floor(index / 4);
  const inRow = index % 4;
  const rowCount = Math.min(4, total - row * 4);
  return [(inRow - (rowCount - 1) / 2) * (DEVICE_W + GAP), DEVICE_H / 2 + 0.05, row * 2.6 - 1];
}

function portPos(device: LabDevice, deviceIndex: number, total: number, portIndex: number): THREE.Vector3 {
  const [dx, dy, dz] = devicePos(deviceIndex, total);
  const n = device.ports.length;
  const px = dx - DEVICE_W / 2 + ((portIndex + 0.5) * DEVICE_W) / n;
  return new THREE.Vector3(px, dy - DEVICE_H / 4, dz + DEVICE_D / 2 + 0.02);
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

function Cable({ from, to, animate }: { from: THREE.Vector3; to: THREE.Vector3; animate: boolean }) {
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += Math.max(0.6, from.distanceTo(to) * 0.25);
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [from, to]);
  const geometry = useMemo(() => new THREE.TubeGeometry(curve, 40, 0.035, 8, false), [curve]);
  const indexCount = geometry.index ? geometry.index.count : 0;
  const progress = useRef(animate ? 0 : 1);

  useFrame((_, delta) => {
    if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta * 1.8);
      geometry.setDrawRange(0, Math.floor(indexCount * progress.current));
    }
  });
  if (animate && progress.current === 0) geometry.setDrawRange(0, 0);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#facc15" roughness={0.4} />
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
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={2} />
    </mesh>
  );
}

function PacketFlow({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const curve = useMemo(() => {
    const mid = from.clone().lerp(to, 0.5);
    mid.y += Math.max(0.6, from.distanceTo(to) * 0.25);
    return new THREE.QuadraticBezierCurve3(from, mid, to);
  }, [from, to]);
  return (
    <>
      <Packet curve={curve} offset={0} />
      <Packet curve={curve} offset={0.5} />
    </>
  );
}

function PortSocket({
  position, color, selected, connected, flashState, onClick, label,
}: {
  position: THREE.Vector3; color: string; selected: boolean; connected: boolean;
  flashState: "ok" | "bad" | null; onClick: () => void; label: string;
}) {
  const ledRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ledRef.current) return;
    const mat = ledRef.current.material as THREE.MeshStandardMaterial;
    if (connected) {
      mat.emissiveIntensity = 1.2 + Math.sin(clock.getElapsedTime() * 8) * 0.8;
      mat.emissive.set("#22c55e");
      mat.color.set("#22c55e");
    } else if (flashState === "bad") {
      mat.emissive.set("#ef4444");
      mat.color.set("#ef4444");
      mat.emissiveIntensity = 2.5;
    } else if (selected) {
      mat.emissive.set("#facc15");
      mat.color.set("#facc15");
      mat.emissiveIntensity = 2;
    } else {
      mat.emissive.set("#1e293b");
      mat.color.set("#475569");
      mat.emissiveIntensity = 0.2;
    }
  });
  return (
    <group position={position}>
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <boxGeometry args={[0.22, 0.18, 0.1]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={ledRef} position={[0, 0.16, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="#475569" emissive="#1e293b" />
      </mesh>
      <Text position={[0, -0.2, 0.02]} fontSize={0.09} color="#94a3b8" anchorX="center">
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
  const [selected, setSelected] = useState<PortRef | null>(null);

  function clickPort(ref: PortRef) {
    if (!selected) {
      setSelected(ref);
      return;
    }
    if (selected.device === ref.device && selected.port === ref.port) {
      setSelected(null);
      return;
    }
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
    <Canvas camera={{ position: [0, 5.5, 8], fov: 45 }} style={{ background: "#0b1220" }}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} />
      <OrbitControls enablePan={false} minDistance={4} maxDistance={16} maxPolarAngle={Math.PI / 2.1} />

      {/* desk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[24, 14]} />
        <meshStandardMaterial color="#111a2e" />
      </mesh>

      {scenario.devices.map((d, di) => {
        const [x, y, z] = devicePos(di, scenario.devices.length);
        return (
          <group key={d.id}>
            <mesh position={[x, y, z]}>
              <boxGeometry args={[DEVICE_W, DEVICE_H, DEVICE_D]} />
              <meshStandardMaterial color={KIND_COLORS[d.kind] ?? "#334155"} roughness={0.55} />
            </mesh>
            <Text position={[x, y + DEVICE_H / 2 + 0.22, z]} fontSize={0.2} color="#e2e8f0" anchorX="center">
              {d.name}
            </Text>
            {d.ports.map((p, pi) => {
              const key = `${d.id}:${p.id}`;
              const pos = portPos(d, di, scenario.devices.length, pi);
              return (
                <PortSocket
                  key={key}
                  position={pos}
                  color={PORT_COLORS[p.kind] ?? "#475569"}
                  label={p.label}
                  selected={selected?.device === d.id && selected?.port === p.id}
                  connected={connectedPorts.has(key)}
                  flashState={flash && !flash.ok && flash.key.includes(key) ? "bad" : null}
                  onClick={() => clickPort({ device: d.id, port: p.id })}
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
            <Cable from={from} to={to} animate={isNewest} />
            {packetsActive && <PacketFlow from={from} to={to} />}
          </group>
        );
      })}
    </Canvas>
  );
}
