#!/bin/bash
# Health check script for DigitalOcean App Platform
# Checks if the kong_admin process is running

if pgrep -f "/app/kong_admin" > /dev/null; then
    exit 0  # Process is running
else
    exit 1  # Process is not running
fi
