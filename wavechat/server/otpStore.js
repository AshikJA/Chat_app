const otpMap = new Map();

function setOtp(email, otp) {
  otpMap.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
}

function verifyOtp(email, otp) {
  const entry = otpMap.get(email);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpMap.delete(email);
    return false;
  }
  if (entry.otp !== otp) return false;
  otpMap.delete(email);
  return true;
}

module.exports = { setOtp, verifyOtp };
