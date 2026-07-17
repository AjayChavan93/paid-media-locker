const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.DB_STORAGE_PATH,
  logging: false, // Turn off query logs for clean output
});

// Models Definition
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  walletBalance: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1000, // Starting balance is 1000 coins
  },
});

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  s3OriginalKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  s3PreviewKey: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Unlock = sequelize.define('Unlock', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  priceSpent: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false, // positive for credit, negative for debit
  },
  type: {
    type: DataTypes.STRING, // 'SIGNUP', 'DEBIT_UNLOCK', 'CREDIT_UNLOCK'
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Associations
User.hasMany(Media, { foreignKey: 'uploaderId', as: 'uploadedMedia' });
Media.belongsTo(User, { foreignKey: 'uploaderId', as: 'uploader' });

User.hasMany(Unlock, { foreignKey: 'userId', as: 'unlocks' });
Unlock.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Media.hasMany(Unlock, { foreignKey: 'mediaId', as: 'unlocks' });
Unlock.belongsTo(Media, { foreignKey: 'mediaId', as: 'media' });

User.hasMany(Transaction, { foreignKey: 'userId', as: 'transactions' });
Transaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Media,
  Unlock,
  Transaction,
};
