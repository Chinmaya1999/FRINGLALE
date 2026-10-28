import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing required env var ${k}`);
}

if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET.length < 32 || /change-me|secret|password/i.test(process.env.JWT_SECRET))) {
  throw new Error('JWT_SECRET must be at least 32 random characters in production');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  priceLockMinutes: Number(process.env.PRICE_LOCK_MINUTES || 15),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  goldApiUrl: process.env.GOLD_API_URL || '',
  goldApiKey: process.env.GOLD_API_KEY || '',
};
