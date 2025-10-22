# Push Kong Admin to DigitalOcean Container Registry

## Quick Start

```bash
cd src/kong_admin
./push-to-do.sh
```

## What the Script Does

1. **Checks Prerequisites**: Verifies `doctl` is installed
2. **Authenticates**: Logs in to DigitalOcean Container Registry
3. **Builds Base Image**: Creates `chisel_ubuntu:latest` base image
4. **Pushes Base**: Uploads base image to registry
5. **Builds App**: Creates `kong_admin` with timestamped version
6. **Pushes App**: Uploads both `latest` and versioned tags

## Images Created

```
registry.digitalocean.com/kongswap-container-registry/chisel_ubuntu:latest
registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
registry.digitalocean.com/kongswap-container-registry/kong_admin:YYYYMMDD-HHMMSS
```

## Prerequisites

### Install doctl (DigitalOcean CLI)

**macOS:**
```bash
brew install doctl
```

**Linux:**
```bash
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin
```

### Authenticate doctl

```bash
# Get your API token from: https://cloud.digitalocean.com/account/api/tokens
doctl auth init
```

## Usage

### Basic Push

```bash
cd src/kong_admin
./push-to-do.sh
```

Follow the prompts:
- Enter version tag (or press Enter for auto-generated timestamp)
- Confirm push (y/N)

### Custom Version

```bash
cd src/kong_admin
./push-to-do.sh
# When prompted, enter: v1.0.0
```

## Deploy on Server

Once pushed, deploy on your DigitalOcean droplet:

```bash
# On your server
doctl registry login
docker pull registry.digitalocean.com/kongswap-container-registry/kong_admin:latest

# Run with environment variables
docker run -d \
  --name kong_admin \
  --restart unless-stopped \
  -e KONG_DATABASE_HOST=your-db-host \
  -e KONG_DATABASE_PORT=25061 \
  -e KONG_DATABASE_USER=doadmin \
  -e KONG_DATABASE_PASSWORD=your-password \
  -e KONG_DATABASE_DB_NAME=apidbpool \
  -e KONG_DATABASE_CA_CERT=/app/ca-certificate-dbpool.crt \
  -e KONG_DATABASE_MAX_CONNECTIONS=20 \
  -e KONG_DB_UPDATES_DELAY_SECS=3 \
  registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
```

## View Images in Registry

```bash
# List all repositories
doctl registry repository list-v2

# List tags for kong_admin
doctl registry repository list-tags kong_admin

# List tags for chisel_ubuntu
doctl registry repository list-tags chisel_ubuntu
```

## Troubleshooting

### doctl not found

```bash
# Install doctl
brew install doctl  # macOS
# or download from https://github.com/digitalocean/doctl/releases
```

### Authentication failed

```bash
# Re-authenticate
doctl auth init

# Then login to registry
doctl registry login
```

### Build fails

```bash
# Make sure you're in the right directory
cd src/kong_admin

# Check Docker is running
docker ps

# Clean up and retry
docker system prune -f
./push-to-do.sh
```

### Push fails

```bash
# Re-login to registry
doctl registry login

# Check registry quota
doctl registry get

# Retry push
./push-to-do.sh
```

## Manual Commands

If you prefer manual control:

```bash
# 1. Login
doctl registry login

# 2. Build base image
docker build \
  -f Dockerfile.chisel_ubuntu \
  -t registry.digitalocean.com/kongswap-container-registry/chisel_ubuntu:latest \
  --platform linux/amd64 \
  .

# 3. Push base image
docker push registry.digitalocean.com/kongswap-container-registry/chisel_ubuntu:latest

# 4. Build kong_admin (from project root)
cd ../..
docker build \
  -f src/kong_admin/Dockerfile.kong_admin \
  -t registry.digitalocean.com/kongswap-container-registry/kong_admin:latest \
  --platform linux/amd64 \
  ./src

# 5. Push kong_admin
docker push registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
```

## Registry Management

### Delete old images

```bash
# List tags
doctl registry repository list-tags kong_admin

# Delete specific tag
doctl registry repository delete-tag kong_admin 20251015-120000

# Run garbage collection
doctl registry garbage-collection start --include-untagged-manifests
```

### Check registry space

```bash
doctl registry get
```
