import {
  getSessionRole,
  getSessionTenant,
  setSessionRole,
  setSessionTenant,
  ApiError,
} from './api';
import { LifecycleState, ReleaseGateStatus } from './types';

describe('Frontend Session & API Contracts', () => {
  it('manages session tenant and operator roles cleanly', () => {
    setSessionRole('approver');
    expect(getSessionRole()).toBe('approver');

    setSessionTenant('tenant-test-123');
    expect(getSessionTenant()).toBe('tenant-test-123');
  });

  it('correctly handles ApiError instances with correlation IDs', () => {
    const err = new ApiError('Conflict occurred', 409, 'corr_test_123', ['version conflict']);
    expect(err.statusCode).toBe(409);
    expect(err.correlationId).toBe('corr_test_123');
    expect(err.message).toBe('Conflict occurred');
  });

  it('validates supported lifecycle states and release gates', () => {
    const validStates: LifecycleState[] = ['draft', 'candidate', 'approved', 'active', 'archived'];
    expect(validStates).toHaveLength(5);

    const validGates: ReleaseGateStatus[] = ['PASS', 'WARN', 'FAIL'];
    expect(validGates).toContain('PASS');
    expect(validGates).toContain('FAIL');
  });

  it('validates Vercel image optimization guardrail contracts', () => {
    const nextConfig = require('../../next.config.js');
    expect(nextConfig.images).toBeDefined();

    // Standardized to single modern WebP format (avoids duplicate AVIF/WebP variants)
    expect(nextConfig.images.formats).toEqual(['image/webp']);

    // Minimum edge cache TTL configured to 31 days to maximize hit ratios
    expect(nextConfig.images.minimumCacheTTL).toBe(2678400);

    // deviceSizes trimmed to avoid redundant legacy widths (750, 828)
    expect(nextConfig.images.deviceSizes).toEqual([640, 768, 1080, 1920]);

    // SVGs must never be optimized via Vercel optimizer
    expect(nextConfig.images.dangerouslyAllowSVG).toBe(false);

    // Headers configured for static asset edge/browser caching
    expect(typeof nextConfig.headers).toBe('function');
  });
});
