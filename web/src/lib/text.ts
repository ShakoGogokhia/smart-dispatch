const utf8Decoder = new TextDecoder("utf-8");

export function repairMojibake(value: string) {
  if (!value.includes("á")) {
    return value;
  }

  try {
    const bytes = Uint8Array.from(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
    const repaired = utf8Decoder.decode(bytes);
    return repaired || value;
  } catch {
    return value;
  }
}
