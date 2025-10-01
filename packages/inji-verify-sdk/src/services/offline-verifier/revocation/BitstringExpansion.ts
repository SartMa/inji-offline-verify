import { base58btc } from 'multiformats/bases/base58';
import { base64url } from 'multiformats/bases/base64';

// GZIP decompression - rely on browser CompressionStream / DecompressionStream if available, otherwise fallback to pako (not added yet)
async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
  const ds = new DecompressionStream('gzip');
  // Ensure we pass a normal ArrayBuffer to Blob
  const copy = new Uint8Array(data); // force plain Uint8Array
  const writer = (new Blob([copy])).stream().pipeThrough(ds);
    const buf = await new Response(writer).arrayBuffer();
    return new Uint8Array(buf);
  } else {
    // Lazy load pako only if needed (expects global pako if bundled)
    // To avoid adding dependency now, throw a clear error
    throw new Error('GZIP decompression not supported in this environment');
  }
}

export async function expandCompressedBitstring(compressed: string): Promise<Uint8Array> {
  if (!compressed || typeof compressed !== 'string') {
    throw new Error('Encoded status list missing');
  }
  const prefix = compressed[0];
  let decoded: Uint8Array;
  console.info('[BitstringExpansion] Decoding bitstring', { prefix, length: compressed.length });
  try {
    if (prefix === 'z') {
      decoded = base58btc.decode(compressed);
    } else if (prefix === 'u') {
      decoded = base64url.decode(compressed);
    } else {
      // Try lenient base64url decoding without prefix (non-standard)
      try {
        decoded = base64url.decode(`u${compressed}`);
      } catch {
        throw new Error('Unsupported multibase prefix for status list');
      }
    }
  } catch (e) {
    console.error('[BitstringExpansion] Multibase decode failed', e);
    throw new Error('Invalid multibase encoding for status list');
  }
  const expanded = await gunzip(decoded);
  console.info('[BitstringExpansion] Gzip expanded length', expanded.length);
  return expanded;
}
