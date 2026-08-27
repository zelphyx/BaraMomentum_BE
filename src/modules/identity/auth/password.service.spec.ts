import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hash returns argon2id hash', async () => {
    const hash = await service.hash('Password123!Secret');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Password123!Secret');
  });

  it('verify returns true for correct password', async () => {
    const hash = await service.hash('Password123!Secret');
    expect(await service.verify(hash, 'Password123!Secret')).toBe(true);
  });

  it('verify returns false for wrong password', async () => {
    const hash = await service.hash('Password123!Secret');
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });

  it('two hashes of same password differ', async () => {
    const a = await service.hash('Password123!Secret');
    const b = await service.hash('Password123!Secret');
    expect(a).not.toBe(b);
  });
});
