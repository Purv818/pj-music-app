/**
 * Friends Page
 * Teen tarike se friend add karo:
 *  1. Username search
 *  2. Invite Link share karo (WhatsApp/SMS/Copy)
 *  3. Invite Code manually enter karo
 */

import api from '../api.js';
import { escapeHTML, toast, relativeTime } from '../ui.js';
import { emit, on, off } from '../socket.js';
import { player } from '../player.js';
import { getUser } from '../auth.js';

export const renderFriends = async (container) => {
  container.innerHTML = `
    <div class="page page-enter" id="friends-page">
      <div class="section-header">
        <h2 class="section-title">Friends</h2>
        <button class="btn btn-sm btn-primary" id="add-friend-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Friend
        </button>
      </div>

      <!-- Tabs -->
      <div class="library-tabs" id="friends-tabs">
        <button class="chip active" data-tab="friends">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          Friends
        </button>
        <button class="chip" data-tab="requests">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Requests
        </button>
      </div>

      <div id="friends-content"></div>
    </div>`;

  document.getElementById('add-friend-btn')?.addEventListener('click', showAddFriendModal);

  document.getElementById('friends-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    document.querySelectorAll('#friends-tabs .chip').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    tab.dataset.tab === 'friends' ? loadFriends() : loadRequests();
  });

  on('room:invitation',    ({ roomId, roomName, invitedBy, token }) => showSyncInvite({ roomId, roomName, invitedBy, token }));
  on('sync:inviteReceived', ({ from }) => showPeerSyncInvite(from));

  // Deep-link: app://add-friend?code=XXXX handle karo
  handleInviteCodeFromUrl();

  await loadFriends();
};

// ─── Load Friends ──────────────────────────────────────────────────────────────

const loadFriends = async () => {
  const content = document.getElementById('friends-content');
  try {
    const res = await api.get('/friends');
    const friends = res.data || [];

    if (friends.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <p class="empty-state__title">No friends yet</p>
          <p class="empty-state__subtitle">Search for users to add them as friends.</p>
        </div>`;
      return;
    }

    content.innerHTML = friends.map((f) => `
      <div class="friend-row">
        <div class="avatar avatar-md">
          ${f.avatar
            ? `<img src="${escapeHTML(f.avatar)}" alt="${escapeHTML(f.displayName || f.username)}" />`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
          }
        </div>
        <div class="friend-row__info">
          <div class="friend-row__name">${escapeHTML(f.displayName || f.username)}</div>
          <div class="friend-row__status">@${escapeHTML(f.username)}</div>
        </div>
        <div class="friend-row__actions">
          <button class="btn btn-sm btn-secondary listen-together" data-id="${escapeHTML(f._id)}" data-name="${escapeHTML(f.displayName || f.username)}">
            🎵 Listen
          </button>
          <button class="btn btn-sm btn-danger remove-friend" data-id="${escapeHTML(f._id)}">Remove</button>
        </div>
      </div>
    `).join('');

    content.querySelectorAll('.listen-together').forEach((btn) => {
      btn.addEventListener('click', () => {
        sendListenTogether(btn.dataset.id, btn.dataset.name);
      });
    });

    content.querySelectorAll('.remove-friend').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this friend?')) return;
        try {
          await api.delete(`/friends/${btn.dataset.id}`);
          toast('Friend removed');
          loadFriends();
        } catch { toast('Could not remove friend', 'error'); }
      });
    });

  } catch {
    content.innerHTML = '<p class="text-muted text-center" style="padding:32px;">Could not load friends.</p>';
  }
};

// ─── Load Requests ────────────────────────────────────────────────────────────

const loadRequests = async () => {
  const content = document.getElementById('friends-content');
  try {
    const res = await api.get('/friends/requests');
    const { received = [], sent = [] } = res.data || {};

    let html = '';

    if (received.length === 0 && sent.length === 0) {
      html = '<p class="text-muted text-center" style="padding:32px;">No pending requests</p>';
    }

    if (received.length > 0) {
      html += `<h3 style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:8px;padding:0 4px;">Received</h3>`;
      html += received.map((u) => `
        <div class="friend-row">
          <div class="avatar avatar-md">
            ${u.avatar ? `<img src="${escapeHTML(u.avatar)}" alt="" />` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>`}
          </div>
          <div class="friend-row__info">
            <div class="friend-row__name">${escapeHTML(u.displayName || u.username)}</div>
            <div class="friend-row__status">@${escapeHTML(u.username)}</div>
          </div>
          <div class="friend-row__actions">
            <button class="btn btn-sm btn-primary accept-req" data-id="${escapeHTML(u._id)}">Accept</button>
            <button class="btn btn-sm btn-secondary reject-req" data-id="${escapeHTML(u._id)}">Decline</button>
          </div>
        </div>
      `).join('');
    }

    if (sent.length > 0) {
      html += `<h3 style="font-size:0.875rem;color:var(--text-secondary);margin:16px 0 8px;padding:0 4px;">Sent</h3>`;
      html += sent.map((u) => `
        <div class="friend-row">
          <div class="avatar avatar-md">
            ${u.avatar ? `<img src="${escapeHTML(u.avatar)}" alt="" />` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>`}
          </div>
          <div class="friend-row__info">
            <div class="friend-row__name">${escapeHTML(u.displayName || u.username)}</div>
            <div class="friend-row__status">Pending...</div>
          </div>
        </div>
      `).join('');
    }

    content.innerHTML = html;

    content.querySelectorAll('.accept-req').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.post(`/friends/accept/${btn.dataset.id}`);
          toast('Friend added!', 'success');
          loadRequests();
        } catch { toast('Error', 'error'); }
      });
    });

    content.querySelectorAll('.reject-req').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.post(`/friends/reject/${btn.dataset.id}`).catch(() => {});
        loadRequests();
      });
    });

  } catch {
    content.innerHTML = '<p class="text-muted text-center" style="padding:32px;">Could not load requests.</p>';
  }
};

// ─── Add Friend Modal — 3 Tabs ────────────────────────────────────────────────
// Tab 1: Username Search
// Tab 2: Share Invite Link
// Tab 3: Enter Invite Code

const showAddFriendModal = () => {
  const user   = getUser();
  // User ka actual unique invite code — har user ka alag hota hai
  const myCode = user?.inviteCode || '------';
  const link   = `${window.location.origin}${window.location.pathname}?invite=${myCode}`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet" style="max-height:88vh;">
      <div class="modal-handle"></div>
      <h2 style="margin-bottom:4px;">Add Friend</h2>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px;">Teen tarike se add karo</p>

      <!-- Method tabs -->
      <div style="display:flex;gap:6px;margin-bottom:20px;background:var(--bg-elevated);border-radius:12px;padding:4px;">
        <button class="method-tab active" data-method="search"
          style="flex:1;padding:8px 4px;border-radius:9px;font-size:0.75rem;font-weight:600;transition:all 0.2s;background:transparent;color:var(--text-secondary);">
          🔍 Search
        </button>
        <button class="method-tab" data-method="share"
          style="flex:1;padding:8px 4px;border-radius:9px;font-size:0.75rem;font-weight:600;transition:all 0.2s;background:transparent;color:var(--text-secondary);">
          🔗 Share Link
        </button>
        <button class="method-tab" data-method="code"
          style="flex:1;padding:8px 4px;border-radius:9px;font-size:0.75rem;font-weight:600;transition:all 0.2s;background:transparent;color:var(--text-secondary);">
          📋 Enter Code
        </button>
      </div>

      <!-- Tab 1: Search -->
      <div id="method-search">
        <div class="search-input-wrap" style="margin-bottom:12px;">
          <div class="search-input-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <input class="search-input" id="friend-search-input"
            placeholder="@username ya naam search karo..." type="text" autocomplete="off" />
        </div>
        <div id="friend-search-results">
          <p style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:24px 0;">
            Kam se kam 2 characters type karo
          </p>
        </div>
      </div>

      <!-- Tab 2: Share Link -->
      <div id="method-share">
        <div style="text-align:center;padding:8px 0 20px;">
          <div style="
            width:72px;height:72px;
            background:linear-gradient(135deg,var(--color-primary),var(--color-accent));
            border-radius:20px;margin:0 auto 16px;
            display:flex;align-items:center;justify-content:center;
            font-size:32px;box-shadow:0 8px 24px rgba(168,85,247,0.4);">
            🔗
          </div>
          <h3 style="margin-bottom:6px;">Apna Invite Link Share Karo</h3>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:20px;">
            Dosto ko ye link bhejo — woh click karenge toh seedha friend request aa jayegi
          </p>
        </div>

        <!-- Link box -->
        <div style="
          background:var(--bg-elevated);border-radius:12px;
          padding:12px 14px;margin-bottom:16px;
          border:1.5px solid var(--border-color);
          display:flex;align-items:center;gap:10px;">
          <span style="flex:1;font-size:0.75rem;color:var(--text-secondary);word-break:break-all;font-family:monospace;">
            ${escapeHTML(link)}
          </span>
          <button id="copy-link-btn" style="
            flex-shrink:0;padding:6px 12px;
            background:var(--color-primary);color:white;
            border-radius:8px;font-size:0.75rem;font-weight:600;">
            Copy
          </button>
        </div>

        <!-- Your invite code -->
        <div style="text-align:center;margin-bottom:20px;">
          <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">Ya sirf ye code share karo</p>
          <div style="
            display:inline-block;
            background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(6,182,212,0.15));
            border:1.5px dashed var(--color-primary);
            border-radius:12px;padding:10px 24px;">
            <span style="font-size:1.5rem;font-weight:700;letter-spacing:4px;color:var(--color-primary);">
              ${myCode}
            </span>
          </div>
        </div>

        <!-- Share buttons -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button id="share-whatsapp" style="
            padding:12px;border-radius:12px;
            background:#25D366;color:white;
            font-weight:600;font-size:0.875rem;
            display:flex;align-items:center;justify-content:center;gap:8px;">
            <span style="font-size:18px;">💬</span> WhatsApp
          </button>
          <button id="share-sms" style="
            padding:12px;border-radius:12px;
            background:var(--bg-elevated);color:var(--text-primary);
            border:1px solid var(--border-color);
            font-weight:600;font-size:0.875rem;
            display:flex;align-items:center;justify-content:center;gap:8px;">
            <span style="font-size:18px;">📱</span> SMS
          </button>
          <button id="share-native" style="
            padding:12px;border-radius:12px;
            background:var(--bg-elevated);color:var(--text-primary);
            border:1px solid var(--border-color);
            font-weight:600;font-size:0.875rem;
            display:flex;align-items:center;justify-content:center;gap:8px;
            grid-column: span 2;">
            <span style="font-size:18px;">📤</span> Share (Any App)
          </button>
        </div>
      </div>

      <!-- Tab 3: Enter Code -->
      <div id="method-code">
        <div style="text-align:center;padding:8px 0 20px;">
          <div style="
            width:72px;height:72px;
            background:linear-gradient(135deg,var(--color-accent),var(--color-primary));
            border-radius:20px;margin:0 auto 16px;
            display:flex;align-items:center;justify-content:center;
            font-size:32px;box-shadow:0 8px 24px rgba(6,182,212,0.4);">
            🎫
          </div>
          <h3 style="margin-bottom:6px;">Friend ka Code Enter Karo</h3>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:20px;">
            Apne dost se 6-digit code maango aur yahan enter karo
          </p>
        </div>

        <!-- Code input boxes -->
        <div id="code-boxes" style="display:flex;gap:8px;justify-content:center;margin-bottom:20px;">
          ${Array(6).fill(0).map((_, i) => `
            <input type="text" maxlength="1" data-pos="${i}"
              style="
                width:44px;height:52px;text-align:center;
                font-size:1.25rem;font-weight:700;
                background:var(--bg-elevated);
                border:2px solid var(--border-color);
                border-radius:10px;color:var(--text-primary);
                text-transform:uppercase;
                transition:border-color 0.2s,box-shadow 0.2s;
              "
              class="code-digit" />
          `).join('')}
        </div>

        <div id="code-error" style="
          display:none;text-align:center;font-size:0.8rem;
          color:#ef4444;margin-bottom:12px;"></div>

        <button id="submit-code-btn" class="btn btn-primary btn-full" disabled>
          Friend Request Bhejo
        </button>
        <p style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:10px;">
          Dost ka code Settings → Share Code mein milega
        </p>
      </div>

    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // ── Method tab switching ───────────────────────────────────
  const tabs   = overlay.querySelectorAll('.method-tab');
  const panels = {
    search : overlay.querySelector('#method-search'),
    share  : overlay.querySelector('#method-share'),
    code   : overlay.querySelector('#method-code'),
  };

  const activateTab = (method) => {
    // Tab buttons style
    tabs.forEach(t => {
      const isActive = t.dataset.method === method;
      t.style.background = isActive ? 'var(--color-primary)' : 'transparent';
      t.style.color      = isActive ? 'white'                : 'var(--text-secondary)';
      t.style.boxShadow  = isActive ? '0 2px 8px rgba(168,85,247,0.3)' : 'none';
    });
    // Panel visibility
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      el.style.display = key === method ? 'block' : 'none';
    });
    // Auto-focus
    if (method === 'search') {
      setTimeout(() => overlay.querySelector('#friend-search-input')?.focus(), 50);
    }
    if (method === 'code') {
      setTimeout(() => overlay.querySelector('.code-digit')?.focus(), 50);
    }
  };

  // Set initial state — hide share and code panels directly
  if (panels.share) panels.share.style.display = 'none';
  if (panels.code)  panels.code.style.display  = 'none';
  if (panels.search) panels.search.style.display = 'block';

  // Activate first tab visually
  tabs.forEach(t => {
    if (t.dataset.method === 'search') {
      t.style.background = 'var(--color-primary)';
      t.style.color      = 'white';
      t.style.boxShadow  = '0 2px 8px rgba(168,85,247,0.3)';
    }
  });

  tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.method)));

  // ── Tab 1: Username Search ─────────────────────────────────
  const searchInput = overlay.querySelector('#friend-search-input');
  let searchTimer;

  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    const resultsEl = overlay.querySelector('#friend-search-results');

    if (q.length < 2) {
      resultsEl.innerHTML = `<p style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:24px 0;">Kam se kam 2 characters type karo</p>`;
      return;
    }

    resultsEl.innerHTML = `<div style="text-align:center;padding:16px;"><div class="spinner spinner-sm" style="margin:0 auto;"></div></div>`;

    searchTimer = setTimeout(async () => {
      try {
        const res   = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
        const users = res.data || [];

        if (users.length === 0) {
          resultsEl.innerHTML = `<p style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:24px 0;">"${escapeHTML(q)}" naam ka koi user nahi mila</p>`;
          return;
        }

        resultsEl.innerHTML = users.map(u => `
          <div class="friend-row" style="padding:8px 4px;">
            <div class="avatar avatar-md">
              ${u.avatar
                ? `<img src="${escapeHTML(u.avatar)}" alt="" />`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>`}
            </div>
            <div class="friend-row__info">
              <div class="friend-row__name">${escapeHTML(u.displayName || u.username)}</div>
              <div class="friend-row__status">@${escapeHTML(u.username)}</div>
            </div>
            <button class="btn btn-sm btn-primary add-req-btn" data-id="${escapeHTML(u._id)}"
              style="flex-shrink:0;">Add</button>
          </div>
        `).join('');

        resultsEl.querySelectorAll('.add-req-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await api.post(`/friends/request/${btn.dataset.id}`);
              btn.textContent = '✓ Sent';
              btn.disabled    = true;
              btn.style.background = '#22c55e';
              toast('Friend request bhej di! 🎉', 'success');
            } catch (err) {
              toast(err.message || 'Error', 'error');
            }
          });
        });
      } catch { resultsEl.innerHTML = `<p style="color:#ef4444;text-align:center;padding:16px;">Search fail ho gayi</p>`; }
    }, 400);
  });

  searchInput?.focus();

  // ── Tab 2: Share Link ──────────────────────────────────────
  const shareText = `🎵 PJ Music pe mujhse connect karo!\nIs link se add karo: ${link}\n\nYa invite code: ${myCode}`;

  overlay.querySelector('#copy-link-btn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      const btn = overlay.querySelector('#copy-link-btn');
      btn.textContent = '✓ Copied!';
      btn.style.background = '#22c55e';
      setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = ''; }, 2000);
      toast('Link copy ho gaya! 📋', 'success');
    } catch { toast('Copy nahi hua, manually karo', 'error'); }
  });

  overlay.querySelector('#share-whatsapp')?.addEventListener('click', () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  });

  overlay.querySelector('#share-sms')?.addEventListener('click', () => {
    window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
  });

  overlay.querySelector('#share-native')?.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PJ Music — Friend Invite', text: shareText, url: link });
      } catch (_) {}
    } else {
      // Fallback: clipboard copy
      await navigator.clipboard.writeText(shareText).catch(() => {});
      toast('Text copy ho gaya — paste karke bhejo!', 'info');
    }
  });

  // ── Tab 3: Code Entry ──────────────────────────────────────
  const codeDigits  = overlay.querySelectorAll('.code-digit');
  const submitBtn   = overlay.querySelector('#submit-code-btn');
  const codeError   = overlay.querySelector('#code-error');

  const getEnteredCode = () => [...codeDigits].map(d => d.value.toUpperCase()).join('');

  const updateSubmitBtn = () => {
    const code = getEnteredCode();
    submitBtn.disabled = code.length !== 6;
  };

  codeDigits.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();
      e.target.value = val;
      // Focus next
      if (val && idx < 5) codeDigits[idx + 1].focus();
      updateSubmitBtn();
      codeError.style.display = 'none';
      // Highlight filled
      input.style.borderColor = val ? 'var(--color-primary)' : 'var(--border-color)';
      input.style.boxShadow   = val ? '0 0 0 3px rgba(168,85,247,0.15)' : 'none';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        codeDigits[idx - 1].focus();
        codeDigits[idx - 1].value = '';
        codeDigits[idx - 1].style.borderColor = 'var(--border-color)';
        updateSubmitBtn();
      }
      // Paste support
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        navigator.clipboard.readText().then(text => {
          const clean = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
          codeDigits.forEach((d, i) => {
            d.value = clean[i] || '';
            d.style.borderColor = clean[i] ? 'var(--color-primary)' : 'var(--border-color)';
          });
          updateSubmitBtn();
        }).catch(() => {});
      }
    });
  });

  submitBtn?.addEventListener('click', async () => {
    const code = getEnteredCode();
    if (code.length !== 6) return;

    submitBtn.textContent = 'Bhej raha hun...';
    submitBtn.disabled    = true;
    codeError.style.display = 'none';

    try {
      // Code se userId nikalo aur request bhejo
      const userId = decodeInviteCode(code);
      await api.post(`/friends/request/${userId}`);

      // Success animation
      codeDigits.forEach(d => { d.style.borderColor = '#22c55e'; d.style.background = 'rgba(34,197,94,0.1)'; });
      submitBtn.textContent     = '✓ Request Bhej Di!';
      submitBtn.style.background = '#22c55e';
      toast('Friend request bhej di! 🎉 Unke accept karne ka wait karo', 'success', 4000);
      setTimeout(() => overlay.remove(), 2000);
    } catch (err) {
      codeError.textContent    = 'Code galat hai ya expire ho gaya. Dobara try karo.';
      codeError.style.display  = 'block';
      submitBtn.textContent    = 'Friend Request Bhejo';
      submitBtn.disabled       = false;
      codeDigits.forEach(d => { d.style.borderColor = '#ef4444'; });
    }
  });

  // Paste from clipboard on any digit focus — only focus when code tab is active
  // (focus() removed here to prevent auto-scroll away from code tab)
  // User khud click karega first box pe
};

// ─── Invite Code ─────────────────────────────────────────────────────────────

/**
 * Code se userId nikalo — stored users mein se dhundo.
 */
const decodeInviteCode = (code) => {
  try {
    const users = JSON.parse(localStorage.getItem('pj_all_users') || '[]');
    const found = users.find(u => u.inviteCode === code.toUpperCase());
    if (!found) throw new Error('Code nahi mila');
    return found._id;
  } catch {
    throw new Error('Code galat hai ya user registered nahi hai');
  }
};

/**
 * URL mein invite code hai toh automatically process karo.
 * e.g. http://localhost:3000?invite=ABC123
 */
const handleInviteCodeFromUrl = async () => {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('invite');
  if (!code) return;

  // URL clean karo (code remove karo)
  const newUrl = window.location.pathname;
  window.history.replaceState({}, '', newUrl);

  // Thoda wait karo phir process karo
  setTimeout(async () => {
    try {
      const userId = decodeInviteCode(code.toUpperCase());
      await api.post(`/friends/request/${userId}`);
      toast(`🎉 Invite link se friend request bhej di!`, 'success', 5000);
    } catch {
      toast('Invite link expire ho gaya ya invalid hai', 'error');
    }
  }, 1500);
};

// ─── Send "Listen Together" invite ───────────────────────────────────────────

const sendListenTogether = (targetUserId, targetName) => {
  const song = player.getCurrentSong();
  emit('sync:invite', { targetUserId });
  toast(`Sent listening invite to ${targetName}`, 'info');
};

// ─── Incoming Room Invitation ─────────────────────────────────────────────────

const showSyncInvite = ({ roomId, roomName, invitedBy, token }) => {
  toast(`${invitedBy.displayName} invited you to "${roomName}"`, 'info', 8000);

  // Could also show a modal — here we show a banner
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed; bottom: calc(var(--bottom-nav-height) + var(--mini-player-height) + 80px + var(--safe-area-bottom));
    left:16px; right:16px; background:var(--bg-elevated); border-radius:12px;
    padding:16px; z-index:200; box-shadow:var(--shadow-md); border:1px solid var(--border-color);
    animation: toast-in 0.25s ease;
  `;
  banner.innerHTML = `
    <p style="font-weight:600;margin-bottom:8px;">🎵 ${escapeHTML(invitedBy.displayName)} invited you to listen in <strong>${escapeHTML(roomName)}</strong></p>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-sm btn-primary" id="join-room-btn">Join Room</button>
      <button class="btn btn-sm btn-secondary" id="decline-room-btn">Decline</button>
    </div>`;
  document.body.appendChild(banner);

  document.getElementById('join-room-btn')?.addEventListener('click', async () => {
    try {
      await api.post('/rooms/join', { token });
      toast('Joined room!', 'success');
      banner.remove();
      document.querySelector('[data-page="rooms"]')?.click();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  document.getElementById('decline-room-btn')?.addEventListener('click', () => banner.remove());

  setTimeout(() => banner.remove(), 30000);
};

// ─── Incoming peer sync invitation ───────────────────────────────────────────

const showPeerSyncInvite = (from) => {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed; bottom: calc(var(--bottom-nav-height) + var(--mini-player-height) + 80px + var(--safe-area-bottom));
    left:16px; right:16px; background:var(--bg-elevated); border-radius:12px;
    padding:16px; z-index:200; box-shadow:var(--shadow-md); border:1px solid var(--border-color);
    animation: toast-in 0.25s ease;
  `;
  banner.innerHTML = `
    <p style="font-weight:600;margin-bottom:8px;">🎵 ${escapeHTML(from.displayName)} wants to listen together</p>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-sm btn-primary" id="accept-sync-btn">Accept</button>
      <button class="btn btn-sm btn-secondary" id="decline-sync-btn">Decline</button>
    </div>`;
  document.body.appendChild(banner);

  document.getElementById('accept-sync-btn')?.addEventListener('click', () => {
    emit('sync:accept', { inviterId: from.id });
    toast(`Now listening with ${from.displayName}`, 'success');
    banner.remove();
  });

  document.getElementById('decline-sync-btn')?.addEventListener('click', () => {
    emit('sync:decline', { inviterId: from.id });
    banner.remove();
  });

  setTimeout(() => banner.remove(), 30000);
};
