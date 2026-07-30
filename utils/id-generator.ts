/**
 * Generates a unique ID with a given prefix
 * @param prefix The prefix for the ID (e.g., "CL" for clients, "TR" for transactions)
 * @returns A unique ID string
 */
export function generateId(prefix: string): string {
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${timestamp}${random}`;
}
