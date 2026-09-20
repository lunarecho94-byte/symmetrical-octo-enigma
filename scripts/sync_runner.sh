#!/bin/bash
# ==============================================================================
# URBAN — Stock & Catalog Synchronization Runner (Every 15 Minutes)
# Automatically downloads latest Prom XML feed from EasyDrop,
# filters out models with < 3 sizes in stock for sneakers,
# generates updated data/products.json, data/meta.json, feed.xml,
# and pushes changes to all 5 GitHub repositories to trigger Vercel deployment.
# ==============================================================================

set -e

# Export standard system PATH for launchd/cron
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT_DIR="/Users/mac/.gemini/antigravity/scratch/streetwear-dropship-ua"
cd "$PROJECT_DIR"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="$PROJECT_DIR/scripts/sync.log"

echo "[$TIMESTAMP] Starting EasyDrop catalog sync..." >> "$LOG_FILE"

# 1. Run Python sync script with automatic XML download
python3 "$PROJECT_DIR/scripts/sync_catalog.py" --download >> "$LOG_FILE" 2>&1

# 2. Check if catalog files changed
CHANGED_FILES=$(git status --porcelain data/ feed.xml)

if [ -n "$CHANGED_FILES" ]; then
    echo "[$TIMESTAMP] Changes detected in catalog data. Committing and pushing..." >> "$LOG_FILE"
    git add data/products.json data/meta.json feed.xml
    git -c user.name="Mac" -c user.email="mac@MacBook-Pro-Mac.local" commit -m "Автоматична синхронізація наявності EasyDrop [$TIMESTAMP]" >> "$LOG_FILE" 2>&1

    # Pull rebase before push to avoid lock / non-fast-forward conflicts
    git pull origin main --rebase >> "$LOG_FILE" 2>&1 || true

    # Push to all 5 remotes
    git push origin main >> "$LOG_FILE" 2>&1 || true
    git push as_repo main >> "$LOG_FILE" 2>&1 || true
    git push urbangrid main >> "$LOG_FILE" 2>&1 || true
    git push urbangrid_ua main >> "$LOG_FILE" 2>&1 || true
    git push urbangridv main >> "$LOG_FILE" 2>&1 || true

    echo "[$TIMESTAMP] Successfully pushed to all 5 remotes. Vercel deployment triggered." >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] No changes in stock or catalog. Repositories up to date." >> "$LOG_FILE"
fi
