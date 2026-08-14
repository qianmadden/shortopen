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

  let client;
  try {
    client = makeClient();
  } catch (error) {
    console.error('[Short Open Auth]', error);
    window.shortOpenAuthReady = Promise.resolve({ client: null, session: null, error });
    return;
  }

  window.shortOpenSupabase = client;

  const state = {
    session: null,
    user: null
  };

  function ensureNavLink(container, mobile) {
    if (!container) return null;
    let link = container.querySelector('[data-so-auth-nav]');
    if (link) return link;

    link = document.createElement('a');
    link.href = 'account.html';
    link.dataset.soAuthNav = 'true';
    link.textContent = 'Sign In';

    if (mobile) {
      link.className = 'so-auth-mobile-link';
      container.appendChild(link);
    } else {
      link.className = 'so-nav-secondary so-auth-account-link';
      container.appendChild(link);
    }
    return link;
  }

  function paintNav(session) {
    state.session = session || null;
    state.user = session && session.user ? session.user : null;
    const label = state.user ? 'My Account' : 'Sign In';

    const desktop = ensureNavLink(document.querySelector('.so-nav-actions'), false);
    if (desktop) {
      desktop.textContent = label;
      desktop.setAttribute('aria-label', label);
    }

    const mobileMenu = document.querySelector('.so-mobile-menu');
    const mobile = ensureNavLink(mobileMenu, true);
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
