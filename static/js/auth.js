// ─── Auth Helpers (loaded on every page) ─────────────────────

function getToken() { return localStorage.getItem('token'); }
function getUser()  { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

function authHeader() {
    const t = getToken();
    return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Update navbar based on login state
(function initNav() {
    const user = getUser();
    const navGuest = document.getElementById('navGuest');
    const navUser  = document.getElementById('navUser');
    const navAdmin = document.getElementById('navAdmin');
    const navUserName = document.getElementById('navUserName');

    if (!user) return; // show guest links (default)

    if (navGuest)  navGuest.classList.add('hidden');
    if (user.role === 'admin') {
        if (navAdmin) navAdmin.classList.remove('hidden');
    } else {
        if (navUser) navUser.classList.remove('hidden');
        if (navUserName) navUserName.textContent = user.name.split(' ')[0];
    }
})();

// Mobile nav toggle
document.getElementById('navToggle')?.addEventListener('click', () => {
    document.getElementById('navLinks')?.classList.toggle('open');
});

// Redirect if already logged in (on login/signup pages)
(function redirectIfLoggedIn() {
    const path = window.location.pathname;
    const user = getUser();
    if (user && (path === '/login' || path === '/signup')) {
        window.location.href = user.role === 'admin' ? '/admin' : '/dashboard';
    }
})();
