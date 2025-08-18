/**
 * Creates a throttled version of a function that will only execute at most once
 * within the specified time period. Subsequent calls within the throttle period
 * will be ignored.
 * 
 * @param func The function to throttle
 * @param delay The minimum time in milliseconds between function executions
 * @returns A throttled version of the function
 */
export function throttle<TArgs extends unknown[], TReturn>(
    func: (...args: TArgs) => TReturn,
    delay: number
): (...args: TArgs) => void {
    let isThrottled = false;
    let lastArgs: TArgs | null = null;

    return function(this: unknown, ...args: TArgs) {
        if (isThrottled) {
            // Store the most recent arguments to call at the end of throttle period
            lastArgs = args;
            return;
        }

        // Execute the function immediately
        func.apply(this, args);
        isThrottled = true;

        // Reset throttle after delay
        setTimeout(() => {
            isThrottled = false;
            // If there were calls during throttle period, execute with last args
            if (lastArgs !== null) {
                func.apply(this, lastArgs);
                lastArgs = null;
                // Re-throttle to prevent immediate subsequent calls
                isThrottled = true;
                setTimeout(() => {
                    isThrottled = false;
                }, delay);
            }
        }, delay);
    };
}