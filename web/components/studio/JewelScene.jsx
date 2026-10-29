'use client';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, PerformanceMonitor, Sparkles, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SHAPE_SCALE } from '@/lib/viewerItem';
import { TIERS } from './quality';
import { buildProcedural } from './procedural';

const CAMERA_PRESETS = { angle: [2.7, 1.5, 4.1], front: [0, 0.9, 4.4], top: [0, 5, 0.01], side: [4.4, 0.9, 0] };
const HOLO_CYAN = '#7ee7ff';

/* ---------- materials ---------- */
function makeMetal(metal, tier, highlight) {
  const m = new THREE.MeshPhysicalMaterial({
    color: metal?.hex || '#D9B04A', metalness: 1, roughness: metal?.roughness ?? 0.12,
    clearcoat: tier === 'low' ? 0 : 0.25, clearcoatRoughness: 0.15, envMapIntensity: 1.1,
  });
  if (highlight) { m.emissive = new THREE.Color('#C9A24A'); m.emissiveIntensity = 0.55; }
  return m;
}

function makeGem(stone, tierCfg, highlight) {
  const color = new THREE.Color(stone?.hex || '#ffffff');
  const isDiamond = stone?.kind === 'diamond';
  // Mirror-finish flat facets reflecting the strip lights give the bright/dark flash of a cut stone on every tier; transmission has nothing to refract in a void.
  let m;
  if (tierCfg.fire || tierCfg.shadows) {
    m = new THREE.MeshPhysicalMaterial({
      color, metalness: 1, roughness: 0, flatShading: true, envMapIntensity: isDiamond ? 2.6 : 1.7,
      ...(tierCfg.fire ? { iridescence: 0.5, iridescenceIOR: 1.8, iridescenceThicknessRange: [120, 420] } : {}),
    });
  } else {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.9, flatShading: true, envMapIntensity: 2 });
  }
  if (highlight) { m.emissive = new THREE.Color('#C9A24A'); m.emissiveIntensity = 0.4; }
  return m;
}

/** Hologram: fresnel rim + travelling scan lines, additive. Tinted by the real metal / stone colour. */
function makeHolo(hex, alpha, motion) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(hex) }, uMotion: { value: motion ? 1 : 0 }, uAlpha: { value: alpha } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vWorld; varying vec3 vView;
      void main() {
        vec4 pos = vec4(position, 1.0); vec3 nrm = normal;
        #ifdef USE_INSTANCING
          pos = instanceMatrix * pos; nrm = mat3(instanceMatrix) * nrm;
        #endif
        vec4 wp = modelMatrix * pos;
        vWorld = wp.xyz; vN = normalize(mat3(modelMatrix) * nrm); vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform float uMotion; uniform float uAlpha;
      varying vec3 vN; varying vec3 vWorld; varying vec3 vView;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
        float scan = 0.5 + 0.5 * sin(vWorld.y * 90.0 - uTime * 3.0 * uMotion);
        float lines = smoothstep(0.55, 1.0, scan);
        float flick = 1.0 - 0.06 * uMotion * sin(uTime * 37.0);
        float a = (0.2 + fres * 0.9 + lines * 0.3) * uAlpha * flick;
        gl_FragColor = vec4(uColor * (0.7 + fres * 1.4 + lines * 0.4), a);
      }`,
  });
}

const isStoneNode = (name) => /^(stone|gem)/i.test(name);

/* ---------- one piece of jewellery: shared body for GLB and parametric models ---------- */
function PieceBody({ item, root, x, tier, exploded, highlight, showMeasure, reduced, hologram }) {
  const tierCfg = TIERS[tier];
  const invalidate = useThree((s) => s.invalidate);
  const comps = item.components;

  const mats = useMemo(() => ({
    metal: makeMetal(item.metal, tier, false), metalHi: makeMetal(item.metal, tier, true),
    gem: makeGem(item.stone, tierCfg, false), gemHi: makeGem(item.stone, tierCfg, true),
    holoMetal: makeHolo(new THREE.Color(HOLO_CYAN).lerp(new THREE.Color(item.metal?.hex || '#D9B04A'), 0.55), 0.8, !reduced),
    holoGem: makeHolo(new THREE.Color('#ffffff').lerp(new THREE.Color(item.stone?.hex || '#ffffff'), 0.5).lerp(new THREE.Color(HOLO_CYAN), 0.25), 1, !reduced),
  }), [item.metal, item.stone, tier, tierCfg, reduced]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const nodes = useMemo(() => {
    const list = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.rest = o.position.clone();
      o.userData.restScale = o.scale.clone();
      o.userData.kind = isStoneNode(o.name) ? 'gem' : 'metal';
      list.push(o);
    });
    return list;
  }, [root]);

  const hasStone = !!item.stone;
  const caratScale = Math.cbrt(Math.max(item.carat, 0.1) / 0.5);
  const parametric = !!root.userData.parametric;

  useEffect(() => {
    // GLB models without a dedicated shape asset are scaled to approximate the shape (labelled simulated); parametric models bake the shape in.
    const [sx, sz] = item.realShape || parametric ? [1, 1] : SHAPE_SCALE[item.shape] || [1, 1];
    nodes.forEach((o) => {
      const gem = o.userData.kind === 'gem';
      const hi = highlight === o.name;
      o.visible = gem ? hasStone : true;
      o.material = hologram ? (gem ? mats.holoGem : mats.holoMetal) : gem ? (hi ? mats.gemHi : mats.gem) : (hi ? mats.metalHi : mats.metal);
      if (o.name === 'stone') {
        const r = o.userData.restScale;
        o.scale.set(r.x * sx * caratScale, r.y * caratScale, r.z * sz * caratScale);
      }
    });
    invalidate();
  }, [nodes, mats, highlight, hasStone, item.shape, item.realShape, parametric, caratScale, hologram, invalidate]);

  const targets = useMemo(() => {
    const t = new Map();
    nodes.forEach((o) => {
      const i = comps.findIndex((c) => c.meshName === o.name);
      const extra = o.userData.explode;
      t.set(o, new THREE.Vector3(...(extra || [0, i < 0 ? 0 : i * 0.4, 0])));
    });
    return t;
  }, [nodes, comps]);

  // Demand-mode rendering: ask for a frame whenever the exploded state changes so the animation starts.
  useEffect(() => { invalidate(); }, [exploded, invalidate]);

  useFrame(({ clock }) => {
    if (hologram) { mats.holoMetal.uniforms.uTime.value = clock.elapsedTime; mats.holoGem.uniforms.uTime.value = clock.elapsedTime; }
    let moving = false;
    nodes.forEach((o) => {
      const goal = o.userData.rest.clone();
      if (exploded) goal.add(targets.get(o));
      if (reduced) o.position.copy(goal);
      else if (o.position.distanceToSquared(goal) > 1e-6) { o.position.lerp(goal, 0.12); moving = true; }
    });
    if (moving) invalidate();
  });

  const anchors = useMemo(() => {
    if (!showMeasure) return [];
    return item.annotations.map((a, i) => {
      const node = nodes.find((n) => n.name === a.meshName);
      if (!node) return null;
      const box = new THREE.Box3().setFromObject(node);
      const c = box.getCenter(new THREE.Vector3());
      return { ...a, pos: [c.x, box.max.y, c.z], side: i % 2 ? 1 : -1 };
    }).filter(Boolean);
  }, [showMeasure, item.annotations, nodes]);

  return (
    <group position={[x, 0, 0]}>
      <primitive object={root} />
      {!exploded && anchors.map((a) => (
        <Html key={a.label} position={a.pos} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex items-center" style={{ transform: `translateX(${a.side * 14}px)`, flexDirection: a.side > 0 ? 'row' : 'row-reverse' }}>
            <span className="block h-1.5 w-1.5 rounded-full bg-[#C9A24A]" />
            <span className="block h-px w-8 bg-[#C9A24A]/70" />
            <span className="whitespace-nowrap rounded border border-[#C9A24A]/50 bg-black/55 px-1.5 py-0.5 text-[10px] tracking-wide text-[#E4CF98]">
              {a.label} · {a.valueMm.toFixed(1)} mm
            </span>
          </div>
        </Html>
      ))}
    </group>
  );
}

function GlbPiece(props) {
  const { item, tier } = props;
  const url = tier === 'low' && item.lodUrls?.low ? item.lodUrls.low : item.glbUrl;
  const { scene } = useGLTF(url);
  const root = useMemo(() => scene.clone(true), [scene]);
  return <PieceBody {...props} root={root} />;
}

function ProcPiece(props) {
  const { item } = props;
  const root = useMemo(() => {
    const g = buildProcedural(item.procedural, { shape: item.shape, weightG: item.weightG });
    g.userData.parametric = true;
    return g;
  }, [item.procedural, item.shape, item.weightG]);
  // Geometries from stoneGeometry() are cached and shared; only free the ones we own.
  useEffect(() => () => root.traverse((o) => { if (o.isMesh && !o.geometry.userData?.shared) o.geometry.dispose?.(); }), [root]);
  return <PieceBody {...props} root={root} />;
}

const Piece = (props) => (props.item.procedural ? <ProcPiece {...props} /> : <GlbPiece {...props} />);

/* ---------- hologram stage ---------- */
function HoloStage({ tier, reduced, y }) {
  const beam = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uMotion: { value: reduced ? 0 : 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; uniform float uMotion; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * 0.16 * (1.0 + 0.12 * uMotion * sin(uTime * 2.0 + vUv.y * 8.0)); gl_FragColor = vec4(0.49, 0.9, 1.0, a); }',
  }), [reduced]);
  useEffect(() => () => beam.dispose(), [beam]);
  useFrame(({ clock }) => { beam.uniforms.uTime.value = clock.elapsedTime; });
  const ring = (r, color, o = 0.9) => (
    <mesh position={[0, y + 0.06, 0]} rotation-x={Math.PI / 2}>
      <torusGeometry args={[r, 0.012, 6, 96]} /><meshBasicMaterial color={color} transparent opacity={o} />
    </mesh>
  );
  return (
    <group>
      <mesh position={[0, y, 0]}><cylinderGeometry args={[1.6, 1.7, 0.1, 64]} /><meshStandardMaterial color="#080b10" metalness={0.85} roughness={0.35} /></mesh>
      {ring(1.5, '#C9A24A')}{ring(1.2, HOLO_CYAN, 0.8)}{ring(0.9, HOLO_CYAN, 0.5)}
      <mesh position={[0, y + 1.4, 0]} material={beam}><coneGeometry args={[1.25, 2.8, 48, 1, true]} /></mesh>
      {tier !== 'low' && !reduced && <Sparkles count={46} scale={[3, 3.4, 3]} size={3} speed={0.35} color={HOLO_CYAN} position={[0, y + 1.6, 0]} />}
    </group>
  );
}

/** Gentle levitation in hologram mode. */
function Levitate({ on, reduced, scrollRef, children }) {
  const ref = useRef();
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef(-1);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = on ? 0.18 + (reduced ? 0 : Math.sin(clock.elapsedTime * 1.2) * 0.05) : 0;
    if (scrollRef) {
      ref.current.position.x = innerWidth > 900 ? 1.1 : 0;   // keep the ring clear of the caption column
      // Scroll-driven spin: smoothed towards the target so Lenis' easing reads as weight, not jitter.
      const target = (scrollRef.current ?? 0) * Math.PI * 2.4;
      ref.current.rotation.y += (target - ref.current.rotation.y) * (reduced ? 1 : 0.1);
      if (Math.abs(target - ref.current.rotation.y) > 0.001 || last.current !== scrollRef.current) invalidate();
      last.current = scrollRef.current;
    }
  });
  return <group ref={ref}>{children}</group>;
}

/* ---------- rig ---------- */
function StudioLights({ res }) {
  // Narrow strip lights around the piece give crisp facet flashes on stones; the warm base keeps polished metal from reflecting pure black.
  const strips = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const a = (i / 8) * Math.PI * 2;
    return { pos: [Math.cos(a) * 8, 2 + (i % 3), Math.sin(a) * 8], ry: -a + Math.PI / 2, color: i % 2 ? '#dfe8ff' : '#fff1d6', k: i % 2 ? 5 : 6 };
  });
  return (
    <Environment resolution={res} frames={1} background={false}>
      <mesh scale={60}><sphereGeometry args={[1, 24, 16]} /><meshBasicMaterial color="#4a3b22" side={THREE.BackSide} /></mesh>
      <Lightformer form="rect" intensity={3.2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      {strips.map((s, i) => <Lightformer key={i} form="rect" intensity={s.k} position={s.pos} rotation-y={s.ry} scale={[0.9, 7, 1]} color={s.color} />)}
      <Lightformer form="rect" intensity={1.4} position={[0, 1.5, 9]} rotation-y={Math.PI} scale={[14, 5, 1]} color="#fff8ee" />
      <Lightformer form="rect" intensity={1.2} position={[0, -5, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} color="#ffe9b8" />
    </Environment>
  );
}

function CameraRig({ preset, reduced, controls, distance }) {
  const { camera, invalidate } = useThree();
  const goal = useRef(null);
  useEffect(() => {
    const p = CAMERA_PRESETS[preset];
    if (!p) return;
    const v = new THREE.Vector3(...p).normalize().multiplyScalar(distance);
    if (reduced) { camera.position.copy(v); controls.current?.update(); invalidate(); }
    else goal.current = v;
  }, [preset, distance, reduced, camera, controls, invalidate]);
  useFrame(() => {
    if (!goal.current) return;
    camera.position.lerp(goal.current, 0.12);
    controls.current?.update();
    if (camera.position.distanceToSquared(goal.current) < 1e-4) goal.current = null;
    invalidate();
  });
  return null;
}

/** Keyframed camera path along scroll progress 0..1: wide → close on the stone → pull back. */
const PATH = [[0, [2.7, 1.5, 6.2], 0.2], [0.35, [1.4, 1.3, 4.6], 0.5], [0.7, [-1.2, 1.2, 5.4], 0.5], [1, [0, 1.1, 6.8], 0.25]];
function ScrollCam({ scrollRef, reduced }) {
  const { camera, invalidate } = useThree();
  const look = useRef(new THREE.Vector3());
  useFrame(() => {
    const p = Math.min(1, Math.max(0, scrollRef.current ?? 0));
    let i = 0; while (i < PATH.length - 2 && p > PATH[i + 1][0]) i++;
    const [p0, a, ay] = PATH[i], [p1, b, by] = PATH[i + 1];
    const t = Math.min(1, Math.max(0, (p - p0) / (p1 - p0))), e = t * t * (3 - 2 * t);
    const goal = new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), e);
    const k = reduced ? 1 : 0.1;
    if (camera.position.distanceToSquared(goal) > 1e-5) { camera.position.lerp(goal, k); invalidate(); }
    look.current.set(0, ay + (by - ay) * e, 0);
    camera.lookAt(look.current);
  });
  return null;
}

function Spin({ on }) {
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => { if (on) invalidate(); });
  return null;
}

/** OrbitControls sets touch-action:none on the canvas, which swallows page scroll on phones. Embedded scenes hand vertical swipes back to the page. */
function PageScroll() {
  const el = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const set = () => { el.style.touchAction = 'pan-y'; };
    set();
    const t = setTimeout(set, 0);   // after OrbitControls connects
    return () => clearTimeout(t);
  }, [el]);
  return null;
}

export default function JewelScene({ items, tier, exploded, highlight, showMeasure, autoRotate, reduced, preset, hologram, scrollRef, pageScroll, onDowngrade, onFail }) {
  const cfg = TIERS[tier];
  const controls = useRef();
  const spacing = 2.8;
  const fit = Math.max(...items.map((i) => i.fit || 1));
  const distance = (items.length > 1 ? 7.4 : 5.6) * fit;
  const start = new THREE.Vector3(...CAMERA_PRESETS.angle).normalize().multiplyScalar(distance).toArray();

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, cfg.dprMax]}
      camera={{ position: start, fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: cfg.antialias, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!items[0]?.capture }}
      onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail?.(); })}
    >
      <PerformanceMonitor onDecline={onDowngrade} flipflops={2} />
      <ambientLight intensity={0.15} />
      <StudioLights res={cfg.envRes} />
      <Suspense fallback={null}>
        <Levitate on={hologram} reduced={reduced} scrollRef={scrollRef}>
          {items.map((it, i) => (
            <Piece key={`${it.key}-${it.glbUrl}-${it.procedural}`} item={it} x={(i - (items.length - 1) / 2) * spacing} tier={tier}
              exploded={exploded} highlight={highlight} showMeasure={showMeasure} reduced={reduced} hologram={hologram} />
          ))}
        </Levitate>
      </Suspense>
      {hologram && <HoloStage tier={tier} reduced={reduced} y={-1.5} />}
      {!hologram && cfg.shadows && <ContactShadows position={[0, -1.15, 0]} opacity={0.5} scale={items.length * 6} blur={2.6} far={2.5} resolution={cfg.shadowRes} frames={Infinity} />}
      <OrbitControls ref={controls} makeDefault enabled={!scrollRef} enablePan={false} enableDamping={!reduced} dampingFactor={0.08}
        minDistance={2} maxDistance={14} autoRotate={autoRotate && !reduced} autoRotateSpeed={1.2}
        maxPolarAngle={Math.PI * 0.62} target={[0, hologram ? 0 : 0.2, 0]} />
      {(scrollRef || pageScroll) && <PageScroll />}
      {scrollRef ? <ScrollCam scrollRef={scrollRef} reduced={reduced} /> : <CameraRig preset={preset} reduced={reduced} controls={controls} distance={distance} />}
      <Spin on={(autoRotate && !reduced) || (hologram && !reduced)} />
    </Canvas>
  );
}
