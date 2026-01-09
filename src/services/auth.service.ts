import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { randomBytes } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SessionsRepository, Session } from '../db/repositories/sessions.repository';
import { TenantsRepository } from '../db/repositories/tenants.repository';
import { Tenant } from '../models';

let firebaseApp: App | null = null;

function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  if (!config.firebase.projectId || !config.firebase.clientEmail || !config.firebase.privateKey) {
    throw new Error('Firebase Admin SDK configuration missing');
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    }),
  });

  return firebaseApp;
}

export interface AuthUser {
  userId: string;
  email: string;
  tenant: Tenant;
  session: Session;
}

export class AuthService {
  private sessionsRepository: SessionsRepository;
  private tenantsRepository: TenantsRepository;

  constructor() {
    this.sessionsRepository = new SessionsRepository();
    this.tenantsRepository = new TenantsRepository();
  }

  async verifyFirebaseToken(idToken: string): Promise<DecodedIdToken> {
    try {
      const auth = getAuth(getFirebaseApp());
      const decoded = await auth.verifyIdToken(idToken);
      return decoded;
    } catch (error) {
      logger.error('Failed to verify Firebase token', { error });
      throw new Error('Invalid Firebase token');
    }
  }

  async register(
    firebaseIdToken: string,
    workspaceName: string
  ): Promise<{ session: Session; tenant: Tenant; sessionToken: string }> {
    const decoded = await this.verifyFirebaseToken(firebaseIdToken);
    const { uid: firebaseUid, email } = decoded;

    if (!email) {
      throw new Error('Firebase user must have an email');
    }

    // Check if tenant already exists for this Firebase user
    const existingTenant = await this.tenantsRepository.findByFirebaseUid(firebaseUid);
    if (existingTenant) {
      throw new Error('User already has a workspace registered');
    }

    // Create new tenant
    const tenant = await this.tenantsRepository.createForSetup({
      name: workspaceName,
      adminEmail: email,
      adminFirebaseUid: firebaseUid,
    });

    // Create session
    const sessionToken = this.generateSessionToken();
    const expiresAt = this.getSessionExpiry();

    const session = await this.sessionsRepository.create({
      userId: firebaseUid,
      tenantId: tenant.id,
      sessionToken,
      expiresAt,
    });

    logger.info('User registered', { firebaseUid, tenantId: tenant.id });

    return { session, tenant, sessionToken };
  }

  async login(
    firebaseIdToken: string
  ): Promise<{ session: Session; tenant: Tenant; sessionToken: string }> {
    const decoded = await this.verifyFirebaseToken(firebaseIdToken);
    const { uid: firebaseUid } = decoded;

    // Find tenant for this Firebase user
    const tenant = await this.tenantsRepository.findByFirebaseUid(firebaseUid);
    if (!tenant) {
      throw new Error('No workspace found for this user. Please register first.');
    }

    // Create new session
    const sessionToken = this.generateSessionToken();
    const expiresAt = this.getSessionExpiry();

    const session = await this.sessionsRepository.create({
      userId: firebaseUid,
      tenantId: tenant.id,
      sessionToken,
      expiresAt,
    });

    logger.info('User logged in', { firebaseUid, tenantId: tenant.id });

    return { session, tenant, sessionToken };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.sessionsRepository.deleteByToken(sessionToken);
    logger.info('User logged out');
  }

  async validateSession(sessionToken: string): Promise<AuthUser | null> {
    const session = await this.sessionsRepository.findByToken(sessionToken);
    if (!session) {
      return null;
    }

    const tenant = await this.tenantsRepository.findById(session.tenantId);
    if (!tenant) {
      // Session exists but tenant doesn't - cleanup
      await this.sessionsRepository.deleteByToken(sessionToken);
      return null;
    }

    return {
      userId: session.userId,
      email: tenant.adminEmail || '',
      tenant,
      session,
    };
  }

  async extendSession(sessionToken: string): Promise<Session | null> {
    const newExpiresAt = this.getSessionExpiry();
    return this.sessionsRepository.extendSession(sessionToken, newExpiresAt);
  }

  private generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getSessionExpiry(): Date {
    const days = config.session.maxAgeDays;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  async cleanupExpiredSessions(): Promise<number> {
    return this.sessionsRepository.deleteExpired();
  }
}
