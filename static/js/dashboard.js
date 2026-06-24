// ─── User Dashboard ───────────────────────────────────────────

let allBookings = [];

(async function init() {
    const user = getUser();
    if (!user) { window.location.href = '/login'; return; }
    if (user.role === 'admin') { window.location.href = '/admin'; return; }

    document.getElementById('sidebarName').textContent = user.name;
    document.getElementById('profileName').textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileRole').textContent = user.role;

    await loadBookings();
})();

// Tab switching
document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const tab = this.dataset.tab;
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); t.classList.add('hidden'); });
        this.classList.add('active');
        const tabEl = document.getElementById(`tab-${tab}`);
        if (tabEl) { tabEl.classList.remove('hidden'); tabEl.classList.add('active'); }
    });
});

async function loadBookings() {
    try {
        const res = await fetch('/api/bookings/my', { headers: authHeader() });
        allBookings = await res.json();
        renderBookings(allBookings);
    } catch {
        document.getElementById('bookingsLoading').innerHTML = '<p style="color:var(--danger)">Failed to load bookings.</p>';
    }
}

function renderBookings(bookings) {
    const loading = document.getElementById('bookingsLoading');
    const empty   = document.getElementById('bookingsEmpty');
    const list    = document.getElementById('bookingsList');

    loading.classList.add('hidden');

    if (!bookings.length) {
        empty.classList.remove('hidden');
        list.classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');
    list.classList.remove('hidden');

    list.innerHTML = bookings.map(b => `
        <div class="booking-item">
            <div>
                <div class="booking-route">
                    <i class="fas fa-bus"></i> ${b.source} → ${b.destination}
                </div>
                <small style="color:var(--text-muted)">${b.bus_number} &bull; ${b.type}</small>
            </div>
            <div class="booking-meta">
                <div class="booking-meta-item">
                    <span class="meta-label">Date</span>
                    <span class="meta-value">${formatDate(b.date)}</span>
                </div>
                <div class="booking-meta-item">
                    <span class="meta-label">Departure</span>
                    <span class="meta-value">${b.departure_time}</span>
                </div>
                <div class="booking-meta-item">
                    <span class="meta-label">Seat</span>
                    <span class="meta-value">#${b.seat_number}</span>
                </div>
                <div class="booking-meta-item">
                    <span class="meta-label">Price</span>
                    <span class="meta-value" style="color:var(--primary)">₹${b.price}</span>
                </div>
            </div>
            <div class="booking-actions">
                <span class="status-badge status-${b.status}">${b.status.toUpperCase()}</span>
                <a href="/ticket/${b.id}" class="btn btn-outline btn-sm"><i class="fas fa-eye"></i> View</a>
                ${b.status === 'confirmed' ? `<button class="btn btn-danger btn-sm" onclick="cancelBooking(${b.id}, this)"><i class="fas fa-times"></i> Cancel</button>` : ''}
            </div>
        </div>
    `).join('');
}

function filterBookings(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filtered = status === 'all' ? allBookings : allBookings.filter(b => b.status === status);
    renderBookings(filtered);
}

async function cancelBooking(id, btn) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`/api/bookings/${id}/cancel`, { method: 'PUT', headers: authHeader() });
        if (res.ok) {
            await loadBookings();
        } else {
            alert('Failed to cancel booking.');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        }
    } catch {
        alert('Network error.');
        btn.disabled = false;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
