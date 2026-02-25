#!/usr/bin/env bash

# Get the directory where the script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================"
echo "Starting Boss Agent..."
echo "Directory: $DIR"
echo "========================================"

# Run the agent
pnpm start

# Keep the terminal window open if it fails or exits
echo ""
echo "Boss Agent process ended."
read -p "Press any key to close this window..."
