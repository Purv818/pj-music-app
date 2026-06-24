// ─── Ticket Page ──────────────────────────────────────────────

(async function init() {
    const user = getUser();
    if (!user) { window.location.href = '/login'; return; }

    try {
        const res = await fetch(`/api/bookings/${BOOKING_ID}`, { headers: authHeader() });
        const data = await res.json();

        if (!res.ok) {
            showError('Ticket not found.');
            return;
        }

        renderTicket(data);
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('ticketContent').classList.remove('hidden');
    } catch {
        showError('Failed to load ticket.');
    }
})();

function renderTicket(t) {
    document.getElementById('ticketId').textContent = t.id;
    document.getElementById('ticketSource').textContent = t.source;
    document.getElementById('ticketDest').textContent = t.destination;
    document.getElementById('ticketDistance').textContent = `${t.distance} km`;
    document.getElementById('ticketDate').textContent = formatDate(t.date);
    document.getElementById('ticketDep').textContent = t.departure_time;
    document.getElementById('ticketArr').textContent = t.arrival_time;
    document.getElementById('ticketBus').textContent = t.bus_number;
    document.getElementById('ticketSeat').textContent = t.seat_number;
    document.getElementById('ticketPassenger').textContent = t.passenger_name;
    document.getElementById('ticketPrice').textContent = `₹${t.price}`;
    document.getElementById('ticketBarcode').textContent = `BMS${String(t.id).padStart(6, '0')}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function showError(msg) {
    document.getElementById('loadingState').innerHTML = `
        <i class="fas fa-exclamation-circle fa-2x" style="color:var(--danger)"></i>
        <p>${msg}</p>
        <a href="/dashboard" class="btn btn-primary" style="margin-top:1rem">Go to Dashboard</a>
    `;
}
