/**
 * Utilidad criptográfica para Finnova (Web Cryptography API - Estándar W3C)
 * Cifra la contraseña utilizando AES-256-CBC antes de viajar por HTTP/red hacia el backend.
 */

// Clave simétrica de 256 bits (32 caracteres UTF-8)
const CRYPTO_KEY_STRING = 'FinnovaSecureKey2026AES256Pass!!';

/**
 * Encripta una contraseña en texto plano utilizando AES-256-CBC.
 * Retorna formato: "ENC:<iv_hex>:<ciphertext_hex>"
 */
export async function encryptPassword(plainPassword: string): Promise<string> {
  if (!plainPassword) return plainPassword;

  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const rawKey = encoder.encode(CRYPTO_KEY_STRING);

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
      );

      // Generar Vector de Inicialización (IV) aleatorio de 16 bytes
      const iv = window.crypto.getRandomValues(new Uint8Array(16));
      const data = encoder.encode(plainPassword);

      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        data
      );

      const ivHex = Array.from(iv)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const encHex = Array.from(new Uint8Array(encryptedBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return `ENC:${ivHex}:${encHex}`;
    }
  } catch (error) {
    console.warn('[Crypto] Fallback al no poder usar WebCrypto:', error);
  }

  return plainPassword;
}
