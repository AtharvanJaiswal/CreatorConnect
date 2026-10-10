# CreatorConnect — Phase 5 Load Testing & Capacity Strategy

## 1. Capacity & Performance Targets

Capacity targets are grounded in real-world infrastructure constraints for a 3-node container cluster rather than speculative fantasy figures.

| Dimension                            | Baseline Target          | Peak Stress Target          | Acceptance SLA                                     |
| :----------------------------------- | :----------------------- | :-------------------------- | :------------------------------------------------- |
| **Concurrent WebSocket Connections** | 2,500 connections / node | 5,000 connections / node    | 0 dropped connections; memory $< 1\text{GB}$       |
| **Message Creation Throughput**      | 200 msgs / sec           | 500 msgs / sec cluster-wide | p95 latency $< 100\text{ms}$; p99 $< 250\text{ms}$ |
| **Realtime Room Fanout Latency**     | Sub-30ms                 | Sub-50ms                    | Realtime event delivered to peer within 50ms       |
| **Reconnect Storm Tolerance**        | 500 reconnects / sec     | 2,000 reconnects in 10s     | Handshake p95 $< 300\text{ms}$; zero 5xx errors    |
| **Outbox Drain Throughput**          | 500 events / sec         | 1,000 events / sec          | Outbox lag remains $< 500\text{ms}$                |
| **Database Pool Utilization**        | $< 40\%$                 | $< 75\%$                    | Zero pool exhaustion timeouts                      |

---

## 2. Load Testing Scenarios (k6 & Artillery)

### Scenario A: Realtime Connection Churn & Reconnect Storm

Simulates 2,000 users disconnecting simultaneously (simulating an ALB reload or network glitch) and reconnecting within 10 seconds:

- **Load Profile**: Ramp up from 0 to 2,000 virtual users (VUs) over 10 seconds; each VU connects via WebSocket, completes JWT handshake, joins 3 conversation rooms, and requests sequence catch-up sync.
- **Pass Criteria**: Handshake success rate $> 99.9\%$; server CPU $< 75\%$; no unhandled rejections.

### Scenario B: Sustained Chat Traffic with Media Attachments

Simulates active messaging across 500 distinct conversations:

- **Load Profile**: 500 VUs actively posting messages at 2 msgs/sec per room; 10% of messages include a 2MB image attachment upload.
- **Pass Criteria**: REST API response p95 $< 120\text{ms}$; ClamAV scan throughput $> 15\text{ files/sec}$; outbox drain lag $< 600\text{ms}$.

---

## 3. Bottleneck Analysis & Profiling Strategy

When stress tests reveal latency spikes, the following diagnostic toolchain is utilized:

1. **Clinic.js Doctor / Flame**: Identifies event-loop blockages in `apps/realtime` and `apps/api`.
2. **`pg_stat_statements`**: Analyzes database lock waits on `SELECT FOR UPDATE` on the `conversations` table.
3. **Redis `SLOWLOG`**: Detects long-running Redis operations or pub/sub channel congestion.
4. **Linux `ss -s` & `netstat`**: Audits socket buffer exhaustion (`TIME_WAIT`, `CLOSE_WAIT`) and OS file descriptor limits (`ulimit -n 65535`).
