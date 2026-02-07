/**
 * Time Formatting Utilities
 * Convert minutes to human-readable format
 */

/**
 * Convert minutes to "X hours and Y minutes" format
 * Examples:
 * - 70 minutes -> "1 hour and 10 minutes"
 * - 125 minutes -> "2 hours and 5 minutes"
 * - 45 minutes -> "45 minutes"
 * - 60 minutes -> "1 hour"
 */
export function formatMinutesToReadable(totalMinutes: number): string {
  if (totalMinutes === 0) return "0 minutes";
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  if (minutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Short version for compact display
 * Examples:
 * - 70 minutes -> "1h 10m"
 * - 125 minutes -> "2h 5m"
 * - 45 minutes -> "45m"
 */
export function formatMinutesToShort(totalMinutes: number): string {
  if (totalMinutes === 0) return "0m";
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}
