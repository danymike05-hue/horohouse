// A new message must reach the other person wherever they are: in the conversation (live), in
// another screen of the app (inbox and push) or away (push). Never the sender.
import { ChatGateway } from './chat.gateway';

const ME = 'me';
const OTHER = 'other';

function build({ looking = [] as string[], connected = [] as string[], appLanguage = 'en' } = {}) {
  const sent: { to: string; event: string }[] = [];
  const pushes: any[] = [];
  const gw: any = Object.create(ChatGateway.prototype);
  gw.logger = { log: () => undefined, warn: () => undefined };
  gw.server = {
    to: (to: string) => ({ emit: (event: string) => sent.push({ to, event }) }),
    in: () => ({ fetchSockets: async () => looking.map((userId) => ({ data: { user: { userId } } })) }),
  };
  gw.userSockets = new Map(connected.map((id) => [id, new Set([`socket-${id}`])]));
  gw.chatService = { participantIds: async () => [ME, OTHER] };
  gw.userModel = { findById: () => ({ select: () => ({ lean: async () => ({ name: 'Awa', appLanguage }) }) }) };
  gw.pushNotificationsService = { sendToUser: async (id: string, p: any) => { pushes.push({ id, ...p }); } };
  return { gw, sent, pushes };
}

describe('announcing a message', () => {
  it('someone in the conversation gets it live, with no push', async () => {
    const { gw, sent, pushes } = build({ looking: [ME, OTHER], connected: [ME, OTHER] });
    await gw.announce('c1', { content: 'Hi', type: 'text' }, ME);
    expect(sent).toContainEqual({ to: 'conversation:c1', event: 'message:new' });
    expect(pushes).toEqual([]);
  });

  it('someone elsewhere in the app gets it in their inbox and as a push', async () => {
    const { gw, sent, pushes } = build({ looking: [ME], connected: [ME, OTHER] });
    await gw.announce('c1', { content: 'Hi', type: 'text' }, ME);
    expect(sent).toContainEqual({ to: 'socket-other', event: 'inbox:message' });
    expect(pushes).toEqual([expect.objectContaining({ id: OTHER, body: 'Awa: Hi', data: expect.objectContaining({ route: '/messages/c1' }) })]);
  });

  it('someone away gets a push, in their language, for a photo too', async () => {
    const { gw, pushes } = build({ appLanguage: 'fr' });
    await gw.announce('c1', { type: 'image' }, ME);
    expect(pushes[0]).toMatchObject({ id: OTHER, title: '💬 Nouveau message', body: 'Awa vous a envoyé une photo' });
  });

  it('no push when the caller already tells them', async () => {
    const { gw, pushes } = build();
    await gw.announce('c1', { content: 'Hi' }, ME, { push: false });
    expect(pushes).toEqual([]);
  });

  it('the sender is never told', async () => {
    const { gw, sent, pushes } = build({ connected: [ME, OTHER] });
    await gw.announce('c1', { content: 'Hi' }, ME);
    expect(sent.some((x) => x.to === 'socket-me')).toBe(false);
    expect(pushes.every((p) => p.id === OTHER)).toBe(true);
  });
});
