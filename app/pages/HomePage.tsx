"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import LoadingScreen, { type LoadingCompletePayload } from "./components/LoadingScreen";
import { Hero } from "./components/Hero";
import { Projects } from "./components/Projects";
import { Experience } from "./components/Experience";
import { Canvas } from "@react-three/fiber";
import { PipeSystem } from "./components/PipeSystem";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

export default function HomePage() {
  const [showLoading, setShowLoading] = useState(true);
  const [ignition, setIgnition] = useState<LoadingCompletePayload | null>(null);
  const [energized, setEnergized] = useState<Set<string>>(new Set());

  const handleLoadingComplete = useCallback((payload: LoadingCompletePayload) => {
    setIgnition(payload);
    setShowLoading(false);
  }, []);

  const handleTargetReached = useCallback((id: string) => {
    setEnergized((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (showLoading) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [showLoading]);

  // Define UI targets globally so PipeSystem can reach them across sections
  const targets = useMemo(() => [
    // Hero Section
    { id: "hero-title-1", x: -0.55, y: -0.1 },
    { id: "hero-title-2", x: -0.45, y: -0.05 },
    { id: "hero-desc-1", x: -0.6, y: -0.3 },
    { id: "hero-desc-2", x: -0.5, y: -0.4 },
    
    // Navbar
    { id: "nav-1", x: -0.4, y: 0.8 },
    { id: "nav-2", x: -0.15, y: 0.8 },
    { id: "nav-3", x: 0.15, y: 0.8 },
    { id: "nav-4", x: 0.4, y: 0.8 },
    
    // Hero Image
    { id: "hero-image-1", x: 0.5, y: -0.1 },
    { id: "hero-image-2", x: 0.55, y: 0.1 },

    // Background nodes - Distributed for even density across sections
    // Hero area
    { id: "bg-h-1", x: -0.9, y: 1.5, z: -4 },
    { id: "bg-h-2", x: 0.9, y: 1.2, z: -3 },
    { id: "bg-h-3", x: -0.95, y: 0.5, z: -2 },
    { id: "bg-h-4", x: 0.95, y: 0.0, z: -2 },
    { id: "bg-h-5", x: -0.5, y: -0.5, z: -5 },
    { id: "bg-h-6", x: 0.5, y: -0.8, z: -5 },

    // Experience area
    { id: "bg-m-1", x: -0.8, y: -2.0, z: -4 },
    { id: "bg-m-2", x: 0.8, y: -2.5, z: -4 },
    { id: "bg-m-3", x: 0, y: -3.0, z: -6 },
    { id: "bg-m-4", x: -0.7, y: -3.5, z: -3 },
    { id: "bg-m-5", x: 0.7, y: -4.0, z: -3 },
    { id: "bg-m-6", x: -0.9, y: -4.5, z: -5 },
    { id: "bg-m-7", x: 0.9, y: -5.0, z: -5 },
    { id: "bg-m-8", x: 0, y: -5.5, z: -4 },

    // Projects area
    { id: "bg-p-1", x: -0.6, y: -7.0, z: -3 },
    { id: "bg-p-2", x: 0.6, y: -8.0, z: -3 },
    { id: "bg-p-3", x: -0.8, y: -10.0, z: -6 },
    { id: "bg-p-4", x: 0.8, y: -12.0, z: -6 },
    { id: "bg-p-5", x: -0.5, y: -15.0, z: -4 },
    { id: "bg-p-6", x: 0.5, y: -18.0, z: -4 },

    // Deep background (scrolling down)
    { id: "bg-d-1", x: -0.9, y: -22.0, z: -5 },
    { id: "bg-d-2", x: 0.9, y: -26.0, z: -5 },
    { id: "bg-d-3", x: 0, y: -30.0, z: -3 },
    { id: "bg-d-4", x: -0.7, y: -35.0, z: -6 },
    { id: "bg-d-5", x: 0.7, y: -40.0, z: -4 },
    { id: "bg-d-6", x: -0.5, y: -45.0, z: -5 },
    { id: "bg-d-7", x: 0.9, y: -50.0, z: -6 },
    { id: "bg-d-8", x: -0.9, y: -55.0, z: -4 },
    { id: "bg-d-9", x: 0, y: -60.0, z: -5 },
    { id: "bg-d-10", x: 0.6, y: -65.0, z: -3 },
    { id: "bg-d-11", x: -0.6, y: -70.0, z: -4 },
    { id: "bg-d-12", x: 0.8, y: -75.0, z: -5 },
    { id: "bg-d-13", x: -0.8, y: -80.0, z: -6 },

    // Experience Section Targets
    { id: "exp-title-1", x: -0.8, y: -1.8, z: -3 },
    { id: "exp-title-2", x: 0.8, y: -2.2, z: -3 },
    { id: "exp-1", x: -0.1, y: -2.8, z: -4 },
    { id: "exp-2", x: 0.6, y: -3.2, z: -2 },
    { id: "exp-3", x: -0.4, y: -3.6, z: -3 },

    // Projects Section
    { id: "projects-title-1", x: -0.7, y: -4.5, z: -2 },
    { id: "projects-title-2", x: 0.7, y: -5.0, z: -2 },
    { id: "project-1", x: -0.3, y: -6.0, z: -4 },
    { id: "project-2", x: 0.4, y: -6.5, z: -3 },
    { id: "project-3", x: -0.5, y: -7.0, z: -4 },
    { id: "project-4", x: 0.5, y: -7.2, z: -3 },

    // Bottom nodes
    { id: "bottom-1", x: -0.5, y: -8.0, z: -5 },
    { id: "bottom-2", x: 0.5, y: -8.5, z: -4 },
    { id: "bottom-3", x: 0, y: -9.5, z: -3 },
  ], []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-black overflow-x-hidden">
      {showLoading && <LoadingScreen onComplete={handleLoadingComplete} />}
      
      {/* Global Background 3D Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <PipeSystem ignition={ignition} targets={targets} onTargetReached={handleTargetReached} />
          <EffectComposer>
            <Bloom intensity={0.4} luminanceThreshold={0.5} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>

      <div
        className={`relative z-10 transition-opacity duration-[800ms] ease-out ${
          showLoading ? "opacity-0" : "opacity-100"
        }`}
      >
        <Hero 
          ignition={ignition} 
          energized={energized} 
          targets={targets} 
        />
        <Experience energized={energized} />
        <Projects energized={energized} />
      </div>
    </main>
  );
}
