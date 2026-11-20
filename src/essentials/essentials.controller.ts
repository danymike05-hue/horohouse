import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import {
  AdminOrdersQueryDto,
  AdminShopsQueryDto,
  ApplyShopDto,
  CityQueryDto,
  CreateOrderDto,
  DisputeDto,
  InterestDto,
  InviteShopDto,
  ItemOfferDto,
  ItemsQueryDto,
  ItemTypeDto,
  KitOfferDto,
  MarketDto,
  PartActionDto,
  PutCartDto,
  RateDto,
  ReasonDto,
  ResolveDisputeDto,
  SendPayoutDto,
  TemplateDto,
  UpdateShopDto,
} from './dto/essentials.dto';
import { EssentialsAdminService } from './essentials-admin.service';
import { EssentialsService } from './essentials.service';
import { PartnerService } from './partner.service';

const uid = (req: any): string => String(req.user?._id ?? req.user?.id ?? req.user?.userId ?? req.user?.sub);
const PHOTO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const DOC_MIME_TYPES = [...PHOTO_MIME_TYPES, 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

@ApiTags('Essentials')
@ApiBearerAuth()
@Controller('essentials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EssentialsController {
  constructor(
    private readonly ess: EssentialsService,
    private readonly partner: PartnerService,
    private readonly admin: EssentialsAdminService,
  ) {}

  // ════════════════ Uploads (photos for shops, items and problem reports) ════════════════

  @Post('photos')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one photo or document (shop documents may be PDF)' })
  async upload(@Req() req: any, @Query('kind') kind?: string) {
    const data = await req.file();
    if (!data) throw new BadRequestException('No file uploaded');
    const isDoc = kind === 'document';
    const mime = String(data.mimetype).toLowerCase();
    if (!(isDoc ? DOC_MIME_TYPES : PHOTO_MIME_TYPES).includes(mime)) throw new BadRequestException(isDoc ? 'Upload a photo or a PDF' : 'Upload a photo (JPG, PNG, WEBP or HEIC)');
    const buffer: Buffer = await data.toBuffer();
    if (buffer.length > MAX_BYTES) throw new BadRequestException('The file is too large (10 MB maximum)');
    const result = await uploadBufferToCloudinary(buffer, {
      folder: isDoc ? 'horohouse/essentials-documents' : 'horohouse/essentials',
      resourceType: mime === 'application/pdf' ? 'raw' : 'image',
    } as any);
    return { url: result.secure_url };
  }

  // ════════════════ Admin (before the ":id" routes) ════════════════

  @Get('admin/overview') @Roles(UserRole.ADMIN)
  adminOverview() { return this.admin.overview(); }

  @Get('admin/shops') @Roles(UserRole.ADMIN)
  adminShops(@Query() q: AdminShopsQueryDto) { return this.admin.shops(q); }

  @Post('admin/shops/invite') @Roles(UserRole.ADMIN)
  adminInvite(@Body() dto: InviteShopDto) { return this.admin.invite(dto); }

  @Post('admin/shops/:id/:action') @Roles(UserRole.ADMIN) @HttpCode(200)
  adminShopStatus(@Param('id') id: string, @Param('action') action: string, @Body() dto: ReasonDto) {
    if (!['approve', 'reject', 'suspend', 'reinstate'].includes(action)) throw new BadRequestException('Unknown action');
    return this.admin.setStatus(id, action as any, dto.reason);
  }

  @Get('admin/catalogue') @Roles(UserRole.ADMIN)
  adminCatalogue() { return this.admin.catalogue(); }

  @Patch('admin/market') @Roles(UserRole.ADMIN)
  adminMarket(@Body() dto: MarketDto) { return this.admin.updateMarket(dto); }

  @Post('admin/templates') @Roles(UserRole.ADMIN)
  adminNewTemplate(@Body() dto: TemplateDto) { return this.admin.saveTemplate(null, dto); }

  @Patch('admin/templates/:id') @Roles(UserRole.ADMIN)
  adminEditTemplate(@Param('id') id: string, @Body() dto: TemplateDto) { return this.admin.saveTemplate(id, dto); }

  @Post('admin/item-types') @Roles(UserRole.ADMIN)
  adminNewItemType(@Body() dto: ItemTypeDto) { return this.admin.saveItemType(null, dto); }

  @Patch('admin/item-types/:key') @Roles(UserRole.ADMIN)
  adminEditItemType(@Param('key') key: string, @Body() dto: ItemTypeDto) { return this.admin.saveItemType(key, dto); }

  @Get('admin/orders') @Roles(UserRole.ADMIN)
  adminOrders(@Query() q: AdminOrdersQueryDto) { return this.admin.orders(q); }

  @Post('admin/parts/:partId/resolve') @Roles(UserRole.ADMIN) @HttpCode(200)
  adminResolve(@Param('partId') partId: string, @Body() dto: ResolveDisputeDto) { return this.admin.resolveDispute(partId, dto); }

  @Post('admin/parts/:partId/refund-retry') @Roles(UserRole.ADMIN) @HttpCode(200)
  adminRetryRefund(@Param('partId') partId: string) { return this.admin.retryRefund(partId); }

  @Post('admin/parts/:partId/refund-done') @Roles(UserRole.ADMIN) @HttpCode(200)
  adminRefundDone(@Param('partId') partId: string) { return this.admin.markRefunded(partId); }

  @Get('admin/payouts') @Roles(UserRole.ADMIN)
  adminPayouts() { return this.admin.payoutsView(); }

  @Post('admin/payouts') @Roles(UserRole.ADMIN)
  adminSendPayout(@Req() req: any, @Body() dto: SendPayoutDto) { return this.admin.sendPayout(uid(req), dto); }

  @Get('admin/insights') @Roles(UserRole.ADMIN)
  adminInsights() { return this.admin.insights(); }

  // ════════════════ Partner shops ════════════════

  @Get('partner/shop')
  @ApiOperation({ summary: 'My partner shop (or null)' })
  myShop(@Req() req: any) { return this.partner.getShop(uid(req)); }

  @Post('partner/apply')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Save or send my shop application (an invite code claims an invited shop)' })
  apply(@Req() req: any, @Body() dto: ApplyShopDto) { return this.partner.apply(uid(req), dto); }

  @Patch('partner/shop')
  updateShop(@Req() req: any, @Body() dto: UpdateShopDto) { return this.partner.updateShop(uid(req), dto); }

  @Get('partner/templates')
  partnerTemplates(@Req() req: any) { return this.partner.templates(uid(req)); }

  @Put('partner/kit-offers/:templateId')
  putKitOffer(@Req() req: any, @Param('templateId') templateId: string, @Body() dto: KitOfferDto) { return this.partner.putKitOffer(uid(req), templateId, dto); }

  @Delete('partner/kit-offers/:templateId')
  removeKitOffer(@Req() req: any, @Param('templateId') templateId: string) { return this.partner.removeKitOffer(uid(req), templateId); }

  @Get('partner/item-types')
  partnerItemTypes() { return this.partner.itemTypes(); }

  @Get('partner/item-offers')
  partnerItems(@Req() req: any) { return this.partner.myItems(uid(req)); }

  @Post('partner/item-offers')
  createItem(@Req() req: any, @Body() dto: ItemOfferDto) { return this.partner.createItem(uid(req), dto); }

  @Patch('partner/item-offers/:id')
  updateItem(@Req() req: any, @Param('id') id: string, @Body() dto: ItemOfferDto) { return this.partner.updateItem(uid(req), id, dto); }

  @Delete('partner/item-offers/:id')
  deleteItem(@Req() req: any, @Param('id') id: string) { return this.partner.deleteItem(uid(req), id); }

  @Get('partner/orders')
  partnerOrders(@Req() req: any, @Query('tab') tab?: string) {
    return this.partner.orders(uid(req), tab === 'active' || tab === 'done' ? tab : 'new');
  }

  @Post('partner/parts/:partId/:action') @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  partnerAct(@Req() req: any, @Param('partId') partId: string, @Param('action') action: string, @Body() dto: PartActionDto) {
    if (!['accept', 'decline', 'packed', 'out', 'delivered'].includes(action)) throw new BadRequestException('Unknown action');
    return this.partner.act(uid(req), partId, action as any, dto);
  }

  @Get('partner/money')
  partnerMoney(@Req() req: any) { return this.partner.money(uid(req)); }

  // ════════════════ Students ════════════════

  @Get('home')
  @ApiOperation({ summary: 'Kits with best prices, categories and cities for a delivery city' })
  home(@Req() req: any, @Query() q: CityQueryDto) { return this.ess.home(uid(req), q.city); }

  @Get('delivery-defaults')
  deliveryDefaults(@Req() req: any) { return this.ess.deliveryDefaults(uid(req)); }

  @Get('kits/:templateId/offers')
  kitOffers(@Param('templateId') id: string, @Query() q: CityQueryDto) { return this.ess.kitTemplateOffers(id, q.city ?? ''); }

  @Get('kit-offers/:id')
  kitOffer(@Param('id') id: string, @Query() q: CityQueryDto) { return this.ess.kitOffer(id, q.city ?? ''); }

  @Get('items')
  items(@Query() q: ItemsQueryDto) { return this.ess.items(q); }

  @Get('item-offers/:id')
  itemOffer(@Param('id') id: string, @Query() q: CityQueryDto) { return this.ess.itemOffer(id, q.city ?? ''); }

  @Get('item-types/:key/offers')
  itemTypeOffers(@Param('key') key: string, @Query() q: CityQueryDto) { return this.ess.itemTypeOffers(key, q.city ?? ''); }

  @Get('shops/:slug')
  shopPage(@Param('slug') slug: string, @Query() q: CityQueryDto) { return this.ess.shopPage(slug, q.city ?? ''); }

  @Get('cart')
  cart(@Req() req: any) { return this.ess.getCart(uid(req)); }

  @Put('cart')
  putCart(@Req() req: any, @Body() dto: PutCartDto) { return this.ess.putCart(uid(req), dto); }

  @Post('orders')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Turn the cart into an order waiting for payment (then pay through /checkout with purpose "essentials")' })
  createOrder(@Req() req: any, @Body() dto: CreateOrderDto) { return this.ess.createOrder(uid(req), dto); }

  @Get('orders')
  myOrders(@Req() req: any) { return this.ess.myOrders(uid(req)); }

  @Get('orders/:id')
  myOrder(@Req() req: any, @Param('id') id: string) { return this.ess.myOrder(uid(req), id); }

  @Post('orders/:id/parts/:partId/received') @HttpCode(200)
  received(@Req() req: any, @Param('id') id: string, @Param('partId') partId: string) { return this.ess.studentReceived(uid(req), id, partId); }

  @Post('orders/:id/parts/:partId/cancel') @HttpCode(200)
  cancel(@Req() req: any, @Param('id') id: string, @Param('partId') partId: string) { return this.ess.studentCancel(uid(req), id, partId); }

  @Post('orders/:id/parts/:partId/dispute') @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  dispute(@Req() req: any, @Param('id') id: string, @Param('partId') partId: string, @Body() dto: DisputeDto) { return this.ess.studentDispute(uid(req), id, partId, dto); }

  @Post('orders/:id/parts/:partId/rate') @HttpCode(200)
  rate(@Req() req: any, @Param('id') id: string, @Param('partId') partId: string, @Body() dto: RateDto) { return this.ess.studentRate(uid(req), id, partId, dto); }

  @Post('interest') @HttpCode(200)
  interest(@Req() req: any, @Body() dto: InterestDto) { return this.ess.addInterest(uid(req), dto.city); }
}
