# Tutorial Documentation

This folder contains the game tutorial and automated screenshot generation tools.

## Contents

- `how-to-play.md` - The main tutorial document
- `images/` - Tutorial screenshots (auto-generated)
- `generate-screenshots.sh` - Script to generate/update screenshots
- `README.md` - This file

## Important Note

The tutorial and screenshots only show features that are currently implemented in the game. As new features are developed, run the screenshot generation script to update the tutorial images.

## Generating/Updating Screenshots

To regenerate the tutorial screenshots (e.g., after UI changes):

```bash
cd tutorial
./generate-screenshots.sh
```

This script will:
1. Run the E2E test `tutorial-screenshots.spec.ts`
2. Capture screenshots at key moments during gameplay
3. Automatically move and rename them to the `images/` folder
4. Update the tutorial to use the latest graphics

## How It Works

1. **E2E Test** (`e2e/tests/tutorial-screenshots.spec.ts`):
   - Navigates through the game capturing important screens
   - Takes screenshots with descriptive names
   - Covers all major game features

2. **Generation Script** (`generate-screenshots.sh`):
   - Runs the E2E test
   - Finds generated screenshots
   - Copies them to `tutorial/images/` with proper names
   - Provides feedback on the process

3. **Tutorial Document** (`how-to-play.md`):
   - References images by their stable names in `images/`
   - Automatically uses latest screenshots after regeneration

## Adding New Screenshots

To add new screenshots to the tutorial:

1. Edit `e2e/tests/tutorial-screenshots.spec.ts`
2. Add new screenshot capture code
3. Update the mapping in `generate-screenshots.sh`
4. Reference the new image in `how-to-play.md`
5. Run `./generate-screenshots.sh`

## Benefits

- **Consistency**: Screenshots always match current UI
- **Automation**: No manual screenshot editing needed
- **Maintainability**: Easy to update when game changes
- **Version Control**: Track tutorial changes with code