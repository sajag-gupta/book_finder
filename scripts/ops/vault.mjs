/**
 * Encrypted copy of .env, so a new machine or agent can get the working keys without them ever being
 * readable in the (public) repository.
 *
 *   VAULT_PASSPHRASE=... node scripts/ops/vault.mjs lock      .env  ->  secrets/env.enc.json
 *   VAULT_PASSPHRASE=... node scripts/ops/vault.mjs unlock    secrets/env.enc.json  ->  .env
 *   node scripts/ops/vault.mjs unlock --force                 overwrite an existing .env (prompts for the passphrase)
 *
 * Encryption: AES-256-GCM, key from scrypt (N=2^17) with a random salt. The passphrase is never stored
 * anywhere in the repo: whoever holds it can decrypt, so keep it in a password manager and share it
 * only through a private channel. After a leak or a change of agent, rotate the keys themselves.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const [, , command, ...flags] = process.argv;
const ENV = new URL('../../.env', import.meta.url);
const VAULT = new URL('../../secrets/env.enc.json', import.meta.url);
const KDF = { N: 2 ** 17, r: 8, p: 1 };

async function passphrase() {
  if (process.env.VAULT_PASSPHRASE) return process.env.VAULT_PASSPHRASE;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Vault passphrase: ');
  rl.close();
  return answer.trim();
}
const keyFrom = (pass, salt) => scryptSync(pass, salt, 32, { ...KDF, maxmem: 256 * 1024 * 1024 });

if (command === 'lock') {
  if (!existsSync(ENV)) throw new Error('No .env to lock.');
  const pass = await passphrase();
  if (pass.length < 20) throw new Error('Use a passphrase of at least 20 characters.');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(pass, salt), iv);
  const data = Buffer.concat([cipher.update(readFileSync(ENV)), cipher.final()]);
  mkdirSync(new URL('../../secrets/', import.meta.url), { recursive: true });
  writeFileSync(
    VAULT,
    `${JSON.stringify(
      {
        note: 'Encrypted .env. See scripts/ops/vault.mjs. Useless without the passphrase.',
        alg: 'aes-256-gcm',
        kdf: 'scrypt',
        ...KDF,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64'),
      },
      null,
      2,
    )}\n`,
  );
  console.log('Locked .env into secrets/env.enc.json');
} else if (command === 'unlock') {
  if (existsSync(ENV) && !flags.includes('--force')) {
    throw new Error('.env already exists. Use --force to overwrite it.');
  }
  const vault = JSON.parse(readFileSync(VAULT, 'utf8'));
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFrom(await passphrase(), Buffer.from(vault.salt, 'base64')),
    Buffer.from(vault.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(vault.tag, 'base64'));
  let plain;
  try {
    plain = Buffer.concat([decipher.update(Buffer.from(vault.data, 'base64')), decipher.final()]);
  } catch {
    throw new Error('Wrong passphrase, or the vault file was changed.');
  }
  writeFileSync(ENV, plain);
  console.log('Wrote .env (git-ignored). Never commit it.');
} else {
  console.log('Usage: node scripts/ops/vault.mjs lock | unlock [--force]');
  process.exitCode = 1;
}
