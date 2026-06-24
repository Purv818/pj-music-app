from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import sqlite3
import bcrypt
import jwt
import datetime
import os
from functools import wraps

app = Flask(__name__)
app.secret_key = 'bus_management_secret_key_2024'
CORS(app)

JWT_SECRET = 'jwt_secret_key_bus_mgmt'
DB_PATH = 'database.db'

# ─── DB Helper ───────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    with open('database.sql', 'r') as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()

# ─── JWT Helpers ─────────────────────────────────────────────
def create_token(user_id, role):
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def decode_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except:
        return None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        data = decode_token(token)
        if not data:
            return jsonify({'error': 'Invalid token'}), 401
        request.user = data
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        data = decode_token(token)
        if not data or data.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        request.user = data
        return f(*args, **kwargs)
    return decorated

# ─── Page Routes ─────────────────────────────────────────────
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/signup')
def signup_page():
    return render_template('signup.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/admin')
def admin_dashboard():
    return render_template('admin.html')

@app.route('/search')
def search_page():
    return render_template('search.html')

@app.route('/booking/<int:schedule_id>')
def booking_page(schedule_id):
    return render_template('booking.html', schedule_id=schedule_id)

@app.route('/ticket/<int:booking_id>')
def ticket_page(booking_id):
    return render_template('ticket.html', booking_id=booking_id)

# ─── Auth APIs ───────────────────────────────────────────────
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'user')

    if not name or not email or not password:
        return jsonify({'error': 'All fields required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = get_db()
    try:
        conn.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                     (name, email, hashed, role))
        conn.commit()
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        token = create_token(user['id'], user['role'])
        return jsonify({'token': token, 'user': {'id': user['id'], 'name': user['name'], 'email': user['email'], 'role': user['role']}})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Email already registered'}), 409
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode(), user['password'].encode()):
        return jsonify({'error': 'Invalid credentials'}), 401

    token = create_token(user['id'], user['role'])
    return jsonify({'token': token, 'user': {'id': user['id'], 'name': user['name'], 'email': user['email'], 'role': user['role']}})

@app.route('/api/auth/me', methods=['GET'])
@token_required
def me():
    conn = get_db()
    user = conn.execute('SELECT id, name, email, role FROM users WHERE id = ?', (request.user['user_id'],)).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(dict(user))

# ─── Bus APIs ────────────────────────────────────────────────
@app.route('/api/buses', methods=['GET'])
def get_buses():
    conn = get_db()
    buses = conn.execute('SELECT * FROM buses').fetchall()
    conn.close()
    return jsonify([dict(b) for b in buses])

@app.route('/api/buses', methods=['POST'])
@admin_required
def add_bus():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO buses (bus_number, capacity, type) VALUES (?, ?, ?)',
                 (data['bus_number'], data['capacity'], data['type']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Bus added successfully'}), 201

@app.route('/api/buses/<int:bus_id>', methods=['PUT'])
@admin_required
def update_bus(bus_id):
    data = request.json
    conn = get_db()
    conn.execute('UPDATE buses SET bus_number=?, capacity=?, type=? WHERE id=?',
                 (data['bus_number'], data['capacity'], data['type'], bus_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Bus updated'})

@app.route('/api/buses/<int:bus_id>', methods=['DELETE'])
@admin_required
def delete_bus(bus_id):
    conn = get_db()
    conn.execute('DELETE FROM buses WHERE id = ?', (bus_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Bus deleted'})

# ─── Route APIs ──────────────────────────────────────────────
@app.route('/api/routes', methods=['GET'])
def get_routes():
    conn = get_db()
    routes = conn.execute('SELECT * FROM routes').fetchall()
    conn.close()
    return jsonify([dict(r) for r in routes])

@app.route('/api/routes', methods=['POST'])
@admin_required
def add_route():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO routes (source, destination, via, distance) VALUES (?, ?, ?, ?)',
                 (data['source'], data['destination'], data.get('via',''), data['distance']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Route added'}), 201

@app.route('/api/routes/<int:route_id>', methods=['DELETE'])
@admin_required
def delete_route(route_id):
    conn = get_db()
    conn.execute('DELETE FROM routes WHERE id = ?', (route_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Route deleted'})

# ─── Schedule APIs ───────────────────────────────────────────
@app.route('/api/schedules/search', methods=['GET'])
def search_schedules():
    source = request.args.get('source', '').strip()
    destination = request.args.get('destination', '').strip()
    date = request.args.get('date', '')

    conn = get_db()
    query = '''
        SELECT s.id, s.departure_time, s.arrival_time, s.price, s.date,
               b.bus_number, b.capacity, b.type,
               r.source, r.destination, r.distance, r.via,
               (b.capacity - COUNT(bk.id)) as available_seats
        FROM schedules s
        JOIN buses b ON s.bus_id = b.id
        JOIN routes r ON s.route_id = r.id
        LEFT JOIN bookings bk ON bk.schedule_id = s.id AND bk.status != 'cancelled'
        WHERE LOWER(r.source) LIKE ? AND LOWER(r.destination) LIKE ?
    '''
    params = [f'%{source.lower()}%', f'%{destination.lower()}%']
    if date:
        query += ' AND s.date = ?'
        params.append(date)
    query += ' GROUP BY s.id'

    schedules = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(s) for s in schedules])

@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    conn = get_db()
    schedules = conn.execute('''
        SELECT s.*, b.bus_number, b.type, r.source, r.destination, r.via
        FROM schedules s
        JOIN buses b ON s.bus_id = b.id
        JOIN routes r ON s.route_id = r.id
    ''').fetchall()
    conn.close()
    return jsonify([dict(s) for s in schedules])

@app.route('/api/schedules', methods=['POST'])
@admin_required
def add_schedule():
    data = request.json
    conn = get_db()
    conn.execute('INSERT INTO schedules (bus_id, route_id, departure_time, arrival_time, price, date) VALUES (?, ?, ?, ?, ?, ?)',
                 (data['bus_id'], data['route_id'], data['departure_time'], data['arrival_time'], data['price'], data['date']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Schedule added'}), 201

@app.route('/api/schedules/<int:schedule_id>', methods=['DELETE'])
@admin_required
def delete_schedule(schedule_id):
    conn = get_db()
    conn.execute('DELETE FROM schedules WHERE id = ?', (schedule_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Schedule deleted'})

# ─── Seat APIs ───────────────────────────────────────────────
@app.route('/api/schedules/<int:schedule_id>/seats', methods=['GET'])
def get_seats(schedule_id):
    conn = get_db()
    schedule = conn.execute('''
        SELECT s.*, b.capacity FROM schedules s JOIN buses b ON s.bus_id = b.id WHERE s.id = ?
    ''', (schedule_id,)).fetchone()
    if not schedule:
        return jsonify({'error': 'Schedule not found'}), 404

    booked = conn.execute(
        "SELECT seat_number FROM bookings WHERE schedule_id = ? AND status != 'cancelled'",
        (schedule_id,)
    ).fetchall()
    conn.close()

    booked_seats = [b['seat_number'] for b in booked]
    all_seats = list(range(1, schedule['capacity'] + 1))
    seats = [{'number': s, 'status': 'booked' if s in booked_seats else 'available'} for s in all_seats]
    return jsonify({'seats': seats, 'capacity': schedule['capacity']})

# ─── Booking APIs ────────────────────────────────────────────
@app.route('/api/bookings', methods=['POST'])
@token_required
def create_booking():
    data = request.json
    schedule_id = data.get('schedule_id')
    seat_number = data.get('seat_number')
    user_id = request.user['user_id']

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM bookings WHERE schedule_id=? AND seat_number=? AND status!='cancelled'",
        (schedule_id, seat_number)
    ).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'Seat already booked'}), 409

    conn.execute('INSERT INTO bookings (user_id, schedule_id, seat_number, status) VALUES (?, ?, ?, ?)',
                 (user_id, schedule_id, seat_number, 'confirmed'))
    conn.commit()
    booking_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.close()
    return jsonify({'message': 'Booking confirmed', 'booking_id': booking_id}), 201

@app.route('/api/bookings/my', methods=['GET'])
@token_required
def my_bookings():
    conn = get_db()
    bookings = conn.execute('''
        SELECT bk.id, bk.seat_number, bk.status, bk.created_at,
               s.departure_time, s.arrival_time, s.price, s.date,
               b.bus_number, b.type,
               r.source, r.destination
        FROM bookings bk
        JOIN schedules s ON bk.schedule_id = s.id
        JOIN buses b ON s.bus_id = b.id
        JOIN routes r ON s.route_id = r.id
        WHERE bk.user_id = ?
        ORDER BY bk.created_at DESC
    ''', (request.user['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(b) for b in bookings])

@app.route('/api/bookings/<int:booking_id>', methods=['GET'])
@token_required
def get_booking(booking_id):
    conn = get_db()
    booking = conn.execute('''
        SELECT bk.*, s.departure_time, s.arrival_time, s.price, s.date,
               b.bus_number, b.type, b.capacity,
               r.source, r.destination, r.distance,
               u.name as passenger_name, u.email as passenger_email
        FROM bookings bk
        JOIN schedules s ON bk.schedule_id = s.id
        JOIN buses b ON s.bus_id = b.id
        JOIN routes r ON s.route_id = r.id
        JOIN users u ON bk.user_id = u.id
        WHERE bk.id = ?
    ''', (booking_id,)).fetchone()
    conn.close()
    if not booking:
        return jsonify({'error': 'Booking not found'}), 404
    return jsonify(dict(booking))

@app.route('/api/bookings/<int:booking_id>/cancel', methods=['PUT'])
@token_required
def cancel_booking(booking_id):
    conn = get_db()
    conn.execute("UPDATE bookings SET status='cancelled' WHERE id=? AND user_id=?",
                 (booking_id, request.user['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Booking cancelled'})

# ─── Admin APIs ──────────────────────────────────────────────
@app.route('/api/admin/bookings', methods=['GET'])
@admin_required
def admin_bookings():
    conn = get_db()
    bookings = conn.execute('''
        SELECT bk.id, bk.seat_number, bk.status, bk.created_at,
               s.departure_time, s.date, s.price,
               b.bus_number, r.source, r.destination,
               u.name as passenger_name, u.email as passenger_email
        FROM bookings bk
        JOIN schedules s ON bk.schedule_id = s.id
        JOIN buses b ON s.bus_id = b.id
        JOIN routes r ON s.route_id = r.id
        JOIN users u ON bk.user_id = u.id
        ORDER BY bk.created_at DESC
    ''').fetchall()
    conn.close()
    return jsonify([dict(b) for b in bookings])

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    conn = get_db()
    total_bookings = conn.execute("SELECT COUNT(*) as c FROM bookings WHERE status='confirmed'").fetchone()['c']
    total_revenue = conn.execute('''
        SELECT COALESCE(SUM(s.price), 0) as r FROM bookings bk
        JOIN schedules s ON bk.schedule_id = s.id WHERE bk.status='confirmed'
    ''').fetchone()['r']
    total_users = conn.execute("SELECT COUNT(*) as c FROM users WHERE role='user'").fetchone()['c']
    total_buses = conn.execute("SELECT COUNT(*) as c FROM buses").fetchone()['c']
    total_routes = conn.execute("SELECT COUNT(*) as c FROM routes").fetchone()['c']
    total_locations = conn.execute('''
        SELECT COUNT(DISTINCT loc) as c FROM (
            SELECT source as loc FROM routes
            UNION
            SELECT destination as loc FROM routes
        )
    ''').fetchone()['c']

    popular_routes = conn.execute('''
        SELECT r.source, r.destination, COUNT(bk.id) as bookings
        FROM bookings bk
        JOIN schedules s ON bk.schedule_id = s.id
        JOIN routes r ON s.route_id = r.id
        WHERE bk.status = 'confirmed'
        GROUP BY r.id ORDER BY bookings DESC LIMIT 5
    ''').fetchall()

    monthly = conn.execute('''
        SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as bookings,
               SUM(s.price) as revenue
        FROM bookings bk
        JOIN schedules s ON bk.schedule_id = s.id
        WHERE bk.status = 'confirmed'
        GROUP BY month ORDER BY month DESC LIMIT 6
    ''').fetchall()

    conn.close()
    return jsonify({
        'total_bookings': total_bookings,
        'total_revenue': total_revenue,
        'total_users': total_users,
        'total_buses': total_buses,
        'total_routes': total_routes,
        'total_locations': total_locations,
        'popular_routes': [dict(r) for r in popular_routes],
        'monthly_stats': [dict(m) for m in monthly]
    })

if __name__ == '__main__':
    if not os.path.exists(DB_PATH):
        print("No database found. Run: python init_db.py")
        print("Starting with empty DB for now...")
        conn = get_db()
        with open('database.sql', 'r') as f:
            conn.executescript(f.read())
        conn.commit()
        conn.close()
    app.run(debug=True, port=5000)
