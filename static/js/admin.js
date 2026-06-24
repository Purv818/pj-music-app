// ─── Admin Dashboard ──────────────────────────────────────────

(async function init() {
    const user = getUser();
    if (!user || user.role !== 'admin') { window.location.href = '/login'; return; }
    document.getElementById('sidebarName').textContent = user.name;

    await Promise.all([loadStats(), loadBuses(), loadRoutes(), loadSchedules(), loadAllBookings()]);
})();

// ─── Tab Switching ────────────────────────────────────────────
document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); t.classList.add('hidden'); });
        this.classList.add('active');
        const tabEl = document.getElementById(`tab-${this.dataset.tab}`);
        if (tabEl) { tabEl.classList.remove('hidden'); tabEl.classList.add('active'); }
    });
});

// ─── Stats & Charts ───────────────────────────────────────────
async function loadStats() {
    const res  = await fetch('/api/admin/stats', { headers: authHeader() });
    const data = await res.json();

    document.getElementById('statBookings').textContent = data.total_bookings;
    document.getElementById('statRevenue').textContent  = `₹${data.total_revenue.toLocaleString('en-IN')}`;
    document.getElementById('statUsers').textContent    = data.total_users;
    document.getElementById('statBuses').textContent    = data.total_buses;
    document.getElementById('statLocations').textContent = data.total_locations;
    document.getElementById('statRoutes').textContent    = data.total_routes;

    renderCharts(data);
}

function renderCharts(data) {
    const months   = data.monthly_stats.map(m => m.month).reverse();
    const bookings = data.monthly_stats.map(m => m.bookings).reverse();
    const revenue  = data.monthly_stats.map(m => m.revenue || 0).reverse();

    // Bookings chart
    new Chart(document.getElementById('bookingsChart'), {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{ label: 'Bookings', data: bookings, backgroundColor: '#3b82f6', borderRadius: 6 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Revenue chart
    new Chart(document.getElementById('revenueChart'), {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Revenue (₹)', data: revenue,
                borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.1)',
                fill: true, tension: 0.4, pointRadius: 5
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // Popular routes doughnut
    const routes = data.popular_routes;
    new Chart(document.getElementById('routesChart'), {
        type: 'doughnut',
        data: {
            labels: routes.map(r => `${r.source}→${r.destination}`),
            datasets: [{ data: routes.map(r => r.bookings), backgroundColor: ['#3b82f6','#7c3aed','#16a34a','#d97706','#dc2626'] }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// ─── Buses ────────────────────────────────────────────────────
let buses = [];
async function loadBuses() {
    const res = await fetch('/api/buses', { headers: authHeader() });
    buses = await res.json();
    const tbody = document.getElementById('busesBody');
    tbody.innerHTML = buses.map(b => `
        <tr>
            <td>${b.id}</td>
            <td><strong>${b.bus_number}</strong></td>
            <td>${b.capacity}</td>
            <td><span class="bus-type-badge badge-${b.type.replace(' ','-')}">${b.type}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-outline btn-sm" onclick="editBus(${b.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBus(${b.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editBus(id) {
    const bus = buses.find(b => b.id === id);
    if (!bus) return;
    document.getElementById('busId').value = bus.id;
    document.getElementById('busNumber').value = bus.bus_number;
    document.getElementById('busCapacity').value = bus.capacity;
    document.getElementById('busType').value = bus.type;
    document.getElementById('busModalTitle').textContent = 'Edit Bus';
    openModal('busModal');
}

async function saveBus(e) {
    e.preventDefault();
    const id = document.getElementById('busId').value;
    const payload = {
        bus_number: document.getElementById('busNumber').value,
        capacity: parseInt(document.getElementById('busCapacity').value),
        type: document.getElementById('busType').value
    };
    const url    = id ? `/api/buses/${id}` : '/api/buses';
    const method = id ? 'PUT' : 'POST';
    await fetch(url, { method, headers: authHeader(), body: JSON.stringify(payload) });
    closeModal('busModal');
    document.getElementById('busId').value = '';
    document.getElementById('busModalTitle').textContent = 'Add Bus';
    document.getElementById('busForm').reset();
    await loadBuses();
}

async function deleteBus(id) {
    if (!confirm('Delete this bus?')) return;
    await fetch(`/api/buses/${id}`, { method: 'DELETE', headers: authHeader() });
    await loadBuses();
}

// ─── Routes ───────────────────────────────────────────────────
let routes = [];
async function loadRoutes() {
    const res = await fetch('/api/routes', { headers: authHeader() });
    routes = await res.json();
    const tbody = document.getElementById('routesBody');
    tbody.innerHTML = routes.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.source}</td>
            <td>${r.destination}</td>
            <td>${r.distance} km</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteRoute(${r.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');

    // Populate schedule route dropdown
    const sel = document.getElementById('scheduleRoute');
    sel.innerHTML = routes.map(r => `<option value="${r.id}">${r.source} → ${r.destination}</option>`).join('');
}

async function saveRoute(e) {
    e.preventDefault();
    const payload = {
        source: document.getElementById('routeSource').value,
        destination: document.getElementById('routeDest').value,
        distance: parseInt(document.getElementById('routeDistance').value)
    };
    await fetch('/api/routes', { method: 'POST', headers: authHeader(), body: JSON.stringify(payload) });
    closeModal('routeModal');
    document.getElementById('routeForm').reset();
    await loadRoutes();
}

async function deleteRoute(id) {
    if (!confirm('Delete this route?')) return;
    await fetch(`/api/routes/${id}`, { method: 'DELETE', headers: authHeader() });
    await loadRoutes();
}

// ─── Schedules ────────────────────────────────────────────────
async function loadSchedules() {
    const res  = await fetch('/api/schedules', { headers: authHeader() });
    const data = await res.json();
    const tbody = document.getElementById('schedulesBody');
    tbody.innerHTML = data.map(s => `
        <tr>
            <td>${s.id}</td>
            <td>${s.bus_number}</td>
            <td>${s.source} → ${s.destination}</td>
            <td>${s.date}</td>
            <td>${s.departure_time}</td>
            <td>${s.arrival_time}</td>
            <td>₹${s.price}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');

    // Populate bus dropdown
    const busSel = document.getElementById('scheduleBus');
    busSel.innerHTML = buses.map(b => `<option value="${b.id}">${b.bus_number} (${b.type})</option>`).join('');

    // Set min date
    document.getElementById('scheduleDate').min = new Date().toISOString().split('T')[0];
}

async function saveSchedule(e) {
    e.preventDefault();
    const payload = {
        bus_id: parseInt(document.getElementById('scheduleBus').value),
        route_id: parseInt(document.getElementById('scheduleRoute').value),
        date: document.getElementById('scheduleDate').value,
        departure_time: document.getElementById('scheduleDep').value,
        arrival_time: document.getElementById('scheduleArr').value,
        price: parseFloat(document.getElementById('schedulePrice').value)
    };
    await fetch('/api/schedules', { method: 'POST', headers: authHeader(), body: JSON.stringify(payload) });
    closeModal('scheduleModal');
    document.getElementById('scheduleForm').reset();
    await loadSchedules();
}

async function deleteSchedule(id) {
    if (!confirm('Delete this schedule?')) return;
    await fetch(`/api/schedules/${id}`, { method: 'DELETE', headers: authHeader() });
    await loadSchedules();
}

// ─── All Bookings ─────────────────────────────────────────────
async function loadAllBookings() {
    const res  = await fetch('/api/admin/bookings', { headers: authHeader() });
    const data = await res.json();
    const tbody = document.getElementById('allBookingsBody');
    tbody.innerHTML = data.map(b => `
        <tr>
            <td>#${b.id}</td>
            <td>
                <strong>${b.passenger_name}</strong><br>
                <small style="color:var(--text-muted)">${b.passenger_email}</small>
            </td>
            <td>${b.source} → ${b.destination}</td>
            <td>${b.date}</td>
            <td>${b.bus_number}</td>
            <td>${b.seat_number}</td>
            <td>₹${b.price}</td>
            <td><span class="status-badge status-${b.status}">${b.status.toUpperCase()}</span></td>
        </tr>
    `).join('');
}

// ─── Modal Helpers ────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
