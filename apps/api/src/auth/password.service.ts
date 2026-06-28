import { hash, verify } from "@node-rs/argon2";

/** Thin wrapper around argon2 so hashing is swappable and easy to fake in tests. */
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain);
    } catch {
      return false;
    }
  }
}
