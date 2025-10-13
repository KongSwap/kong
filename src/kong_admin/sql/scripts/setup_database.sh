#!/bin/bash
# ============================================================================
# Kong Admin Database Setup Script
# ============================================================================
# This script creates and initializes the Kong Admin PostgreSQL database.
#
# Usage:
#   ./setup_database.sh [database_name] [user]
#
# Examples:
#   ./setup_database.sh                    # Uses defaults: kong-apis, postgres
#   ./setup_database.sh my-kong-db         # Custom DB name
#   ./setup_database.sh kong-apis myuser   # Custom DB name and user
# ============================================================================

set -e  # Exit on error

# Default values
DB_NAME="${1:-kong-apis}"
DB_USER="${2:-postgres}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_SCRIPT="$SCRIPT_DIR/init_database.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "Kong Admin Database Setup"
echo "=================================================="
echo ""

# Check if PostgreSQL is running
echo -n "Checking PostgreSQL connection... "
if pg_isready -q -U "$DB_USER"; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo ""
    echo "PostgreSQL is not running or not accessible."
    echo "Please start PostgreSQL and try again."
    echo ""
    echo "Common commands:"
    echo "  macOS (Homebrew): brew services start postgresql"
    echo "  Linux (systemd):  sudo systemctl start postgresql"
    echo "  Docker:           docker start postgres"
    exit 1
fi

# Check if database exists
echo -n "Checking if database '$DB_NAME' exists... "
if psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${YELLOW}⚠ Already exists${NC}"
    echo ""
    read -p "Database '$DB_NAME' already exists. Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping database '$DB_NAME'..."
        dropdb -U "$DB_USER" "$DB_NAME" || {
            echo -e "${RED}✗ Failed to drop database${NC}"
            exit 1
        }
        echo "Creating database '$DB_NAME'..."
        createdb -U "$DB_USER" "$DB_NAME" || {
            echo -e "${RED}✗ Failed to create database${NC}"
            exit 1
        }
        echo -e "${GREEN}✓ Database recreated${NC}"
    else
        echo "Using existing database."
    fi
else
    echo -e "${YELLOW}Not found${NC}"
    echo "Creating database '$DB_NAME'..."
    createdb -U "$DB_USER" "$DB_NAME" || {
        echo -e "${RED}✗ Failed to create database${NC}"
        exit 1
    }
    echo -e "${GREEN}✓ Database created${NC}"
fi

# Check if init script exists
if [ ! -f "$INIT_SCRIPT" ]; then
    echo -e "${RED}✗ Error: Initialization script not found${NC}"
    echo "Expected location: $INIT_SCRIPT"
    exit 1
fi

# Initialize database schema
echo ""
echo "Initializing database schema..."
echo "Running: psql -U $DB_USER -d $DB_NAME -f $INIT_SCRIPT"
echo ""

psql -U "$DB_USER" -d "$DB_NAME" -f "$INIT_SCRIPT" || {
    echo -e "${RED}✗ Failed to initialize database schema${NC}"
    exit 1
}

echo ""
echo "=================================================="
echo -e "${GREEN}✓ Database setup complete!${NC}"
echo "=================================================="
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""
echo "Next steps:"
echo "  1. Update settings.json with your database credentials"
echo "  2. Run: ./kong_admin --database --mainnet"
echo "  3. Run: ./kong_admin --db_updates --mainnet"
echo ""
