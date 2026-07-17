const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const config = require('./config');

const s3Client = new S3Client({
  endpoint: `http://localhost:5000/s3-proxy`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY,
    secretAccessKey: config.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function test() {
  try {
    console.log("Uploading...");
    await s3Client.send(new PutObjectCommand({
      Bucket: config.S3_BUCKET,
      Key: 'test.txt',
      Body: 'hello world',
    }));
    console.log("Upload Success");
  } catch (err) {
    console.error("Upload Failed:", err);
  }
}

test();
