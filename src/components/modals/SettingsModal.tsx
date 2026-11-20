'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Database,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  History,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  FolderOpen,
  ArrowRight,
  HardDrive,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useNotes } from '@/context/notes-context';
import { useAuth } from '@/context/auth-context';
import { loadSyncQueue, idbGetBackupHistory, idbSaveBackupRecord } from '@/lib/storage/offline-store';
import { createBackupPayload, generateBackupFilename, verifyBackupIntegrity } from '@/lib/backup/crypto';
import { BackupMetadataRecord, BackupVerificationResult, RestoreMode } from '@/types/backup';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export function SettingsModal({ isOpen, onClose, onOpenAuth }: SettingsModalProps) {
  const {
    notes,
    labels,
    triggerSync,
    syncState,
    syncStatusMessage,
    isDatabaseConnected,
    databaseWarning,
    restoreFromBackupData,
  } = useNotes();
  const { user, signOut, isConfigured } = useAuth();

  const [activeTab, setActiveTab] = useState<'main' | 'history' | 'restore' | 'verify'>('main');

  // Statuses
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [lastBackupInfo, setLastBackupInfo] = useState<{ date: string; destination: string; count: number } | null>(null);
  const [isDriveConfigured, setIsDriveConfigured] = useState<boolean>(false);
  const [loadingDriveStatus, setLoadingDriveStatus] = useState<boolean>(true);

  // Backup In Progress
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [backupErrorMessage, setBackupErrorMessage] = useState<string | null>(null);

  // History state
  const [backupHistory, setBackupHistory] = useState<BackupMetadataRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Restore state
  const [restorePayload, setRestorePayload] = useState<any | null>(null);
  const [restoreVerification, setRestoreVerification] = useState<BackupVerificationResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [confirmReplaceText, setConfirmReplaceText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResultMsg, setRestoreResultMsg] = useState<{ success: boolean; message: string } | null>(null);

  // Verification state (Standalone check)
  const [verifyFileResult, setVerifyFileResult] = useState<BackupVerificationResult | null>(null);
  const [verifyFileName, setVerifyFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyInputRef = useRef<HTMLInputElement>(null);

  // Check Google Drive configuration status on mount
  useEffect(() => {
    if (isOpen) {
      fetch('/api/backup/list')
        .then((res) => res.json())
        .then((data) => {
          setIsDriveConfigured(Boolean(data.googleDriveConfigured));
          setLoadingDriveStatus(false);
        })
        .catch(() => {
          setIsDriveConfigured(false);
          setLoadingDriveStatus(false);
        });

      // Load backup history from IndexedDB
      idbGetBackupHistory().then((records) => {
        setBackupHistory(records);
        if (records.length > 0) {
          const latest = records[0];
          setLastBackupInfo({
            date: new Date(latest.created_at).toLocaleString(),
            destination: latest.storage_location === 'google_drive' ? 'Google Drive' : 'Local Download',
            count: latest.notes_count,
          });
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const queue = loadSyncQueue();

  // 1. BACKUP NOW ACTION
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setBackupSuccessMessage(null);
    setBackupErrorMessage(null);

    try {
      const filename = generateBackupFilename();
      const payload = await createBackupPayload(notes, labels, [], {}, user?.id);

      // Verify payload integrity locally
      const localVerification = await verifyBackupIntegrity(payload);
      if (!localVerification.valid) {
        throw new Error('Integrity verification failed for generated backup');
      }

      const jsonStr = JSON.stringify(payload, null, 2);

      // Always trigger immediate local download so user has file on device
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute(
        'href',
        'data:text/json;charset=utf-8,' + encodeURIComponent(jsonStr)
      );
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      // Send to server to upload to Google Drive if configured
      let driveUploaded = false;
      try {
        const res = await fetch('/api/backup/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes,
            labels,
            userId: user?.id,
            uploadToDrive: true,
          }),
        });
        const serverData = await res.json();
        if (serverData.driveResult) {
          driveUploaded = true;
        }
      } catch (cloudErr) {
        console.warn('Could not complete Google Drive cloud upload:', cloudErr);
      }

      // Record in backup history
      const historyRecord: BackupMetadataRecord = {
        id: `backup-${Date.now()}`,
        filename,
        storage_location: driveUploaded ? 'google_drive' : 'local_download',
        file_size_bytes: jsonStr.length,
        notes_count: notes.length,
        labels_count: labels.length,
        checksum_sha256: payload.metadata.checksum_sha256,
        status: 'verified',
        created_at: new Date().toISOString(),
      };

      await idbSaveBackupRecord(historyRecord);
      const updatedHistory = await idbGetBackupHistory();
      setBackupHistory(updatedHistory);

      setLastBackupInfo({
        date: new Date().toLocaleString(),
        destination: driveUploaded ? 'Google Drive & Local File' : 'Local File',
        count: notes.length,
      });

      setBackupSuccessMessage(
        driveUploaded
          ? `Backup completed and verified! Saved to Google Drive ("Digital Diary Backups") & downloaded to your device.`
          : `Backup file generated and downloaded! (SHA-256: ${payload.metadata.checksum_sha256.slice(0, 10)}...)`
      );
    } catch (err: any) {
      setBackupErrorMessage(err?.message || 'Backup failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  // 2. TEXT EXPORT
  const handleExportText = () => {
    let output = `MY DIARY — READABLE TEXT EXPORT\nGenerated: ${new Date().toLocaleString()}\nTotal Notes: ${notes.length}\n========================================\n\n`;
    notes
      .filter((n) => !n.is_deleted)
      .forEach((note, index) => {
        output += `[Note ${index + 1}] ${note.title || 'Untitled'}\n`;
        output += `Date: ${new Date(note.updated_at).toLocaleDateString()}\n`;
        if (note.labels && note.labels.length > 0) {
          output += `Labels: ${note.labels.map((l) => l.name).join(', ')}\n`;
        }
        output += `----------------------------------------\n`;
        output += `${note.content}\n\n`;
        output += `========================================\n\n`;
      });

    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(output);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `diary-notes-${new Date().toISOString().slice(0, 10)}.txt`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 3. RESTORE FILE PARSER & VALIDATOR
  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const verification = await verifyBackupIntegrity(parsed);
        setRestorePayload(parsed);
        setRestoreVerification(verification);
        setActiveTab('restore');
      } catch (err) {
        alert('Invalid JSON file. Please select a valid Diary backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. RESTORE EXECUTION
  const handleExecuteRestore = async () => {
    if (!restorePayload || !restoreVerification?.valid) return;

    if (restoreMode === 'replace') {
      if (confirmReplaceText.toLowerCase() !== 'replace') {
        alert('Please type "REPLACE" to confirm destructive replacement.');
        return;
      }
    }

    setIsRestoring(true);
    setRestoreResultMsg(null);

    try {
      const res = await restoreFromBackupData(restorePayload, {
        mode: restoreMode,
        createSafetyBackup: true,
      });

      if (res.success) {
        setRestoreResultMsg({
          success: true,
          message: `Successfully restored ${res.restoredNotesCount} notes and ${res.restoredLabelsCount} labels (${restoreMode} mode).${
            res.safetyBackupCreated ? ' Automatic safety backup of previous notes was preserved.' : ''
          }`,
        });
        setRestorePayload(null);
        setRestoreVerification(null);
        setConfirmReplaceText('');
      } else {
        setRestoreResultMsg({
          success: false,
          message: res.error || 'Restore failed',
        });
      }
    } catch (e: any) {
      setRestoreResultMsg({
        success: false,
        message: e?.message || 'Restore error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 5. STANDALONE VERIFY FILE
  const handleSelectVerifyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerifyFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const verification = await verifyBackupIntegrity(parsed);
        setVerifyFileResult(verification);
        setActiveTab('verify');
      } catch (err) {
        setVerifyFileResult({
          valid: false,
          error: 'File is not a valid JSON document.',
          notesCount: 0,
          labelsCount: 0,
          versionsCount: 0,
          createdAt: '',
          checksumMatched: false,
          computedChecksum: '',
          declaredChecksum: '',
          formatVersion: 'invalid',
          duplicateIdsFound: 0,
        });
        setActiveTab('verify');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Compute Overall Protection Status
  const isProtected = isConfigured && isDatabaseConnected && (lastBackupInfo !== null || isDriveConfigured);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-7 shadow-2xl border border-stone-200 dark:border-stone-800 z-10 max-h-[92vh] overflow-y-auto">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Settings & Data Protection
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex p-1 bg-stone-100 dark:bg-stone-800/80 rounded-xl my-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('main')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'main'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Backup & Sync
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Backup History
          </button>
          <button
            onClick={() => setActiveTab('restore')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'restore'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Restore Backup
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'verify'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Verify Integrity
          </button>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleSelectRestoreFile}
          className="hidden"
        />
        <input
          ref={verifyInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleSelectVerifyFile}
          className="hidden"
        />

        {/* TAB 1: MAIN BACKUP & RECOVERY SCREEN */}
        {activeTab === 'main' && (
          <div className="space-y-5">
            {/* Protection Status Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3 ${
                isProtected
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                  : databaseWarning
                  ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                  : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
              }`}
            >
              {isProtected ? (
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : databaseWarning ? (
                <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm">
                  {isProtected
                    ? 'Three-Layer Data Protection Active'
                    : databaseWarning
                    ? 'Cloud Database Unreachable — Local Notes Safe'
                    : 'Device-Only Protection (IndexedDB)'}
                </p>
                <p className="leading-relaxed opacity-90">
                  {isProtected
                    ? 'Notes are persisted in IndexedDB on your device, synchronized with Supabase PostgreSQL, and backed up in Google Drive.'
                    : databaseWarning
                    ? `${databaseWarning}. All your notes remain completely accessible on this device and pending edits will synchronize once reconnected.`
                    : 'Notes are saved locally in IndexedDB. Connect Supabase & Google Drive for automated multi-device cloud backups.'}
                </p>
              </div>
            </div>

            {/* Success & Error Alerts */}
            {backupSuccessMessage && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>{backupSuccessMessage}</span>
                <button onClick={() => setBackupSuccessMessage(null)} className="ml-2 font-bold">×</button>
              </div>
            )}
            {backupErrorMessage && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
                <span>{backupErrorMessage}</span>
                <button onClick={() => setBackupErrorMessage(null)} className="ml-2 font-bold">×</button>
              </div>
            )}

            {/* SECTION: BACKUP & RECOVERY METRICS */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/60 space-y-3">
              <span className="text-xs font-bold uppercase text-stone-400 tracking-wider block">
                Backup & Recovery Status
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {/* 1. Last Cloud Sync */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/60">
                  <span className="text-stone-400 block text-[11px]">Last Cloud Sync:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1 mt-0.5">
                    <Cloud className="w-3.5 h-3.5 text-amber-500" />
                    <span>{syncStatusMessage || 'Synchronized'}</span>
                  </span>
                </div>

                {/* 2. Last Successful Backup */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/60">
                  <span className="text-stone-400 block text-[11px]">Last Successful Backup:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1 mt-0.5 truncate">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{lastBackupInfo ? `${lastBackupInfo.date}` : 'Not yet created'}</span>
                  </span>
                </div>

                {/* 3. Automatic Backup Status */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/60">
                  <span className="text-stone-400 block text-[11px]">Automatic Backup:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Daily at 02:00 UTC (GitHub Actions)</span>
                  </span>
                </div>

                {/* 4. Google Drive Status */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-700/60">
                  <span className="text-stone-400 block text-[11px]">Google Drive Destination:</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1 mt-0.5">
                    {isDriveConfigured ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Connected (&quot;Digital Diary Backups&quot;)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Ready (Add credentials in Secrets)</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Backup Now & Download */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleBackupNow}
                  disabled={isBackingUp}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-semibold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
                  <span>{isBackingUp ? 'Generating & Uploading...' : 'Backup Now'}</span>
                </button>

                <button
                  onClick={handleExportText}
                  className="py-2.5 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-amber-500 text-stone-800 dark:text-stone-200 font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  title="Download readable plain text file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download TXT</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 hover:border-amber-500 text-stone-800 dark:text-stone-200 font-semibold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
                  title="Upload a backup to restore notes"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restore File</span>
                </button>
              </div>
            </div>

            {/* User Account Section */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700/60">
              <span className="text-xs font-bold uppercase text-stone-400 tracking-wider block mb-2">
                Authentication & Isolation
              </span>
              {user ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                      {user.user_metadata?.name || 'Brother / Owner'}
                    </p>
                    <p className="text-xs text-stone-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Sign in to associate your cloud notes with your private Supabase account.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shrink-0 ml-3"
                  >
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BACKUP HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Backup History & Recovery Points
                </h3>
                <p className="text-xs text-stone-500">
                  Independently dated snapshots. Never overwrites the only valid backup.
                </p>
              </div>
              <button
                onClick={handleBackupNow}
                disabled={isBackingUp}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isBackingUp ? 'animate-spin' : ''}`} />
                <span>New Snapshot</span>
              </button>
            </div>

            {backupHistory.length === 0 ? (
              <div className="py-12 text-center text-xs text-stone-400">
                <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No backups recorded yet on this device.</p>
                <p className="mt-1">Click &quot;New Snapshot&quot; or &quot;Backup Now&quot; to create your first recovery point.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {backupHistory.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200/80 dark:border-stone-700/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800 dark:text-stone-200 truncate max-w-[200px] sm:max-w-[260px]">
                          {rec.filename}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-stone-500 mt-1">
                        <span>{new Date(rec.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span>{rec.notes_count} notes</span>
                        <span>•</span>
                        <span>{(rec.file_size_bytes / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span className="font-mono">{rec.checksum_sha256 ? rec.checksum_sha256.slice(0, 8) : 'SHA-256'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: RESTORE BACKUP SCREEN */}
        {activeTab === 'restore' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Restore Backup (Decoupled Recovery)
                </h3>
                <p className="text-xs text-stone-500">
                  Restores notes into any new or existing database. Preserves content, checklists, labels, and dates.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                <span>Select JSON File</span>
              </button>
            </div>

            {restoreResultMsg && (
              <div
                className={`p-3 rounded-xl text-xs ${
                  restoreResultMsg.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {restoreResultMsg.message}
              </div>
            )}

            {!restorePayload ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="py-12 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl text-center cursor-pointer hover:border-amber-500 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Click here to upload your JSON backup file
                </p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Works even if the original Supabase project is gone or deleted!
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-4 text-xs">
                {/* Pre-Restoration Verification Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-bold text-stone-800 dark:text-stone-200">
                    <span>Pre-Restoration Verification</span>
                    {restoreVerification?.valid ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> SHA-256 Verified
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Verification Failed
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700">
                      <span className="text-stone-400 block">Backup Date:</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        {restoreVerification?.createdAt
                          ? new Date(restoreVerification.createdAt).toLocaleString()
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700">
                      <span className="text-stone-400 block">Recoverable Notes:</span>
                      <span className="font-bold text-amber-600">
                        {restoreVerification?.notesCount || 0} notes ({restoreVerification?.labelsCount || 0} labels)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Restoration Mode Selector */}
                <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-700">
                  <span className="font-bold text-stone-700 dark:text-stone-300 block">
                    Choose Restoration Mode:
                  </span>

                  <div className="space-y-2">
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreMode"
                        value="merge"
                        checked={restoreMode === 'merge'}
                        onChange={() => setRestoreMode('merge')}
                        className="mt-0.5 text-amber-500"
                      />
                      <div>
                        <span className="font-bold text-stone-800 dark:text-stone-200 block">
                          Merge with existing notes (Recommended)
                        </span>
                        <span className="text-[11px] text-stone-500">
                          Adds missing notes and updates older entries. Does not delete any existing notes.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 cursor-pointer">
                      <input
                        type="radio"
                        name="restoreMode"
                        value="replace"
                        checked={restoreMode === 'replace'}
                        onChange={() => setRestoreMode('replace')}
                        className="mt-0.5 text-rose-500"
                      />
                      <div>
                        <span className="font-bold text-rose-800 dark:text-rose-300 block">
                          Replace existing notes (Destructive)
                        </span>
                        <span className="text-[11px] text-rose-600 dark:text-rose-400">
                          Overwrites all notes. Automatically generates and verifies a safety pre-backup first!
                        </span>
                      </div>
                    </label>
                  </div>

                  {restoreMode === 'replace' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-rose-700 dark:text-rose-300 mb-1">
                        Type &quot;REPLACE&quot; to confirm:
                      </label>
                      <input
                        type="text"
                        value={confirmReplaceText}
                        onChange={(e) => setConfirmReplaceText(e.target.value)}
                        placeholder="REPLACE"
                        className="w-full p-2 rounded-lg border border-rose-300 bg-white dark:bg-stone-900 text-xs focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Execute Button */}
                <button
                  onClick={handleExecuteRestore}
                  disabled={isRestoring || !restoreVerification?.valid}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {isRestoring
                      ? 'Restoring & Preserving Safety Backup...'
                      : `Restore ${restoreVerification?.notesCount || 0} Notes now`}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: VERIFY BACKUP INTEGRITY */}
        {activeTab === 'verify' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Verify Backup Integrity
                </h3>
                <p className="text-xs text-stone-500">
                  Test and inspect any backup file without touching your current database.
                </p>
              </div>
              <button
                onClick={() => verifyInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-700 text-xs font-semibold"
              >
                Select File
              </button>
            </div>

            {!verifyFileResult ? (
              <div
                onClick={() => verifyInputRef.current?.click()}
                className="py-12 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl text-center cursor-pointer hover:border-amber-500 transition-colors"
              >
                <FileCheck className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Upload any diary backup to run SHA-256 cryptographic check
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold truncate max-w-[200px]">{verifyFileName}</span>
                  {verifyFileResult.valid ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> REJECTED
                    </span>
                  )}
                </div>

                {verifyFileResult.error && (
                  <p className="text-rose-600 bg-rose-50 dark:bg-rose-950/50 p-2 rounded-lg">
                    {verifyFileResult.error}
                  </p>
                )}

                <div className="space-y-1.5 text-[11px] text-stone-600 dark:text-stone-400">
                  <p><strong>Format Version:</strong> {verifyFileResult.formatVersion}</p>
                  <p><strong>Notes Count:</strong> {verifyFileResult.notesCount}</p>
                  <p><strong>Labels Count:</strong> {verifyFileResult.labelsCount}</p>
                  <p><strong>Checksum (Computed):</strong> <span className="font-mono">{verifyFileResult.computedChecksum}</span></p>
                  <p><strong>Checksum (Declared):</strong> <span className="font-mono">{verifyFileResult.declaredChecksum}</span></p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
