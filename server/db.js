import { MongoClient } from 'mongodb';

let client = null;
let database = null;
let connecting = null;

const DB_NAME = process.env.MONGODB_DB || 'piso_tabs_licensing';

function logConnectionError(error) {
  console.error('[MongoDB] Connection error:', error.message);
  if (error.reason?.servers) {
    for (const [host, description] of error.reason.servers) {
      console.error(`[MongoDB] ${host}:`, description.error?.message || description.type);
    }
  }
}

async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const newClient = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 20000,
    maxPoolSize: 15,
    retryWrites: true
  });
  try {
    console.log('[MongoDB] Connecting to Atlas...');
    await newClient.connect();
    const newDatabase = newClient.db(DB_NAME);
    await newDatabase.command({ ping: 1 });
    console.log('[MongoDB] Connected successfully');
    await Promise.all([
      newDatabase.collection('admins').createIndex({ email: 1 }, { unique: true }),
      newDatabase.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
      newDatabase.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      newDatabase.collection('licenses').createIndex({ keyHash: 1 }, { unique: true }),
      newDatabase.collection('licenses').createIndex({ requestId: 1 }, { unique: true, partialFilterExpression: { requestId: { $exists: true } } }),
      newDatabase.collection('licenses').createIndex({ createdAt: -1 }),
      newDatabase.collection('licenses').createIndex({ customer: 1 }),
      newDatabase.collection('audit_logs').createIndex({ createdAt: -1 })
    ]);
    client = newClient;
    database = newDatabase;
    console.log('[MongoDB] Database indexes ready');
    return database;
  } catch (error) {
    logConnectionError(error);
    await newClient.close().catch(() => {});
    throw error;
  }
}

export async function db() {
  if (database) return database;
  if (!connecting) connecting = connectDatabase().finally(() => { connecting = null; });
  return connecting;
}

export function getClient() {
  if (!client) throw new Error('MongoDB not connected');
  return client;
}

export async function closeDb() {
  const currentClient = client;
  client = null;
  database = null;
  if (currentClient) await currentClient.close();
}
