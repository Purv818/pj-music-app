// ─── Search Page ─────────────────────────────────────────────

let allResults = [];

// Pre-fill from URL params
(function init() {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('source') || '';
    const dest   = params.get('destination') || '';
    const date   = params.get('date') || new Date().toISOString().split('T')[0];

    document.getElementById('source').value = source;
    document.getElementById('destination').value = dest;
    document.getElementById('date').value = date;
    document.getElementById('date').min = new Date().toISOString().split('T')[0];

    if (source && dest) searchBuses(source, dest, date);
})();

document.getElementById('searchForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const source = document.getElementById('source').value.trim();
    const dest   = document.getElementById('destination').value.trim();
    const date   = document.getElementById('date').value;
    if (source && dest) {
        history.replaceState(null, '', `/search?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(dest)}&date=${date}`);
        searchBuses(source, dest, date);
    }
});

function swapCities() {
    const s = document.getElementById('source');
    const d = document.getElementById('destination');
    [s.value, d.value] = [d.value, s.value];
}

async function searchBuses(source, destination, date) {
    showState('loading');
    try {
        const params = new URLSearchParams({ source, destination });
        if (date) params.append('date', date);
        const res  = await fetch(`/api/schedules/search?${params}`);
        const data = await res.json();
        allResults = data;
        renderResults(data);
    } catch {
        showState('empty');
    }
}

function renderResults(results) {
    const container = document.getElementById('busResults');
    const header    = document.getElementById('resultsHeader');

    if (!results.length) { showState('noResults'); return; }

    showState('results');
    header.style.display = 'flex';
    document.getElementById('resultsCount').textContent = `${results.length} bus${results.length > 1 ? 'es' : ''} found`;

    container.innerHTML = results.map(bus => `
        <div class="bus-card" data-type="${bus.type}" data-price="${bus.price}" data-dep="${bus.departure_time}">
            <div class="bus-card-header">
                <div>
                    <div class="bus-name"><i class="fas fa-bus"></i> ${bus.bus_number}</div>
                    <small style="color:var(--text-muted)">
                        ${bus.source} → ${bus.destination}
                        ${bus.via ? `<span class="via-tag"><i class="fas fa-map-signs"></i> via ${bus.via}</span>` : ''}
                        &bull; ${bus.distance} km
                    </small>
                </div>
                <span class="bus-type-badge badge-${bus.type.replace(' ','-')}">${bus.type}</span>
            </div>
            <div class="bus-card-body">
                <div class="bus-timing">
                    <div class="time-block">
                        <div class="time-val">${bus.departure_time}</div>
                        <div class="time-city">${bus.source}</div>
                    </div>
                    <div class="time-arrow">
                        <i class="fas fa-arrow-right"></i>
                        <span>${bus.arrival_time}</span>
                    </div>
                    <div class="time-block">
                        <div class="time-val">${bus.arrival_time}</div>
                        <div class="time-city">${bus.destination}</div>
                    </div>
                </div>
                <div class="bus-seats">
                    <div class="seats-count">${bus.available_seats}</div>
                    <div class="seats-label">Seats Left</div>
                </div>
                <div class="bus-price">
                    <div class="price-val">₹${bus.price}</div>
                    <div class="price-label">per seat</div>
                </div>
                <button class="btn btn-primary" onclick="bookBus(${bus.id}, ${bus.available_seats})">
                    <i class="fas fa-ticket-alt"></i> Book Now
                </button>
            </div>
        </div>
    `).join('');
}

function bookBus(scheduleId, availableSeats) {
    const user = getUser();
    if (!user) {
        window.location.href = `/login`;
        return;
    }
    if (availableSeats <= 0) {
        alert('Sorry, no seats available on this bus.');
        return;
    }
    window.location.href = `/booking/${scheduleId}`;
}

function showState(state) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('noResults').classList.add('hidden');
    document.getElementById('busResults').innerHTML = '';
    document.getElementById('resultsHeader').style.display = 'none';

    if (state === 'loading') document.getElementById('loadingState').classList.remove('hidden');
    else if (state === 'empty') document.getElementById('emptyState').classList.remove('hidden');
    else if (state === 'noResults') document.getElementById('noResults').classList.remove('hidden');
}

function applyFilters() {
    const types = [...document.querySelectorAll('.filter-group input[type=checkbox]:checked')]
        .map(c => c.value);
    const maxPrice = parseInt(document.getElementById('priceRange').value);
    const times = [...document.querySelectorAll('.filter-group input[type=checkbox]:checked')]
        .map(c => c.value).filter(v => ['morning','afternoon','evening','night'].includes(v));
    const busTypes = types.filter(v => ['AC','Non-AC','Sleeper','Semi-Sleeper'].includes(v));

    let filtered = allResults.filter(b => {
        if (busTypes.length && !busTypes.includes(b.type)) return false;
        if (b.price > maxPrice) return false;
        if (times.length) {
            const hour = parseInt(b.departure_time.split(':')[0]);
            const slot = hour >= 6 && hour < 12 ? 'morning'
                       : hour >= 12 && hour < 18 ? 'afternoon'
                       : hour >= 18 ? 'evening' : 'night';
            if (!times.includes(slot)) return false;
        }
        return true;
    });
    renderResults(filtered);
}

function updatePriceLabel(val) {
    document.getElementById('priceLabel').textContent = `Up to ₹${val}`;
}

function clearFilters() {
    document.querySelectorAll('.filter-group input[type=checkbox]').forEach(c => c.checked = false);
    document.getElementById('priceRange').value = 2000;
    document.getElementById('priceLabel').textContent = 'Up to ₹2000';
    renderResults(allResults);
}

function sortResults() {
    const by = document.getElementById('sortBy').value;
    const sorted = [...allResults].sort((a, b) => {
        if (by === 'price') return a.price - b.price;
        if (by === 'departure') return a.departure_time.localeCompare(b.departure_time);
        if (by === 'seats') return b.available_seats - a.available_seats;
        return 0;
    });
    renderResults(sorted);
}
