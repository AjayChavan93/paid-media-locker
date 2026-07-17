const os = require('os');
const path = require('path');
require('dotenv').config();

function getLocalIpAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const hostIp = process.env.HOST_IP || getLocalIpAddress();

module.exports = {
  PORT: process.env.PORT || 5000,
  HOST_IP: hostIp,
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_key_paid_media_locker_123',
  DB_STORAGE_PATH: process.env.DB_STORAGE_PATH || path.join(__dirname, 'database.sqlite'),
  S3_PORT: process.env.S3_PORT || 9000,
  S3_BUCKET: process.env.S3_BUCKET || 'media-locker-bucket',
  S3_ACCESS_KEY: 'S3RVER',
  S3_SECRET_KEY: 'S3RVER',
  RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
};
