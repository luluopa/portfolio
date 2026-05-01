"use client";

import { useRef, useMemo, useState, useEffect, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type LoadingCompletePayload } from "./LoadingScreen";

// Shader optimized for thin energy lines
const PulseShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#ffffff") },
    uPulseColor: { value: new THREE.Color("#ffffff") },
    uProgress: { value: 0 },
    uClipRadius: { value: 0.15 }, 
    uOrigin: { value: new THREE.Vector3(0, 0, 0) },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vLocalPosition;
    void main() {
      vUv = uv;
      vLocalPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uPulseColor;
    uniform float uProgress;
    uniform float uClipRadius;
    uniform vec3 uOrigin;
    varying vec2 vUv;
    varying vec3 vLocalPosition;

    void main() {
      if (vUv.x > uProgress) discard;

      // Distance-based clipping for the start point
      float dist = distance(vLocalPosition.xy, uOrigin.xy);
      if (dist < uClipRadius) discard;

      // Soften the edge fade
      float edgeFade = smoothstep(uClipRadius, uClipRadius + 0.1, dist);
      float baseOpacity = 0.05 * edgeFade;
      
      // Energy bursts moving along the line - SLOWER
      float pulse = fract(vUv.x * 2.0 - uTime * 0.5);
      pulse = pow(pulse, 40.0) * 0.6;
      
      // The "Spark" at the tip - SMOOTHER
      float tipDist = abs(vUv.x - uProgress);
      float spark = 1.0 - smoothstep(0.0, 0.03, tipDist);
      spark = pow(spark, 3.0) * 1.2;

      // Final energy pulse/burst logic - SLOWER
      float burst = fract(vUv.x * 1.0 - uTime * 0.3 + 0.5);
      burst = pow(burst, 60.0) * 0.5;

      float finalEnergy = max(max(pulse, burst), spark) * edgeFade;
      
      // Increase brightness near the tip (the "energy head")
      vec3 finalColor = uColor + (uPulseColor * finalEnergy * 8.0);
      
      // Add a slight glow boost when progress is high (reaching target)
      float reachBoost = smoothstep(0.95, 1.0, uProgress) * spark * 2.0;
      finalColor += uPulseColor * reachBoost;

      float finalOpacity = baseOpacity + finalEnergy * 0.6 + reachBoost;

      gl_FragColor = vec4(finalColor, finalOpacity);
    }
  `,
};

const PathfindingPipe = memo(function PathfindingPipe({ 
  origin, 
  target, 
  id, 
  onReached,
  startTime: globalStartTime
}: { 
  origin: THREE.Vector3; 
  target: THREE.Vector3; 
  id: string;
  onReached: (id: string) => void;
  startTime: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const stateRef = useRef({
    isActivated: false,
    hasReached: false,
    localStartTime: 0,
    lastIteration: 0
  });
  
  const [iteration, setIteration] = useState(0);

  const idHash = useMemo(() => id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0), [id]);

  const curve = useMemo(() => {
    // Only rebuild if coordinates or iteration change
    const startPoint = new THREE.Vector3(origin.x, origin.y, origin.z);
    const endPoint = new THREE.Vector3(target.x, target.y, target.z);
    const points = [startPoint];
    const seed = (idHash * 7.7) + (iteration * 13.33);
    const rnd = (s: number) => (Math.sin(s) + 1) / 2;
    const isFromSide = Math.abs(origin.x) > 2.0; 
    
    if (isFromSide) {
      const laneX = THREE.MathUtils.lerp(origin.x, target.x, 0.2 + rnd(seed) * 0.3);
      points.push(new THREE.Vector3(laneX, origin.y, origin.z));
      const midY = THREE.MathUtils.lerp(origin.y, target.y, 0.4 + rnd(seed + 1) * 0.2);
      points.push(new THREE.Vector3(laneX, midY, THREE.MathUtils.lerp(origin.z, target.z, 0.3)));
      const secondX = THREE.MathUtils.lerp(laneX, target.x, 0.5 + rnd(seed + 2) * 0.3);
      points.push(new THREE.Vector3(secondX, midY, THREE.MathUtils.lerp(origin.z, target.z, 0.6)));
      points.push(new THREE.Vector3(secondX, target.y, THREE.MathUtils.lerp(origin.z, target.z, 0.8)));
    } else {
      const firstX = origin.x + (rnd(seed) - 0.5) * 2.0;
      points.push(new THREE.Vector3(firstX, origin.y, origin.z));
      const midY = THREE.MathUtils.lerp(origin.y, target.y, 0.3 + rnd(seed + 1) * 0.3);
      const midX = firstX + (rnd(seed + 2) - 0.5) * 1.5;
      points.push(new THREE.Vector3(firstX, midY, origin.z));
      points.push(new THREE.Vector3(midX, midY, THREE.MathUtils.lerp(origin.z, target.z, 0.3)));
      const secondY = THREE.MathUtils.lerp(origin.y, target.y, 0.6 + rnd(seed + 3) * 0.2);
      points.push(new THREE.Vector3(midX, secondY, THREE.MathUtils.lerp(origin.z, target.z, 0.6)));
      points.push(new THREE.Vector3(target.x, secondY, THREE.MathUtils.lerp(origin.z, target.z, 0.85)));
    }
    
    points.push(endPoint);
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i+1]));
    }
    return path;
  }, [origin.x, origin.y, origin.z, target.x, target.y, target.z, idHash, iteration]);

  const geometry = useMemo(() => {
    // Reduced segments (160 -> 64) for performance during scroll
    const geo = new THREE.TubeGeometry(curve, 64, 0.0018, 6, false);
    return geo;
  }, [curve]);

  useEffect(() => {
    return () => {
      if (geometry) geometry.dispose();
    };
  }, [geometry]);

  const uniforms = useMemo(() => {
    const u = THREE.UniformsUtils.clone(PulseShader.uniforms);
    u.uColor.value = new THREE.Color("#18181b"); 
    u.uPulseColor.value = new THREE.Color("#ffffff"); 
    const isFromCenter = Math.abs(origin.x) < 2.0;
    u.uClipRadius.value = isFromCenter ? 0.25 : 0.0;
    return { ...u, uOrigin: { value: origin.clone() } };
  }, [origin.x, origin.y, origin.z]); 

  useEffect(() => {
    return () => {
      if (materialRef.current) materialRef.current.dispose();
    };
  }, []);

  useFrame((state) => {
    // Always update time for shader effects
    uniforms.uTime.value = state.clock.elapsedTime;

    if (globalStartTime > 0) {
      const camY = state.camera.position.y;
      const distToCam = Math.abs(target.y - camY);
      const isBackground = id.startsWith("bg-");
      
      // Proximity activation - Background pipes activate much earlier or instantly
      if (!stateRef.current.isActivated) {
        const activationRange = isBackground ? 100 : 12; // 100 is almost global
        
        if (isBackground || id.startsWith("hero") || id.startsWith("nav") || distToCam < activationRange) {
          stateRef.current.isActivated = true;
          stateRef.current.localStartTime = state.clock.elapsedTime;
        }
        return;
      }

      const timeSinceStart = state.clock.elapsedTime - stateRef.current.localStartTime;
      const pipeDelay = iteration === 0 ? (idHash % 4) * 0.2 : 0.1; 
      const growthTime = timeSinceStart - pipeDelay;
      
      const progress = Math.min(Math.max(growthTime * 0.8, 0), 1);
      uniforms.uProgress.value = progress;

      if (progress >= 1 && !stateRef.current.hasReached) {
        stateRef.current.hasReached = true;
        onReached(id);
      }

      // Reset logic for all pipes to keep background dynamic
      const isPersistent = id.startsWith("hero") || id.startsWith("nav");
      const idHashVal = idHash; 
      
      // Background pipes reset very fast (1-3s) to maintain a diffuse background flow
      const resetThreshold = isBackground 
        ? 1.0 + (idHashVal % 2) 
        : isPersistent 
          ? 15.0 + (idHashVal % 10) 
          : 8.0 + (idHashVal % 5);
      
      if (progress >= 1 && growthTime > resetThreshold) {
        stateRef.current.lastIteration += 1;
        stateRef.current.localStartTime = state.clock.elapsedTime;
        stateRef.current.hasReached = false;
        setIteration(stateRef.current.lastIteration);
      }
    }
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={PulseShader.vertexShader}
        fragmentShader={PulseShader.fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
});

export type PipeTarget = {
  id: string;
  x: number;
  y: number;
  z?: number;
};

export function PipeSystem({ 
  ignition,
  targets, 
  onTargetReached 
}: { 
  ignition: LoadingCompletePayload | null;
  targets: PipeTarget[]; 
  onTargetReached: (id: string) => void;
}) {
  const { viewport } = useThree();
  const [startTime, setStartTime] = useState<number>(0);

  // Stabilize viewport dimensions to avoid excessive re-calculations during scroll
  const stableViewport = useMemo(() => ({
    width: Math.round(viewport.width * 100) / 100,
    height: Math.round(viewport.height * 100) / 100,
  }), [viewport.width, viewport.height]);

  useFrame((state) => {
    // Start timing
    if (ignition && startTime === 0) {
      setStartTime(state.clock.elapsedTime);
    }

    // Scroll handling: Move the CAMERA instead of the group
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const windowH = typeof window !== "undefined" ? window.innerHeight : 1;
    const scrollRatio = scrollY / (windowH || 1);
    
    // Map scroll pixels to camera Y (scrolling down = camera moves down)
    // FIX: Multiply scrollRatio by stableViewport.height * 1.0 to match HTML height 1:1
    const targetCamY = -scrollRatio * stableViewport.height;
    if (!isNaN(targetCamY) && isFinite(targetCamY)) {
      state.camera.position.lerp(new THREE.Vector3(state.camera.position.x, targetCamY, state.camera.position.z), 0.1);
    }
  });

  const worldData = useMemo(() => {
    return targets.map((t, i) => {
      const depth = t.z ?? -1;
      
      const distance = 5 - depth;
      const vAtDepth = 2 * Math.tan(THREE.MathUtils.degToRad(50) / 2) * distance;
      const wAtDepth = vAtDepth * (stableViewport.width / (stableViewport.height || 1));

      const targetVec = new THREE.Vector3(
        (t.x * wAtDepth) / 2,
        (t.y * vAtDepth) / 2,
        depth
      );

      let originVec: THREE.Vector3;

      if (ignition?.origin && (t.id.startsWith("hero") || t.id.startsWith("nav"))) {
        const windowW = typeof window !== "undefined" ? window.innerWidth : 1;
        const windowH = typeof window !== "undefined" ? window.innerHeight : 1;
        const ndcX = (ignition.origin.x / (windowW || 1)) * 2 - 1;
        const ndcY = -(ignition.origin.y / (windowH || 1)) * 2 + 1;
        
        originVec = new THREE.Vector3(
          (ndcX * wAtDepth) / 2,
          (ndcY * vAtDepth) / 2,
          depth
        );
      } else if (t.id.startsWith("hero") || t.id.startsWith("nav")) {
        originVec = new THREE.Vector3(-wAtDepth * 0.6, 0, depth);
      } else {
        // Background pipes: random trajectory across the screen area
        const side = i % 2 === 0 ? 1 : -1;
        // Start from one side, go to a point on the other side or middle
        const edgeX = (side * wAtDepth) / 2 * 1.5; 
        const edgeY = targetVec.y + (Math.sin(i * 1.5) * 5.0); // More variation in start Y
        originVec = new THREE.Vector3(edgeX, edgeY, depth);
        
        // Randomize target X more for background to make them "cross" the page
        targetVec.x = -edgeX * 0.8; 
      }

      return { origin: originVec, target: targetVec };
    });
  }, [targets, stableViewport.width, stableViewport.height, ignition]);

  if (!ignition) return null;

  return (
    <group>
      {worldData.map((data, i) => (
        <PathfindingPipe 
          key={targets[i].id} 
          id={targets[i].id} 
          origin={data.origin} 
          target={data.target} 
          onReached={onTargetReached}
          startTime={startTime}
        />
      ))}
      <ambientLight intensity={0.1} />
    </group>
  );
}
