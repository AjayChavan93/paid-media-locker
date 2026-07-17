const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Jimp = require('jimp');
const crypto = require('crypto');
const config = require('../config');
const { sequelize, User, Media, Unlock, Transaction } = require('../config/db');
const { uploadToS3, getPresignedUrl } = require('../services/s3Service');
const auth = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- AUTH ROUTES ---

// Register User
router.post('/auth/register', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ where: { username } }, { transaction: t });
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash,
      walletBalance: 1000 // default wallet balance
    }, { transaction: t });

    // Record the signup bonus transaction
    await Transaction.create({
      userId: user.id,
      amount: 1000,
      type: 'SIGNUP_BONUS',
      description: 'Signup welcome coin bonus'
    }, { transaction: t });

    await t.commit();

    // Generate JWT
    const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login User
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id }, config.JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        walletBalance: user.walletBalance
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// Get Current User Info
router.get('/auth/me', auth, async (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      walletBalance: req.user.walletBalance
    }
  });
});

// --- MEDIA ROUTES ---

// Upload Media
router.post('/media/upload', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, price } = req.body;
    const file = req.file;

    if (!title || !price || !file) {
      return res.status(400).json({ error: 'Title, price, and image file are required' });
    }

    const unlockPrice = parseInt(price, 10);
    if (isNaN(unlockPrice) || unlockPrice < 0) {
      return res.status(400).json({ error: 'Price must be a valid non-negative number' });
    }

    // Process image to generate preview using Jimp (resizing and blurring)
    let previewBuffer;
    try {
      const jimpImage = await Jimp.read(file.buffer);
      // Resize to 400px width (maintain aspect ratio) and apply blur
      jimpImage.resize(400, Jimp.AUTO).blur(20);
      previewBuffer = await jimpImage.getBufferAsync(Jimp.MIME_JPEG);
    } catch (jimpErr) {
      console.error('Jimp preview generation error:', jimpErr);
      return res.status(500).json({ error: 'Failed to process image preview' });
    }

    // Generate unique S3 keys
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const uniqueId = crypto.randomUUID();
    const originalKey = `media/original/${uniqueId}.${fileExtension}`;
    const previewKey = `media/preview/${uniqueId}.jpg`;

    // Upload files to S3
    await uploadToS3(originalKey, file.buffer, file.mimetype);
    await uploadToS3(previewKey, previewBuffer, 'image/jpeg');

    // Save metadata in database
    const media = await Media.create({
      title,
      price: unlockPrice,
      s3OriginalKey: originalKey,
      s3PreviewKey: previewKey,
      uploaderId: req.user.id
    });

    return res.status(201).json({
      message: 'Media uploaded successfully',
      media: {
        id: media.id,
        title: media.title,
        price: media.price,
        uploaderId: media.uploaderId
      }
    });
  } catch (error) {
    console.error('Media upload error:', error);
    return res.status(500).json({ error: 'Failed to upload media' });
  }
});

// Get Media Feed (lists media with locked/unlocked dynamic access URLs)
router.get('/media/feed', auth, async (req, res) => {
  try {
    const mediaItems = await Media.findAll({
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'username'] },
        { model: Unlock, as: 'unlocks', attributes: ['userId'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const feed = await Promise.all(mediaItems.map(async (item) => {
      const isOwner = item.uploaderId === req.user.id;
      const isUnlocked = item.unlocks.some(u => u.userId === req.user.id);
      
      let imageUrl = '';
      let status = 'locked';

      if (isOwner) {
        status = 'owned';
        imageUrl = await getPresignedUrl(item.s3OriginalKey, 60); // 60 seconds access
      } else if (isUnlocked) {
        status = 'unlocked';
        imageUrl = await getPresignedUrl(item.s3OriginalKey, 60); // 60 seconds access
      } else {
        status = 'locked';
        imageUrl = await getPresignedUrl(item.s3PreviewKey, 60); // 60 seconds access for previews too (prevents hotlinking)
      }

      return {
        id: item.id,
        title: item.title,
        price: item.price,
        status,
        imageUrl,
        uploader: item.uploader.username,
        createdAt: item.createdAt
      };
    }));

    return res.json({ feed });
  } catch (error) {
    console.error('Feed retrieval error:', error);
    return res.status(500).json({ error: 'Failed to load media feed' });
  }
});

// Unlock Media Content
router.post('/media/:id/unlock', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const mediaId = req.params.id;
    const media = await Media.findByPk(mediaId, {
      include: [{ model: User, as: 'uploader' }],
      transaction: t
    });

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Owner doesn't need to unlock
    if (media.uploaderId === req.user.id) {
      return res.status(400).json({ error: 'You already own this media' });
    }

    // Check if already unlocked
    const existingUnlock = await Unlock.findOne({
      where: { userId: req.user.id, mediaId: media.id },
      transaction: t
    });
    if (existingUnlock) {
      return res.status(400).json({ error: 'Media is already unlocked' });
    }

    // Fetch fresh user data within transaction to prevent race conditions
    const buyer = await User.findByPk(req.user.id, { transaction: t });
    if (buyer.walletBalance < media.price) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Deduct coins from buyer
    buyer.walletBalance -= media.price;
    await buyer.save({ transaction: t });

    // Credit coins to uploader (seller)
    const seller = media.uploader;
    seller.walletBalance += media.price;
    await seller.save({ transaction: t });

    // Create Unlock record
    await Unlock.create({
      userId: buyer.id,
      mediaId: media.id,
      priceSpent: media.price
    }, { transaction: t });

    // Create Transaction history for buyer
    await Transaction.create({
      userId: buyer.id,
      amount: -media.price,
      type: 'DEBIT_UNLOCK',
      description: `Unlocked media "${media.title}" by ${seller.username}`
    }, { transaction: t });

    // Create Transaction history for seller
    await Transaction.create({
      userId: seller.id,
      amount: media.price,
      type: 'CREDIT_UNLOCK',
      description: `Earned from "${media.title}" unlocked by ${buyer.username}`
    }, { transaction: t });

    await t.commit();

    return res.json({
      message: 'Media unlocked successfully',
      newBalance: buyer.walletBalance
    });
  } catch (error) {
    await t.rollback();
    console.error('Media unlocking error:', error);
    return res.status(500).json({ error: 'Failed to unlock media content' });
  }
});

// --- WALLET ROUTES ---

// Get Wallet Balance and Transaction History
router.get('/wallet/history', auth, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      balance: req.user.walletBalance,
      transactions
    });
  } catch (error) {
    console.error('Wallet history error:', error);
    return res.status(500).json({ error: 'Failed to retrieve wallet history' });
  }
});

module.exports = router;
