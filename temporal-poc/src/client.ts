/**
 * Temporal Client
 * 
 * This creates a client connection to Temporal server.
 * Used by scripts to start workflows, query status, etc.
 */

import { Connection, Client } from '@temporalio/client';

export async function createClient(): Promise<Client> {
  // Connect to Temporal server
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  // Create client
  const client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  return client;
}
