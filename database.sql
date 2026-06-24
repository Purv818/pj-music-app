-- Bus Management System Database Schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_number TEXT UNIQUE NOT NULL,
    capacity INTEGER NOT NULL,
    type TEXT DEFAULT 'AC' CHECK(type IN ('AC', 'Non-AC', 'Sleeper', 'Semi-Sleeper')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    destination TEXT NOT NULL,
    via TEXT DEFAULT '',
    distance INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    price REAL NOT NULL,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    schedule_id INTEGER NOT NULL,
    seat_number INTEGER NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'pending')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

-- ─── Sample Data ─────────────────────────────────────────────

-- Admin user (password: admin123)
INSERT OR IGNORE INTO users (name, email, password, role) VALUES
('Admin User', 'admin@busms.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iCGi', 'admin');

-- Sample users (password: user123)
INSERT OR IGNORE INTO users (name, email, password, role) VALUES
('Rahul Sharma', 'rahul@example.com', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user'),
('Priya Patel', 'priya@example.com', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user'),
('Amit Kumar', 'amit@example.com', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user');

-- Buses
INSERT OR IGNORE INTO buses (bus_number, capacity, type) VALUES
('MH-01-AB-1234', 40, 'AC'),
('MH-02-CD-5678', 45, 'Non-AC'),
('MH-03-EF-9012', 36, 'Sleeper'),
('MH-04-GH-3456', 40, 'Semi-Sleeper'),
('MH-05-IJ-7890', 45, 'AC'),
('MH-06-KL-2345', 36, 'Sleeper');

-- Routes
INSERT OR IGNORE INTO routes (source, destination, distance) VALUES
('Mumbai', 'Pune', 150),
('Mumbai', 'Nashik', 170),
('Pune', 'Nashik', 210),
('Mumbai', 'Aurangabad', 340),
('Pune', 'Aurangabad', 235),
('Mumbai', 'Nagpur', 830),
('Pune', 'Nagpur', 700),
('Mumbai', 'Goa', 590),
('Pune', 'Goa', 450),
('Mumbai', 'Shirdi', 240);

-- Schedules
INSERT OR IGNORE INTO schedules (bus_id, route_id, departure_time, arrival_time, price, date) VALUES
(1, 1, '06:00', '09:30', 350, '2026-04-25'),
(2, 1, '08:00', '11:30', 250, '2026-04-25'),
(3, 1, '22:00', '01:30', 450, '2026-04-25'),
(1, 2, '07:00', '11:00', 400, '2026-04-25'),
(4, 2, '14:00', '18:00', 380, '2026-04-25'),
(5, 3, '09:00', '14:30', 500, '2026-04-25'),
(6, 4, '20:00', '06:00', 750, '2026-04-25'),
(1, 5, '07:30', '12:00', 550, '2026-04-25'),
(2, 6, '18:00', '08:00', 1200, '2026-04-25'),
(3, 7, '19:00', '07:00', 1000, '2026-04-25'),
(4, 8, '21:00', '09:00', 900, '2026-04-25'),
(5, 9, '20:30', '08:30', 800, '2026-04-25'),
(1, 1, '06:00', '09:30', 350, '2026-04-26'),
(2, 1, '08:00', '11:30', 250, '2026-04-26'),
(3, 2, '22:00', '02:00', 420, '2026-04-26'),
(4, 3, '10:00', '15:30', 520, '2026-04-26'),
(5, 4, '21:00', '07:00', 780, '2026-04-26'),
(6, 5, '08:00', '12:30', 560, '2026-04-26');

-- Sample bookings
INSERT OR IGNORE INTO bookings (user_id, schedule_id, seat_number, status) VALUES
(2, 1, 5, 'confirmed'),
(2, 1, 6, 'confirmed'),
(3, 1, 10, 'confirmed'),
(3, 2, 3, 'confirmed'),
(4, 3, 15, 'confirmed'),
(2, 7, 20, 'confirmed'),
(3, 9, 8, 'confirmed'),
(4, 11, 12, 'confirmed'),
(2, 13, 7, 'confirmed'),
(3, 13, 8, 'confirmed');
