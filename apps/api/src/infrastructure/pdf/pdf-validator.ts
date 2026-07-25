/**
 * @file Defines PDF validation, text extraction, and rendering infrastructure.
 */
/**
 * @description Performs the is probably pdf helper operation for this module.
 * @param {Uint8Array} bytes - Input value for bytes.
 * @returns {boolean} Result of the is probably pdf operation.
 */
export function isProbablyPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) {
    return false;
  }

  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  return signature === "%PDF-";
}
