# Complete Banking Web App with Authentication

A comprehensive banking web application with full authentication system, user management, and admin dashboard.

## 🔐 Authentication System

### **Login Credentials**

**Admin Access:**
- **Email:** `bank@gmail.com`
- **Password:** `admin010`
- **Access:** Full admin dashboard with user management

**Demo User Access:**
- **Email:** `demo@example.com`
- **Password:** `demo123`
- **Access:** Main banking interface

**Alternative Demo Accounts:**
- `carmen@example.com` / `carmen123`
- `user@bank.com` / `user123`

### **Features**
- ✅ **Secure Login/Logout** - Complete session management
- ✅ **User Registration** - Create new accounts with validation
- ✅ **Admin Dashboard** - Comprehensive admin interface
- ✅ **Session Persistence** - Remember me functionality
- ✅ **Auto Logout** - 24-hour session timeout
- ✅ **Role-based Access** - Admin vs User permissions

## 📱 Application Structure

### **Entry Points**
- `index.html` - **Login Page** (Start here)
- `banking-app.html` - **Main Banking Interface**
- `admin.html` - **Admin Dashboard**

### **How to Use**

1. **Start the App:**
   - Open `index.html` in any web browser
   - You'll see the login/registration interface

2. **Login Options:**
   - **Admin:** Use `bank@gmail.com` / `admin010` for admin dashboard
   - **Demo User:** Use `demo@example.com` / `demo123` for banking app
   - **Register:** Create a new account with the registration form

3. **Banking App Features:**
   - Account balance and transaction history
   - Interactive tabs and navigation
   - Search and filter transactions
   - Full logout functionality

4. **Admin Dashboard Features:**
   - User management and monitoring
   - Real-time transaction tracking
   - System status monitoring
   - Data export capabilities
   - Security oversight

## 🎯 Complete Feature Set

### **Authentication Features**
- **Login Form** with email/password validation
- **Registration Form** with comprehensive validation
- **Password Toggle** for better UX
- **Remember Me** checkbox for persistent sessions
- **Demo Account** for quick testing
- **Secure Logout** with confirmation
- **Session Management** with automatic timeout

### **Banking App Features**
- **Account Overview** - Balance and account info
- **Transaction History** - Complete transaction list
- **Tab Navigation** - Overview, Manage, Routing & balance info
- **Search & Filter** - Find specific transactions
- **Responsive Design** - Works on all devices
- **Interactive Elements** - All buttons and links functional

### **Admin Dashboard Features**
- **Dashboard Overview** - Key metrics and statistics
- **User Management** - View and manage all users
- **Account Management** - Monitor all accounts
- **Transaction Monitoring** - Real-time transaction tracking
- **System Status** - Monitor application health
- **Reports & Analytics** - Generate reports
- **Security Settings** - Configure security options
- **Real-time Updates** - Live data refresh

## 🚀 Technology Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Authentication:** Session-based with localStorage/sessionStorage
- **Design:** Responsive, mobile-first approach
- **Icons:** Font Awesome 6.0
- **Styling:** CSS Grid, Flexbox, Gradients, Animations

## 📁 File Structure

```
bank/
├── index.html              # Login/Registration page (Entry point)
├── banking-app.html        # Main banking interface
├── admin.html              # Admin dashboard
├── auth-styles.css         # Authentication page styling
├── admin-styles.css        # Admin dashboard styling
├── styles.css              # Main banking app styling
├── auth.js                 # Authentication logic
├── admin.js                # Admin dashboard functionality
├── script.js               # Main banking app functionality
└── README.md               # This documentation
```

## 🔧 Setup & Installation

1. **Download/Clone** all files to a folder
2. **Open** `index.html` in any modern web browser
3. **Login** with provided credentials or create new account
4. **Enjoy** the full banking experience!

**No installation or server required - runs completely in the browser!**

## 🖥️ Optional Backend (Cross-Device Admin)

This project now includes an optional Node/Express + MongoDB backend to persist users and transactions across devices so admins can approve from anywhere.

### Setup

1. Configure environment variables:
   - Copy `server/.env.example` to `server/.env` and set `MONGO_URI` to your MongoDB connection string.

2. Install and run the API:
   - PowerShell:
     - `cd server`
     - `npm install`
     - `npm run dev`  # starts on `http://localhost:4000`

3. Point the frontend to the API:
   - In the browser dev console or before loading pages, set:
     - `localStorage.setItem('apiBaseUrl','http://localhost:4000')`
   - Or edit `config.js` default if desired.

### API Endpoints
- `GET /api/health`
- Users: `GET /api/users`, `POST /api/users`
- Pending users: `GET /api/pending-users`, `POST /api/pending-users/approve/:id`
- Transactions: `GET /api/transactions/pending`, `POST /api/transactions`,
  `POST /api/transactions/:id/approve`, `POST /api/transactions/:id/reject`
- Audit: `GET /api/audit`

Frontend will fall back to localStorage when the API is unreachable.

## 🎨 Design Features

### **Consistent Branding**
- Purple/blue gradient theme throughout
- Smooth animations and transitions
- Professional banking aesthetic
- Mobile-optimized interface

### **User Experience**
- Intuitive navigation
- Clear visual feedback
- Loading states and animations
- Error handling and validation
- Responsive design for all devices

### **Security UI**
- Password visibility toggle
- Secure session indicators
- Logout confirmations
- Session timeout warnings

## 🔒 Security Features

### **Authentication Security**
- Email validation
- Password strength requirements
- Session timeout (24 hours)
- Secure logout with session clearing
- Role-based access control

### **Data Protection**
- Client-side session management
- Secure credential validation
- Auto-logout on session expiry
- Protected admin routes

## 📱 Responsive Design

### **Breakpoints**
- **Mobile:** < 480px (Optimized)
- **Tablet:** 481px - 767px (Responsive)
- **Desktop:** 768px+ (Full-featured)

### **Mobile Features**
- Touch-optimized buttons
- Swipe gesture support
- Full-screen experience
- Optimized form layouts

## 🎯 Testing Guide

### **Test Authentication:**
1. Open `index.html`
2. Try admin login: `bank@gmail.com` / `admin010`
3. Try demo login: `demo@example.com` / `demo123`
4. Test registration with new account
5. Test logout and session persistence

### **Test Banking App:**
1. Login as demo user
2. Test all navigation tabs
3. Click transactions and buttons
4. Test search functionality
5. Test logout

### **Test Admin Dashboard:**
1. Login as admin
2. Navigate through all sections
3. Test user management features
4. Check real-time updates
5. Test logout

## 🌟 Key Improvements

### **From Original Request:**
- ✅ **Complete Authentication System**
- ✅ **Admin Dashboard with Credentials**
- ✅ **User Registration & Login**
- ✅ **Session Management**
- ✅ **Role-Based Access**
- ✅ **Full-Screen Responsive Design**
- ✅ **Professional Banking Interface**

### **Additional Features Added:**
- Real-time dashboard updates
- Comprehensive form validation
- Advanced session management
- Mobile-optimized authentication
- Admin user management tools
- System monitoring dashboard

## 🎉 Usage Summary

**Perfect for:**
- Demonstrating banking app functionality
- Testing authentication systems
- Showcasing responsive design
- Admin dashboard prototyping
- Mobile banking interface demos

**Start Here:** Open `index.html` and login with `bank@gmail.com` / `admin010` for admin access or `demo@example.com` / `demo123` for user access!

---

**Your complete banking application with authentication is ready to use!**

## 🚀 Quick Deploy (Vercel + Railway)

This project supports an optional backend for cross-device admin approvals. Deploy both parts:

- Frontend: Vercel (static site)
- Backend: Railway (Node/Express + MongoDB under `server/`)

### Backend on Railway
1. Push this repo to GitHub.
2. In Railway: New → Deploy from GitHub → select your repo.
3. Set service root/path to `server/` so it builds the API.
4. Environment Variables:
    - `MONGO_URI` = your MongoDB Atlas connection string
    - `DB_NAME` = `securebank` (or your choice)
    - `PORT` = `4000` (optional; app respects `process.env.PORT`)
5. Deploy and verify `https://<your-railway-app>/api/health` returns `{ ok: true }`.

### Frontend on Vercel
1. Import the GitHub repo as a new Project (framework: Other; no build command).
2. Update `vercel.json` to point the rewrite to your Railway URL:

```json
{
   "version": 2,
   "rewrites": [
      { "source": "/api/(.*)", "destination": "https://<your-railway-app>.railway.app/api/$1" }
   ]
}
```

3. Deploy and visit your Vercel URL. The app calls `/api/...` and Vercel proxies to Railway.

### Local vs Production API
- `config.js` uses `http://localhost:4000` when on localhost, and an empty base in production so requests go to `/api/...`.
- You can override at runtime for testing:

```js
localStorage.setItem('apiBaseUrl', 'https://<your-railway-app>.railway.app'); location.reload();
```

### Post-Deploy Test
- Open the app on Vercel, perform an action that creates a pending transaction.
- Open the admin page and approve/reject; verify updates reflect across devices.