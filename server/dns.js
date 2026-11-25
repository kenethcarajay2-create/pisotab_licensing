
import dns from 'node:dns';

// Use reliable DNS resolvers for MongoDB Atlas SRV lookups.
dns.setServers(['1.1.1.1', '8.8.8.8']);
