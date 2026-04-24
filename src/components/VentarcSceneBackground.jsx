import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PALETTES = {
  home: ['#8fb8ff', '#dfe8ff', '#5ca0ff'],
  features: ['#8bc7ff', '#cdd9ff', '#53a6ff'],
  solutions: ['#98d2ff', '#d8e1ff', '#6cb6ff'],
  pricing: ['#e2e8ff', '#8ab7ff', '#6f93ff'],
  resources: ['#b0c7ff', '#d6e2ff', '#88b9ff'],
};

function clampPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 1.75);
}

export default function VentarcSceneBackground({ page = 'home' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const palette = PALETTES[page] || PALETTES.home;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070b, 0.026);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(clampPixelRatio());
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 1000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3;
      const radius = 5 + Math.random() * 11;
      const angle = Math.random() * Math.PI * 2;
      const lift = (Math.random() - 0.5) * 12;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = lift;
      positions[i3 + 2] = (Math.random() - 0.5) * 18;

      const color = new THREE.Color(palette[i % palette.length]);
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        size: 0.06,
        transparent: true,
        opacity: 0.8,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    root.add(particles);

    const rods = new THREE.Group();
    const rodGeometry = new THREE.BoxGeometry(0.06, 2.8, 0.06);
    for (let i = 0; i < 18; i += 1) {
      const rod = new THREE.Mesh(
        rodGeometry,
        new THREE.MeshBasicMaterial({
          color: palette[i % palette.length],
          transparent: true,
          opacity: 0.12,
        }),
      );
      rod.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 10);
      rod.rotation.set(Math.random(), Math.random() * Math.PI, Math.random() * 0.5);
      rod.scale.y = 0.6 + Math.random() * 1.8;
      rods.add(rod);
    }
    root.add(rods);

    const rings = new THREE.Group();
    const ringConfigs = [
      { radius: 4.8, tube: 0.018, color: palette[0], opacity: 0.18 },
      { radius: 7.2, tube: 0.016, color: palette[1], opacity: 0.12 },
      { radius: 9.8, tube: 0.012, color: palette[2], opacity: 0.08 },
    ];

    ringConfigs.forEach((config, index) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(config.radius, config.tube, 16, 180),
        new THREE.MeshBasicMaterial({
          color: config.color,
          transparent: true,
          opacity: config.opacity,
        }),
      );
      mesh.rotation.x = 1.08 + index * 0.18;
      mesh.rotation.y = index * 0.6;
      rings.add(mesh);
    });
    root.add(rings);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 1),
      new THREE.MeshBasicMaterial({
        color: palette[1],
        wireframe: true,
        transparent: true,
        opacity: 0.14,
      }),
    );
    root.add(core);

    const pointer = { x: 0, y: 0 };

    function onPointerMove(event) {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function resize() {
      const { clientWidth, clientHeight } = mount;
      if (!clientWidth || !clientHeight) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(clampPixelRatio());
      renderer.setSize(clientWidth, clientHeight, false);
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove);

    let frameId = 0;
    const animationStart = performance.now();

    function animate() {
      const elapsed = (performance.now() - animationStart) / 1000;
      const speed = reducedMotion ? 0.18 : 1;

      particles.rotation.y = elapsed * 0.028 * speed;
      particles.rotation.x = Math.sin(elapsed * 0.14) * 0.08;

      rods.rotation.y = elapsed * 0.05 * speed;
      rods.rotation.z = Math.sin(elapsed * 0.09) * 0.08;

      rings.rotation.z = elapsed * 0.06 * speed;
      rings.rotation.x = 1 + Math.sin(elapsed * 0.08) * 0.08;

      core.rotation.x = elapsed * 0.18 * speed;
      core.rotation.y = elapsed * 0.24 * speed;

      camera.position.x += ((pointer.x || 0) * 1.6 - camera.position.x) * 0.03;
      camera.position.y += ((-pointer.y || 0) * 0.9 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      mount.removeChild(renderer.domElement);
      particleGeometry.dispose();
      rodGeometry.dispose();
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [page]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute inset-0 ventarc-grid-mask opacity-50" />
      <div className="absolute inset-0 ventarc-radial-glow" />
      <div className="absolute inset-0 ventarc-noise opacity-[0.14]" />
    </div>
  );
}
