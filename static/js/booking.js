// ─── Booking Page ─────────────────────────────────────────────

let selectedSeat = null;
let scheduleData = null;

(async function init() {
    const user = getUser();
    if (!user) { window.location.href = '/login'; return; }

    try {
        const [seatRes, allSchedRes] = await Promise.all([
            fetch(`/api/schedules/${SCHEDULE_ID}/seats`),
            fetch('/api/schedules')
        ]);
        const seatData  = await seatRes.json();
        const allSched  = await allSchedRes.json();
        scheduleData    = allSched.find(s => s.id === SCHEDULE_ID);

        if (!scheduleData || !seatData) { showError('Schedule not found.'); return; }

        renderBusInfo(scheduleData);
        renderSeats(seatData.seats, seatData.capacity);
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('bookingContent').classList.remove('hidden');
    } catch(e) {
        showError('Failed to load booking data.');
    }
})();

// ── Bus Info Strip ────────────────────────────────────────────
function renderBusInfo(s) {
    document.getElementById('busInfoCard').innerHTML = `
        <div class="bus-info-grid">
            <div class="bus-info-item">
                <span class="bus-info-label"><i class="fas fa-map-marker-alt"></i> Route</span>
                <span class="bus-info-value">${s.source} <i class="fas fa-long-arrow-alt-right" style="color:var(--primary)"></i> ${s.destination}</span>
            </div>
            <div class="bus-info-item">
                <span class="bus-info-label"><i class="fas fa-calendar-alt"></i> Date</span>
                <span class="bus-info-value">${formatDate(s.date)}</span>
            </div>
            <div class="bus-info-item">
                <span class="bus-info-label"><i class="fas fa-clock"></i> Departure</span>
                <span class="bus-info-value">${s.departure_time}</span>
            </div>
            <div class="bus-info-item">
                <span class="bus-info-label"><i class="fas fa-flag-checkered"></i> Arrival</span>
                <span class="bus-info-value">${s.arrival_time}</span>
            </div>
            <div class="bus-info-item">
                <span class="bus-info-label"><i class="fas fa-bus"></i> Bus</span>
                <span class="bus-info-value">${s.bus_number}</span>
            </div>
            <div class="bus-info-item">
                <span class="bus-info-label"><i class="fas fa-rupee-sign"></i> Price</span>
                <span class="bus-info-value price-highlight">₹${s.price}</span>
            </div>
        </div>
    `;

    // Set plate on bus shell
    const plate = document.getElementById('busPlate');
    if (plate) plate.textContent = s.bus_number;

    // Summary panel
    document.getElementById('summaryRoute').textContent = `${s.source} → ${s.destination}`;
    document.getElementById('summaryDate').textContent  = formatDate(s.date);
    document.getElementById('summaryDep').textContent   = s.departure_time;
    document.getElementById('summaryBus').textContent   = s.bus_number;
    document.getElementById('summaryType').textContent  = s.type;
}

// ── Seat Rendering ────────────────────────────────────────────
function renderSeats(seats, capacity) {
    const container = document.getElementById('seatsContainer');
    container.innerHTML = '';

    const totalRows = Math.ceil(capacity / 4);
    let seatIdx = 0;

    for (let row = 0; row < totalRows; row++) {
        const rowEl = document.createElement('div');
        rowEl.className = 'seat-row';

        // Row number label
        const rowLabel = document.createElement('div');
        rowLabel.className = 'row-label';
        rowLabel.textContent = row + 1;
        rowEl.appendChild(rowLabel);

        // 4 seats per row: A B | C D
        for (let col = 0; col < 4; col++) {
            if (col === 2) {
                // Aisle spacer
                const aisle = document.createElement('div');
                aisle.className = 'aisle-gap';
                rowEl.appendChild(aisle);
            }

            if (seatIdx < seats.length) {
                const seat = seats[seatIdx++];
                const el   = document.createElement('div');
                const colLetter = ['A','B','C','D'][col];
                el.className    = `seat ${seat.status}`;
                el.dataset.number = seat.number;
                el.dataset.label  = `${row + 1}${colLetter}`;

                // Seat icon + number
                el.innerHTML = `<i class="fas fa-couch seat-icon"></i><span class="seat-num">${seat.number}</span>`;

                if (seat.status === 'available') {
                    el.addEventListener('click', () => selectSeat(seat.number, el));
                    el.addEventListener('mouseenter', showTooltip);
                    el.addEventListener('mouseleave', hideTooltip);
                }
                rowEl.appendChild(el);
            }
        }
        container.appendChild(rowEl);
    }

    // Seat count badges
    const available = seats.filter(s => s.status === 'available').length;
    const booked    = seats.filter(s => s.status === 'booked').length;
    document.getElementById('seatCounts').innerHTML = `
        <span class="count-badge available-badge"><i class="fas fa-check-circle"></i> ${available} Available</span>
        <span class="count-badge booked-badge"><i class="fas fa-times-circle"></i> ${booked} Booked</span>
        <span class="count-badge total-badge"><i class="fas fa-bus"></i> ${capacity} Total</span>
    `;
}

// ── Seat Selection ────────────────────────────────────────────
function selectSeat(number, el) {
    document.querySelectorAll('.seat.selected').forEach(s => {
        s.classList.remove('selected');
        s.classList.add('available');
    });

    selectedSeat = number;
    el.classList.remove('available');
    el.classList.add('selected');

    const label = el.dataset.label || number;
    document.getElementById('summarySeat').textContent = `Seat ${number} (${label})`;
    document.getElementById('summaryTotal').textContent = `₹${scheduleData.price}`;
    document.getElementById('bookBtn').disabled = false;

    // Animate the selected seat box
    const box = document.getElementById('selectedSeatBox');
    box.classList.add('seat-selected-anim');
    setTimeout(() => box.classList.remove('seat-selected-anim'), 400);
}

// ── Tooltip ───────────────────────────────────────────────────
function showTooltip(e) {
    const el  = e.currentTarget;
    const tip = document.getElementById('seatTooltip');
    tip.textContent = `Seat ${el.dataset.number} (${el.dataset.label}) — ₹${scheduleData?.price || ''}`;
    tip.style.display = 'block';
    positionTooltip(e);
    el.addEventListener('mousemove', positionTooltip);
}
function hideTooltip(e) {
    document.getElementById('seatTooltip').style.display = 'none';
    e.currentTarget.removeEventListener('mousemove', positionTooltip);
}
function positionTooltip(e) {
    const tip = document.getElementById('seatTooltip');
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 36) + 'px';
}

// ── Confirm Booking ───────────────────────────────────────────
async function confirmBooking() {
    if (!selectedSeat) return;
    const btn = document.getElementById('bookBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
    btn.disabled  = true;

    try {
        const res  = await fetch('/api/bookings', {
            method: 'POST',
            headers: authHeader(),
            body: JSON.stringify({ schedule_id: SCHEDULE_ID, seat_number: selectedSeat })
        });
        const data = await res.json();
        if (res.ok) {
            window.location.href = `/ticket/${data.booking_id}`;
        } else {
            showAlert(data.error || 'Booking failed. Please try again.', 'error');
            btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Confirm Booking';
            btn.disabled  = false;
        }
    } catch {
        showAlert('Network error. Please try again.', 'error');
        btn.innerHTML = '<i class="fas fa-ticket-alt"></i> Confirm Booking';
        btn.disabled  = false;
    }
}

function showAlert(msg, type) {
    const box = document.getElementById('alertBox');
    box.textContent = msg;
    box.className   = `alert alert-${type}`;
}

function showError(msg) {
    document.getElementById('loadingState').innerHTML = `
        <i class="fas fa-exclamation-circle fa-2x" style="color:var(--danger)"></i>
        <p>${msg}</p>
        <a href="/search" class="btn btn-primary" style="margin-top:1rem">Back to Search</a>
    `;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}
