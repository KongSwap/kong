<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { browser } from '$app/environment';

  // Component props
  export let containerClass = '';
  export let governanceVisible = false; // New prop to control initialization

  // ThreeJS variables
  let container: HTMLDivElement;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let tokens: THREE.Group[] = [];
  let frameId: number;
  let isInitialized = false; // Track initialization state

  // Constants for falling simulation
  const gravity = -0.0003; // Moderate gravity for continuous fall
  const fallBoundaryTop = 130;
  const fallBoundaryBottom = -130;

  // Initialize ThreeJS scene
  function initScene() {
    if (!browser || !container) return;
    
    // Create scene, camera and renderer
    scene = new THREE.Scene();
    
    // Create perspective camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.z = 30;
    
    // Create WebGL renderer with transparency
    renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x888888);
    scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Add point lights with cyberpunk colors
    const blueLight = new THREE.PointLight(0x00A4FF, 1.5, 100);
    blueLight.position.set(15, 15, 15);
    scene.add(blueLight);

    const magentaLight = new THREE.PointLight(0xFF00FF, 1.5, 100);
    magentaLight.position.set(-15, -15, 15);
    scene.add(magentaLight);

    const yellowLight = new THREE.PointLight(0xFFDC00, 1.5, 100);
    yellowLight.position.set(0, -20, 10);
    scene.add(yellowLight);

    // Create token instances
    createTokens();

    // Handle window resize
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }
    
    isInitialized = true; // Mark as initialized
  }

  // Create token geometries
  function createTokens() {
    if (!browser || !scene) return;
    
    // Load KONG logo texture
    const textureLoader = new THREE.TextureLoader();
    
    // First try with a texture that has a transparent background to show the logo clearly
    const kongTexture = textureLoader.load('/images/kong_logo.png', 
      // onLoad callback
      (texture) => {
        texture.flipY = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // Add repeat and offset to scale the texture properly to fit in a circle
        texture.repeat.set(1.0, 1.0);
        texture.offset.set(0, 0);
        texture.needsUpdate = true;
        
        // Update materials once texture is loaded
        materials.forEach(material => {
          material.map = texture;
          material.needsUpdate = true;
        });
      },
      // onProgress callback (not used)
      undefined,
      // onError callback
      (err) => {
        console.error("Error loading texture:", err);
      }
    );
    
    // Create a thin cylinder geometry for a 3D token effect
    const tokenGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.2, 32);
    
    // Materials with cyberpunk colors and logo texture
    const blueMaterial = new THREE.MeshStandardMaterial({
      color: 0x00A4FF, // Back to colored background
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x00A4FF,
      emissiveIntensity: 0.1,
      map: kongTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true
    });

    const magentaMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF00FF, // Back to colored background
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0xFF00FF,
      emissiveIntensity: 0.1,
      map: kongTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true
    });

    const yellowMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFDC00, // Back to colored background
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0xFFDC00,
      emissiveIntensity: 0.1,
      map: kongTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true
    });

    const materials = [blueMaterial, magentaMaterial, yellowMaterial];

    // Create multiple tokens with random positions
    for (let i = 0; i < 25; i++) {
      const materialIndex = i % 3;
      const material = materials[materialIndex];
      
      // Create token mesh
      const token = new THREE.Mesh(tokenGeometry, material.clone());
      
      // Random initial position (higher up)
      const x = (Math.random() - 0.5) * 20; // Spread out horizontally
      const y = 20 + Math.random() * 20; // Start above the scene
      const z = (Math.random() - 0.5) * 20; // Spread out depth-wise
      token.position.set(x, y, z);
      
      // Random initial rotation
      token.rotation.x = Math.random() * Math.PI * 2;
      token.rotation.y = Math.random() * Math.PI * 2;
      token.rotation.z = Math.random() * Math.PI * 2;
      
      // Create a group to handle rotation together
      const tokenGroup = new THREE.Group();
      tokenGroup.add(token);
      
      // Store velocity and state for animation
      const velocity = {
        rotationX: (Math.random() - 0.5) * 0.02,
        rotationY: (Math.random() - 0.5) * 0.02,
        positionX: (Math.random() - 0.5) * 0.01, // Reduced initial horizontal drift
        positionY: -Math.random() * 0.05, // Small random initial downward speed
        positionZ: (Math.random() - 0.5) * 0.01 // Reduced initial depth drift
      };
      
      // Store references for animation
      (tokenGroup as any).token = token;
      (tokenGroup as any).velocity = velocity;
      
      scene.add(tokenGroup);
      tokens.push(tokenGroup);
    }
  }

  // Animation loop
  function animate() {
    if (!browser || !scene || !camera || !renderer) return;
    
    frameId = requestAnimationFrame(animate);
    
    // Adjust camera for better view of falling tokens (Simplified)
    camera.position.y = 10; // Fixed higher Y position
    camera.lookAt(0, -5, 0); // Look slightly down for continuous stream
    
    // Animate each token group
    tokens.forEach(group => {
      // Get token and velocity data
      const token = (group as any).token;
      const velocity = (group as any).velocity;

      // Apply gravity
      velocity.positionY += gravity;
      
      // Update position
      group.position.x += velocity.positionX;
      group.position.y += velocity.positionY;
      group.position.z += velocity.positionZ;
      
      // Apply rotation (using group's rotation)
      group.rotation.x += velocity.rotationX;
      group.rotation.y += velocity.rotationY;

      // Check if token has fallen below the bottom boundary
      if (group.position.y < fallBoundaryBottom) {
        // Reset position to the top with random horizontal/depth offset
        group.position.y = fallBoundaryTop;
        group.position.x = (Math.random() - 0.5) * 20; 
        group.position.z = (Math.random() - 0.5) * 20;
        
        // Reset vertical velocity to ensure downward movement
        velocity.positionY = -Math.random() * 0.05; 
        // Optionally reset horizontal/rotational velocity too
        velocity.positionX = (Math.random() - 0.5) * 0.01;
      }
    });
    
    renderer.render(scene, camera);
  }

  // Handle window resize
  function handleResize() {
    if (!browser || !container || !camera || !renderer) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // Cleanup
  function cleanup() {
    if (!browser) return;
    
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    
    if (renderer && container && container.contains(renderer.domElement)) {
      renderer.dispose();
      container.removeChild(renderer.domElement);
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
    }
  }

  // Lifecycle hooks
  onMount(() => {
    if (browser && container) {
      initScene();
      animate();
    }
  });

  onDestroy(() => {
    cleanup();
  });

  // Reactive statement to initialize when visible
  $: if (browser && container && governanceVisible && !isInitialized) {
    initScene();
    animate();
  }
</script>

<div bind:this={container} class={`token-animation-container ${containerClass}`}></div>

<style scoped>
  .token-animation-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }
</style> 