/**
 * Singleton PostgreSQL connection pool
 * Prevents connection leaks on hot-reload and scaling by maintaining
 * a single pool instance per process (cached on globalThis).
 * 
 * Usage:
 *   import { getPgPool } from '@/lib/db-pg';
 *   const pool = getPgPool();
 *   const result = await pool.query('SELECT * FROM table WHERE id = $1', [id]);
 */

import { Pool, PoolClient } from 'pg';

// Extend global type to hold the pool
declare global {
  var pgPool: Pool | undefined;
}

let pool: Pool | undefined;

/**
 * Get or create the singleton PostgreSQL connection pool.
 * The pool is cached on globalThis to survive hot-reload in development.
 * @returns The PostgreSQL connection pool instance
 */
export function getPgPool(): Pool {
  // In development, use globalThis to survive module reloads
  if (process.env.NODE_ENV !== 'production') {
    if (!global.pgPool) {
      global.pgPool = createPool();
    }
    return global.pgPool;
  }

  // In production, use module-level cache
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

/**
 * Create a new PostgreSQL connection pool.
 * @private
 * @returns A new Pool instance
 */
function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const poolInstance = new Pool({
    connectionString,
  });

  // Log pool events in development for debugging
  if (process.env.NODE_ENV !== 'production') {
    poolInstance.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return poolInstance;
}

/**
 * Gracefully shutdown the pool.
 * Call this during application shutdown (e.g., in API route cleanup or process termination).
 * @returns Promise that resolves when pool is closed
 */
export async function closePgPool(): Promise<void> {
  if (process.env.NODE_ENV !== 'production' && global.pgPool) {
    await global.pgPool.end();
    global.pgPool = undefined;
  } else if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Get a single client from the pool.
 * Use this when you need to run multiple queries in a transaction.
 * 
 * Example:
 *   const client = await getPoolClient();
 *   try {
 *     await client.query('BEGIN');
 *     await client.query('UPDATE ...');
 *     await client.query('COMMIT');
 *   } catch (err) {
 *     await client.query('ROLLBACK');
 *     throw err;
 *   } finally {
 *     client.release();
 *   }
 * 
 * @returns A client from the pool
 */
export async function getPoolClient(): Promise<PoolClient> {
  const pool = getPgPool();
  return pool.connect();
}