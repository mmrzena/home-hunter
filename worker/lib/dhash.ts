import sharp from "sharp";

const WIDTH = 9; // 9 columns → 8 horizontal comparisons per row
const HEIGHT = 8; // 8 rows → 64 bits total
const TWO_63 = 1n << 63n;
const TWO_64 = 1n << 64n;

/**
 * 64-bit difference hash. Resize to 9×8 grayscale, then for each row emit a bit
 * per adjacent-pixel comparison (left < right). Perceptually similar images —
 * including re-uploads, light crops, and recompression — land within a small
 * Hamming distance, which is exactly the "agents reuse the same photos" signal.
 *
 * Returned as a signed 64-bit BigInt so it round-trips through Postgres bigint;
 * Hamming distance is bit_count((a # b)::bit(64)), unaffected by the sign.
 */
export async function dhash(buffer: Buffer): Promise<bigint | null> {
  try {
    const raw = await sharp(buffer)
      .removeAlpha()
      .grayscale()
      .resize(WIDTH, HEIGHT, { fit: "fill" })
      .raw()
      .toBuffer();

    const channels = Math.max(1, Math.round(raw.length / (WIDTH * HEIGHT)));
    let bits = 0n;
    for (let row = 0; row < HEIGHT; row += 1) {
      for (let col = 0; col < WIDTH - 1; col += 1) {
        const left = raw[(row * WIDTH + col) * channels];
        const right = raw[(row * WIDTH + col + 1) * channels];
        bits = (bits << 1n) | (left < right ? 1n : 0n);
      }
    }
    return bits >= TWO_63 ? bits - TWO_64 : bits;
  } catch {
    return null;
  }
}
