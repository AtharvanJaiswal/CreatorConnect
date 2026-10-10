import { describe, it, expect } from 'vitest';
import {
  TelemetryVerifier,
  MANDATORY_HEALTH_PROBES,
  type ServiceEndpointCheck,
} from './telemetry-alert-verifier.js';

describe('TelemetryVerifier', () => {
  const verifier = new TelemetryVerifier();

  describe('verifyProbeResponse', () => {
    const livenessCheck: ServiceEndpointCheck = MANDATORY_HEALTH_PROBES[0]; // /health

    it('should return PASS when probe status matches expected and contains all required keys', () => {
      const result = verifier.verifyProbeResponse(livenessCheck, 200, {
        status: 'ok',
        timestamp: '2026-10-10T12:00:00Z',
        uptime: 3600,
      });

      expect(result.status).toBe('PASS');
      expect(result.accessible).toBe(true);
      expect(result.missingMetrics).toHaveLength(0);
      expect(result.reason).toBeUndefined();
    });

    it('should return FAIL when probe status is not expected', () => {
      const result = verifier.verifyProbeResponse(livenessCheck, 503, {
        status: 'error',
        timestamp: '2026-10-10T12:00:00Z',
        uptime: 3600,
      });

      expect(result.status).toBe('FAIL');
      expect(result.accessible).toBe(false);
      expect(result.reason).toContain('status=503');
    });

    it('should return FAIL when expected keys are missing from response', () => {
      const result = verifier.verifyProbeResponse(livenessCheck, 200, {
        status: 'ok',
        // missing timestamp and uptime
      });

      expect(result.status).toBe('FAIL');
      expect(result.missingMetrics).toContain('timestamp');
      expect(result.missingMetrics).toContain('uptime');
      expect(result.reason).toContain('missing=[timestamp, uptime]');
    });
  });

  describe('verifyAlertDelivery', () => {
    it('should return PASS when delivery rate is 100% and latency is within threshold', () => {
      const result = verifier.verifyAlertDelivery({
        alertType: 'P1',
        channel: 'pagerduty://creatorconnect-oncall',
        sentCount: 5,
        receivedCount: 5,
        latencyMs: 1200,
        maxLatencyMs: 3000,
      });

      expect(result.status).toBe('PASS');
      expect(result.deliveryRatePercent).toBe(100);
      expect(result.reason).toBeUndefined();
    });

    it('should return FAIL when delivery rate is below 100%', () => {
      const result = verifier.verifyAlertDelivery({
        alertType: 'P1',
        channel: 'pagerduty://creatorconnect-oncall',
        sentCount: 10,
        receivedCount: 8,
        latencyMs: 1500,
      });

      expect(result.status).toBe('FAIL');
      expect(result.deliveryRatePercent).toBe(80);
      expect(result.reason).toContain('Delivery rate below 100%: 80.0% (8/10)');
    });

    it('should return FAIL when latency exceeds maximum threshold', () => {
      const result = verifier.verifyAlertDelivery({
        alertType: 'P2',
        channel: 'slack://#alerts-eng',
        sentCount: 5,
        receivedCount: 5,
        latencyMs: 6500,
        maxLatencyMs: 5000,
      });

      expect(result.status).toBe('FAIL');
      expect(result.reason).toContain('Alert latency exceeded: 6500ms > 5000ms');
    });

    it('should return BLOCKED when no test alerts were sent', () => {
      const result = verifier.verifyAlertDelivery({
        alertType: 'P3',
        channel: 'email://team@creatorconnect.app',
        sentCount: 0,
        receivedCount: 0,
        latencyMs: 0,
      });

      expect(result.status).toBe('BLOCKED');
      expect(result.reason).toContain('No test alerts were sent');
    });
  });

  describe('toGateResult', () => {
    it('should produce PASS gate when all probes and alerts succeed', () => {
      const probeRes = verifier.verifyProbeResponse(MANDATORY_HEALTH_PROBES[0], 200, {
        status: 'ok',
        timestamp: '2026-10-10T12:00:00Z',
        uptime: 100,
      });
      const alertRes = verifier.verifyAlertDelivery({
        alertType: 'P1',
        channel: 'pagerduty',
        sentCount: 1,
        receivedCount: 1,
        latencyMs: 500,
      });

      const gate = verifier.toGateResult([probeRes], [alertRes], 'test');
      expect(gate.id).toBe('GATE_B_MONITORING_ALERTING');
      expect(gate.status).toBe('PASS');
      expect(gate.evidence.length).toBeGreaterThan(0);
      expect(gate.reason).toBeUndefined();
    });

    it('should produce FAIL gate when any probe or alert fails', () => {
      const probeRes = verifier.verifyProbeResponse(MANDATORY_HEALTH_PROBES[0], 500, {});
      const alertRes = verifier.verifyAlertDelivery({
        alertType: 'P1',
        channel: 'pagerduty',
        sentCount: 1,
        receivedCount: 1,
        latencyMs: 500,
      });

      const gate = verifier.toGateResult([probeRes], [alertRes], 'test');
      expect(gate.status).toBe('FAIL');
      expect(gate.reason).toBeDefined();
    });
  });
});
