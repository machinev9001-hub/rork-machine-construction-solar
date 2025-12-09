import CryptoJS from 'crypto-js';

export function hashPin(pin: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || CryptoJS.lib.WordArray.random(128 / 8).toString();
  
  const hash = CryptoJS.PBKDF2(pin, generatedSalt, {
    keySize: 256 / 32,
    iterations: 10000,
  }).toString();
  
  return {
    hash,
    salt: generatedSalt,
  };
}

export function verifyPin(pin: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPin(pin, storedSalt);
  return hash === storedHash;
}

export function isSecurePin(pin: string): { isSecure: boolean; message?: string } {
  if (pin.length < 4) {
    return { isSecure: false, message: 'PIN must be at least 4 digits' };
  }
  
  if (pin.length > 6) {
    return { isSecure: false, message: 'PIN must be no more than 6 digits' };
  }
  
  if (!/^\d+$/.test(pin)) {
    return { isSecure: false, message: 'PIN must contain only numbers' };
  }
  
  const repeatingPattern = /^(.)\1+$/;
  if (repeatingPattern.test(pin)) {
    return { isSecure: false, message: 'PIN cannot be all the same digit (e.g., 1111)' };
  }
  
  const sequentialPatterns = ['0123', '1234', '2345', '3456', '4567', '5678', '6789'];
  for (const pattern of sequentialPatterns) {
    if (pin.includes(pattern)) {
      return { isSecure: false, message: 'PIN cannot contain sequential digits (e.g., 1234)' };
    }
  }
  
  return { isSecure: true };
}
