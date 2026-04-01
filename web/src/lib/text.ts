const utf8Decoder = new TextDecoder("utf-8");

export function repairMojibake(value: string) {
  if (!/[ÃÂâá]/.test(value)) {
    return value;
  }

  try {
    let repaired = value;

    for (let index = 0; index < 2; index += 1) {
      const bytes = Uint8Array.from(Array.from(repaired, (char) => char.charCodeAt(0) & 0xff));
      const decoded = utf8Decoder.decode(bytes);
      if (!decoded || decoded === repaired) {
        break;
      }
      repaired = decoded;
    }

    return repaired || value;
  } catch {
    return value;
  }
}
