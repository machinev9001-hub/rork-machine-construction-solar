#!/bin/bash

# Backup Firebase Indexes Script
# Creates timestamped backup of firestore.indexes.json

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="firestore-index-backups"
SOURCE_FILE="firestore.indexes.json"
BACKUP_FILE="${BACKUP_DIR}/firestore.indexes.${TIMESTAMP}.json"

echo "🔄 Backing up Firestore indexes..."

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  echo "✅ Created backup directory: $BACKUP_DIR"
fi

# Check if source file exists
if [ ! -f "$SOURCE_FILE" ]; then
  echo "❌ Error: $SOURCE_FILE not found!"
  exit 1
fi

# Create backup
cp "$SOURCE_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Backup created successfully: $BACKUP_FILE"
  echo "📊 Backup size: $(du -h $BACKUP_FILE | cut -f1)"
  echo "📝 Total backups: $(ls -1 $BACKUP_DIR | wc -l)"
else
  echo "❌ Error: Failed to create backup"
  exit 1
fi

# List recent backups (last 5)
echo ""
echo "📂 Recent backups:"
ls -lt "$BACKUP_DIR" | head -6 | tail -5
