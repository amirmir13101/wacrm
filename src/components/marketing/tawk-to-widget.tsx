'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    __talkWagonTawkAllowed?: boolean;
    Tawk_API?: {
      hideWidget?: () => void;
      showWidget?: () => void;
      maximize?: () => void;
      onLoad?: () => void;
    };
  }
}

const TAWK_PUBLIC_EXACT_PATHS = new Set([
  '/',
  '/about',
  '/blog',
  '/contact',
  '/data-deletion',
  '/features',
  '/pricing',
  '/privacy-policy',
  '/refund-policy',
  '/security',
  '/terms-and-conditions',
  '/wati-alternative',
]);

const TAWK_PUBLIC_PATH_PREFIXES = [
  '/data-deletion/',
  '/blog/',
  '/features/',
  '/use-cases/',
] as const;

function isTawkPublicPath(pathname: string): boolean {
  return (
    TAWK_PUBLIC_EXACT_PATHS.has(pathname) ||
    TAWK_PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const MARKETING_HOSTS = new Set([
  'talkwagon.chat',
  'www.talkwagon.chat',
  'localhost',
  '127.0.0.1',
]);

function isMarketingHost(hostname: string): boolean {
  if (hostname === 'app.talkwagon.chat') return false;
  return MARKETING_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

export function TawkToWidget() {
  const pathname = usePathname();
  const [shouldShowTawk, setShouldShowTawk] = useState(false);

  useEffect(() => {
    const allowed =
      typeof window !== 'undefined' &&
      isMarketingHost(window.location.hostname.toLowerCase()) &&
      isTawkPublicPath(pathname);

    setShouldShowTawk(allowed);
    window.__talkWagonTawkAllowed = allowed;
    const tawk = window.Tawk_API;
    if (!tawk) return;

    if (allowed) {
      tawk.showWidget?.();
      return;
    }

    tawk.hideWidget?.();
  }, [pathname]);

  useEffect(() => {
    window.__talkWagonTawkAllowed = shouldShowTawk;
    const tawk = window.Tawk_API;
    if (!tawk) return;

    tawk.onLoad = () => {
      if (window.__talkWagonTawkAllowed) {
        tawk.showWidget?.();
      } else {
        tawk.hideWidget?.();
      }
    };

    if (shouldShowTawk) {
      tawk.showWidget?.();
      return;
    }

    tawk.hideWidget?.();
  }, [shouldShowTawk]);

  if (!shouldShowTawk) {
    return null;
  }

  return (
    <Script
      id="tawk-to-widget"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          var Tawk_API = Tawk_API || {}, Tawk_LoadStart = new Date();
          Tawk_API.onLoad = function() {
            if (window.__talkWagonTawkAllowed === false && Tawk_API.hideWidget) {
              Tawk_API.hideWidget();
            }
          };
          (function(){
            var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
            s1.async = true;
            s1.src = 'https://embed.tawk.to/69c2fd0846a6c41c341aac11/1jkgqoql8';
            s1.charset = 'UTF-8';
            s1.setAttribute('crossorigin', '*');
            s0.parentNode.insertBefore(s1, s0);
          })();
        `,
      }}
    />
  );
}
