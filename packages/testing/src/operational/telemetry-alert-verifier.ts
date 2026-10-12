import type {
  OperationalGateResult,
  TelemetryCheckResult,
  AlertDeliveryResult,
} from './gate-types.js';

export interface ServiceEndpointCheck {
  service: string;
  endpoint: string;
  expectedStatus: number;
  expectedKeys: string[];
}

export const MANDATORY_HEALTH_PROBES: ServiceEndpointCheck[] = [
  {
    service: 'api-liveness',
    endpoint: '/health',
    expectedStatus: 200,
    expectedKeys: ['status', 'timestamp', 'uptime'],
  },
  {
    service: 'api-readiness',
    endpoint: '/ready',
    expectedStatus: 200,
    expectedKeys: ['status', 'timestamp', 'services'],
  },
];

export const REQUIRED_SYSTEM_METRICS = [
  'http_request_duration_seconds',
  'http_requests_total',
  'db_query_duration_seconds',
  'queue_job_waiting_count',
  'queue_job_failed_total',
  'websocket_active_connections',
  'media_processing_duration_seconds',
];

export class TelemetryVerifier {
  /**
   * Verifies health endpoint response against expected keys and HTTP status.
   */
  public verifyProbeResponse(
    check: ServiceEndpointCheck,
    actualStatus: number,
    actualBody: Record<string, unknown>,
  ): TelemetryCheckResult {
    const accessible = actualStatus === check.expectedStatus;
    const bodyKeys = Object.keys(actualBody);
    const presentKeys = check.expectedKeys.filter((k) => bodyKeys.includes(k));
    const missingKeys = check.expectedKeys.filter((k) => !bodyKeys.includes(k));

    const isSuccess = accessible && missingKeys.length === 0;

    return {
      status: isSuccess ? 'PASS' : 'FAIL',
      service: check.service,
      endpoint: check.endpoint,
      accessible,
      metricsPresent: presentKeys,
      missingMetrics: missingKeys,
      reason: isSuccess
        ? undefined
        : `Probe failed for '${check.service}' on '${check.endpoint}': status=${actualStatus}, missing=[${missingKeys.join(', ')}]`,
    };
  }

  /**
   * Evaluates alert delivery rate using the standard formula (Section 5.4):
   * Delivery Rate = (Alerts received / Alerts sent) * 100%
   */
  public verifyAlertDelivery(params: {
    alertType: 'P1' | 'P2' | 'P3';
    channel: string;
    sentCount: number;
    receivedCount: number;
    latencyMs: number;
    maxLatencyMs?: number;
  }): AlertDeliveryResult {
    const { alertType, channel, sentCount, receivedCount, latencyMs, maxLatencyMs = 5000 } = params;

    if (sentCount <= 0) {
      return {
        status: 'BLOCKED',
        alertType,
        channel,
        sentCount: 0,
        receivedCount: 0,
        deliveryRatePercent: 0,
        latencyMs,
        reason: 'No test alerts were sent; delivery verification cannot be evaluated.',
      };
    }

    const deliveryRatePercent = Math.min(100, Math.max(0, (receivedCount / sentCount) * 100));
    const isRateAcceptable = deliveryRatePercent === 100;
    const isLatencyAcceptable = latencyMs <= maxLatencyMs;

    const isSuccess = isRateAcceptable && isLatencyAcceptable;

    let reason: string | undefined;
    if (!isSuccess) {
      const issues: string[] = [];
      if (!isRateAcceptable) {
        issues.push(
          `Delivery rate below 100%: ${deliveryRatePercent.toFixed(1)}% (${receivedCount}/${sentCount})`,
        );
      }
      if (!isLatencyAcceptable) {
        issues.push(`Alert latency exceeded: ${latencyMs}ms > ${maxLatencyMs}ms`);
      }
      reason = issues.join('; ');
    }

    return {
      status: isSuccess ? 'PASS' : 'FAIL',
      alertType,
      channel,
      sentCount,
      receivedCount,
      deliveryRatePercent,
      latencyMs,
      reason,
    };
  }

  /**
   * Adapts probe and alert delivery results into a standard OperationalGateResult.
   */
  public toGateResult(
    probeResults: TelemetryCheckResult[],
    alertResults: AlertDeliveryResult[],
    environment: 'local' | 'test' | 'staging' | 'production' = 'test',
  ): OperationalGateResult {
    const allProbesPass = probeResults.every((p) => p.status === 'PASS');
    const allAlertsPass = alertResults.every((a) => a.status === 'PASS');
    const isSuccess = allProbesPass && allAlertsPass;

    const evidence: string[] = [
      ...probeResults.map((p) => `Probe [${p.service}]: ${p.status} on ${p.endpoint}`),
      ...alertResults.map(
        (a) =>
          `Alert [${a.alertType} -> ${a.channel}]: ${a.deliveryRatePercent}% delivered in ${a.latencyMs}ms (${a.status})`,
      ),
    ];

    const reasons: string[] = [
      ...probeResults.filter((p) => p.reason).map((p) => p.reason!),
      ...alertResults.filter((a) => a.reason).map((a) => a.reason!),
    ];

    return {
      id: 'GATE_B_MONITORING_ALERTING',
      name: 'Observability Telemetry & Alert Delivery Verification Gate',
      status: isSuccess ? 'PASS' : 'FAIL',
      environment,
      evidence,
      checkedAt: new Date().toISOString(),
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    };
  }
}
