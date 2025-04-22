/**
 * This script helps build and copy the worker scripts to the public directory
 * 
 * You would typically add this script to your build process, e.g., in package.json:
 * "scripts": {
 *   "build:workers": "node src/lib/workers/buildWorkers.js",
 *   "build": "npm run build:workers && vite build"
 * }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const WORKER_DIR = path.join(__dirname);
const OUTPUT_DIR = path.join(__dirname, '../../../static/workers');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Created output directory: ${OUTPUT_DIR}`);
}

// Helper function to build a worker
function buildWorker(workerFileName) {
  const workerPath = path.join(WORKER_DIR, workerFileName);
  const workerBaseName = path.basename(workerFileName, '.ts');
  const outputPath = path.join(OUTPUT_DIR, `${workerBaseName}.js`);
  
  try {
    // Use esbuild to bundle the worker (assuming it's installed)
    // This command will bundle the worker and all its dependencies into a single file
    execSync(
      `npx esbuild ${workerPath} --bundle --format=esm --outfile=${outputPath}`
    );
    
    console.log(`Built worker: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to build worker ${workerFileName}:`, error.message);
    return false;
  }
}

// Find all worker files
const workerFiles = fs.readdirSync(WORKER_DIR)
  .filter(file => file.endsWith('.ts') && file.includes('Worker'));

// Build all workers
let success = true;
for (const workerFile of workerFiles) {
  const result = buildWorker(workerFile);
  if (!result) success = false;
}

if (success) {
  console.log('All workers built successfully!');
  process.exit(0);
} else {
  console.error('Some workers failed to build.');
  process.exit(1);
} 