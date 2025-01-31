export function readString(
  data: Uint8Array,
  start: number,
  end: number,
): string {
  const subArray = data.subarray(start, end);
  const str = String.fromCharCode(...Array.from(subArray));
  const nullLocation = str.indexOf("\u0000");
  if (nullLocation > 0) {
    return str.substring(0, nullLocation);
  }
  return str;
}
