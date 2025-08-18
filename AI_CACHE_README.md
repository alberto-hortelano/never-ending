# AI Response Caching

This project includes a browser-based AI response caching system to speed up development and save API credits during testing.

## How It Works

The AI cache:
1. Stores responses in browser memory (fast access)
2. Persists to localStorage (survives page reloads)
3. Uses hash of the request as the cache key
4. Returns cached responses instead of making API calls
5. Expires cache entries after 7 days
6. Limits cache to 50 responses / 5MB

## Usage

### Browser Console Commands

Open the browser console (F12) and use these commands:

```javascript
// View cache statistics
AICache.stats()

// Clear all cached responses
AICache.clear()

// Toggle cache on/off
AICache.toggle()

// Show help
AICache.help()
```

## Benefits

1. **Faster Development**: Instant responses for repeated AI requests
2. **Save Credits**: No API calls for cached responses  
3. **Consistent Testing**: Same AI response for same input
4. **Offline Development**: Work with cached responses without internet

## Cache Storage

- **Memory**: Fast in-memory Map for current session
- **localStorage**: Persists between sessions (5MB limit)
- **Auto-cleanup**: Removes oldest entries when limit reached

## When to Clear Cache

Clear the cache when:
- You've updated AI prompts or context
- You want fresh AI responses
- Testing production behavior
- localStorage is full

## Console Output

Watch for cache messages in the console:
- `[AICache] Cache hit...` - Using cached response
- `[AICache] Cache miss...` - Making API call
- `[AICache] Cached response...` - Saved new response

## Notes

- Cache files are gitignored and not committed
- Each developer has their own local cache
- Cache TTL is 7 days (configurable in AICacheService.ts)
- Console logs show when cache hits/misses occur