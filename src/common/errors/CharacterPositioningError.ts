/**
 * Custom error class for character positioning failures.
 * Provides detailed information about why a character couldn't be positioned.
 */
export class CharacterPositioningError extends Error {
    public readonly characterName: string;
    public readonly requestedLocation: string;
    public readonly availableRooms: string[];
    public readonly mapBounds: { width: number; height: number };

    constructor(
        characterName: string,
        requestedLocation: string,
        availableRooms: string[] = [],
        mapBounds: { width: number; height: number } = { width: 50, height: 50 }
    ) {
        const roomList = availableRooms.length > 0 
            ? `\nAvailable rooms: ${availableRooms.join(', ')}`
            : '\nNo rooms available on map';
            
        super(
            `Failed to position character "${characterName}" at location "${requestedLocation}".` +
            roomList +
            `\nMap bounds: ${mapBounds.width}x${mapBounds.height}` +
            `\nPlease use exact room names from the map or coordinates within bounds.`
        );
        
        this.name = 'CharacterPositioningError';
        this.characterName = characterName;
        this.requestedLocation = requestedLocation;
        this.availableRooms = availableRooms;
        this.mapBounds = mapBounds;
        
        // Maintains proper stack trace for where error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CharacterPositioningError);
        }
    }

    /**
     * Returns a JSON representation suitable for sending to the AI
     */
    toAIFeedback(): Record<string, unknown> {
        return {
            error: 'CHARACTER_POSITIONING_FAILED',
            character: this.characterName,
            requestedLocation: this.requestedLocation,
            availableRooms: this.availableRooms,
            mapBounds: this.mapBounds,
            suggestion: this.availableRooms.length > 0
                ? `Use one of these exact room names: ${this.availableRooms.slice(0, 3).join(', ')}`
                : `Use coordinates like "25,25" within bounds 0-${this.mapBounds.width - 1} x 0-${this.mapBounds.height - 1}`
        };
    }
}