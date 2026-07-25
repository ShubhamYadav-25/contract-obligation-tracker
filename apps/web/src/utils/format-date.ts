/**
 * @file Defines shared frontend utility helpers.
 */
/**
 * @description Performs the format date time helper operation for this module.
 * @param {string | Date} value - Input value for value.
 * @returns {string} Result of the format date time operation.
 */
export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
