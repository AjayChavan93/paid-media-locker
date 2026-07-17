const { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const S3rver = require('s3rver');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const s3Endpoint = config.RENDER_EXTERNAL_URL
  ? `${config.RENDER_EXTERNAL_URL}/s3-proxy`
  : `http://${config.HOST_IP}:${config.PORT}/s3-proxy`;

// Configure S3 Client pointing to our local s3rver via Express proxy
const s3Client = new S3Client({
  endpoint: s3Endpoint,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Necessary for local s3rver
});

function startS3rver() {
  const directory = path.join(__dirname, '../s3-storage');
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const s3rverInstance = new S3rver({
      port: config.S3_PORT,
      address: '0.0.0.0', // Listen on all network interfaces
      directory: directory,
      silent: true,
    });

    s3rverInstance.run(async (err, host, port) => {
      if (err) {
        console.error('Failed to start S3rver:', err);
        return reject(err);
      }
      console.log(`[S3rver] Mock S3 server running at http://${config.HOST_IP}:${port}`);
      
      // Ensure the default bucket exists
      try {
        await ensureBucketExists();
        resolve(s3rverInstance);
      } catch (bucketErr) {
        reject(bucketErr);
      }
    });
  });
}

async function ensureBucketExists() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }));
  } catch (error) {
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET }));
      console.log(`[S3rver] Created default bucket: ${config.S3_BUCKET}`);
    } catch (createErr) {
      console.error(`Failed to create bucket ${config.S3_BUCKET}:`, createErr);
      throw createErr;
    }
  }
}

async function uploadToS3(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
  return key;
}

async function getPresignedUrl(key, expiresInSeconds = 60) {
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

module.exports = {
  startS3rver,
  uploadToS3,
  getPresignedUrl,
  s3Client,
};
