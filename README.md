# 🚌 BusMS — Bus Management System

A full-stack bus booking web application built with **Python Flask**, **SQLite**, and vanilla **HTML/CSS/JS**.

---

## 📁 Project Structure

```
busms/
├── app.py               # Flask backend (all APIs + page routes)
├── init_db.py           # Database initializer with sample data
├── requirements.txt     # Python dependencies
├── database.db          # SQLite database (auto-created)
├── database.sql         # SQL schema reference
├── templates/
│   ├── base.html        # Shared navbar + footer layout
│   ├── index.html       # Home page with search
│   ├── login.html       # Login page
│   ├── signup.html      # Signup page
│   ├── search.html      # Bus search results
│   ├── booking.html     # Seat selection
│   ├── ticket.html      # Booking confirmation ticket
│   ├── dashboard.html   # User dashboard
│   └── admin.html       # Admin dashboard
└── static/
    ├── css/style.css    # All styles
    └── js/
        ├── auth.js      # Auth helpers (loaded globally)
        ├── search.js    # Search page logic
        ├── booking.js   # Seat selection logic
        ├── ticket.js    # Ticket display logic
        ├── dashboard.js # User dashboard logic
        └── admin.js     # Admin dashboard logic
```

---

## 🚀 Setup & Run

### 1. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 2. Initialize the database

```bash
python init_db.py
```

This creates `database.db` with schema + sample data (buses, routes, schedules, users).

### 3. Start the server

```bash
python app.py
```

Open your browser at **http://localhost:5000**

---

## 🔑 Demo Credentials

| Role  | Email                  | Password  |
|-------|------------------------|-----------|
| Admin | admin@busms.com        | admin123  |
| User  | rahul@example.com      | user123   |
| User  | priya@example.com      | user123   |

---

## ✨ Features

### User
- Search buses by source, destination, and date
- Filter by bus type, departure time, price
- Interactive seat selection map
- Booking confirmation with printable ticket
- View and cancel bookings from dashboard

### Admin
- Dashboard with stats: total bookings, revenue, users, buses
- Charts: monthly bookings, revenue trend, popular routes
- Full CRUD for buses, routes, schedules
- View all bookings across all users

### Security
- Passwords hashed with bcrypt
- JWT-based authentication
- Role-based route protection (admin/user)

---

## 🛠 Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | HTML5, CSS3, JavaScript |
| Backend  | Python 3, Flask         |
| Database | SQLite (via sqlite3)    |
| Auth     | JWT + bcrypt            |
| Charts   | Chart.js (CDN)          |
| Icons    | Font Awesome (CDN)      |
