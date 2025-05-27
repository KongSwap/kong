#!/bin/bash

echo "🧹 Cleaning build artifacts..."

# Navigate to the kong_svelte directory
cd src/kong_svelte

# Remove old build artifacts
rm -rf dist
rm -rf .svelte-kit
rm -rf node_modules/.vite

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building the application..."
npm run build

echo "✅ Build complete!"

# Check if dist directory was created
if [ -d "dist" ]; then
    echo "📁 Build output directory created successfully"
    echo "📋 Contents of dist/_app/immutable/chunks:"
    ls -la dist/_app/immutable/chunks/ | head -20
else
    echo "❌ Error: dist directory not created"
    exit 1
fi 