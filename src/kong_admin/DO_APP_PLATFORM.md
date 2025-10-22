# DigitalOcean App Platform Deployment Guide

## Quick Fix for Current Issue

The error you're seeing is because:
1. **HTTP Health Check Failed**: App Platform expects an HTTP server on port 8080, but kong_admin is a worker (no HTTP)
2. **Database Timeout**: Connection timeout is too short (10s → 30s)

### Fix Steps

1. **Rebuild and push the updated image:**
```bash
cd src/kong_admin
./push-to-do.sh
```

2. **Update App Platform settings:**
   - Go to your app in DigitalOcean dashboard
   - Click "Settings" → "Components" → "kong-admin"
   - Change **Component Type** from "Service" to "Worker"
   - This disables HTTP health checks (workers don't need them)
   - Save and redeploy

## Proper Deployment

### Option 1: Deploy as Worker (Recommended)

**In DigitalOcean Dashboard:**

1. **Create/Edit App**
   - Go to Apps → Your App → Settings
   - Component Settings → **Type: Worker**

2. **Configure Environment Variables**
   ```
   KONG_DATABASE_HOST=your-db-host.db.ondigitalocean.com
   KONG_DATABASE_PORT=25061
   KONG_DATABASE_USER=doadmin
   KONG_DATABASE_PASSWORD=********
   KONG_DATABASE_DB_NAME=apidbpool
   KONG_DATABASE_MAX_CONNECTIONS=14
   KONG_DATABASE_CONNECTION_TIMEOUT_SECS=30
   KONG_DB_UPDATES_DELAY_SECS=3
   ```

3. **Database Access**
   - Ensure your database allows connections from App Platform
   - Add App Platform to database's "Trusted Sources"
   - Or use "Apps & Databases in same VPC"

### Option 2: Use App Spec (Advanced)

```bash
# Deploy using the included app.yaml
doctl apps create --spec src/kong_admin/.do/app.yaml

# Or update existing app
doctl apps update <APP_ID> --spec src/kong_admin/.do/app.yaml
```

## Database Connection Issues

### Fix "Timeout(Create)" Error

**1. Check Database Firewall:**
```bash
# Get your app's outbound IPs
doctl apps list
doctl apps get <APP_ID>

# Add to database trusted sources
# Go to: Databases → Your DB → Settings → Trusted Sources
# Add: "All App Platform apps in same region"
```

**2. Increase Timeout:**
Already updated in Dockerfile to 30 seconds:
```dockerfile
ENV KONG_DATABASE_CONNECTION_TIMEOUT_SECS=30
```

**3. Test Database Connection:**
```bash
# SSH into a test container
docker run -it --rm ubuntu:22.04 bash

# Install postgresql client
apt-get update && apt-get install -y postgresql-client

# Test connection
psql -h your-db-host.db.ondigitalocean.com \
     -p 25061 \
     -U doadmin \
     -d apidbpool
```

### Common Database Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `Timeout(Create)` | Firewall blocking | Add App Platform to trusted sources |
| `Connection refused` | Wrong host/port | Verify database connection string |
| `Authentication failed` | Wrong credentials | Check username/password in env vars |
| `SSL required` | Database requires SSL | CA cert is included in image |

## Health Check Configuration

### Worker Health Check (Current)

The Dockerfile includes a built-in health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /app/healthcheck.sh
```

This checks if the process is running (no HTTP required).

### Disable HTTP Health Check in App Platform

**Via Dashboard:**
1. Settings → Components → kong-admin
2. **Type**: Worker (not Service)
3. Save

**Via App Spec:**
```yaml
workers:
  - name: kong-admin-worker
    health_check:
      http_path: null  # Disable HTTP checks
```

## Monitoring & Logs

### View Logs

**DigitalOcean Dashboard:**
- Apps → Your App → Runtime Logs

**CLI:**
```bash
# Get app ID
doctl apps list

# Stream logs
doctl apps logs <APP_ID> --type RUN --follow

# Filter for errors
doctl apps logs <APP_ID> --type RUN | grep -i error
```

### Key Log Messages

✅ **Success:**
```
✓ Settings loaded from environment variables
Database pool created with max_connections: 14
Loading tokens and pools from database
DB update successful, last_id: 12345
```

❌ **Failure:**
```
Environment variables incomplete: Missing required...
Failed to load settings from both sources
Error: Timeout(Create)
```

## Resource Configuration

### Instance Sizes

| Size | RAM | vCPU | Monthly Cost | Recommended For |
|------|-----|------|--------------|-----------------|
| basic-xxs | 512MB | 0.5 | $5 | Testing |
| basic-xs | 1GB | 1 | $10 | Light production |
| basic-s | 2GB | 1 | $20 | Production |

**Current setting:** `basic-xxs` (512MB)

**Adjust if needed:**
- Settings → Components → kong-admin → Resources
- Select appropriate size

### Scaling

For higher throughput:
1. Increase `KONG_DATABASE_MAX_CONNECTIONS`
2. Upgrade instance size
3. Or use multiple instances (increase count)

## Troubleshooting

### App Won't Start

**Check logs first:**
```bash
doctl apps logs <APP_ID> --type BUILD
doctl apps logs <APP_ID> --type RUN
```

**Common fixes:**
1. Verify all required env vars are set
2. Check database firewall rules
3. Increase connection timeout
4. Ensure Component Type is "Worker"

### Database Connection Fails

**1. Test from local machine:**
```bash
docker run -it --rm \
  -e KONG_DATABASE_HOST=your-db-host \
  -e KONG_DATABASE_PORT=25061 \
  -e KONG_DATABASE_USER=doadmin \
  -e KONG_DATABASE_PASSWORD=your-password \
  -e KONG_DATABASE_DB_NAME=apidbpool \
  registry.digitalocean.com/kongswap-container-registry/kong_admin:latest
```

**2. Check database access:**
- Database → Settings → Trusted Sources
- Add "All App Platform apps"

**3. Verify credentials:**
- Double-check env vars in App Platform
- Test with `psql` client

### Health Check Fails

**1. Ensure Component Type is Worker:**
- Settings → Components → Type: Worker

**2. Check start period:**
- App needs 60s to initialize
- Start period allows this

**3. View health check logs:**
```bash
doctl apps logs <APP_ID> --type RUN | grep -i health
```

## Cost Optimization

### Current Costs
- **App Instance**: $5/month (basic-xxs)
- **Container Registry**: Free (1 repo)
- **Total**: ~$5/month

### Tips
1. Use smallest instance that works
2. Clean up old registry images
3. Optimize connection pool size
4. Monitor resource usage

## Updates & Rollbacks

### Deploy Update

```bash
# 1. Build and push new image
cd src/kong_admin
./push-to-do.sh

# 2. Trigger redeploy in App Platform
# Dashboard: Apps → Your App → Actions → Force Rebuild
# Or via CLI:
doctl apps create-deployment <APP_ID>
```

### Rollback

```bash
# List deployments
doctl apps list-deployments <APP_ID>

# Rollback to previous
doctl apps get-deployment <APP_ID> <DEPLOYMENT_ID>
```

### Zero-Downtime Updates

App Platform automatically does rolling updates:
1. Starts new instance
2. Waits for health check
3. Terminates old instance

## Best Practices

1. ✅ Use Worker type (not Service)
2. ✅ Set appropriate health check timeout
3. ✅ Configure database firewall properly
4. ✅ Use environment variables (not hardcoded)
5. ✅ Monitor logs regularly
6. ✅ Test locally before deploying
7. ✅ Tag images with versions
8. ✅ Keep connection pool reasonable
