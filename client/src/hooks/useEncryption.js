import { useRef, useEffect, useCallback } from 'react'
import sodium from 'libsodium-wrappers'
import {
  initSodium,
  hasLocalKeyPair,
  getLocalPublicKey,
  generateAndStoreKeyPair,
  getSharedKey,
  encryptMessage,
  decryptMessage,
} from '../utils/crypto'

export default function useEncryption(users) {
  const sharedKeysRef = useRef({})
  const readyRef = useRef(false)

  useEffect(() => {
    initSodium().then(() => { readyRef.current = true })
  }, [])

  const ensureKeyPair = useCallback(async () => {
    await sodium.ready
    if (!hasLocalKeyPair()) {
      return generateAndStoreKeyPair()
    }
    return getLocalPublicKey()
  }, [])

  const ensureSharedKey = useCallback(async (partnerId, partnerPublicKey) => {
    if (!partnerPublicKey) return null
    if (!sharedKeysRef.current[partnerId]) {
      await sodium.ready
      const key = getSharedKey(partnerPublicKey)
      if (key) sharedKeysRef.current[partnerId] = key
    }
    return sharedKeysRef.current[partnerId] || null
  }, [])

  const encrypt = useCallback((plaintext, partnerId) => {
    const key = sharedKeysRef.current[partnerId]
    if (!key) return plaintext
    return encryptMessage(plaintext, key)
  }, [])

  const decrypt = useCallback((payload, partnerId) => {
    if (!payload || typeof payload !== 'string') return payload
    if (!payload.includes(':')) return payload
    const key = sharedKeysRef.current[partnerId]
    if (!key) return payload
    return decryptMessage(payload, key)
  }, [])

  const preloadKeys = useCallback(async (partnerId, partnerPublicKey) => {
    await ensureSharedKey(partnerId, partnerPublicKey)
  }, [ensureSharedKey])

  return { ensureKeyPair, preloadKeys, encrypt, decrypt }
}
