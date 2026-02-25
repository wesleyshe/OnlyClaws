import { customAlphabet } from 'nanoid';

const random = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 32);
const claimRandom = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24);

export function generateApiKey() {
  return `onlyclaws_${random()}`;
}

export function generateClaimToken() {
  return `onlyclaws_claim_${claimRandom()}`;
}
