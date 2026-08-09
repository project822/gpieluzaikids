import mongoose from 'mongoose';
import { requireDevKey } from '@/lib/devApi';
import { isDbEnabled } from '@/lib/repo';
import {
  maintenanceEnabled,
  getMaintenanceSource,
  getMaintenanceText,
  getBlockedIps,
  getBlockedIpsDetailed,
} from '@/lib/runtimeState';
import { getRateLimitedIps } from '@/lib/rateLimit';
import { getSecurityStats } from '@/lib/securityLog';

// Status sistem untuk project /dev (dashboard developer).
// GET /api/dev/status  →  ringkasan kesehatan & keamanan real-time.

export async function GET(request) {
  const denied = requireDevKey(request, 'GET status');
  if (denied) return denied;

  const dbEnabled = isDbEnabled();
  const readyState = mongoose.connection?.readyState ?? 99;
  const rateLimited = getRateLimitedIps();

  return Response.json({
    ok: true,
    app: {
      name: 'GPI Eluzai — Website Utama',
      nodeEnv: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.round(process.uptime()),
      now: new Date().toISOString(),
    },
    db: {
      enabled: dbEnabled,
      connected: dbEnabled && readyState === 1,
      readyState,
      mode: dbEnabled ? (readyState === 1 ? 'connected' : 'disconnected') : 'demo',
    },
    maintenance: {
      enabled: maintenanceEnabled(),
      source: getMaintenanceSource(),
      ...getMaintenanceText(),
    },
    blockedIps: getBlockedIps(),
    blockedIpsDetail: getBlockedIpsDetailed(),
    rateLimitedIps: rateLimited,
    security: getSecurityStats(),
  });
}
