#!/bin/bash

# Default commit message if none is provided
COMMIT_MSG=${1:-"Update project files"}

echo "Adding files to git..."
git add .

echo "Committing changes..."
# We use || true so the script doesn't fail if there's nothing new to commit
git commit -m "$COMMIT_MSG" || true

echo "Attempting to push forcefully to remote repository..."
# Retry loop for pushing to handle transient network/socket issues
MAX_RETRIES=3
RETRY_COUNT=0
PUSH_SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Force push to origin on the current branch (HEAD)
    if git push -f origin HEAD; then
        PUSH_SUCCESS=true
        echo "Push successful!"
        break
    else
        echo "Push failed. Retrying in 2 seconds... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
        RETRY_COUNT=$((RETRY_COUNT+1))
        sleep 2
    fi
done

if [ "$PUSH_SUCCESS" = false ]; then
    echo "Failed to push after $MAX_RETRIES attempts. Please check your network or repository settings."
    exit 1
fi
