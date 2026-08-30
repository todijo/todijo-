import "server-only";

export type WebPushConfig = { publicKey: string; privateKey: string; subject: string; encryptionKey: Buffer };

export function webPushPublicKey(env: NodeJS.ProcessEnv = process.env) {
  const value = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  return value && /^[A-Za-z0-9_-]{80,120}$/.test(value) ? value : null;
}

export function webPushConfig(env: NodeJS.ProcessEnv = process.env): WebPushConfig | null {
  const publicKey = webPushPublicKey(env), privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim(), subject = env.WEB_PUSH_VAPID_SUBJECT?.trim();
  let encryptionKey: Buffer;
  try { encryptionKey = Buffer.from(env.WEB_PUSH_ENCRYPTION_KEY ?? "", "base64"); } catch { return null; }
  if (!publicKey || !privateKey || !/^[A-Za-z0-9_-]{40,64}$/.test(privateKey) || !subject || !/^(?:mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject) || encryptionKey.length !== 32) return null;
  return { publicKey, privateKey, subject, encryptionKey };
}
