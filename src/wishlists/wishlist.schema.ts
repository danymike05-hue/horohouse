import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WishlistDocument = Wishlist & Document;

/**
 * Named list of saved places (Airbnb wishlists). user.favorites stays the set of every
 * saved place (the heart); a wishlist groups some of them and can be shared by link.
 */
@Schema({ timestamps: true, collection: 'wishlists' })
export class Wishlist {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 50, trim: true })
  name: string;

  @Prop({ type: [Types.ObjectId], ref: 'Property', default: [] })
  propertyIds: Types.ObjectId[];

  /** Secret part of the share link; unset = not shared */
  @Prop({ type: String, index: { unique: true, sparse: true } })
  shareToken?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const WishlistSchema = SchemaFactory.createForClass(Wishlist);
