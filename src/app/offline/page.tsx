'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/shell/Brand';

export default function OfflinePage() {
  const [online, setOnline] = useState(false);
  const [lastPortal, setLastPortal] = useState<string>('/app');
  const [portalLabel, setPortalLabel] = useState<string>('My Dashboard');
  const router = useRouter();

  useEffect(() => {
    setOnline(navigator.onLine);

    // Detect saved portal if available
    try {
      const saved = localStorage.getItem('carzz_last_portal') || localStorage.getItem('carzz_portal');
      if (saved) {
        setLastPortal(saved);
        if (saved.startsWith('/staff')) {
          setPortalLabel('Staff Dashboard');
        } else if (saved.startsWith('/console')) {
          setPortalLabel('Management Console');
        } else {
          setPortalLabel('Customer Portal');
        }
      }
    } catch {
      // ignore
    }

    const onOnline = () => {
      setOnline(true);
      window.location.reload();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleResume = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      window.location.href = lastPortal;
    }
  };

  return (
    <main
      style={{
        backgroundColor: '#081429',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        margin: 0,
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '24px',
          border: '1px solid #1e3a6a',
          backgroundColor: '#0e203f',
          padding: '40px 28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            margin: '0 auto',
            display: 'flex',
            height: '72px',
            width: '72px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '20px',
            backgroundColor: '#081429',
            border: '1px solid #1e3a6a',
          }}
        >
          <BrandMark size={48} />
        </div>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            color: '#ffffff',
            margin: '24px 0 8px',
          }}
        >
          {online ? 'Connection Restored!' : 'You are currently offline'}
        </h1>

        <p
          style={{
            margin: '0 0 24px',
            fontSize: '14px',
            color: '#94a3b8',
            lineHeight: 1.6,
          }}
        >
          {online
            ? 'Your internet is back. Reloading live data...'
            : 'Your saved dashboard, vehicle records, and wash schedules remain available offline.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={handleResume}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              backgroundColor: '#e8a317',
              color: '#081429',
              padding: '14px 20px',
              fontSize: '15px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
            }}
          >
            Open {portalLabel}
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px',
              border: '1px solid #1e3a6a',
              backgroundColor: '#081429',
              color: '#94a3b8',
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry Connection
          </button>
        </div>

        {/* Quick Portal Shortcuts if available */}
        <div style={{ marginTop: '24px', borderTop: '1px solid #1e3a6a', paddingTop: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '10px' }}>
            Offline Portals
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '13px' }}>
            <a href="/app" style={{ color: '#e8a317', textDecoration: 'none', fontWeight: 600 }}>Customer</a>
            <span style={{ color: '#334155' }}>•</span>
            <a href="/staff" style={{ color: '#e8a317', textDecoration: 'none', fontWeight: 600 }}>Wash Staff</a>
            <span style={{ color: '#334155' }}>•</span>
            <a href="/console" style={{ color: '#e8a317', textDecoration: 'none', fontWeight: 600 }}>Console</a>
          </div>
        </div>
      </div>
    </main>
  );
}

