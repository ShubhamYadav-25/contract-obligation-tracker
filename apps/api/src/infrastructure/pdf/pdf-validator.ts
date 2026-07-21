export function isProbablyPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) {
    return false;
  }

  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  return signature === "%PDF-";
}
