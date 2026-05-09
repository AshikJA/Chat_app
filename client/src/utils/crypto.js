import sodium from 'libsodium-wrappers'

const PRIVATE_KEY_KEY = 'chat_private_key'
const PUBLIC_KEY_KEY = 'chat_public_key'

export async function initSodium() {
  await sodium.ready
}

export function hasLocalKeyPair() {
  return !!localStorage.getItem(PRIVATE_KEY_KEY)
}

export function getLocalPublicKey() {
  return localStorage.getItem(PUBLIC_KEY_KEY) || ''
}

export function generateAndStoreKeyPair() {
  const pair = sodium.crypto_box_keypair()
  const pk = sodium.to_base64(pair.publicKey)
  const sk = sodium.to_base64(pair.privateKey)
  localStorage.setItem(PUBLIC_KEY_KEY, pk)
  localStorage.setItem(PRIVATE_KEY_KEY, sk)
  return pk
}

export function getSharedKey(partnerPublicKeyBase64) {
  const skBase64 = localStorage.getItem(PRIVATE_KEY_KEY)
  if (!skBase64) return null
  const sk = sodium.from_base64(skBase64)
  const pk = sodium.from_base64(partnerPublicKeyBase64)
  return sodium.crypto_box_beforenm(pk, sk)
}

export function encryptMessage(plaintext, sharedKey) {
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES)
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, sharedKey)
  const nonceB64 = sodium.to_base64(nonce)
  const cipherB64 = sodium.to_base64(ciphertext)
  return nonceB64 + ':' + cipherB64
}

export function decryptMessage(payload, sharedKey) {
  try {
    const idx = payload.indexOf(':')
    if (idx === -1) return payload
    const nonceB64 = payload.slice(0, idx)
    const cipherB64 = payload.slice(idx + 1)
    const nonce = sodium.from_base64(nonceB64)
    const cipher = sodium.from_base64(cipherB64)
    const plain = sodium.crypto_secretbox_open_easy(cipher, nonce, sharedKey)
    return sodium.to_string(plain)
  } catch {
    return payload
  }
}
