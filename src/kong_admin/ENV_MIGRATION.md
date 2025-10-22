# Environment Variables Migration Guide

Kong Admin now supports configuration via environment variables with automatic fallback to `settings.json`.

## Quick Start

### Option 1: Using .env File (Recommended)

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your configuration
vim .env

# Run the application - it will automatically load from .env
cargo run -- --db_updates
```

### Option 2: Export Environment Variables

```bash
# Export variables in your shell
export KONG_DATABASE_HOST=your-db-host.com
export KONG_DATABASE_PORT=25061
export KONG_DATABASE_USER=your-username
export KONG_DATABASE_PASSWORD=your-password
export KONG_DATABASE_DB_NAME=your-database
export KONG_DATABASE_CA_CERT=./ca-certificate-dbpool.crt
export KONG_DATABASE_MAX_CONNECTIONS=20
export KONG_DATABASE_CONNECTION_TIMEOUT_SECS=5
export KONG_DB_UPDATES_DELAY_SECS=3

# Run the application
cargo run -- --db_updates
```

### Option 3: Legacy settings.json (Fallback)

```bash
# If no environment variables are set, automatically falls back to settings.json
cargo run -- --db_updates
```

## Environment Variable Reference

All variables use the `KONG_` prefix:

### Core Settings

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `KONG_DB_UPDATES_DELAY_SECS` | u64 | No | 60 | Database polling interval in seconds |
| `KONG_DFX_PEM_FILE` | String | No | None | DFX identity file path (for --kong_data/--kong_backend) |

### Database Settings

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `KONG_DATABASE_HOST` | String | Yes | - | Database hostname or IP address |
| `KONG_DATABASE_PORT` | u16 | Yes | - | Database port number |
| `KONG_DATABASE_USER` | String | Yes | - | Database username |
| `KONG_DATABASE_PASSWORD` | String | Yes | - | Database password |
| `KONG_DATABASE_DB_NAME` | String | Yes | - | Database name |
| `KONG_DATABASE_CA_CERT` | String | No | None | Path to TLS CA certificate |
| `KONG_DATABASE_MAX_CONNECTIONS` | usize | No | 16 | Maximum connections in pool |
| `KONG_DATABASE_CONNECTION_TIMEOUT_SECS` | u64 | No | 5 | Connection timeout in seconds |

## Configuration Priority

The application loads configuration in this order:

1. **Environment Variables** (highest priority)
   - Loads from `.env` file if present
   - Then loads from system environment
   - Uses `KONG_` prefix for all variables

2. **settings.json** (fallback)
   - Used if environment variables are incomplete
   - Legacy configuration method

## Security Best Practices

### ✅ DO

- Use `.env` files for local development
- Use environment variables in production (Docker, Kubernetes, etc.)
- Keep `.env` files out of version control (already in `.gitignore`)
- Use different `.env` files for different environments
- Rotate database passwords regularly

### ❌ DON'T

- Commit `.env` files to git
- Share `.env` files via chat/email
- Use the same credentials across environments
- Store production credentials in `settings.json`

## Docker Deployment

```dockerfile
# Dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/kong_admin /usr/local/bin/
CMD ["kong_admin", "--db_updates"]
```

```bash
# Run with environment variables
docker run -d \
  -e KONG_DATABASE_HOST=prod-db.example.com \
  -e KONG_DATABASE_PORT=5432 \
  -e KONG_DATABASE_USER=kong \
  -e KONG_DATABASE_PASSWORD=secure-password \
  -e KONG_DATABASE_DB_NAME=kong_prod \
  -e KONG_DATABASE_CA_CERT=/certs/ca.crt \
  -e KONG_DB_UPDATES_DELAY_SECS=10 \
  -v /path/to/certs:/certs \
  kong_admin
```

## Kubernetes Deployment

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kong-admin-secrets
type: Opaque
stringData:
  KONG_DATABASE_PASSWORD: your-secure-password

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-admin-config
data:
  KONG_DATABASE_HOST: "prod-db.example.com"
  KONG_DATABASE_PORT: "5432"
  KONG_DATABASE_USER: "kong"
  KONG_DATABASE_DB_NAME: "kong_prod"
  KONG_DB_UPDATES_DELAY_SECS: "10"
  KONG_DATABASE_MAX_CONNECTIONS: "20"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong-admin
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kong-admin
  template:
    metadata:
      labels:
        app: kong-admin
    spec:
      containers:
      - name: kong-admin
        image: kong_admin:latest
        envFrom:
        - configMapRef:
            name: kong-admin-config
        - secretRef:
            name: kong-admin-secrets
```

## Troubleshooting

### Application won't start

Check logs for specific error messages:

```bash
# Enable debug logging
RUST_LOG=kong_admin=debug cargo run -- --db_updates
```

### Settings loaded from wrong source

The application logs which source it's using:

```
✓ Settings loaded from environment variables
```

or

```
Environment variables incomplete: ...
Falling back to settings.json
```

### Environment variables not loading from .env

1. Verify `.env` file exists in working directory
2. Check file permissions: `chmod 600 .env`
3. Verify variable names use `KONG_` prefix
4. Check for syntax errors in `.env` file

### Database connection fails

1. Verify all required database variables are set
2. Test database connectivity: `psql -h $KONG_DATABASE_HOST -p $KONG_DATABASE_PORT -U $KONG_DATABASE_USER`
3. Check CA certificate path if using TLS
4. Verify firewall rules allow connection

## Migration from settings.json

### Step 1: Create .env file

```bash
cp .env.example .env
```

### Step 2: Copy values from settings.json

```bash
# settings.json values → .env variables
db_updates_delay_secs → KONG_DB_UPDATES_DELAY_SECS
dfx_pem_file → KONG_DFX_PEM_FILE
database.host → KONG_DATABASE_HOST
database.port → KONG_DATABASE_PORT
database.user → KONG_DATABASE_USER
database.password → KONG_DATABASE_PASSWORD
database.ca_cert → KONG_DATABASE_CA_CERT
database.db_name → KONG_DATABASE_DB_NAME
database.max_connections → KONG_DATABASE_MAX_CONNECTIONS
database.connection_timeout_secs → KONG_DATABASE_CONNECTION_TIMEOUT_SECS
```

### Step 3: Test

```bash
cargo run -- --db_updates
```

Verify logs show: `✓ Settings loaded from environment variables`

### Step 4: Remove settings.json (Optional)

Once confirmed working, you can remove `settings.json`:

```bash
# Keep as backup first
mv settings.json settings.json.backup

# Test application still works
cargo run -- --db_updates

# If successful, delete backup
rm settings.json.backup
```

## Development Workflow

### Local Development

```bash
# Use .env for local settings
cp .env.example .env
# Edit with local database credentials
cargo run -- --db_updates
```

### Staging Environment

```bash
# Use staging-specific .env
cp .env.example .env.staging
# Edit with staging credentials
export $(cat .env.staging | xargs)
cargo run -- --db_updates
```

### Production Deployment

```bash
# Use environment variables (not .env files)
# Set via CI/CD, Kubernetes secrets, or container orchestration
export KONG_DATABASE_HOST=prod-db.internal
export KONG_DATABASE_PASSWORD=$(vault read -field=password secret/kong/db)
cargo run --release -- --db_updates
```

## Backward Compatibility

The implementation maintains **100% backward compatibility**:

- Existing `settings.json` files continue to work
- No changes required to deployment scripts
- Gradual migration path supported
- Zero downtime during transition

## Support

For issues or questions:
1. Check logs with `RUST_LOG=kong_admin=debug`
2. Verify all required variables are set
3. Test database connectivity independently
4. Review this guide's troubleshooting section
