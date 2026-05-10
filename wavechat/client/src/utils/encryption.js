import sodium from 'libsodium-wrappers';

export async function generateKeyPair() {
  await sodium.ready;

  const keyPair = sodium.crypto_box_keypair();
  const publicKey = sodium.to_base64(keyPair.publicKey, sodium.base64_variants.ORIGINAL);
  const privateKey = sodium.to_base64(keyPair.privateKey, sodium.base64_variants.ORIGINAL);

  localStorage.setItem('wc_private_key', privateKey);

  return { publicKey, privateKey };
}

export async function encryptMessage(message, receiverPublicKey, myPrivateKey) {
  await sodium.ready;

  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const receiverPub = sodium.from_base64(receiverPublicKey, sodium.base64_variants.ORIGINAL);
  const myPriv = sodium.from_base64(myPrivateKey, sodium.base64_variants.ORIGINAL);

  const encrypted = sodium.crypto_box_easy(
    sodium.from_string(message),
    nonce,
    receiverPub,
    myPriv
  );

  return {
    encrypted: sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
  };
}

export async function decryptMessage(encrypted, nonce, senderPublicKey, myPrivateKey) {
  await sodium.ready;

  const enc = sodium.from_base64(encrypted, sodium.base64_variants.ORIGINAL);
  const n = sodium.from_base64(nonce, sodium.base64_variants.ORIGINAL);
  const senderPub = sodium.from_base64(senderPublicKey, sodium.base64_variants.ORIGINAL);
  const myPriv = sodium.from_base64(myPrivateKey, sodium.base64_variants.ORIGINAL);

  const decrypted = sodium.crypto_box_open_easy(enc, n, senderPub, myPriv);

  return sodium.to_string(decrypted);
}
