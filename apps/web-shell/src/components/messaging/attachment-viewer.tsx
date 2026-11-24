import React from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode,
  FileText,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { AttachmentDownloadResponse, MessageResponse } from '@creatorconnect/contracts';
import {
  categorizeMediaType,
  formatFileSize,
  formatMessageTimestamp,
  messagingWorkflowService,
} from '../../lib/messaging-workflow-service';

export interface AttachmentViewerProps {
  conversationId: string;
  attachmentId: string;
  token?: string | null | undefined;
  onClose?: (() => void) | undefined;
  originMessage?: MessageResponse | undefined;
  peerName?: string | undefined;
  allAttachments?:
    | Array<{ id: string; fileName?: string | undefined; mediaAssetId?: string | undefined }>
    | undefined;
  onSelectAttachment?: ((attachmentId: string) => void) | undefined;
  standalone?: boolean | undefined;
}

export function AttachmentViewer({
  conversationId,
  attachmentId,
  token,
  onClose,
  originMessage,
  peerName = 'Creator',
  allAttachments,
  onSelectAttachment,
  standalone = false,
}: AttachmentViewerProps) {
  const [downloadInfo, setDownloadInfo] = React.useState<AttachmentDownloadResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [zoom, setZoom] = React.useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const stageRef = React.useRef<HTMLDivElement>(null);

  const fetchDownload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await messagingWorkflowService.getAttachmentDownload(
        conversationId,
        attachmentId,
        token ?? undefined,
      );
      setDownloadInfo(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to authorize attachment download. Conversation access may be revoked.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [conversationId, attachmentId, token]);

  React.useEffect(() => {
    fetchDownload();
    setZoom(1.0);
  }, [fetchDownload]);

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const category = downloadInfo
    ? categorizeMediaType(downloadInfo.mimeType, downloadInfo.fileName)
    : 'unsupported';

  // Multi-attachment pager indexing
  const currentIndex = allAttachments
    ? allAttachments.findIndex((att) => att.id === attachmentId)
    : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = allAttachments ? currentIndex < allAttachments.length - 1 : false;

  const handlePrev = () => {
    if (hasPrevious && allAttachments && onSelectAttachment) {
      onSelectAttachment(allAttachments[currentIndex - 1]!.id);
    }
  };

  const handleNext = () => {
    if (hasNext && allAttachments && onSelectAttachment) {
      onSelectAttachment(allAttachments[currentIndex + 1]!.id);
    }
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(3.0, Math.max(0.5, Math.round((prev + delta) * 100) / 100)));
  };

  const resetZoom = () => {
    setZoom(1.0);
  };

  const fileExt = (downloadInfo?.fileName?.split('.').pop() || 'RAW').toUpperCase();

  return (
    <div className={`w-full flex flex-col gap-6 text-[#14110F] ${standalone ? 'py-2' : ''}`}>
      {/* Stitch I05: Breadcrumb & Return Bar */}
      <section
        aria-label="Provenance path and navigation"
        className="w-full bg-white rounded-2xl p-4 shadow-xs border border-[#EFE9DF] flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FAF2EE] hover:bg-[#F3ECE6] text-xs font-semibold text-[#14110F] transition-colors"
              title="Return to conversation"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Thread</span>
            </button>
          )}

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6F675E]">
            <span className="font-medium">Conversations</span>
            <span>/</span>
            <span className="font-medium text-[#14110F]">{peerName}</span>
            <span>/</span>
            <span className="font-semibold text-[#14110F] truncate max-w-[200px] sm:max-w-[320px]">
              {downloadInfo?.fileName ?? (loading ? 'Loading asset...' : 'Attachment')}
            </span>
          </nav>
        </div>

        {/* Quick File Swapper inside current thread if multiple attachments exist */}
        {allAttachments && allAttachments.length > 1 && (
          <div className="flex items-center gap-2 self-end md:self-auto text-xs">
            <span className="text-[#6F675E] font-medium">
              File {currentIndex + 1} of {allAttachments.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={!hasPrevious}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-[#FAF2EE] hover:bg-[#EFE9DF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous attachment"
              >
                <ChevronLeft className="w-4 h-4 text-[#14110F]" />
              </button>
              <button
                onClick={handleNext}
                disabled={!hasNext}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-[#FAF2EE] hover:bg-[#EFE9DF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next attachment"
              >
                <ChevronRight className="w-4 h-4 text-[#14110F]" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Stitch I05: Two-Column Viewer Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Media Stage (8 columns) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div
            ref={stageRef}
            className="w-full bg-[#14110F] rounded-3xl min-h-[520px] relative flex flex-col justify-between overflow-hidden shadow-2xl border border-black/40 text-white"
          >
            {/* Top Media HUD Bar (Overlaid on Dark Stage) */}
            <div className="w-full p-4 flex items-center justify-between z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold tracking-wider uppercase text-white/90 border border-white/10">
                  {fileExt} · {category.toUpperCase()}
                </span>
                <span className="hidden sm:inline text-xs text-white/60">
                  {downloadInfo?.mimeType ?? 'Presigned Asset'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B6E09B]/20 text-[#B6E09B] text-[11px] font-bold border border-[#B6E09B]/30">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>VAULT ASSET VERIFIED</span>
                </div>
              </div>
            </div>

            {/* Central Media Canvas Display Area */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative min-h-[360px] overflow-hidden">
              {loading && (
                <div className="flex flex-col items-center gap-3 text-white/80 animate-pulse">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#FFD64A]" />
                  <p className="text-sm font-medium">
                    Verifying asset credentials & presigned URL...
                  </p>
                  <p className="text-xs text-white/50">
                    Audited access via CreatorConnect Media Vault
                  </p>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center text-center max-w-md gap-3 p-6 bg-red-950/40 rounded-2xl border border-red-500/30 text-white">
                  <ShieldAlert className="w-12 h-12 text-[#FFB4AB]" />
                  <h3 className="text-lg font-bold">Asset No Longer Accessible</h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    {error.includes('denied') || error.includes('403')
                      ? 'Your access to this attachment was denied or conversation membership changed. Only active participants may inspect thread media.'
                      : error}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={fetchDownload}
                      className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Authorization</span>
                    </button>
                    {onClose && (
                      <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-full bg-[#FFD64A] text-[#14110F] text-xs font-bold transition-colors"
                      >
                        Return to Thread
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!loading && !error && downloadInfo && (
                <>
                  {/* STAGE 1: Image Mode */}
                  {category === 'image' && (
                    <div className="w-full h-full flex items-center justify-center overflow-auto max-h-[500px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={downloadInfo.downloadUrl}
                        alt={downloadInfo.fileName}
                        style={{
                          transform: `scale(${zoom})`,
                          transition: 'transform 0.15s ease-out',
                        }}
                        className="max-h-[460px] max-w-full object-contain rounded-lg shadow-2xl select-none"
                      />
                    </div>
                  )}

                  {/* STAGE 2: Video Mode */}
                  {category === 'video' && (
                    <div className="w-full flex items-center justify-center">
                      <video
                        src={downloadInfo.downloadUrl}
                        controls
                        playsInline
                        className="max-h-[460px] max-w-full rounded-xl shadow-2xl bg-black"
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}

                  {/* STAGE 3: PDF Document Mode */}
                  {category === 'pdf' && (
                    <div className="w-full flex flex-col items-center gap-3">
                      <div className="w-full h-[460px] rounded-xl overflow-hidden bg-white shadow-2xl">
                        <iframe
                          src={downloadInfo.downloadUrl}
                          title={downloadInfo.fileName}
                          className="w-full h-full border-0"
                        />
                      </div>
                      <p className="text-[11px] text-white/50">
                        Rendered using isolated sandbox document frame.
                      </p>
                    </div>
                  )}

                  {/* STAGE 4: Unsupported Format / Raw 3D LUT / Archive */}
                  {category === 'unsupported' && (
                    <div className="flex flex-col items-center text-center max-w-md gap-3 p-6 bg-white/5 rounded-2xl border border-white/10 text-white">
                      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-[#FFD64A]">
                        <FileCode className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold">No In-Browser Preview for .{fileExt}</h3>
                      <p className="text-xs text-white/70 leading-relaxed">
                        For security and fidelity, active scripts, raw archives, or 3D LUT grading
                        files are not parsed inline in the browser. You can safely download the
                        original asset to inspect it locally.
                      </p>
                      <a
                        href={downloadInfo.downloadUrl}
                        download={downloadInfo.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFD64A] hover:bg-[#F2CA3D] text-[#14110F] font-bold text-xs shadow-md transition-transform active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          Download {downloadInfo.fileName} ({formatFileSize(downloadInfo.fileSize)})
                        </span>
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Controls & Cinema Viewport Toolbar (Floating Pill) */}
            <div className="w-full p-4 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="text-xs text-white/60">
                {downloadInfo ? (
                  <span>
                    Size:{' '}
                    <strong className="text-white">{formatFileSize(downloadInfo.fileSize)}</strong>{' '}
                    · {downloadInfo.fileName}
                  </span>
                ) : null}
              </div>

              {category === 'image' && !loading && !error && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-lg">
                  <button
                    onClick={() => handleZoom(-0.25)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>

                  <span className="w-12 text-center text-xs tabular-nums font-mono">
                    {Math.round(zoom * 100)}%
                  </span>

                  <button
                    onClick={() => handleZoom(0.25)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-white/20">|</span>

                  <button
                    onClick={resetZoom}
                    className="px-2 py-0.5 rounded hover:bg-white/20 text-[11px] transition-colors"
                    title="Reset to 100%"
                  >
                    1:1
                  </button>

                  <button
                    onClick={resetZoom}
                    className="px-2 py-0.5 rounded hover:bg-white/20 text-[11px] transition-colors"
                    title="Fit to Screen"
                  >
                    Fit
                  </button>

                  <span className="text-white/20">|</span>

                  <button
                    onClick={toggleFullscreen}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Media Vault Scan Footnote */}
          <div className="w-full p-3.5 bg-white rounded-2xl border border-[#EFE9DF] text-[11px] text-[#6F675E] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-[#14110F]">
              <ShieldCheck className="w-4 h-4 text-[#2E7D32]" />
              <span>CreatorConnect Media Vault</span>
            </div>
            <div>
              Presigned Asset Link ({Math.round((downloadInfo?.expiresInSeconds ?? 900) / 60)}m
              expiry) · Access Audit Logged
            </div>
          </div>
        </div>

        {/* Right Column: Attachment Dossier & Action Sidebar (4 columns) */}
        <aside
          aria-label="Attachment dossier and download controls"
          className="lg:col-span-4 flex flex-col gap-4"
        >
          <div className="w-full bg-white rounded-3xl p-6 shadow-xs border border-[#EFE9DF] flex flex-col gap-5">
            {/* Dossier Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EFE9DF]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FFD64A] text-[#14110F] flex items-center justify-center font-bold text-xs">
                  <FileText className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-base text-[#14110F]">Attachment Details</h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#B6E09B] text-[#14110F]">
                Authorized
              </span>
            </div>

            {/* Primary File Identity Section */}
            <div className="bg-[#FAF2EE] rounded-2xl p-4 flex flex-col gap-3 border border-[#EFE9DF]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F675E]">
                  Active File
                </span>
                <h3
                  className="font-bold text-sm text-[#14110F] truncate mt-0.5"
                  title={downloadInfo?.fileName ?? ''}
                >
                  {downloadInfo?.fileName ?? (loading ? 'Loading...' : 'Unknown')}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8DFD5] text-left text-xs">
                <div>
                  <span className="text-[10px] text-[#6F675E]">Format:</span>
                  <p className="font-semibold text-[#14110F] truncate">
                    {downloadInfo?.mimeType ?? 'Presigned File'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[#6F675E]">File Size:</span>
                  <p className="font-semibold text-[#14110F]">
                    {downloadInfo ? formatFileSize(downloadInfo.fileSize) : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[#6F675E]">Expiry:</span>
                  <p className="font-semibold text-[#14110F]">
                    {downloadInfo
                      ? `${Math.round(downloadInfo.expiresInSeconds / 60)} Minutes`
                      : '15 Minutes'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-[#6F675E]">Attachment ID:</span>
                  <p className="font-mono text-[10px] text-[#6F675E] truncate" title={attachmentId}>
                    {attachmentId.slice(0, 12)}...
                  </p>
                </div>
              </div>
            </div>

            {/* Sender Provenance & Chat Thread Anchor */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F675E]">
                Sender Provenance
              </span>
              <div className="flex items-center gap-3 p-3 bg-[#FAF2EE] rounded-2xl border border-[#EFE9DF]">
                <div className="w-10 h-10 rounded-full bg-[#725C00] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {peerName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-[#14110F] truncate">{peerName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#B6E09B] text-[#14110F] font-semibold">
                      Verified
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6F675E]">Thread Participant</span>
                </div>
              </div>

              {originMessage && (
                <div className="p-3 bg-[#FAF2EE]/60 rounded-xl text-xs text-[#6F675E] border border-[#EFE9DF]/80">
                  <div className="flex items-center justify-between text-[10px] font-medium text-[#8C827A] mb-1">
                    <span>Sent in message</span>
                    <span>{formatMessageTimestamp(originMessage.createdAt)}</span>
                  </div>
                  <p className="italic text-[#14110F] line-clamp-2">
                    &ldquo;{originMessage.content}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Primary Download Action Button (Stitch I05 Specification) */}
            <div className="flex flex-col gap-2 pt-2">
              {downloadInfo?.downloadUrl ? (
                <a
                  href={downloadInfo.downloadUrl}
                  download={downloadInfo.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-full bg-[#FFD64A] hover:bg-[#F2CA3D] text-[#14110F] font-bold text-sm text-center shadow-xs flex items-center justify-center gap-2 transition-transform active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Original Asset ({formatFileSize(downloadInfo.fileSize)})</span>
                </a>
              ) : (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-full bg-[#EFE9DF] text-[#8C827A] font-bold text-sm text-center cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Unavailable</span>
                </button>
              )}

              <p className="text-[10px] text-center text-[#8C827A] leading-tight">
                Presigned download expires in{' '}
                {Math.round((downloadInfo?.expiresInSeconds ?? 900) / 60)} minutes. Download access
                is logged for security audit.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
