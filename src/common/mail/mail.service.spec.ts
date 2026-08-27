import { MailService } from './mail.service';

describe('MailService', () => {
  it('sendMail is called with correct from address', async () => {
    const service = new MailService({
      host: 'localhost',
      port: 1025,
      from: 'noreply@test.local',
    });
    const transporter = (service as unknown as { transporter: { sendMail: jest.Mock } }).transporter;
    transporter.sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    await service.send({ to: 'a@b.c', subject: 'Hi', text: 'Hello' });
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@test.local',
        to: 'a@b.c',
        subject: 'Hi',
        text: 'Hello',
      }),
    );
  });
});