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
});
