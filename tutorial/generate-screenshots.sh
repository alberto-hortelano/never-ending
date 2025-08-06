#!/bin/bash

# Generate Tutorial Screenshots
# This script runs the comprehensive E2E test that generates all tutorial screenshots

echo "🎮 Generating tutorial screenshots..."
echo "This will run the complete game flow test and capture screenshots at each stage."
echo ""

# Create images directory if it doesn't exist
mkdir -p tutorial/images

# Clean old screenshots (optional - uncomment if desired)
# echo "🧹 Cleaning old screenshots..."
# rm -f tutorial/images/*.png

# Run the comprehensive game flow test
echo "📸 Running complete game flow test..."
npm run test:e2e -- game-complete-flow.spec.ts --reporter=list

# Wait for files to be written
sleep 2

echo ""
echo "✨ Screenshot generation complete!"
echo "📝 Tutorial images are in: tutorial/images/"
echo ""

# List generated images with descriptions
echo "Generated screenshots:"
echo "----------------------"
echo "  01-main-menu.png         - Game start screen"
echo "  02-character-selection.png - Character selection"
echo "  03-game-board.png        - Initial game state"
echo "  04-movement-basics.png   - Movement highlighting"
echo "  05-movement-path.png     - Path visualization"
echo "  06-action-points.png     - AP display"
echo "  07-shooting-setup.png    - Targeting mode"
echo "  08-line-of-sight.png     - LOS visualization"
echo "  09-hit-probability.png   - Combat calculations"
echo "  10-overwatch-setup.png   - Setting overwatch"
echo "  11-overwatch-trigger.png - Overwatch activation"
echo "  12-actions-menu.png      - Available actions"
echo "  13-inventory.png         - Equipment screen"
echo "  14-end-turn.png          - Turn management"
echo "  15-victory.png           - Win condition"
echo ""

# Count actual files generated
ACTUAL_COUNT=$(ls -1 tutorial/images/*.png 2>/dev/null | wc -l)
echo "Total images generated: $ACTUAL_COUNT"

if [ "$ACTUAL_COUNT" -lt 10 ]; then
    echo "⚠️  Warning: Expected at least 10 screenshots, but only found $ACTUAL_COUNT"
    echo "Some screenshots may have failed to generate. Check the test output for errors."
fi