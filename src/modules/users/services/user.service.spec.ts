import * as bcrypt from 'bcrypt';
import { UsersService } from './user.service';

describe('UsersService', () => {
  it('validates password correctly', async () => {
    const service = new UsersService({} as any, {} as any, {} as any);
    const password = 'Secret123!';
    const salt = await bcrypt.genSalt();
    const hash = await bcrypt.hash(password, salt);

    await expect(service.validatePassword(password, hash)).resolves.toBe(true);
    await expect(service.validatePassword('wrong', hash)).resolves.toBe(false);
  });
});
