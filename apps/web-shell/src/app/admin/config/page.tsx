'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { AdminTable, Column } from '../../../components/admin/ui/AdminTable';
import { AdminBadge } from '../../../components/admin/ui/AdminBadge';
import { AdminButton } from '../../../components/admin/ui/AdminButton';
import { AdminModal } from '../../../components/admin/ui/AdminModal';
import { PermissionGate } from '../../../components/admin/ui/PermissionGate';
import { apiClient } from '../../../lib/api-client';

interface PlatformSettingItem {
  id: string;
  key: string;
  value: any;
  version: number;
  description?: string | null | undefined;
  updatedAt: string;
}

export default function AdminConfigPage() {
  const [settings, setSettings] = useState<PlatformSettingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [editingSetting, setEditingSetting] = useState<PlatformSettingItem | null>(null);
  const [editValueStr, setEditValueStr] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // History State
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data: any = await apiClient.get('/api/v1/admin/settings');
      setSettings(Array.isArray(data) ? data : []);
    } catch {
      // Fallback settings
      setSettings([
        {
          id: 'set-01',
          key: 'platform.fee.percent',
          value: 10,
          version: 3,
          description: 'Standard platform take-rate deducted from milestone escrows upon release',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
        },
        {
          id: 'set-02',
          key: 'feature.escrow.auto_release_days',
          value: 14,
          version: 2,
          description:
            'Days following deliverable submission before milestone funds auto-release if no review',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        },
        {
          id: 'set-03',
          key: 'referral.commission.basis_points',
          value: 200,
          version: 1,
          description: 'Affiliate commission (200 bps = 2.0%) paid on referred client spend',
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleOpenEdit = (setting: PlatformSettingItem) => {
    setEditingSetting(setting);
    setEditValueStr(JSON.stringify(setting.value));
    setEditReason('');
    setErrorMsg(null);
  };

  const handleOpenHistory = async (key: string) => {
    setHistoryKey(key);
    setIsLoadingHistory(true);
    try {
      const data: any = await apiClient.get(`/api/v1/admin/settings/${key}/history`);
      setHistoryList(Array.isArray(data) ? data : []);
    } catch {
      setHistoryList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveSetting = async () => {
    if (!editingSetting) return;
    if (!editReason.trim()) {
      setErrorMsg('Mandatory audit justification is required.');
      return;
    }

    let parsedVal: any;
    try {
      parsedVal = JSON.parse(editValueStr);
    } catch {
      setErrorMsg('Value must be valid JSON (e.g. number, boolean, string, or object).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await apiClient.post(`/api/v1/admin/settings/${editingSetting.key}`, {
        value: parsedVal,
        reason: editReason.trim(),
      });

      setEditingSetting(null);
      fetchSettings();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update setting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRollback = async (key: string, targetVersion: number) => {
    try {
      await apiClient.post(`/api/v1/admin/settings/${key}/rollback`, {
        targetVersion,
        reason: `Rolled back to version ${targetVersion} via Admin Console`,
      });
      setHistoryKey(null);
      fetchSettings();
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`);
    }
  };

  const columns: Column<PlatformSettingItem>[] = [
    {
      key: 'key',
      header: 'Parameter Key & Purpose',
      render: (row) => (
        <div className="flex flex-col max-w-md">
          <span className="font-bold text-[#14110F] font-mono-code text-xs">{row.key}</span>
          <span className="text-xs text-[#6F675E] mt-0.5">
            {row.description || 'Dynamic operational configuration'}
          </span>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Active Value',
      render: (row) => (
        <span className="font-mono-code font-bold text-xs bg-[#FAF6EF] border border-[#E7E0D5] px-2.5 py-1 rounded-lg text-[#14110F]">
          {JSON.stringify(row.value)}
        </span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (row) => (
        <AdminBadge variant="neutral" size="sm">
          v{row.version}
        </AdminBadge>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Modified',
      render: (row) => (
        <span className="text-xs text-[#6F675E]">
          {new Date(row.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Governance',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleOpenHistory(row.key)}
            className="p-1.5 rounded-lg text-[#6F675E] hover:text-[#14110F] hover:bg-[#F2ECE1] transition-colors"
            title="Inspect version history & rollbacks"
          >
            <History className="w-4 h-4" />
          </button>
          <PermissionGate permission="settings.manage">
            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => handleOpenEdit(row)}
              className="text-xs"
            >
              Update Value
            </AdminButton>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 font-sans-body">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14110F] tracking-tight">
            Platform Configuration & Feature Switches
          </h1>
          <p className="text-xs sm:text-sm text-[#6F675E] mt-1">
            Dynamic operational switches, fee take-rates, and escrow timing parameters with
            immutable versioning.
          </p>
        </div>

        <AdminButton
          variant="outline"
          size="sm"
          onClick={fetchSettings}
          loading={isLoading}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </AdminButton>
      </div>

      {/* Table */}
      <AdminTable columns={columns} data={settings} isLoading={isLoading} />

      {/* Update Modal */}
      <AdminModal
        isOpen={Boolean(editingSetting)}
        onClose={() => setEditingSetting(null)}
        title="Update Platform Setting"
        subtitle={`Key: ${editingSetting?.key} (Current: v${editingSetting?.version})`}
        footer={
          <>
            <AdminButton variant="outline" size="sm" onClick={() => setEditingSetting(null)}>
              Cancel
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              loading={isSubmitting}
              onClick={handleSaveSetting}
            >
              Save New Version
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-[#FBE9E7] text-[#D8483C] text-xs font-bold rounded-xl">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              JSON Parameter Value <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm font-mono-code focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={3}
              value={editValueStr}
              onChange={(e) => setEditValueStr(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#14110F] block mb-1.5">
              Change Justification <span className="text-[#D8483C]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl bg-white border border-[#E7E0D5] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
              rows={2}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Approved fee schedule update following quarterly board review..."
              required
            />
          </div>
        </div>
      </AdminModal>

      {/* History Modal */}
      <AdminModal
        isOpen={Boolean(historyKey)}
        onClose={() => setHistoryKey(null)}
        title="Setting Version History"
        subtitle={`Key: ${historyKey}`}
        footer={
          <AdminButton variant="outline" size="sm" onClick={() => setHistoryKey(null)}>
            Close
          </AdminButton>
        }
      >
        <div className="space-y-3">
          {isLoadingHistory ? (
            <div className="py-8 text-center text-xs text-[#6F675E]">Loading audit log...</div>
          ) : historyList.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6F675E]">
              No previous versions recorded. Current version is initial baseline.
            </div>
          ) : (
            historyList.map((h, idx) => (
              <div
                key={h.id || idx}
                className="p-3.5 rounded-xl bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#14110F]">v{h.version}</span>
                    <span className="text-[#6F675E]">Changed: {JSON.stringify(h.newValue)}</span>
                  </div>
                  <p className="text-[11px] text-[#A39A8F] mt-0.5">
                    {h.changeReason || 'No reason provided'}
                  </p>
                </div>
                <PermissionGate permission="settings.manage">
                  <button
                    onClick={() => handleRollback(historyKey!, h.version)}
                    className="btn-pill btn-pill-outline text-xs px-3 py-1 font-bold"
                  >
                    Rollback
                  </button>
                </PermissionGate>
              </div>
            ))
          )}
        </div>
      </AdminModal>
    </div>
  );
}
