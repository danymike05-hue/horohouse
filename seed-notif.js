const mongoose = require('mongoose');

// Never write the connection string here: it ends up on GitHub
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('Set MONGODB_URI first'); process.exit(1); }

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Get a recent user to attach the notification to
    const users = await db.collection('users').find().sort({ _id: -1 }).limit(5).toArray();
    
    if (users.length === 0) {
      console.log('No users found in database.');
      process.exit(1);
    }
    
    console.log(`Found ${users.length} users. Creating test notifications...`);
    
    const notifications = users.map(user => ({
      userId: user._id,
      type: 'booking_confirmed',
      title: 'Booking Confirmed! 🎉',
      message: 'Your stay at the Seaside Villa has been confirmed (Aug 15 -> Aug 20). Get ready for an amazing trip!',
      link: '/bookings/test-id-123',
      metadata: {
        bookingId: 'test-id-123',
        propertyTitle: 'Seaside Villa',
      },
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    const result = await db.collection('notifications').insertMany(notifications);
    console.log(`Successfully inserted ${result.insertedCount} notifications.`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seed();
