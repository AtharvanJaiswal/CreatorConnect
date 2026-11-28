'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { AdminCard } from '../../../components/admin/ui/AdminCard';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminErrorBanner } from '../../../components/admin/ui/AdminErrorBanner';
import { apiClient } from '../../../lib/api-client';
import { parseAdminApiError, type AdminErrorState } from '../../../lib/admin-error';
import { formatInrMinor, parseReconciliationReport } from '../../../lib/admin-finance-helpers';
import type { AdminReconciliationReport } from '@creatorconnect/contracts';

export default function AdminReconciliationPage() {
  const [report, setReport] = useState<AdminReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<AdminErrorState | null>(null);

  const fetchReconciliation = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await apiClient.get<AdminReconciliationReport>('/api/v1/admin/reconciliation');
      setReport(parseReconciliationReport(data));
    } catch (err) {
      setReport(null);
      setFetchError(
        parseAdminApiError(
          err,
          'Failed to execute double-entry ledger reconciliation against backend API.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  const isBalanced = report?.status === 'BALANCED';

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Double-Entry Ledger Reconciliation
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Mathematical audit of debit-credit parity, escrow liabilities, and platform fee
            accounts.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchReconciliation}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Re-Run Audit
        </AdminButton>
      </div>

      {fetchError && <AdminErrorBanner error={fetchError} onRetry={fetchReconciliation} />}

      {!report && isLoading && (
        <AdminCard padding="lg" className="min-h-[240px] flex items-center justify-center">
          <div className="text-xs font-semibold text-[#6F675E]" role="status">
            Auditing PostgreSQL double-entry ledger accounts...
          </div>
        </AdminCard>
      )}

      {report && (
        <>
          {/* Ledger Parity Banner */}
          <div
            className={`p-6 rounded-3xl border flex items-center justify-between ${
              isBalanced
                ? 'bg-[#E6F4EC] border-[#BEE4D0] text-[#1B7339]'
                : 'bg-[#FBE9E7] border-[#F6C4C0] text-[#D8483C]'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-xs">
                {isBalanced ? (
                  <CheckCircle2 className="w-6 h-6 text-[#2E9E6B]" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-[#D8483C]" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold">
                  {isBalanced
                    ? 'All Ledger Accounts in Perfect Mathematical Parity'
                    : 'Ledger Discrepancy Detected — Immediate Audit Required'}
                </h3>
                <p className="text-xs mt-0.5 opacity-90">
                  Status: <strong>{report.status}</strong> · Audited{' '}
                  {report.totalAccounts.toLocaleString()} double-entry accounts at{' '}
                  {new Date(report.checkedAt).toLocaleString()}.
                </p>
              </div>
            </div>

            <div className="hidden sm:flex flex-col text-right font-mono-code">
              <span className="text-xs uppercase font-bold">Unbalanced Accounts</span>
              <span className="text-2xl font-black">{report.unbalancedAccounts.length}</span>
            </div>
          </div>

          {/* Parity Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <AdminCard padding="md">
              <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider block mb-2">
                Total Debit Volume
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#14110F] font-mono-code mb-1">
                {formatInrMinor(report.totalDebitsMinor)}
              </div>
              <span className="text-xs text-[#6F675E] font-mono-code">
                {report.totalDebitsMinor} paisa
              </span>
            </AdminCard>

            <AdminCard padding="md">
              <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider block mb-2">
                Total Credit Volume
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#14110F] font-mono-code mb-1">
                {formatInrMinor(report.totalCreditsMinor)}
              </div>
              <span className="text-xs text-[#6F675E] font-mono-code">
                {report.totalCreditsMinor} paisa
              </span>
            </AdminCard>

            <AdminCard padding="md">
              <span className="text-xs font-bold text-[#6F675E] uppercase tracking-wider block mb-2">
                Net Difference
              </span>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono-code mb-1 ${
                  report.netDifferenceMinor === '0' ? 'text-[#2E9E6B]' : 'text-[#D8483C]'
                }`}
              >
                {formatInrMinor(report.netDifferenceMinor)}
              </div>
              <span className="text-xs text-[#6F675E] font-mono-code">
                {report.netDifferenceMinor} paisa delta
              </span>
            </AdminCard>
          </div>

          {report.unbalancedAccounts.length > 0 && (
            <AdminCard padding="md">
              <h4 className="text-sm font-bold text-[#D8483C] mb-3">
                Unbalanced Account Discrepancies
              </h4>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs font-mono-code">
                  <thead>
                    <tr className="border-b border-[#E7E0D5] text-[#6F675E]">
                      <th scope="col" className="py-2 pr-4">
                        Code
                      </th>
                      <th scope="col" className="py-2 pr-4">
                        Account Name
                      </th>
                      <th scope="col" className="py-2 pr-4">
                        Type
                      </th>
                      <th scope="col" className="py-2 pr-4">
                        Recorded
                      </th>
                      <th scope="col" className="py-2 pr-4">
                        Expected
                      </th>
                      <th scope="col" className="py-2">
                        Discrepancy
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE9DF]">
                    {report.unbalancedAccounts.map((acc) => (
                      <tr key={acc.id}>
                        <td className="py-2.5 pr-4 font-bold">{acc.code}</td>
                        <td className="py-2.5 pr-4 font-sans-body">{acc.name}</td>
                        <td className="py-2.5 pr-4">
                          <AdminBadge variant="neutral" size="sm">
                            {acc.type}
                          </AdminBadge>
                        </td>
                        <td className="py-2.5 pr-4">{formatInrMinor(acc.balanceMinor)}</td>
                        <td className="py-2.5 pr-4">{formatInrMinor(acc.entriesSumMinor)}</td>
                        <td className="py-2.5 font-bold text-[#D8483C]">
                          {formatInrMinor(acc.discrepancyMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          )}
        </>
      )}
    </div>
  );
}
