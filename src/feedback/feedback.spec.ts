import { FeedbackService } from './feedback.service';

function build(notifyFails = false) {
  const created: any[] = [];
  const model: any = { create: jest.fn(async (doc: any) => { created.push(doc); return { _id: 'f1', ...doc }; }) };
  const notifications: any = { notifyAdmins: jest.fn(() => (notifyFails ? Promise.reject(new Error('down')) : Promise.resolve())) };
  return { service: new FeedbackService(model, notifications), created, notifications };
}

describe('app feedback', () => {
  it('is saved with the sender and reaches the admins', async () => {
    const { service, created, notifications } = build();
    await service.create({ rating: 1, category: 'bug', message: '  The map is blank  ', device: 'android 1.0.0' }, { _id: '507f1f77bcf86cd799439011', name: 'Ana' });
    expect(created[0]).toEqual(expect.objectContaining({ category: 'bug', message: 'The map is blank', rating: 1 }));
    expect(String(created[0].userId)).toBe('507f1f77bcf86cd799439011');
    const sent = notifications.notifyAdmins.mock.calls[0][0];
    expect(sent.title).toBe('🙁 App feedback: Bug');
    expect(sent.message).toBe('Ana: The map is blank (android 1.0.0)');
  });

  it('works for someone who is not logged in', async () => {
    const { service, created, notifications } = build();
    await service.create({ message: 'Nice app' }, null);
    expect(created[0].userId).toBeUndefined();
    expect(notifications.notifyAdmins.mock.calls[0][0].message).toContain('A visitor');
  });

  it('keeps the feedback even if the admin notice fails', async () => {
    const { service, created } = build(true);
    await expect(service.create({ message: 'Hello there' })).resolves.toEqual({ received: true });
    expect(created).toHaveLength(1);
  });
});
