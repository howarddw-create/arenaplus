export const decodeCorruptedUtf8 = (corruptedString: string): string => {
  if (!corruptedString) return '';
  try {
    const bytes = Uint8Array.from(corruptedString, c => c.charCodeAt(0));
    const decodedString = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // If decoding results in the Unicode replacement character, it means the original
    // sequence was not valid UTF-8, so we should use the original string.
    if (decodedString.includes('\uFFFD')) {
      return corruptedString;
    }
    return decodedString;
  } catch (e) {
    // If TextDecoder throws an error, it's not valid UTF-8, so return the original.
    return corruptedString;
  }
};
