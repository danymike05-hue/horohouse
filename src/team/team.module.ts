import { BadRequestException, Body, CallHandler, Controller, Delete, ExecutionContext, Get, Injectable, Logger, Module, NestInterceptor,
  NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, Length } from 'class-validator';
import { HydratedDocument, Model, Types } from 'mongoose';
import { Observable, tap } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { ROLES_KEY, Roles, RolesGuard } from '../auth/guards/roles.guard';
import { AREA_KEY, TEAM_AREAS, TEAM_REFUND_LIMIT_XAF, isTeamArea } from '../auth/team-areas';
import { User, UserDocument, UserRole, UserSchema } from '../users/schemas/user.schema';
import { normalizeCmPhone } from '../checkout/momo.util';

// ── What the team did ─────────────────────────────────────────────────────────

/** One admin action: every change, and every look at an ID document */
@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'admin_actions' })
export class AdminAction {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true }) actorId: Types.ObjectId;
  @Prop() actorName?: string;
  /** owner (an admin) or team (a team member) */
  @Prop() actorKind: 'owner' | 'team';
  @Prop() method: string;
  @Prop() path: string;
  @Prop({ type: [String], default: [] }) areas: string[];
  @Prop() ok: boolean;
  @Prop() status?: number;
  createdAt?: Date;
}
export type AdminActionDocument = HydratedDocument<AdminAction>;
export const AdminActionSchema = SchemaFactory.createForClass(AdminAction);
AdminActionSchema.index({ createdAt: -1 });
// Kept for a year
AdminActionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

@Injectable()
export class AdminActionInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AdminActions');
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(AdminAction.name) private readonly actions: Model<AdminActionDocument>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.includes(UserRole.ADMIN)) return next.handle();
    const req: any = context.switchToHttp().getRequest();
    const user = req?.user;
    const team = Array.isArray(user?.staffPermissions) && user.staffPermissions.length > 0;
    if (!user || (user.role !== UserRole.ADMIN && !team)) return next.handle();
    const areas = this.reflector.getAllAndOverride<string[]>(AREA_KEY, [context.getHandler(), context.getClass()]) ?? [];
    const method = String(req.method ?? '').toUpperCase();
    const path = String(req.url ?? '').split('?')[0];
    // Changes always; reading only when it opens someone's ID document
    const worthIt = method !== 'GET' || /document|government-id/i.test(path);
    if (!worthIt) return next.handle();
    const record = (ok: boolean, status?: number) => {
      this.actions.create({
        actorId: user._id ?? user.userId, actorName: user.name, actorKind: user.role === UserRole.ADMIN ? 'owner' : 'team',
        method, path, areas, ok, status,
      }).catch((e) => this.logger.warn(`Could not record an admin action: ${e?.message}`));
    };
    return next.handle().pipe(tap({ next: () => record(true, 200), error: (e) => record(false, e?.status ?? 500) }));
  }
}

// ── Managing the team (the owner only) ───────────────────────────────────────

class AddMemberDto {
  /** Their email or phone number, as on their HoroHouse account */
  @IsString() @Length(3, 120) contact: string;
  @IsArray() @ArrayMaxSize(TEAM_AREAS.length) @IsString({ each: true }) areas: string[];
}
class SetAreasDto {
  @IsArray() @ArrayMaxSize(TEAM_AREAS.length) @IsString({ each: true }) areas: string[];
}

const MEMBER_FIELDS = 'name email phoneNumber profilePicture role staffPermissions staffAccessMeta';

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(AdminAction.name) private readonly actions: Model<AdminActionDocument>,
  ) {}

  private clean(areas: string[]): string[] {
    const bad = (areas ?? []).filter((a) => !isTeamArea(a));
    if (bad.length) throw new BadRequestException(`Unknown access: ${bad.join(', ')}`);
    return Array.from(new Set(areas));
  }

  async list() {
    const members = await this.users.find({ 'staffPermissions.0': { $exists: true } }).select(MEMBER_FIELDS).sort({ name: 1 }).lean().exec();
    return { areas: TEAM_AREAS, refundLimit: TEAM_REFUND_LIMIT_XAF, members };
  }

  private async findByContact(contact: string) {
    const c = contact.trim();
    if (c.includes('@')) return this.users.findOne({ email: c.toLowerCase() }).exec();
    const local = normalizeCmPhone(c);
    if (!local) throw new BadRequestException('Enter the email or Cameroonian phone number of their HoroHouse account.');
    return this.users.findOne({ phoneNumber: { $regex: `${local}$` } }).exec();
  }

  private async save(user: UserDocument | null, areas: string[], by: string) {
    if (!user) throw new NotFoundException('No HoroHouse account with that email or phone. Ask them to create one first.');
    if (user.role === UserRole.ADMIN) throw new BadRequestException('This person is an admin: they already have every access.');
    if ((user as any).deletedAt) throw new BadRequestException('This account was deleted.');
    await this.users.updateOne({ _id: user._id }, { $set: { staffPermissions: this.clean(areas), staffAccessMeta: { updatedAt: new Date(), updatedBy: by } } }).exec();
    return this.users.findById(user._id).select(MEMBER_FIELDS).lean().exec();
  }

  async add(by: string, dto: AddMemberDto) {
    if (!dto.areas?.length) throw new BadRequestException('Choose at least one area.');
    return this.save(await this.findByContact(dto.contact), dto.areas, by);
  }

  async setAreas(by: string, userId: string, areas: string[]) {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('Member not found');
    return this.save(await this.users.findById(userId).exec(), areas, by);
  }

  async activity(page = 1, actorId?: string) {
    const limit = 40;
    const q: any = {};
    if (actorId && Types.ObjectId.isValid(actorId)) q.actorId = new Types.ObjectId(actorId);
    const items = await this.actions.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit + 1).lean().exec();
    return { items: items.slice(0, limit), hasMore: items.length > limit };
  }
}

@ApiTags('Team')
@ApiBearerAuth('JWT-auth')
@Controller('admin/team')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // the owner only: team members can't give access
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'Team members and what they can use (owner)' })
  list() { return this.team.list(); }

  @Post()
  @ApiOperation({ summary: 'Give someone access to parts of the admin side (owner)' })
  add(@Req() req: any, @Body() dto: AddMemberDto) { return this.team.add(String(req.user.userId), dto); }

  @Patch(':userId')
  @ApiOperation({ summary: 'Change what a team member can use; an empty list removes them (owner)' })
  set(@Req() req: any, @Param('userId') userId: string, @Body() dto: SetAreasDto) { return this.team.setAreas(String(req.user.userId), userId, dto.areas); }

  @Delete(':userId')
  @ApiOperation({ summary: 'Remove a team member (owner)' })
  remove(@Req() req: any, @Param('userId') userId: string) { return this.team.setAreas(String(req.user.userId), userId, []); }

  @Get('activity')
  @ApiOperation({ summary: 'What the team did, newest first (owner)' })
  activity(@Query('page') page?: string, @Query('userId') userId?: string) { return this.team.activity(Math.max(1, Number(page) || 1), userId); }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: AdminAction.name, schema: AdminActionSchema }, { name: User.name, schema: UserSchema }])],
  controllers: [TeamController],
  providers: [TeamService, { provide: APP_INTERCEPTOR, useClass: AdminActionInterceptor }],
})
export class TeamModule {}
