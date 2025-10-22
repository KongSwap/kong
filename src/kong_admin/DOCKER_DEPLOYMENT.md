# Kong Admin Docker Deployment Guide

## DigitalOcean Container Registry Setup

### Prerequisites

1. **GitHub Secret**: Add your DigitalOcean API token to GitHub repository secrets
   - Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`
   - Click "New repository secret"
   - Name: `DIGITALOCEAN_TOKEN`
   - Value: Your DigitalOcean API token

2. **DigitalOcean API Token**:
   - Get from: https://cloud.digitalocean.com/account/api/tokens
   - Create a token with **read and write** permissions

### Automatic Build & Push (GitHub Actions)

The workflow automatically builds and pushes to DigitalOcean Container Registry when:

1. **Push to main/master** with changes to:
   - `src/kong_admin/**`
   - `src/kong_lib/**`
   - `.github/workflows/kong_admin_docker.yml`

2. **Manual trigger**:
   - Go to Actions tab in GitHub
   - Select "Build and Push Kong Admin Docker Image"
   - Click "Run workflow"
   - Optional: Specify custom tag

### Image Tags

Images are tagged with:
- `latest` - Always points to the most recent build
- `YYYYMMDD-HHMMSS-{git-sha}` - Timestamped version

**Example tags**:
```
registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
registry.digitalocean.com/kongswap-container-registry/kong_admin:20251016-123456-a1b2c3d
```

## Manual Build & Push

### 1. Build Chisel Ubuntu Base Image

```bash
# Login to DigitalOcean Container Registry
doctl registry login

# Build and push base image
docker buildx build \
  --platform linux/amd64 \
  -t registry.digitalocean.com/kongswap-container-registry/chisel_ubuntu:latest \
  -f src/kong_admin/Dockerfile.chisel_ubuntu \
  --push \
  src/kong_admin/
```

### 2. Build Kong Admin Image

```bash
# Update Dockerfile to use DO registry base image
sed -i.bak 's|FROM chisel_ubuntu:latest|FROM registry.digitalocean.com/kongswap-container-registry/chisel_ubuntu:latest|g' src/kong_admin/Dockerfile.kong_admin

# Build and push kong_admin
docker buildx build \
  --platform linux/amd64 \
  -t registry.digitalocean.com/kongswap-container-registry/kong_admin:latest \
  -t registry.digitalocean.com/kongswap-container-registry/kong_admin:$(date +%Y%m%d-%H%M%S) \
  -f src/kong_admin/Dockerfile.kong_admin \
  --push \
  src/

# Restore original Dockerfile
mv src/kong_admin/Dockerfile.kong_admin.bak src/kong_admin/Dockerfile.kong_admin
```

## Deployment

### Pull Image from Registry

```bash
# Login to DigitalOcean Container Registry
doctl registry login

# Pull the image
docker pull registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
```

### Run with Environment Variables

```bash
docker run -d \
  --name kong_admin \
  --restart unless-stopped \
  -e KONG_DATABASE_HOST=your-db-host.com \
  -e KONG_DATABASE_PORT=25061 \
  -e KONG_DATABASE_USER=your-user \
  -e KONG_DATABASE_PASSWORD=your-password \
  -e KONG_DATABASE_DB_NAME=your-database \
  -e KONG_DATABASE_CA_CERT=/app/ca-certificate-dbpool.crt \
  -e KONG_DATABASE_MAX_CONNECTIONS=20 \
  -e KONG_DATABASE_CONNECTION_TIMEOUT_SECS=10 \
  -e KONG_DB_UPDATES_DELAY_SECS=3 \
  registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
```

### Run with .env File

```bash
# Create .env file
cat > kong_admin.env <<EOF
KONG_DATABASE_HOST=your-db-host.com
KONG_DATABASE_PORT=25061
KONG_DATABASE_USER=your-user
KONG_DATABASE_PASSWORD=your-password
KONG_DATABASE_DB_NAME=your-database
KONG_DATABASE_CA_CERT=/app/ca-certificate-dbpool.crt
KONG_DATABASE_MAX_CONNECTIONS=20
KONG_DATABASE_CONNECTION_TIMEOUT_SECS=10
KONG_DB_UPDATES_DELAY_SECS=3
EOF

# Run with env file
docker run -d \
  --name kong_admin \
  --restart unless-stopped \
  --env-file kong_admin.env \
  registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  kong_admin:
    image: registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
    container_name: kong_admin
    restart: unless-stopped
    environment:
      KONG_DATABASE_HOST: ${KONG_DATABASE_HOST}
      KONG_DATABASE_PORT: ${KONG_DATABASE_PORT}
      KONG_DATABASE_USER: ${KONG_DATABASE_USER}
      KONG_DATABASE_PASSWORD: ${KONG_DATABASE_PASSWORD}
      KONG_DATABASE_DB_NAME: ${KONG_DATABASE_DB_NAME}
      KONG_DATABASE_CA_CERT: /app/ca-certificate-dbpool.crt
      KONG_DATABASE_MAX_CONNECTIONS: 20
      KONG_DATABASE_CONNECTION_TIMEOUT_SECS: 10
      KONG_DB_UPDATES_DELAY_SECS: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## DigitalOcean Droplet Deployment

### 1. Install Docker on Droplet

```bash
# Update package list
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
```

### 2. Install doctl (DigitalOcean CLI)

```bash
# Download and install doctl
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin
```

### 3. Authenticate doctl

```bash
# Authenticate with your DigitalOcean API token
doctl auth init
```

### 4. Login to Registry and Deploy

```bash
# Login to registry
doctl registry login

# Pull and run
docker pull registry.digitalocean.com/kongswap-container-registry/kong_admin:latest

# Create env file
nano kong_admin.env
# Add your environment variables

# Run container
docker run -d \
  --name kong_admin \
  --restart unless-stopped \
  --env-file kong_admin.env \
  registry.digitalocean.com/kongswap-container-registry/kong_admin:latest

# Check logs
docker logs -f kong_admin
```

## Monitoring & Maintenance

### View Logs

```bash
# Follow logs
docker logs -f kong_admin

# Last 100 lines
docker logs --tail 100 kong_admin

# With timestamps
docker logs -t kong_admin
```

### Update to Latest

```bash
# Pull latest image
docker pull registry.digitalocean.com/kongswap-container-registry/kong_admin:latest

# Stop and remove old container
docker stop kong_admin
docker rm kong_admin

# Run new container
docker run -d \
  --name kong_admin \
  --restart unless-stopped \
  --env-file kong_admin.env \
  registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
```

### Rollback to Previous Version

```bash
# Stop current container
docker stop kong_admin
docker rm kong_admin

# Run specific version
docker run -d \
  --name kong_admin \
  --restart unless-stopped \
  --env-file kong_admin.env \
  registry.digitalocean.com/kongswap-container-registry/kong_admin:20251016-123456-a1b2c3d
```

## Troubleshooting

### Container Won't Start

```bash
# Check container status
docker ps -a

# View logs
docker logs kong_admin

# Check environment variables
docker inspect kong_admin | grep -A 20 Env
```

### Database Connection Issues

```bash
# Test database connectivity from container
docker exec kong_admin ping -c 3 your-db-host.com

# Check DNS resolution
docker exec kong_admin nslookup your-db-host.com

# Verify environment variables are set
docker exec kong_admin env | grep KONG_
```

### Registry Authentication Issues

```bash
# Re-authenticate
doctl registry login

# Check registry access
doctl registry repository list-v2
```

## Registry Management

### List Images

```bash
# List all images in registry
doctl registry repository list-v2

# List tags for kong_admin
doctl registry repository list-tags kong_admin
```

### Delete Old Images

```bash
# Delete specific tag
doctl registry repository delete-tag kong_admin 20251015-123456-a1b2c3d

# Enable garbage collection to free space
doctl registry garbage-collection start --include-untagged-manifests
```

## CI/CD Integration

The GitHub Actions workflow provides:

- ✅ Automatic builds on code changes
- ✅ Multi-stage builds for optimization
- ✅ Layer caching for faster builds
- ✅ Timestamped tags for versioning
- ✅ Latest tag for easy deployment
- ✅ Build summaries in GitHub Actions UI

**Trigger a build**:
1. Push changes to `src/kong_admin/` or `src/kong_lib/`
2. Or manually trigger from GitHub Actions tab
