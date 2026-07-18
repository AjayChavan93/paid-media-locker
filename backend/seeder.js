const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Jimp = require('jimp');
const crypto = require('crypto');
const { User, Media } = require('./config/db');
const { uploadToS3 } = require('./services/s3Service');

async function seedDatabase() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    
    // 1. Seed Users
    let seller = await User.findOne({ where: { username: 'seller' } });
    if (!seller) {
      seller = await User.create({ username: 'seller', passwordHash, walletBalance: 1000 });
      console.log(`[Seeder] Created demo account: seller`);
    }

    let buyer = await User.findOne({ where: { username: 'buyer' } });
    if (!buyer) {
      buyer = await User.create({ username: 'buyer', passwordHash, walletBalance: 1000 });
      console.log(`[Seeder] Created demo account: buyer`);
    }

    // 2. Seed Media if database is empty
    const mediaCount = await Media.count();
    if (mediaCount === 0) {
      console.log(`[Seeder] No media found. Seeding initial demo images...`);
      
      const demoImages = [
        { file: 'demo1.jpg', title: 'Abstract Fluid Colors', price: 250, uploaderId: seller.id },
        { file: 'demo2.jpg', title: 'Neon Cyberpunk Art', price: 150, uploaderId: buyer.id }
      ];

      for (const img of demoImages) {
        const filePath = path.join(__dirname, 'assets', img.file);
        if (!fs.existsSync(filePath)) {
          console.log(`[Seeder] Warning: Asset ${img.file} not found. Skipping.`);
          continue;
        }

        const fileBuffer = fs.readFileSync(filePath);
        
        // Generate Jimp Preview
        const jimpImage = await Jimp.read(fileBuffer);
        jimpImage.resize(400, Jimp.AUTO).blur(20);
        const previewBuffer = await jimpImage.getBufferAsync(Jimp.MIME_JPEG);

        // Upload to internal S3rver
        const uniqueId = crypto.randomUUID();
        const originalKey = `media/original/${uniqueId}.jpg`;
        const previewKey = `media/preview/${uniqueId}.jpg`;

        await uploadToS3(originalKey, fileBuffer, 'image/jpeg');
        await uploadToS3(previewKey, previewBuffer, 'image/jpeg');

        // Save to DB
        await Media.create({
          title: img.title,
          price: img.price,
          s3OriginalKey: originalKey,
          s3PreviewKey: previewKey,
          uploaderId: img.uploaderId
        });
        console.log(`[Seeder] Uploaded and seeded media: ${img.title}`);
      }
    }
    
    console.log('[Seeder] Database and Media Seeding Complete.');
  } catch (error) {
    console.error('[Seeder] Error during seeding:', error);
  }
}

module.exports = seedDatabase;
