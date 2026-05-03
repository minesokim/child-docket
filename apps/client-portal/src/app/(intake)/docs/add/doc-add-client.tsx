'use client';

// Free / uncategorized document upload.
//
// User uploaded the slot-mapped docs they had + still wants to send
// "anything else" (an IRS notice, a random 1099, a receipt). We
// auto-classify in the background but DON'T surface the doc back on
// the /docs overview (per Q1b in the redesign). The client sees a
// quiet "Sent — your preparer will review" confirmation, then
// returns to the overview.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AntonioNote,
  AskAntonioBar,
  Body,
  Button,
  buildTheme,
  H1,
  IntakeBackButton,
  IntakeHeader,
  Row,
  Screen,
  Stack,
} from '@docket/ui';
import type { Theme } from '@docket/ui';
import { requestUploadUrl, confirmUpload } from '@/lib/docs/upload';

type Phase = 'idle' | 'uploading' | 'sent' | 'failed';

type State = {
  phase: Phase;
  uploadProgress: number;
  errorMessage: string | null;
};

export function DocAddClient() {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const router = useRouter();
  const [state, setState] = React.useState<State>({
    phase: 'idle',
    uploadProgress: 0,
    errorMessage: null,
  });

  const onFileChosen = async (file: File) => {
    setState({ phase: 'uploading', uploadProgress: 0, errorMessage: null });
    const preflight = await requestUploadUrl({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    });
    if (!preflight.ok) {
      setState({ phase: 'failed', uploadProgress: 0, errorMessage: preflight.error });
      return;
    }
    const putOk = await putWithProgress(
      preflight.uploadUrl,
      preflight.headers,
      file,
      (pct) => setState((s) => ({ ...s, uploadProgress: pct })),
    );
    if (!putOk.ok) {
      setState({ phase: 'failed', uploadProgress: 0, errorMessage: putOk.error });
      return;
    }
    const confirmed = await confirmUpload({
      storageKey: preflight.storageKey,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    });
    if (!confirmed.ok) {
      setState({ phase: 'failed', uploadProgress: 0, errorMessage: confirmed.error });
      return;
    }
    setState({ phase: 'sent', uploadProgress: 100, errorMessage: null });
  };

  const onBack = () => router.push('/docs');

  return (
    <Screen t={t}>
      <div
        style={{
          padding: '24px 0 0',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100%',
        }}
      >
        <IntakeHeader t={t} step={12} label="Documents" />

        <div style={{ padding: '22px 24px 0' }}>
          <IntakeBackButton t={t} onClick={onBack} />
        </div>

        <div style={{ padding: '20px 24px 8px' }}>
          <Stack gap={8}>
            <H1 t={t}>Send something extra</H1>
            <Body t={t} size={14}>
              Anything you want me to see — a notice from the IRS, a
              receipt, last year&apos;s K-1, a curveball.
            </Body>
          </Stack>
        </div>

        <div style={{ padding: '14px 24px 0', flex: 1 }}>
          <PhaseBlock t={t} state={state} onFileChosen={onFileChosen} onDone={onBack} />
        </div>

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            background: `linear-gradient(to top, ${t.bg} 75%, transparent)`,
            padding: '20px 24px 28px',
            marginTop: 24,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <AskAntonioBar t={t} />
          </div>
          <Button t={t} variant="ghost" onClick={onBack} style={{ width: '100%' }}>
            Back to documents
          </Button>
        </div>
      </div>
    </Screen>
  );
}

function PhaseBlock({
  t,
  state,
  onFileChosen,
  onDone,
}: {
  t: Theme;
  state: State;
  onFileChosen: (file: File) => void;
  onDone: () => void;
}) {
  if (state.phase === 'idle') {
    return (
      <Stack gap={20}>
        <AntonioNote t={t}>
          Whatever you send, I&apos;ll figure out what it is and where it
          fits. Don&apos;t worry about labeling.
        </AntonioNote>
        <Stack gap={10}>
          <FilePickerButton t={t} primary mode="camera" onPick={onFileChosen}>
            Take a photo
          </FilePickerButton>
          <FilePickerButton t={t} primary={false} mode="file" onPick={onFileChosen}>
            Upload a file
          </FilePickerButton>
        </Stack>
      </Stack>
    );
  }

  if (state.phase === 'uploading') {
    return (
      <Stack gap={20}>
        <div
          style={{
            padding: '24px 16px',
            borderRadius: 12,
            background: t.ease.keylimeWash,
            textAlign: 'center',
            fontFamily: t.serif,
            fontSize: 16,
            color: t.ink,
          }}
        >
          Uploading…
        </div>
        <ProgressBar t={t} percent={state.uploadProgress} />
      </Stack>
    );
  }

  if (state.phase === 'sent') {
    return (
      <Stack gap={20}>
        <div
          style={{
            padding: '24px 18px',
            background: t.ease.keylimeWash,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#1f4621',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M5 9l3 3 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 17,
                color: t.rustInk,
                letterSpacing: -0.2,
              }}
            >
              Sent
            </div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>
              Your preparer will review it.
            </div>
          </div>
        </div>
        <Stack gap={10}>
          <Button t={t} onClick={onDone} style={{ width: '100%' }}>
            Done
          </Button>
          <Button
            t={t}
            variant="ghost"
            onClick={() => {
              // Reset to idle so the user can send another.
            }}
            style={{ width: '100%' }}
          >
            Send another
          </Button>
        </Stack>
      </Stack>
    );
  }

  // Failed
  return (
    <Stack gap={20}>
      <div
        style={{
          padding: '20px 18px',
          background: '#FDF1EA',
          borderRadius: 12,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: t.serif,
            fontSize: 16,
            color: '#6E2B0C',
            marginBottom: 6,
          }}
        >
          Couldn&apos;t send it
        </div>
        <div style={{ fontSize: 13, color: '#6E2B0C', lineHeight: 1.5 }}>
          {state.errorMessage ?? 'Try again in a moment.'}
        </div>
      </div>
      <Stack gap={10}>
        <FilePickerButton t={t} primary mode="camera" onPick={onFileChosen}>
          Try again — take a photo
        </FilePickerButton>
        <FilePickerButton t={t} primary={false} mode="file" onPick={onFileChosen}>
          Try again — upload a file
        </FilePickerButton>
      </Stack>
    </Stack>
  );
}

// Same shape as the [slotId] page — TODO: extract if a third caller
// shows up. Two duplicates is fine; three is when extraction earns
// its keep.
function ProgressBar({ t, percent }: { t: Theme; percent: number }) {
  return (
    <div>
      <div
        style={{
          height: 4,
          background: t.borderSoft,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            background: t.rust,
            borderRadius: 999,
            transition: 'width 200ms linear',
          }}
        />
      </div>
      <div
        style={{
          textAlign: 'center',
          marginTop: 8,
          fontFamily: t.mono,
          fontSize: 11,
          color: t.muted,
          letterSpacing: 0.4,
        }}
      >
        {percent}%
      </div>
    </div>
  );
}

function FilePickerButton({
  t,
  onPick,
  primary,
  mode,
  children,
}: {
  t: Theme;
  onPick: (file: File) => void;
  primary: boolean;
  mode: 'camera' | 'file';
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
        {...(mode === 'camera' ? { capture: 'environment' as const } : {})}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
      <Button
        t={t}
        variant={primary ? 'primary' : 'ghost'}
        onClick={() => ref.current?.click()}
        style={{ width: '100%' }}
      >
        {children}
      </Button>
    </>
  );
}

async function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: `Upload failed (${xhr.status}). Tap to retry.` });
      }
    };
    xhr.onerror = () =>
      resolve({ ok: false, error: 'Upload failed — network error.' });
    xhr.ontimeout = () => resolve({ ok: false, error: 'Upload timed out.' });
    xhr.send(file);
  });
}
