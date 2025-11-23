'use client';

import { useEffect, useState } from 'react';
import { analytics } from '@/lib/analytics';

export default function DebugAnalyticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>({});

  useEffect(() => {
    // Wait for scripts to load
    setTimeout(() => {
      const diag = {
        envVarSet: !!process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
        envVarValue: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
        gtagExists: typeof window.gtag !== 'undefined',
        gtagType: typeof window.gtag,
        dataLayerExists: !!window.dataLayer,
        dataLayerLength: window.dataLayer?.length || 0,
        dataLayerContent: window.dataLayer ? [...window.dataLayer] : [],
        scriptsLoaded: checkScriptsLoaded(),
      };
      setDiagnostics(diag);
      console.log('[Debug] Full diagnostics:', diag);
    }, 2000);
  }, []);

  const checkScriptsLoaded = () => {
    const scripts = Array.from(document.querySelectorAll('script'));
    return {
      gtagScript: scripts.some(s => s.src.includes('gtag/js')),
      gtagScriptSrc: scripts.find(s => s.src.includes('gtag/js'))?.src || 'not found',
      allGAScripts: scripts
        .filter(s => s.src.includes('google') || s.innerHTML.includes('gtag'))
        .map(s => ({ src: s.src, hasInlineCode: s.innerHTML.length > 0 })),
    };
  };

  const testEvent = () => {
    console.log('[Debug] Sending test event...');
    analytics.track({ name: 'debug_test_event', params: { timestamp: Date.now() } });

    // Log dataLayer after event
    setTimeout(() => {
      console.log('[Debug] dataLayer after event:', window.dataLayer);
      setDiagnostics((prev: any) => ({
        ...prev,
        dataLayerAfterEvent: window.dataLayer ? [...window.dataLayer] : [],
      }));
    }, 500);
  };

  const testDirectGtag = () => {
    if (window.gtag) {
      console.log('[Debug] Calling gtag directly...');
      window.gtag('event', 'direct_test_event', {
        test_param: 'direct_call',
        timestamp: Date.now()
      });

      setTimeout(() => {
        console.log('[Debug] dataLayer after direct gtag call:', window.dataLayer);
        setDiagnostics((prev: any) => ({
          ...prev,
          dataLayerAfterDirectCall: window.dataLayer ? [...window.dataLayer] : [],
        }));
      }, 500);
    } else {
      alert('gtag is not defined!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">GA4 Analytics Debugger</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Diagnostics</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Events</h2>
          <div className="space-y-3">
            <button
              onClick={testEvent}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Send Test Event (via analytics.track)
            </button>
            <button
              onClick={testDirectGtag}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Send Direct gtag Event
            </button>
            <button
              onClick={() => {
                console.log('[Debug] Current state:');
                console.log('- window.gtag:', window.gtag);
                console.log('- window.dataLayer:', window.dataLayer);
                console.log('- All scripts:', Array.from(document.querySelectorAll('script')).map(s => s.src));
              }}
              className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            >
              Log Current State to Console
            </button>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Open your browser&apos;s DevTools (F12)</li>
            <li>Go to the <strong>Network</strong> tab</li>
            <li>Clear all requests (trash icon)</li>
            <li>Click &quot;Send Test Event&quot; above</li>
            <li>Look for requests to:
              <ul className="list-disc list-inside ml-6 mt-2">
                <li><code>google-analytics.com/g/collect</code></li>
                <li><code>google-analytics.com/collect</code></li>
                <li>Any request with &quot;analytics&quot; in the name</li>
              </ul>
            </li>
            <li>Check the Console tab for debug logs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
