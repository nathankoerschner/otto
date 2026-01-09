import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from '../config';
import { logger } from './logger';

let secretClient: SecretManagerServiceClient | null = null;

function getSecretClient(): SecretManagerServiceClient {
  if (!secretClient) {
    secretClient = new SecretManagerServiceClient();
  }
  return secretClient;
}

/**
 * Retrieve a secret from GCP Secret Manager
 */
export async function getSecret(secretName: string): Promise<string> {
  try {
    const client = getSecretClient();
    const projectId = config.gcp?.projectId;

    if (!projectId) {
      throw new Error('GCP project ID not configured');
    }

    // Build the resource name
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    logger.debug('Fetching secret from GCP Secret Manager', { secretName });

    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data?.toString();

    if (!payload) {
      throw new Error(`Secret ${secretName} has no payload`);
    }

    logger.debug('Successfully retrieved secret', { secretName });
    return payload;
  } catch (error) {
    logger.error('Failed to retrieve secret from GCP Secret Manager', { error, secretName });
    throw error;
  }
}

/**
 * Retrieve multiple secrets in parallel
 */
export async function getSecrets(secretNames: string[]): Promise<Record<string, string>> {
  try {
    const promises = secretNames.map(async (name) => ({
      name,
      value: await getSecret(name),
    }));

    const results = await Promise.all(promises);

    return results.reduce((acc, { name, value }) => {
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);
  } catch (error) {
    logger.error('Failed to retrieve multiple secrets', { error, secretNames });
    throw error;
  }
}

/**
 * Cache for secrets to avoid repeated API calls
 */
const secretCache = new Map<string, { value: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get secret with caching
 */
export async function getCachedSecret(secretName: string): Promise<string> {
  const cached = secretCache.get(secretName);

  if (cached && cached.expiresAt > Date.now()) {
    logger.debug('Returning cached secret', { secretName });
    return cached.value;
  }

  const value = await getSecret(secretName);
  secretCache.set(secretName, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return value;
}

/**
 * Clear secret cache (useful for testing or forcing refresh)
 */
export function clearSecretCache(): void {
  secretCache.clear();
  logger.debug('Secret cache cleared');
}

/**
 * Create a new secret in GCP Secret Manager
 */
export async function createSecret(secretName: string, secretValue: string): Promise<void> {
  try {
    const client = getSecretClient();
    const projectId = config.gcp?.projectId;

    if (!projectId) {
      throw new Error('GCP project ID not configured');
    }

    const parent = `projects/${projectId}`;

    // Create the secret
    await client.createSecret({
      parent,
      secretId: secretName,
      secret: {
        replication: {
          automatic: {},
        },
      },
    });

    // Add the secret version with the value
    const name = `projects/${projectId}/secrets/${secretName}`;
    await client.addSecretVersion({
      parent: name,
      payload: {
        data: Buffer.from(secretValue, 'utf8'),
      },
    });

    // Clear cache for this secret
    secretCache.delete(secretName);

    logger.info('Secret created in GCP Secret Manager', { secretName });
  } catch (error) {
    logger.error('Failed to create secret in GCP Secret Manager', { error, secretName });
    throw error;
  }
}

/**
 * Update an existing secret in GCP Secret Manager (add new version)
 */
export async function updateSecret(secretName: string, secretValue: string): Promise<void> {
  try {
    const client = getSecretClient();
    const projectId = config.gcp?.projectId;

    if (!projectId) {
      throw new Error('GCP project ID not configured');
    }

    const name = `projects/${projectId}/secrets/${secretName}`;

    // Add a new version to the existing secret
    await client.addSecretVersion({
      parent: name,
      payload: {
        data: Buffer.from(secretValue, 'utf8'),
      },
    });

    // Clear cache for this secret
    secretCache.delete(secretName);

    logger.info('Secret updated in GCP Secret Manager', { secretName });
  } catch (error) {
    logger.error('Failed to update secret in GCP Secret Manager', { error, secretName });
    throw error;
  }
}

/**
 * Create or update a secret in GCP Secret Manager
 * Creates the secret if it doesn't exist, otherwise adds a new version
 */
export async function upsertSecret(secretName: string, secretValue: string): Promise<void> {
  try {
    // Try to get the secret first to check if it exists
    await getSecret(secretName);
    // If we get here, secret exists - update it
    await updateSecret(secretName, secretValue);
  } catch {
    // Secret doesn't exist - create it
    await createSecret(secretName, secretValue);
  }
}
