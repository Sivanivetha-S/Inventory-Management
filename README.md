# Smart Inventory Theft Detection & Billing System

A full-stack retail management application with theft detection, billing, and analytics.

---

## Tech Stack

| Layer      | Technology                            |
|------------|---------------------------------------|
| Frontend   | React 18 + Vite                       |
| Backend    | Spring Boot 3.2 (Java 17)             |
| Database   | MySQL 8                               |
| ORM        | Spring Data JPA + Hibernate           |
| Auth       | Spring Security + JWT (JJWT 0.11.5)  |
| Email      | JavaMailSender (Gmail SMTP)           |
| API Docs   | Swagger / OpenAPI 3 (SpringDoc)       |
| Build      | Maven                                 |

---

## Prerequisites

- Java 17+
- Maven 3.8+
- MySQL 8+
- Node.js 18+
- npm 9+
- Gmail account with **App Password** enabled

---

## Database Setup

MySQL will auto-create the database on first run via the JDBC URL flag `createDatabaseIfNotExist=true`.

**Database name:** `smart_inventory_db`

To create it manually (optional):
```sql
CREATE DATABASE smart_inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Backend Setup

### 1. Navigate to backend folder
```bash
cd backend
```

### 2. Configure email (Gmail App Password)
Generate a Gmail **App Password**:
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Under "2-Step Verification" → "App passwords" → generate one for "Mail"

Set these environment variables **OR** edit `application.properties` directly:

| Variable        | Value                             |
|-----------------|-----------------------------------|
| `DB_USERNAME`   | `root` (default)                  |
| `DB_PASSWORD`   | `sivanathi811`                    |
| `MAIL_USERNAME` | `sidheessiva598@gmail.com`        |
| `MAIL_PASSWORD` | your Gmail App Password           |
| `JWT_SECRET`    | any long random string (optional) |

### 3. Run the backend
```bash
mvn spring-boot:run
```

Or build and run the JAR:
```bash
mvn clean package -DskipTests
java -jar target/smart-inventory-1.0.0.jar
```

Backend starts at: **http://localhost:8080**

### 4. Swagger UI
Open: **http://localhost:8080/swagger-ui.html**

---

## Frontend Setup

### 1. Navigate to frontend folder
```bash
cd frontend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start development server
```bash
npm run dev
```

Frontend starts at: **http://localhost:5173**

---

## First-Time Usage

1. Open **http://localhost:5173**
2. Click **Get Started Free** on the landing page
3. Complete the **4-step admin registration**:
   - Step 1: Enter Full Name, Email, Password, Phone
   - Step 2: Enter the OTP sent to your email
   - Step 3: Enter Shop Name & Category
   - Step 4: Registration complete → Login
4. Login and explore the dashboard

---

## Features

### Admin Registration (Multi-step)
- Step 1: Basic info submission
- Step 2: Email OTP verification (expires in 10 minutes)
- Step 3: Shop name and category
- Step 4: Completion

### Product Management
- Add / Edit / Delete products
- Fields: Name, Category, Purchase Price, Selling Price, Stock, Min Alert Level
- Low stock alerts on dashboard

### Customer Management
- Admin-added customers (no OTP required)
- Self-registered customers (email OTP required)
- Full CRUD with search

### Billing System
- Search and select customer (or walk-in)
- Add products to cart
- Set quantities
- Apply manual discount (%)
- Generate invoice with unique number
- Print invoice
- Full invoice history

### Sales Management
- Filter by date range
- Search by invoice or customer
- Summary stats: total invoices, revenue, discounts
- Export to CSV

### Discount Management
- Admin-only discount creation
- CRUD for discounts
- Toggle active/inactive
- Old invoices remain unchanged when discounts are edited/deleted

### Theft Detection
- Daily automated email at **8:00 PM** (Spring Scheduler cron)
- Admin enters actual stock per product
- System calculates: `Expected = Opening Stock − Sold Qty`
- If `Actual < Expected` → theft record created automatically
- Theft alert email sent to admin
- History with status tracking (DETECTED → INVESTIGATED → RESOLVED)
- Admin notes on each record
- Export theft report to CSV

### Dashboard
- Total Products, Customers, Sales
- Today's & Total Revenue
- Low stock alerts
- Theft alerts counter
- Weekly revenue area chart
- Monthly revenue bar chart
- Recent bills table
- Recent theft alerts

---

## API Endpoints Summary

| Module          | Base URL              |
|-----------------|-----------------------|
| Auth            | `/api/auth`           |
| Products        | `/api/products`       |
| Customers       | `/api/customers`      |
| Invoices        | `/api/invoices`       |
| Discounts       | `/api/discounts`      |
| Theft Detection | `/api/theft`          |
| Dashboard       | `/api/dashboard`      |

Full documentation: **http://localhost:8080/swagger-ui.html**

---

## Project Structure

```
newsmartsupply/
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/smartinventory/
│       ├── SmartInventoryApplication.java
│       ├── config/          # SecurityConfig, SwaggerConfig
│       ├── controller/      # AuthController, ProductController, ...
│       ├── dto/
│       │   ├── request/     # All request DTOs
│       │   └── response/    # All response DTOs
│       ├── email/           # EmailService
│       ├── entity/          # JPA Entities
│       ├── exception/       # GlobalExceptionHandler, custom exceptions
│       ├── repository/      # Spring Data JPA Repositories
│       ├── scheduler/       # StockVerificationScheduler (8 PM cron)
│       ├── security/        # JwtUtil, JwtAuthFilter, AdminDetailsService
│       └── service/         # All business logic services
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── context/         # AuthContext
        ├── services/        # api.js (Axios)
        ├── components/
        │   └── layout/      # AppLayout, Sidebar, Topbar
        └── pages/
            ├── LandingPage  # Stacking cards scroll effect
            ├── auth/        # LoginPage, RegisterPage
            ├── Dashboard    # Charts + stats
            ├── Products     # CRUD
            ├── Customers    # CRUD
            ├── Billing      # Invoice generation + print
            ├── Sales        # Reports + export
            ├── Discounts    # CRUD
            └── TheftDetection # Verify + history
```

---

## Environment Variables (Optional)

Instead of editing `application.properties`, set these in your OS or IDE:

```env
DB_USERNAME=root
DB_PASSWORD=sivanathi811
MAIL_USERNAME=sidheessiva598@gmail.com
MAIL_PASSWORD=your_gmail_app_password
JWT_SECRET=YourVeryLongAndSecureJWTSecretKey2024
JWT_EXPIRATION=86400000
```

---

## Notes

- **Do NOT hardcode email passwords** in production — use environment variables or a secrets manager.
- The daily 8 PM scheduler uses the server's local timezone. Ensure the server timezone is set correctly.
- Hibernate auto-creates/updates tables via `spring.jpa.hibernate.ddl-auto=update`. For production, use `validate` and run Flyway/Liquibase migrations.
- The frontend proxies `/api` requests to `http://localhost:8080` via Vite's dev server config.
