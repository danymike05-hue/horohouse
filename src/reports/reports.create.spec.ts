import { ReportsService } from './reports.service';

const PROPERTY = '507f1f77bcf86cd799439081';
const OWNER = '507f1f77bcf86cd799439082';
const REPORTER = '507f1f77bcf86cd799439083';
const dto = { reason: 'Fraudulent / scam' };

function build(opts: { property?: any; existing?: any } = {}) {
  const save = jest.fn().mockResolvedValue({ _id: 'r1' });
  const reportModel: any = jest.fn(() => ({ save }));
  reportModel.exists = jest.fn().mockResolvedValue(opts.existing ?? null);
  const property = opts.property === undefined ? { _id: PROPERTY, ownerId: OWNER, title: 'Villa' } : opts.property;
  const propertyModel: any = { findById: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve(property) }) })) };
  const notifications: any = { notifyAdmins: jest.fn().mockResolvedValue(undefined) };
  const service = new ReportsService(reportModel, propertyModel, {} as any, {} as any, notifications);
  return { service, save, notifications };
}

describe('ReportsService.hideListing', () => {
  const ADMIN: any = { _id: 'admin' };

  function buildHide(updated: any = { _id: PROPERTY, ownerId: OWNER, title: 'Villa' }, openReports: any[] = []) {
    const reportModel: any = {
      findById: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve({ property: PROPERTY }) }) }) })),
      updateMany: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(openReports) }) }) })),
    };
    const propertyModel: any = {
      findByIdAndUpdate: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(updated) }) }) })),
    };
    const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new ReportsService(reportModel, propertyModel, {} as any, {} as any, notifications);
    return { service, reportModel, propertyModel, notifications };
  }
  const REPORT = '507f1f77bcf86cd799439084';

  it('rejects the listing, so the owner cannot turn it back on', async () => {
    const { service, propertyModel } = buildHide();
    await service.hideListing(REPORT, 'Fake photos', ADMIN);
    expect(propertyModel.findByIdAndUpdate).toHaveBeenCalledWith(PROPERTY, { approvalStatus: 'rejected', isActive: false, rejectionReason: 'Fake photos' });
  });

  it('closes every open report on the listing and tells the owner', async () => {
    const { service, reportModel, notifications } = buildHide();
    await service.hideListing(REPORT, 'Fake photos', ADMIN);
    expect(reportModel.updateMany).toHaveBeenCalledWith(
      { property: PROPERTY, status: { $in: ['pending', 'reviewed'] } },
      expect.objectContaining({ status: 'resolved' }),
    );
    expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: OWNER }), expect.objectContaining({ title: 'Votre annonce a été masquée' }));
  });

  it('a failed notice does not undo it, and a deleted listing is a clear error', async () => {
    const failing = buildHide();
    failing.notifications.create.mockRejectedValue(new Error('down'));
    await expect(failing.service.hideListing(REPORT, 'x y z', ADMIN)).resolves.toBeDefined();
    await expect(buildHide(null as any).service.hideListing(REPORT, 'x y z', ADMIN)).rejects.toThrow('no longer exists');
  });
});

describe('ReportsService.create', () => {
  it('saves the report and tells the admins', async () => {
    const { service, save, notifications } = build();
    await service.create(dto, REPORTER, PROPERTY);
    expect(save).toHaveBeenCalledTimes(1);
    expect(notifications.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it('a failed admin notice does not lose the report', async () => {
    const { service, notifications } = build();
    notifications.notifyAdmins.mockRejectedValue(new Error('mail down'));
    await expect(service.create(dto, REPORTER, PROPERTY)).resolves.toBeDefined();
  });

  it('refuses a listing that does not exist, or a bad id', async () => {
    await expect(build({ property: null }).service.create(dto, REPORTER, PROPERTY)).rejects.toThrow('not found');
    await expect(build().service.create(dto, REPORTER, 'nope')).rejects.toThrow('not found');
  });

  it('hosts cannot report their own listing', async () => {
    await expect(build().service.create(dto, OWNER, PROPERTY)).rejects.toThrow('your own');
  });

  it('one open report per person per listing', async () => {
    const { service, save } = build({ existing: { _id: 'old' } });
    await expect(service.create(dto, REPORTER, PROPERTY)).rejects.toThrow('already reported');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('telling reporters the outcome', () => {
  const ADMIN: any = { _id: 'admin' };
  const REPORT = '507f1f77bcf86cd799439084';
  const OTHER = '507f1f77bcf86cd799439085';

  function build(opts: { before?: any; after?: any; openReports?: any[] } = {}) {
    const after = opts.after ?? { status: 'dismissed', reporter: { _id: REPORTER }, property: { title: 'Villa' } };
    const populated = { populate: () => ({ exec: () => Promise.resolve(after) }) };
    const reportModel: any = {
      findById: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(opts.before ?? { status: 'pending', property: PROPERTY }) }) }) })),
      findByIdAndUpdate: jest.fn(() => ({ populate: () => populated })),
      find: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve(opts.openReports ?? []) }) }) })),
      updateMany: jest.fn().mockResolvedValue(undefined),
    };
    const propertyModel: any = {
      findByIdAndUpdate: jest.fn(() => ({ select: () => ({ lean: () => ({ exec: () => Promise.resolve({ _id: PROPERTY, ownerId: OWNER, title: 'Villa' }) }) }) })),
    };
    const notifications: any = { create: jest.fn().mockResolvedValue(undefined) };
    const service = new ReportsService(reportModel, propertyModel, {} as any, {} as any, notifications);
    return { service, notifications };
  }
  const sentTo = (n: any) => n.create.mock.calls.map((c: any[]) => c[0].userId);

  it('a dismissed report: the reporter hears it stays up, in English and French', async () => {
    const { service, notifications } = build();
    await service.updateStatus(REPORT, { status: 'dismissed' } as any);
    const [dto, fr] = notifications.create.mock.calls[0];
    expect(dto).toEqual(expect.objectContaining({ userId: REPORTER, title: 'We reviewed your report' }));
    expect(dto.message).toContain('stays up');
    expect(fr.message).toContain('reste en ligne');
  });

  it('only when an open report is closed, not on every edit', async () => {
    const { service, notifications } = build({ before: { status: 'dismissed' } });
    await service.updateStatus(REPORT, { status: 'dismissed', adminNotes: 'note' } as any);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('hiding a listing tells everyone who reported it once, and the owner', async () => {
    const { service, notifications } = build({ openReports: [{ reporter: REPORTER }, { reporter: OTHER }, { reporter: REPORTER }] });
    await service.hideListing(REPORT, 'Fake photos', ADMIN);
    expect(sentTo(notifications).sort()).toEqual([OWNER, REPORTER, OTHER].sort());
    const reporterCall = notifications.create.mock.calls.find((c: any[]) => c[0].userId === OTHER);
    expect(reporterCall[0].message).toContain('took it off HoroHouse');
    expect(reporterCall[0].message).not.toContain('Fake photos');
  });
});
