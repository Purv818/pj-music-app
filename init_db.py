"""
Full India Bus Network Initializer
- 50+ major routes across India (with via stops)
- 20 buses per route (AC, Non-AC, Sleeper, AC Sleeper)
- 5+ buses per route with 1-hour departure gaps
- Schedules for next 7 days
"""

import sqlite3, bcrypt, os
from datetime import date, timedelta, datetime

DB_PATH = 'database.db'

def hash_password(plain):
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def add_time(base_hour, base_min, add_hours):
    """Add hours to a base time, return HH:MM string."""
    total_mins = base_hour * 60 + base_min + add_hours * 60
    h = (total_mins // 60) % 24
    m = total_mins % 60
    return f"{h:02d}:{m:02d}"

def travel_hours(distance_km, bus_type):
    """Estimate travel time based on distance and bus type."""
    speed = {'AC': 65, 'Non-AC': 60, 'Sleeper': 55, 'AC Sleeper': 60}
    spd = speed.get(bus_type, 60)
    hrs = distance_km / spd
    return round(hrs * 2) / 2  # round to nearest 0.5

def init():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("Removed old database.")

    conn = sqlite3.connect(DB_PATH)

    # ── Schema ────────────────────────────────────────────────
    conn.executescript('''
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL, role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE buses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_number TEXT UNIQUE NOT NULL,
            capacity INTEGER NOT NULL,
            type TEXT DEFAULT 'AC',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL, destination TEXT NOT NULL,
            via TEXT DEFAULT '', distance INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bus_id INTEGER NOT NULL, route_id INTEGER NOT NULL,
            departure_time TEXT NOT NULL, arrival_time TEXT NOT NULL,
            price REAL NOT NULL, date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
            FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
        );
        CREATE TABLE bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL, schedule_id INTEGER NOT NULL,
            seat_number INTEGER NOT NULL, status TEXT DEFAULT 'confirmed',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (schedule_id) REFERENCES schedules(id)
        );
    ''')

    # ── Users ─────────────────────────────────────────────────
    conn.execute("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
                 ('Admin User', 'admin@busms.com', hash_password('admin123'), 'admin'))
    for name, email in [
        ('Rahul Sharma','rahul@example.com'), ('Priya Patel','priya@example.com'),
        ('Amit Kumar','amit@example.com'),    ('Sneha Reddy','sneha@example.com'),
    ]:
        conn.execute("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
                     (name, email, hash_password('user123'), 'user'))

    # ── 80 Buses (20 per type) ────────────────────────────────
    bus_types = [
        ('AC',        40, 'KA'),
        ('Non-AC',    45, 'MH'),
        ('Sleeper',   36, 'DL'),
        ('AC Sleeper',32, 'TN'),
    ]
    bus_id_map = {'AC': [], 'Non-AC': [], 'Sleeper': [], 'AC Sleeper': []}
    bus_counter = {'AC': 1, 'Non-AC': 1, 'Sleeper': 1, 'AC Sleeper': 1}

    for btype, cap, state_code in bus_types:
        for i in range(1, 21):   # 20 buses per type = 80 total
            num = f"{state_code}-{i:02d}-BMS-{btype[:2].upper()}{i:02d}"
            conn.execute("INSERT INTO buses (bus_number,capacity,type) VALUES (?,?,?)",
                         (num, cap, btype))
        conn.commit()

    # Fetch bus IDs grouped by type
    rows = conn.execute("SELECT id, type FROM buses ORDER BY id").fetchall()
    for rid, rtype in rows:
        bus_id_map[rtype].append(rid)

    # ── Routes: All-India Network ─────────────────────────────
    # (source, destination, via, distance_km)
    routes_data = [
        # ── North India ──
        ('Mumbai',      'Delhi',        'Ahmedabad, Jaipur',            1400),
        ('Delhi',       'Mumbai',        'Jaipur, Ahmedabad',            1400),
        ('Delhi',       'Jaipur',        '',                              270),
        ('Jaipur',      'Delhi',         '',                              270),
        ('Delhi',       'Agra',          '',                              200),
        ('Agra',        'Delhi',         '',                              200),
        ('Delhi',       'Chandigarh',    '',                              250),
        ('Chandigarh',  'Delhi',         '',                              250),
        ('Delhi',       'Amritsar',      'Ludhiana',                      450),
        ('Amritsar',    'Delhi',         'Ludhiana',                      450),
        ('Delhi',       'Shimla',        'Chandigarh',                    360),
        ('Shimla',      'Delhi',         'Chandigarh',                    360),
        ('Delhi',       'Dehradun',      'Haridwar',                      300),
        ('Dehradun',    'Delhi',         'Haridwar',                      300),
        ('Delhi',       'Haridwar',      '',                              220),
        ('Haridwar',    'Rishikesh',     '',                               25),
        ('Delhi',       'Lucknow',       'Agra, Kanpur',                  500),
        ('Lucknow',     'Delhi',         'Kanpur, Agra',                  500),
        ('Delhi',       'Varanasi',      'Agra, Allahabad',               800),
        ('Varanasi',    'Delhi',         'Allahabad, Agra',               800),
        ('Lucknow',     'Varanasi',      'Allahabad',                     320),
        ('Jaipur',      'Ahmedabad',     'Ajmer',                         650),
        ('Ahmedabad',   'Jaipur',        'Ajmer',                         650),
        # ── West India ──
        ('Mumbai',      'Pune',          '',                              150),
        ('Pune',        'Mumbai',        '',                              150),
        ('Mumbai',      'Nashik',        '',                              170),
        ('Nashik',      'Mumbai',        '',                              170),
        ('Mumbai',      'Goa',           'Ratnagiri',                     590),
        ('Goa',         'Mumbai',        'Ratnagiri',                     590),
        ('Mumbai',      'Nagpur',        'Aurangabad',                    830),
        ('Nagpur',      'Mumbai',        'Aurangabad',                    830),
        ('Mumbai',      'Ahmedabad',     'Surat, Vadodara',               530),
        ('Ahmedabad',   'Mumbai',        'Vadodara, Surat',               530),
        ('Ahmedabad',   'Surat',         'Vadodara',                      265),
        ('Surat',       'Ahmedabad',     'Vadodara',                      265),
        ('Pune',        'Goa',           'Kolhapur',                      450),
        ('Goa',         'Pune',          'Kolhapur',                      450),
        ('Mumbai',      'Aurangabad',    'Nashik',                        340),
        ('Aurangabad',  'Mumbai',        'Nashik',                        340),
        ('Mumbai',      'Shirdi',        'Nashik',                        240),
        # ── South India ──
        ('Bangalore',   'Chennai',       '',                              350),
        ('Chennai',     'Bangalore',     '',                              350),
        ('Bangalore',   'Hyderabad',     '',                              570),
        ('Hyderabad',   'Bangalore',     '',                              570),
        ('Chennai',     'Hyderabad',     '',                              630),
        ('Hyderabad',   'Chennai',       '',                              630),
        ('Bangalore',   'Mysore',        '',                              145),
        ('Mysore',      'Bangalore',     '',                              145),
        ('Bangalore',   'Coimbatore',    'Salem',                         370),
        ('Coimbatore',  'Bangalore',     'Salem',                         370),
        ('Chennai',     'Coimbatore',    'Salem',                         490),
        ('Coimbatore',  'Chennai',       'Salem',                         490),
        ('Bangalore',   'Goa',           'Hubli',                         590),
        ('Goa',         'Bangalore',     'Hubli',                         590),
        ('Hyderabad',   'Vijayawada',    '',                              280),
        ('Vijayawada',  'Hyderabad',     '',                              280),
        ('Chennai',     'Madurai',       'Trichy',                        460),
        ('Madurai',     'Chennai',       'Trichy',                        460),
        ('Hyderabad',   'Pune',          'Solapur',                       560),
        ('Pune',        'Hyderabad',     'Solapur',                       560),
        ('Bangalore',   'Pune',          'Hubli, Kolhapur',               840),
        ('Pune',        'Bangalore',     'Kolhapur, Hubli',               840),
        # ── East India ──
        ('Kolkata',     'Bhubaneswar',   '',                              440),
        ('Bhubaneswar', 'Kolkata',       '',                              440),
        ('Kolkata',     'Patna',         '',                              580),
        ('Patna',       'Kolkata',       '',                              580),
        ('Kolkata',     'Varanasi',      'Patna',                         680),
        ('Varanasi',    'Kolkata',       'Patna',                         680),
        ('Kolkata',     'Siliguri',      '',                              600),
        ('Siliguri',    'Kolkata',       '',                              600),
        ('Bhubaneswar', 'Hyderabad',     'Vizag',                         780),
        ('Hyderabad',   'Bhubaneswar',   'Vizag',                         780),
        # ── Central India ──
        ('Nagpur',      'Hyderabad',     '',                              500),
        ('Hyderabad',   'Nagpur',        '',                              500),
        ('Nagpur',      'Bhopal',        '',                              340),
        ('Bhopal',      'Nagpur',        '',                              340),
        ('Bhopal',      'Indore',        '',                              190),
        ('Indore',      'Bhopal',        '',                              190),
        ('Indore',      'Mumbai',        'Surat',                         590),
        ('Mumbai',      'Indore',        'Surat',                         590),
        ('Indore',      'Ahmedabad',     '',                              400),
        ('Ahmedabad',   'Indore',        '',                              400),
        ('Bhopal',      'Delhi',         'Gwalior, Agra',                 780),
        ('Delhi',       'Bhopal',        'Agra, Gwalior',                 780),
        ('Delhi',       'Allahabad',     'Agra, Kanpur',                  650),
        # ── Long Distance Overnight ──
        ('Delhi',       'Kolkata',       'Varanasi, Patna',              1500),
        ('Kolkata',     'Delhi',         'Patna, Varanasi',              1500),
        ('Delhi',       'Hyderabad',     'Nagpur',                       1500),
        ('Hyderabad',   'Delhi',         'Nagpur',                       1500),
        ('Mumbai',      'Kolkata',       'Nagpur, Raipur',               1980),
        ('Kolkata',     'Mumbai',        'Raipur, Nagpur',               1980),
        ('Chennai',     'Delhi',         'Bangalore, Hyderabad, Nagpur', 2200),
        ('Delhi',       'Chennai',       'Nagpur, Hyderabad, Bangalore', 2200),
        ('Bangalore',   'Delhi',         'Hyderabad, Nagpur',            2000),
        ('Delhi',       'Bangalore',     'Nagpur, Hyderabad',            2000),
    ]

    conn.executemany(
        "INSERT INTO routes (source,destination,via,distance) VALUES (?,?,?,?)",
        routes_data
    )
    conn.commit()

    # Fetch all route IDs
    routes_db = conn.execute("SELECT id, distance FROM routes ORDER BY id").fetchall()

    # ── Price table per bus type (per km base) ────────────────
    price_per_km = {
        'AC':        1.8,
        'Non-AC':    1.0,
        'Sleeper':   1.5,
        'AC Sleeper':2.2,
    }
    base_price = {
        'AC':        150,
        'Non-AC':     80,
        'Sleeper':   130,
        'AC Sleeper':180,
    }

    # ── First departure slots (5 buses × 4 types = 20 per route) ─
    # Spread departures: 06:00, 08:00, 10:00, 12:00, 14:00 for morning
    # then 16:00, 18:00, 20:00, 22:00, 00:00 for evening/night
    # Each type gets 5 departure slots (1 hour apart within the type block)
    type_start_hours = {
        'AC':        [6, 7, 8, 9, 10],
        'Non-AC':    [11, 12, 13, 14, 15],
        'Sleeper':   [16, 18, 20, 22, 23],
        'AC Sleeper':[17, 19, 21, 0, 1],
    }

    # Schedule for next 7 days
    today = date.today()
    schedule_dates = [(today + timedelta(days=i)).isoformat() for i in range(0, 7)]

    schedules = []
    # Round-robin bus assignment per type
    bus_assign = {t: 0 for t in bus_id_map}

    for route_id, distance in routes_db:
        for btype, dep_hours in type_start_hours.items():
            # price for this route+type
            price = round(base_price[btype] + (distance * price_per_km[btype]), -1)  # round to 10s

            travel_h = travel_hours(distance, btype)

            for i, dep_h in enumerate(dep_hours):
                # Pick bus round-robin
                pool = bus_id_map[btype]
                idx  = bus_assign[btype] % len(pool)
                bid  = pool[idx]
                bus_assign[btype] += 1

                dep_time = f"{dep_h:02d}:00"
                # arrival = dep + travel time
                arr_total = dep_h * 60 + int(travel_h * 60)
                arr_h = (arr_total // 60) % 24
                arr_m = arr_total % 60
                arr_time = f"{arr_h:02d}:{arr_m:02d}"

                for sched_date in schedule_dates:
                    schedules.append((bid, route_id, dep_time, arr_time, price, sched_date))

    conn.executemany(
        "INSERT INTO schedules (bus_id,route_id,departure_time,arrival_time,price,date) VALUES (?,?,?,?,?,?)",
        schedules
    )
    conn.commit()

    # ── Sample bookings ───────────────────────────────────────
    sample_bookings = [
        (2, 1, 5, 'confirmed'), (2, 1, 6, 'confirmed'),
        (3, 2, 10, 'confirmed'), (4, 3, 3, 'confirmed'),
        (5, 4, 15, 'confirmed'), (2, 5, 20, 'confirmed'),
        (3, 6, 8, 'confirmed'),  (4, 7, 12, 'confirmed'),
    ]
    conn.executemany(
        "INSERT INTO bookings (user_id,schedule_id,seat_number,status) VALUES (?,?,?,?)",
        sample_bookings
    )
    conn.commit()
    conn.close()

    total_schedules = len(schedules)
    print(f"\n✅ Database initialized successfully!")
    print(f"   Routes   : {len(routes_db)}")
    print(f"   Buses    : 80 (20 AC + 20 Non-AC + 20 Sleeper + 20 AC Sleeper)")
    print(f"   Schedules: {total_schedules} (across 7 days)")
    print(f"\nDemo Credentials:")
    print(f"  Admin : admin@busms.com   / admin123")
    print(f"  User  : rahul@example.com / user123")

if __name__ == '__main__':
    init()
