(function () {
  'use strict';

  const SUPABASE_URL = 'https://tltfpencvpnhghoruiwb.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OjiAtV6BPd3Bn_FriQ_wow_xhnt2NQx';

  function makeClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase client library did not load.');
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  // Lightweight, non-sensitive "was this browser signed in last time"
  // hint. This is what lets the nav paint "My Account" immediately on a
  // fresh page load instead of always flashing "Sign In" first and only
  // flipping over once the real (async, network-bound) getSession() call
  // resolves a moment later -- that flash-then-flip on every navigation
  // was the visible "Sign In lags / nav reloads funny" behavior. The real
  // session check still runs and is always the source of truth; this only
  // controls the very first paint before that check comes back.
  const HINT_KEY = 'so_auth_hint';
  function readHint() {
    try { return window.localStorage.getItem(HINT_KEY); } catch (e) { return null; }
  }
  function writeHint(signedIn) {
    try { window.localStorage.setItem(HINT_KEY, signedIn ? 'in' : 'out'); } catch (e) { /* private mode, storage blocked, etc. */ }
  }

  let client;
  try {
    client = makeClient();
  } catch (error) {
    console.error('[Short Open Auth]', error);
    // Keep account access available even if the Supabase CDN is slow or
    // unavailable. Authentication can recover on the account page, while the
    // navigation must never silently lose its Sign In entry.
    ensureNavLink(document.querySelector('.so-nav-actions'), false);
    ensureNavLink(document.querySelector('.so-mobile-menu'), true);
    window.shortOpenAuthReady = Promise.resolve({ client: null, session: null, error });
    return;
  }

  window.shortOpenSupabase = client;

  const state = {
    session: null,
    user: null
  };

  function ensureNavLink(container, mobile, initialLabel) {
    if (!container) return null;
    let link = container.querySelector('[data-so-auth-nav]');
    if (link) return link;

    link = document.createElement('a');
    link.href = 'account.html';
    link.dataset.soAuthNav = 'true';
    link.textContent = initialLabel || 'Sign In';

    if (mobile) {
      link.className = 'so-auth-mobile-link';
      container.appendChild(link);
    } else {
      link.className = 'so-nav-secondary so-auth-account-link';
      container.appendChild(link);
    }
    return link;
  }

  // Paint immediately using last known state (from localStorage) rather than
  // always defaulting to signed-out. getSession() below still runs right
  // away and repaints with the real, authoritative session as soon as it
  // resolves -- this first paint is only a best-guess to avoid the visible
  // flash on every page load for a browser that was already signed in.
  const hintedIn = readHint() === 'in';
  const hintedLabel = hintedIn ? 'My Account' : 'Sign In';
  ensureNavLink(document.querySelector('.so-nav-actions'), false, hintedLabel);
  ensureNavLink(document.querySelector('.so-mobile-menu'), true, hintedLabel);
  if (hintedIn) document.documentElement.dataset.soAuth = 'signed-in';

  function paintNav(session) {
    state.session = session || null;
    state.user = session && session.user ? session.user : null;
    const label = state.user ? 'My Account' : 'Sign In';
    writeHint(!!state.user);

    const desktop = ensureNavLink(document.querySelector('.so-nav-actions'), false, label);
    if (desktop) {
      desktop.textContent = label;
      desktop.setAttribute('aria-label', label);
    }

    const mobileMenu = document.querySelector('.so-mobile-menu');
    const mobile = ensureNavLink(mobileMenu, true, label);
    if (mobile) {
      mobile.textContent = label;
      mobile.setAttribute('aria-label', label);
    }

    document.documentElement.dataset.soAuth = state.user ? 'signed-in' : 'signed-out';
  }

  async function initialSession() {
    const { data, error } = await client.auth.getSession();
    if (error) console.warn('[Short Open Auth] getSession:', error.message);
    const session = data ? data.session : null;
    paintNav(session);
    return { client, session, error: error || null };
  }

  const ready = initialSession().catch(function (error) {
    console.error('[Short Open Auth] session init:', error);
    paintNav(null);
    return { client, session: null, error };
  });

  window.shortOpenAuthReady = ready;
  window.shortOpenAuth = {
    client,
    get session() { return state.session; },
    get user() { return state.user; },
    refreshNav: function () { paintNav(state.session); }
  };

  client.auth.onAuthStateChange(function (_event, session) {
    paintNav(session);
    window.dispatchEvent(new CustomEvent('shortopen:authchange', {
      detail: { event: _event, session: session || null }
    }));
  });
})();
