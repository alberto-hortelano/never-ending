import { test, expect } from '@playwright/test';
import { GameBoardPage } from '../pages/GameBoardPage';

test.describe('Melee Combat System', () => {
    let gamePage: GameBoardPage;

    test.beforeEach(async ({ page }) => {
        gamePage = new GameBoardPage(page);
        await gamePage.goto();
        await gamePage.startSinglePlayerGame();
        await gamePage.waitForGameToLoad();
    });

    test('should show melee attacks in action menu', async ({ page }) => {
        // Click on a character to open actions
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();

        // Check that Close Combat category exists
        const closeCombatSection = page.locator('.action-category:has-text("Close Combat")');
        await expect(closeCombatSection).toBeVisible();

        // Verify all 6 melee attacks are present
        const meleeAttacks = [
            'Power Strike',
            'Slash',
            'Fast Attack',
            'Feint',
            'Break Guard',
            'Special'
        ];

        for (const attack of meleeAttacks) {
            await expect(page.locator(`.action-item:has-text("${attack}")`)).toBeVisible();
        }
    });

    test('should highlight adjacent enemies when melee attack selected', async ({ page }) => {
        // Setup: Position characters adjacent to each other
        await gamePage.selectCharacter('Character1');
        await gamePage.moveCharacterTo(5, 5);
        
        // Ensure enemy is adjacent
        await gamePage.endTurn();
        await gamePage.selectCharacter('Character2');
        await gamePage.moveCharacterTo(6, 5);
        await gamePage.endTurn();

        // Select melee attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');

        // Check for melee target highlights
        const highlightedCell = page.locator('.cell.melee-target').first();
        await expect(highlightedCell).toBeVisible();

        // Verify the highlighted cell is at the enemy position
        const cellPosition = await highlightedCell.getAttribute('data-position');
        expect(cellPosition).toBe('6,5');
    });

    test('should show defense wheel when attacked', async ({ page }) => {
        // Setup adjacent characters
        await gamePage.selectCharacter('Character1');
        await gamePage.moveCharacterTo(5, 5);
        await gamePage.endTurn();
        
        await gamePage.selectCharacter('Character2');
        await gamePage.moveCharacterTo(6, 5);
        await gamePage.endTurn();

        // Initiate melee attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        
        // Click on the enemy to attack
        await page.click('.character[data-name="Character2"]');

        // Defense wheel should appear
        const defenseWheel = page.locator('defense-wheel');
        await expect(defenseWheel).toBeVisible();

        // Check wheel has 6 defense options
        const defenseOptions = page.locator('.defense-option');
        await expect(defenseOptions).toHaveCount(6);

        // Verify damage indicators are shown
        await expect(page.locator('.damage-block')).toBeVisible(); // Perfect block option
        await expect(page.locator('.damage-high')).toBeVisible();  // Opposite attack option
    });

    test('should calculate damage based on attack-defense matching', async ({ page }) => {
        // Setup combat scenario
        await gamePage.setupAdjacentCombat();

        // Initiate attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Record initial health
        const initialHealth = await gamePage.getCharacterHealth('Character2');

        // Select same defense (perfect block)
        await page.click('.defense-option:has-text("Power Strike")');

        // Wait for combat resolution
        await page.waitForTimeout(500);

        // Health should remain the same (blocked)
        const afterBlockHealth = await gamePage.getCharacterHealth('Character2');
        expect(afterBlockHealth).toBe(initialHealth);

        // Try again with opposite defense (max damage)
        await gamePage.endTurn();
        await gamePage.endTurn(); // Back to Character1's turn
        
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Select opposite defense
        await page.click('.defense-option:has-text("Break Guard")');

        // Wait for combat resolution
        await page.waitForTimeout(500);

        // Health should be reduced
        const afterDamageHealth = await gamePage.getCharacterHealth('Character2');
        expect(afterDamageHealth).toBeLessThan(initialHealth);
    });

    test('should respect weapon range for melee attacks', async ({ page }) => {
        // Give Character1 a polearm (range 2)
        await gamePage.equipWeapon('Character1', 'polearm');

        // Position characters 2 cells apart
        await gamePage.selectCharacter('Character1');
        await gamePage.moveCharacterTo(5, 5);
        await gamePage.endTurn();

        await gamePage.selectCharacter('Character2');
        await gamePage.moveCharacterTo(7, 5); // 2 cells away
        await gamePage.endTurn();

        // Select melee attack with polearm
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');

        // Enemy should be highlighted despite being 2 cells away
        const highlightedCell = page.locator('.cell.melee-target[data-position="7,5"]');
        await expect(highlightedCell).toBeVisible();
    });

    test('should apply unarmed penalty when defender has no weapon', async ({ page }) => {
        // Setup combat with unarmed defender
        await gamePage.setupAdjacentCombat();
        await gamePage.unequipAllWeapons('Character2');

        // Attack the unarmed character
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        const initialHealth = await gamePage.getCharacterHealth('Character2');

        // Select non-matching defense (should get 2x damage)
        await page.click('.defense-option:has-text("Slash")');
        await page.waitForTimeout(500);

        const afterDamageHealth = await gamePage.getCharacterHealth('Character2');
        const damage = initialHealth - afterDamageHealth;

        // Damage should be significant (2x penalty)
        expect(damage).toBeGreaterThan(30); // Assuming base damage is ~20
    });

    test('should allow perfect dodge for unarmed defender', async ({ page }) => {
        // Setup combat with unarmed defender
        await gamePage.setupAdjacentCombat();
        await gamePage.unequipAllWeapons('Character2');

        // Attack the unarmed character
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        const initialHealth = await gamePage.getCharacterHealth('Character2');

        // Select matching defense (perfect dodge)
        await page.click('.defense-option:has-text("Power Strike")');
        await page.waitForTimeout(500);

        const afterDodgeHealth = await gamePage.getCharacterHealth('Character2');
        
        // No damage should be taken
        expect(afterDodgeHealth).toBe(initialHealth);
    });

    test('should deduct correct AP for different attacks', async ({ page }) => {
        await gamePage.selectCharacter('Character1');
        const initialAP = await gamePage.getCharacterAP('Character1');

        // Use Fast Attack (15 AP)
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Fast Attack")');
        
        // Cancel the attack
        await page.keyboard.press('Escape');

        // Check pending AP cost indicator
        const pendingCost = page.locator('.pending-ap-cost');
        await expect(pendingCost).toHaveText('15');

        // Complete an attack to verify AP deduction
        await gamePage.setupAdjacentCombat();
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Special")'); // 25 AP
        await page.click('.character[data-name="Character2"]');
        await page.click('.defense-option').first();

        await page.waitForTimeout(500);
        const afterAttackAP = await gamePage.getCharacterAP('Character1');
        expect(initialAP - afterAttackAP).toBe(25);
    });

    test('should handle diagonal attacks correctly', async ({ page }) => {
        // Position characters diagonally
        await gamePage.selectCharacter('Character1');
        await gamePage.moveCharacterTo(5, 5);
        await gamePage.endTurn();

        await gamePage.selectCharacter('Character2');
        await gamePage.moveCharacterTo(6, 6); // Diagonal position
        await gamePage.endTurn();

        // Try melee attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Slash")');

        // Diagonal enemy should be highlighted
        const highlightedCell = page.locator('.cell.melee-target[data-position="6,6"]');
        await expect(highlightedCell).toBeVisible();

        // Should be able to attack
        await page.click('.character[data-name="Character2"]');
        await expect(page.locator('defense-wheel')).toBeVisible();
    });

    test('should show weapon information in defense wheel', async ({ page }) => {
        await gamePage.setupAdjacentCombat();
        
        // Give specific weapons to both characters
        await gamePage.equipWeapon('Character1', 'sword');
        await gamePage.equipWeapon('Character2', 'knife');

        // Initiate attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Check weapon info in defense wheel
        await expect(page.locator('.attacker-info')).toContainText('sword');
        await expect(page.locator('.defender-info')).toContainText('knife');
    });

    test('should prevent melee attacks when not enough AP', async ({ page }) => {
        await gamePage.selectCharacter('Character1');
        
        // Use up most AP with movement
        await gamePage.moveCharacterTo(10, 10);
        
        // Try to use expensive attack
        await gamePage.openActionMenu();
        const specialAttack = page.locator('.action-item:has-text("Special")');
        
        // Should be disabled or show error
        const isDisabled = await specialAttack.evaluate(el => 
            el.classList.contains('disabled') || el.hasAttribute('disabled')
        );
        
        if (!isDisabled) {
            await specialAttack.click();
            await expect(page.locator('.error-message')).toContainText('Not enough action points');
        } else {
            expect(isDisabled).toBe(true);
        }
    });

    test('should clear highlights when canceling attack', async ({ page }) => {
        await gamePage.setupAdjacentCombat();

        // Start melee attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');

        // Verify highlights appear
        await expect(page.locator('.cell.melee-target')).toBeVisible();

        // Cancel with ESC
        await page.keyboard.press('Escape');

        // Highlights should be cleared
        await expect(page.locator('.cell.melee-target')).not.toBeVisible();
    });
});

test.describe('Defense Wheel Interactions', () => {
    let gamePage: GameBoardPage;

    test.beforeEach(async ({ page }) => {
        gamePage = new GameBoardPage(page);
        await gamePage.goto();
        await gamePage.startSinglePlayerGame();
        await gamePage.waitForGameToLoad();
        await gamePage.setupAdjacentCombat();
    });

    test('should show damage preview on hover', async ({ page }) => {
        // Initiate attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Hover over different defense options
        const defenseOptions = page.locator('.defense-option');
        
        // Check perfect block shows 0 damage
        await defenseOptions.filter({ hasText: 'Power Strike' }).hover();
        await expect(page.locator('.damage-hint').first()).toHaveText('Block!');

        // Check opposite shows 100% damage
        await defenseOptions.filter({ hasText: 'Break Guard' }).hover();
        await expect(page.locator('.damage-hint').first()).toHaveText('100%');
    });

    test('should highlight selected defense', async ({ page }) => {
        // Initiate attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Select a defense
        const slashDefense = page.locator('.defense-option:has-text("Slash")');
        await slashDefense.click();

        // Should have selected class
        await expect(slashDefense).toHaveClass(/selected/);
    });

    test('should show combat result notification', async ({ page }) => {
        // Initiate attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Select defense
        await page.click('.defense-option:has-text("Slash")');

        // Wait for combat resolution
        await page.waitForTimeout(500);

        // Check for damage notification or combat result
        const damageIndicator = page.locator('.damage-notification, .combat-result');
        await expect(damageIndicator).toBeVisible();
    });

    test('defense wheel should be responsive on mobile', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });

        // Initiate attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Defense wheel should adapt to mobile
        const defenseWheel = page.locator('defense-wheel');
        await expect(defenseWheel).toBeVisible();

        // Check that it's properly sized for mobile
        const wheelSize = await defenseWheel.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
        });

        expect(wheelSize.width).toBeLessThan(350);
        expect(wheelSize.height).toBeLessThan(600);
    });

    test('should close defense wheel after selection', async ({ page }) => {
        // Initiate attack
        await gamePage.selectCharacter('Character1');
        await gamePage.openActionMenu();
        await page.click('.action-item:has-text("Power Strike")');
        await page.click('.character[data-name="Character2"]');

        // Verify wheel is visible
        await expect(page.locator('defense-wheel')).toBeVisible();

        // Select defense
        await page.click('.defense-option').first();

        // Wait for animation
        await page.waitForTimeout(1000);

        // Wheel should be hidden
        await expect(page.locator('defense-wheel')).not.toBeVisible();
    });
});