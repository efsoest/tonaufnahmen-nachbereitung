#!/bin/bash

# Define paths
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="Tonaufnahmen-Nachbereitung.exe"
TARGET_DIR="/Users/mklassen/Library/CloudStorage/SynologyDrive-EFSS-MediaTEAM/Technik/Tontechnik/Tools/Tonaufnahmen-Nachbereitung"

echo "Deploying $SCRIPT_NAME..."

# Build the executable first
echo "Building the executable with bun..."
cd "$SOURCE_DIR"
bun run export

# Check if build was successful and source exists
if [ ! -f "$SOURCE_DIR/$SCRIPT_NAME" ]; then
    echo "Error: Source executable $SOURCE_DIR/$SCRIPT_NAME not found after build."
    exit 1
fi

# Create target directory if it doesn't exist (just in case)
mkdir -p "$TARGET_DIR"

# Copy the executable
echo "Copying the executable to $TARGET_DIR..."
cp "$SOURCE_DIR/$SCRIPT_NAME" "$TARGET_DIR/"

# Copy config.yml if it exists, to provide a default config in the target dir
if [ -f "$SOURCE_DIR/config.yml" ]; then
    echo "Copying config.yml to $TARGET_DIR..."
    cp "$SOURCE_DIR/config.yml" "$TARGET_DIR/"
fi

# Check if copy was successful
if [ $? -eq 0 ]; then
    echo "Success! The compiled executable has been updated in the target directory."
else
    echo "Error: Failed to copy the executable."
    exit 1
fi
