#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="registry.digitalocean.com"
REGISTRY_NAME="kongswap-container-registry"
IMAGE_NAME="kong_admin"
BASE_IMAGE_NAME="chisel_ubuntu"
FULL_IMAGE_NAME="${REGISTRY}/${REGISTRY_NAME}/${IMAGE_NAME}"
FULL_BASE_IMAGE="${REGISTRY}/${REGISTRY_NAME}/${BASE_IMAGE_NAME}"

echo -e "${GREEN}=== Kong Admin Docker Image Builder & Pusher ===${NC}"
echo -e "${GREEN}=== DigitalOcean Container Registry ===${NC}"
echo ""

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo -e "${RED}Error: doctl is not installed.${NC}"
    echo -e "${YELLOW}Install with: brew install doctl${NC}"
    echo -e "${YELLOW}Or visit: https://docs.digitalocean.com/reference/doctl/how-to/install/${NC}"
    exit 1
fi

# Login to DigitalOcean Container Registry
echo -e "${YELLOW}Logging in to DigitalOcean Container Registry...${NC}"
doctl registry login
echo -e "${GREEN}✓ Logged in${NC}"
echo ""

# Get version tag
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEFAULT_VERSION="${TIMESTAMP}"
echo -e "${YELLOW}Enter version tag (default: ${DEFAULT_VERSION}):${NC}"
read -p "Version: " VERSION
VERSION=${VERSION:-$DEFAULT_VERSION}

# Build kong_admin image (using ubuntu:22.04 base)
echo -e "${GREEN}Step 1/2: Building kong_admin image...${NC}"
cd ../..  # Go to project root
docker build \
    -f src/kong_admin/Dockerfile.kong_admin \
    -t ${FULL_IMAGE_NAME}:${VERSION} \
    -t ${FULL_IMAGE_NAME}:latest \
    --platform linux/amd64 \
    ./src

echo -e "${GREEN}✓ kong_admin image built${NC}"
echo ""

# Show image info
echo -e "${GREEN}Built image:${NC}"
docker images | grep "kong_admin" | grep "${REGISTRY}" | head -3
echo ""

# Ask for confirmation
echo -e "${YELLOW}Ready to push the following tags:${NC}"
echo "  - ${FULL_IMAGE_NAME}:${VERSION}"
echo "  - ${FULL_IMAGE_NAME}:latest"
echo ""
read -p "Push to DigitalOcean Container Registry? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Step 2/2: Pushing kong_admin to DigitalOcean...${NC}"

    docker push ${FULL_IMAGE_NAME}:${VERSION}
    docker push ${FULL_IMAGE_NAME}:latest

    echo ""
    echo -e "${GREEN}✓ Successfully pushed to DigitalOcean Container Registry!${NC}"
    echo ""
    echo -e "${GREEN}Images:${NC}"
    echo "  ${FULL_IMAGE_NAME}:${VERSION}"
    echo "  ${FULL_IMAGE_NAME}:latest"
    echo ""
    echo -e "${GREEN}Pull command:${NC}"
    echo "  doctl registry login"
    echo "  docker pull ${FULL_IMAGE_NAME}:latest"
    echo ""
    echo -e "${GREEN}Run command:${NC}"
    echo "  docker run -d \\"
    echo "    --name kong_admin \\"
    echo "    --restart unless-stopped \\"
    echo "    --env-file .env \\"
    echo "    ${FULL_IMAGE_NAME}:latest"
    echo ""
    echo -e "${GREEN}View in DigitalOcean:${NC}"
    echo "  https://cloud.digitalocean.com/registry/kongswap-container-registry"
else
    echo -e "${YELLOW}Push cancelled.${NC}"
fi
