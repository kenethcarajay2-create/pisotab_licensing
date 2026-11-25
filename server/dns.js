import dns from 'node:dns';
// Local DNS workaround for networks that refuse MongoDB SRV records.
// The production service can use its platform DNS; this is imported for local dev only.
dns.setServers(['1.1.1.1', '8.8.8.8']);
