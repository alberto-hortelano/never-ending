#!/bin/bash

# Generate Tutorial Screenshots
# This script runs the tutorial E2E test and copies screenshots to the tutorial/images folder

echo "🎮 Generating tutorial screenshots..."

# Create images directory if it doesn't exist
mkdir -p tutorial/images

# Run the tutorial screenshots test
echo "📸 Running screenshot generation test..."
# Use the actual version that only captures real game features
npm run test:e2e -- tutorial-screenshots-actual.spec.ts --reporter=list

# Wait a moment for files to be written
sleep 2

# Clean up old screenshots first
echo "🧹 Cleaning old screenshots..."
rm -f tutorial/images/*.png

# Find and copy all tutorial screenshots
echo "📁 Moving screenshots to tutorial/images..."

# Define the mapping of generated files to final names
declare -A screenshot_map=(
    ["tutorial-01-start-screen.png"]="01-start-screen.png"
    ["tutorial-02-character-selection.png"]="02-character-selection.png"
    ["tutorial-03-game-interface.png"]="03-game-interface.png"
    ["tutorial-04-action-points.png"]="04-action-points.png"
    ["tutorial-05-movement-highlight.png"]="05-movement-highlight.png"
    ["tutorial-06-actions-menu.png"]="06-actions-menu.png"
    ["tutorial-07-inventory.png"]="07-inventory.png"
    ["tutorial-08-shooting-mode.png"]="08-shooting-mode.png"
    ["tutorial-09-end-turn.png"]="09-end-turn.png"
    ["tutorial-10-settings.png"]="10-settings.png"
)

# Copy screenshots from test results
for src_file in "${!screenshot_map[@]}"; do
    dest_file="${screenshot_map[$src_file]}"
    
    # Look for the file in common Playwright output locations
    if [ -f "$src_file" ]; then
        cp "$src_file" "tutorial/images/$dest_file"
        echo "✅ Copied $src_file → tutorial/images/$dest_file"
    elif [ -f "test-results/$src_file" ]; then
        cp "test-results/$src_file" "tutorial/images/$dest_file"
        echo "✅ Copied test-results/$src_file → tutorial/images/$dest_file"
    elif [ -f "playwright-report/$src_file" ]; then
        cp "playwright-report/$src_file" "tutorial/images/$dest_file"
        echo "✅ Copied playwright-report/$src_file → tutorial/images/$dest_file"
    else
        # Search for the file
        found_file=$(find . -name "$src_file" -type f 2>/dev/null | head -n 1)
        if [ -n "$found_file" ]; then
            cp "$found_file" "tutorial/images/$dest_file"
            echo "✅ Found and copied $found_file → tutorial/images/$dest_file"
        else
            echo "⚠️  Could not find $src_file"
        fi
    fi
done

echo "✨ Screenshot generation complete!"
echo "📝 Tutorial images are in: tutorial/images/"

# List generated images
echo ""
echo "Generated images:"
ls -la tutorial/images/*.png 2>/dev/null || echo "No images found yet."