#!/bin/bash

# Script to update the stored user snapshot file
# Run this script when you want to update the cached data in the frontend

# Default to Railway production URL, or use localhost if provided
SERVER_URL="${1:-https://your-railway-backend.railway.app}"

echo "Fetching snapshot data from: $SERVER_URL/api/snapshot/generate"

# Fetch snapshot data from server
curl -s "$SERVER_URL/api/snapshot/generate" \
  -H "Content-Type: application/json" \
  -o ../client/public/data/stored-user-snapshot.json

if [ $? -eq 0 ]; then
  echo " Snapshot updated successfully!"
  echo "File location: client/public/data/stored-user-snapshot.json"

  # Show some stats
  RECORDS=$(cat ../client/public/data/stored-user-snapshot.json | grep -o '"historicalData":\[' | wc -l)
  echo "Snapshot contains historical data"
else
  echo " Failed to fetch snapshot data"
  exit 1
fi
