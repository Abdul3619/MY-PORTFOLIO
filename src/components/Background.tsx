import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Torus, Sphere, Environment, Sparkles } from "@react-three/drei";
import * as THREE from "three";

function Core({ isMobile }: { isMobile: boolean }) {
  const group = useRef<THREE.Group>(null);
  
  // Mouse and scroll tracking
  const mouse = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    
    const handleScroll = () => {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      scroll.current = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    };

    if (!isMobile) {
      window.addEventListener("mousemove", handleMouseMove);
    }
    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      if (!isMobile) window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  useFrame((state) => {
    if (!group.current) return;

    // Target rotation based on mouse and scroll
    const targetX = (mouse.current.y * 0.2) + (scroll.current * Math.PI);
    const targetY = (mouse.current.x * 0.3) + (scroll.current * Math.PI * 2);

    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.05);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.05);

    // Subtle breathing/floating effect
    const scale = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.03;
    group.current.scale.set(scale, scale, scale);
  });

  const sphereSegments = isMobile ? 32 : 64;

  return (
    <group ref={group}>
      <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
        <Sphere args={[1.5, sphereSegments, sphereSegments]}>
          <MeshDistortMaterial 
            color="#D4AF37" 
            envMapIntensity={2}
            clearcoat={1}
            clearcoatRoughness={0.1}
            metalness={0.8}
            roughness={0.2}
            distort={0.4}
            speed={2}
          />
        </Sphere>
      </Float>

      {/* Orbiting Rings */}
      <Ring radius={2.4} tube={0.015} speed={0.5} axis={[1, 0.5, 0]} color="#B08D57" isMobile={isMobile} />
      <Ring radius={3.0} tube={0.01} speed={-0.3} axis={[0, 1, 0.5]} color="#D4AF37" isMobile={isMobile} />
      <Ring radius={3.6} tube={0.005} speed={0.2} axis={[0.5, 0, 1]} color="#ffffff" isMobile={isMobile} />
    </group>
  );
}

function Ring({ radius, tube, speed, axis, color, isMobile }: { radius: number, tube: number, speed: number, axis: [number, number, number], color: string, isMobile: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const vec = useMemo(() => new THREE.Vector3(...axis).normalize(), [axis]);
  
  useFrame(() => {
    if (ref.current) {
      ref.current.rotateOnAxis(vec, speed * 0.01);
    }
  });

  return (
    <Torus ref={ref} args={[radius, tube, isMobile ? 16 : 32, isMobile ? 50 : 100]}>
      <meshStandardMaterial 
        color={color} 
        metalness={1} 
        roughness={0.1}
        envMapIntensity={2}
      />
    </Torus>
  );
}

export default function Background() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] bg-bg-darkest">
      <Canvas 
        camera={{ position: [0, 0, 8], fov: 45 }}
        dpr={isMobile ? [1, 1] : [1, 2]}
        gl={{ powerPreference: "high-performance", antialias: !isMobile }}
      >
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#D4AF37" />
        <directionalLight position={[-10, -10, -5]} intensity={1} color="#B08D57" />
        
        <Environment preset="city" />
        
        <Sparkles 
          count={isMobile ? 50 : 150} 
          scale={12} 
          size={isMobile ? 2 : 1.5} 
          speed={0.4} 
          opacity={0.3} 
          color="#D4AF37" 
        />

        <Core isMobile={isMobile} />
      </Canvas>
      
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_#050505_100%)] pointer-events-none" />
    </div>
  );
}

