# Deploying Kong Svelte to DigitalOcean App Platform

This guide explains how to deploy the Kong Svelte frontend to DigitalOcean App Platform.

## Prerequisites

1. DigitalOcean account
2. DigitalOcean CLI (`doctl`) installed (optional but recommended)
3. Your app's environment variables (API keys, etc.)

## Deployment Options

### Option 1: Deploy via GitHub Integration (Recommended)

1. **Connect GitHub Repository**
   - Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
   - Click "Create App"
   - Choose "GitHub" as source
   - Authorize DigitalOcean to access your repository
   - Select the `kongswap/swap` repository

2. **Configure Build Settings**
   - Source Directory: `/src/kong_svelte`
   - Build Command: `npm ci && npm run build`
   - Output Directory: `dist`

3. **Configure Run Settings**
   - Run Command: `npx http-server dist -p 8080 -c-1 --cors`
   - HTTP Port: `8080`

4. **Set Environment Variables**
   ```
   NODE_ENV=production
   PUBLIC_DFX_NETWORK=ic
   PUBLIC_IC_HOST=https://ic0.app
   PUBLIC_GIPHY_API_KEY=[your-key]  # If using Giphy features
   ```

5. **Choose Resources**
   - Instance: Basic ($5/month) - 1 vCPU, 512MB RAM
   - Or: Professional ($12/month) - 1 vCPU, 1GB RAM for better performance

6. **Deploy**
   - Review settings and click "Create Resources"

### Option 2: Deploy via CLI

1. **Install DigitalOcean CLI**
   ```bash
   # macOS
   brew install doctl
   
   # Or download from https://docs.digitalocean.com/reference/doctl/how-to/install/
   ```

2. **Authenticate**
   ```bash
   doctl auth init
   ```

3. **Create App**
   ```bash
   cd src/kong_svelte
   doctl apps create --spec .do/app.yaml
   ```

4. **Update App (after changes)**
   ```bash
   doctl apps update <app-id> --spec .do/app.yaml
   ```

### Option 3: Deploy via DigitalOcean Console

1. **Prepare Deployment Package**
   ```bash
   cd src/kong_svelte
   npm ci
   npm run build
   ```

2. **Create App in Console**
   - Go to [App Platform](https://cloud.digitalocean.com/apps)
   - Click "Create App"
   - Choose "DigitalOcean Container Registry" or "GitHub"
   - Upload the `.do/app.yaml` file

## Important Configuration Notes

### Environment Variables

Required environment variables for production:

```bash
# Build-time variables (needed during build)
PUBLIC_DFX_NETWORK=ic
PUBLIC_IC_HOST=https://ic0.app
PUBLIC_GIPHY_API_KEY=your_giphy_api_key  # Optional

# Runtime variables
NODE_ENV=production
```

### Static File Serving

Since this is a SvelteKit static site, we need a simple HTTP server. The deployment uses `http-server` package:

```bash
npm install --save-dev http-server
```

### CORS Configuration

The app.yaml includes CORS settings to allow canister communication:
- Allows all HTTPS origins
- Allows all standard HTTP methods
- Allows all headers

### Custom Domain

To add a custom domain:

1. In App Platform dashboard, go to Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Enable "Force HTTPS"

## Deployment Checklist

- [ ] Environment variables set correctly
- [ ] Build command includes dependency installation
- [ ] Output directory matches SvelteKit build output (`dist`)
- [ ] HTTP server configured for SPA routing (fallback to index.html)
- [ ] CORS configured for IC canister communication
- [ ] Instance size appropriate for expected traffic

## Monitoring and Logs

- View logs: App dashboard → Runtime Logs
- Monitor metrics: App dashboard → Insights
- Set up alerts for downtime or high resource usage

## Troubleshooting

### Build Failures

1. Check build logs for missing dependencies
2. Ensure all environment variables are set
3. Verify Node.js version compatibility

### Runtime Issues

1. Check runtime logs for errors
2. Verify canister endpoints are accessible
3. Check browser console for client-side errors

### Performance Issues

1. Consider upgrading instance size
2. Enable caching headers
3. Use CDN for static assets

## CI/CD Integration

For automatic deployments on push:

1. Enable GitHub integration in App Platform
2. Set deployment branch (e.g., `main` or `production`)
3. Configure auto-deploy on push

## Cost Optimization

- Start with Basic tier ($5/month)
- Monitor resource usage
- Scale up only when needed
- Consider using App Platform's autoscaling features

## Security Considerations

- Always use HTTPS
- Keep environment variables secure
- Regularly update dependencies
- Monitor for suspicious activity