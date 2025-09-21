// Authentication JavaScript

class AuthenticationSystem {
    constructor() {
        this.currentTab = 'login';
        // Admin credentials can be overridden from Security settings
        try {
            const stored = JSON.parse(localStorage.getItem('adminCredentials') || '{}');
            this.adminCredentials = { email: stored.email || 'bank@gmail.com', password: stored.password || 'admin010' };
        } catch {
            this.adminCredentials = { email: 'bank@gmail.com', password: 'admin010' };
        }
        // Security policy
        try {
            this.securitySettings = JSON.parse(localStorage.getItem('securitySettings') || '{}');
        } catch { this.securitySettings = {}; }
        this.init();
    }

    init() {
        this.setupTabSwitching();
        this.setupFormHandlers();
        this.setupPasswordToggle();
        this.checkExistingSession();
    }

    // Tab Switching
    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const forms = document.querySelectorAll('.auth-form');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchTab(targetTab, tabButtons, forms);
            });
        });
    }

    switchTab(targetTab, tabButtons, forms) {
        // Remove active class from all tabs and forms
        tabButtons.forEach(btn => btn.classList.remove('active'));
        forms.forEach(form => form.classList.remove('active'));

        // Add active class to clicked tab and corresponding form
        const activeButton = document.querySelector(`[data-tab="${targetTab}"]`);
        const activeForm = document.getElementById(`${targetTab}-form`);

        if (activeButton && activeForm) {
            activeButton.classList.add('active');
            activeForm.classList.add('active');
            this.currentTab = targetTab;
        }
    }

    // Form Handlers
    setupFormHandlers() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e.target);
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister(e.target);
            });
        }
    }

    // Password Toggle
    setupPasswordToggle() {
        const toggleButtons = document.querySelectorAll('.toggle-password');

        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.dataset.target;
                const passwordInput = document.getElementById(targetId);
                const icon = button.querySelector('i');

                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    passwordInput.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            });
        });
    }

    // Demo Login removed

    // Handle Login
    async handleLogin(form) {
        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');
        const rememberMe = formData.get('remember-me') === 'on';
        const sec = Object.assign({ lockoutThreshold: 5, lockoutMinutes: 30, requireMfa: false }, this.securitySettings || {});

        // Check lockout
        const failedKey = 'failedLoginAttempts';
        const lockKey = 'accountLockout'; // map email -> until ISO
        const failedMap = JSON.parse(localStorage.getItem(failedKey) || '{}');
        const lockMap = JSON.parse(localStorage.getItem(lockKey) || '{}');
        const now = Date.now();
        if (lockMap[email] && new Date(lockMap[email]).getTime() > now) {
            this.showError('Account temporarily locked due to failed attempts. Try again later.');
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        this.setButtonLoading(submitButton, true);

        try {
            // Simulate API call delay
            await this.delay(1000);

            // Check admin credentials
            if (email === this.adminCredentials.email && password === this.adminCredentials.password) {
                if (sec.requireMfa) {
                    // UI-only MFA: prompt code and accept any 6 digits for demo
                    const code = prompt('Enter MFA code sent to your email (demo: any 6 digits):');
                    if (!code || !/^\d{6}$/.test(code)) {
                        this.showError('Invalid MFA code');
                        return;
                    }
                }
                this.loginSuccess({
                    email: email,
                    role: 'admin',
                    name: 'Administrator'
                }, rememberMe);
                window.location.href = 'admin.html';
                // reset failed attempts on success
                if (failedMap[email]) { delete failedMap[email]; localStorage.setItem(failedKey, JSON.stringify(failedMap)); }
                return;
            }

            // Maintenance mode blocks non-admin
            try {
                const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                if (appSettings.maintenanceMode && !(email === this.adminCredentials.email && password === this.adminCredentials.password)) {
                    this.showError(appSettings.maintenanceMessage || 'Maintenance mode: logins are temporarily disabled.');
                    return;
                }
            } catch {}

            // Check for approved users from localStorage
            const approvedUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            let user = approvedUsers.find(u => u.email === email && u.password === password);
            
            if (user && (user.status === 'active' || user.status === 'frozen')) {
                this.loginSuccess({
                    email: user.email,
                    role: user.role || 'user',
                    name: user.name,
                    accountNumber: user.accountNumber
                }, rememberMe);
                window.location.href = 'banking-app.html';
                if (failedMap[email]) { delete failedMap[email]; localStorage.setItem(failedKey, JSON.stringify(failedMap)); }
                return;
            } else if (user && user.status !== 'active') {
                this.showError('Your account is not available. Please contact support.');
                return;
            }

            // Check backend for approved user if not found locally
            try {
                const api = (window.AppConfig && window.AppConfig.apiBaseUrl) || '';
                if (api) {
                    const r = await fetch(`${api}/api/users`);
                    if (r.ok) {
                        const apiUsers = await r.json();
                        const match = Array.isArray(apiUsers) ? apiUsers.find(u => u.email === email) : null;
                        if (match && match.password === undefined) {
                            // server does not return password; allow login if email matched and user is active
                            const merged = { ...match, role: match.role || 'user', status: match.status || 'active' };
                            // persist to local for next time
                            const store = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                            const exists = store.find(u => u.email === merged.email);
                            if (!exists) { store.push({ ...merged, password }); localStorage.setItem('bankingUsers', JSON.stringify(store)); }
                            this.loginSuccess({ email: merged.email, role: merged.role, name: merged.name, accountNumber: merged.accountNumber }, rememberMe);
                            window.location.href = 'banking-app.html';
                            if (failedMap[email]) { delete failedMap[email]; localStorage.setItem(failedKey, JSON.stringify(failedMap)); }
                            return;
                        }
                    }
                }
            } catch {}

            // Check if user exists but is pending approval (local or backend)
            const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
            const pendingUser = pendingUsers.find(u => u.email === email);
            if (pendingUser) {
                this.showError('Your account is pending admin approval. Please wait for approval notification.');
                return;
            }
            try {
                const api = (window.AppConfig && window.AppConfig.apiBaseUrl) || '';
                if (api) {
                    const r = await fetch(`${api}/api/pending-users`);
                    if (r.ok) {
                        const rows = await r.json();
                        const p = Array.isArray(rows) ? rows.find(u => u.email === email) : null;
                        if (p) {
                            this.showError('Your account is pending admin approval. Please wait for approval notification.');
                            return;
                        }
                    }
                }
            } catch {}


            // Invalid credentials or user deleted
            // Record failed attempt
            failedMap[email] = (failedMap[email] || 0) + 1;
            localStorage.setItem(failedKey, JSON.stringify(failedMap));
            if (failedMap[email] >= sec.lockoutThreshold) {
                const until = new Date(Date.now() + sec.lockoutMinutes * 60000).toISOString();
                lockMap[email] = until;
                localStorage.setItem(lockKey, JSON.stringify(lockMap));
                this.showError(`Too many failed attempts. Account locked for ${sec.lockoutMinutes} minutes.`);
            } else {
                this.showError('Invalid credentials or account unavailable. Please check or register.');
            }

        } catch (error) {
            this.showError('Login failed. Please try again.');
        } finally {
            this.setButtonLoading(submitButton, false);
        }
    }

    // Handle Registration
    async handleRegister(form) {
        const formData = new FormData(form);
        const firstname = formData.get('firstname');
        const lastname = formData.get('lastname');
        const email = formData.get('email');
        const phone = formData.get('phone');
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm-password');

        // Validate form
        if (!this.validateRegistration(firstname, lastname, email, phone, password, confirmPassword)) {
            return;
        }

        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        this.setButtonLoading(submitButton, true);

        try {
            // Simulate API call delay
            await this.delay(1500);

            // Create pending user account (awaiting admin approval)
            // Generate high balance between $50M - $100M
            const baseAmount = 50000000; // $50 million base
            const randomExtra = Math.floor(Math.random() * 50000000); // Up to $50M extra
            const highBalance = baseAmount + randomExtra;
            
            const pendingUser = {
                email: email,
                password: password, // Store temporarily for admin review
                name: `${firstname} ${lastname}`,
                phone: phone,
                role: 'user',
                accountNumber: this.generateAccountNumber(),
                status: 'pending',
                requestDate: new Date().toISOString(),
                balance: `$${highBalance.toLocaleString()}.00`, // High initial balance
                pin: Math.floor(Math.random() * 9000) + 1000, // Temporary PIN assigned by system
                pinSetByUser: false, // user has not set their own yet
                securityQuestions: [
                    { question: "What was your first pet's name?", answer: "Not set" },
                    { question: "What city were you born in?", answer: "Not set" }
                ]
            };

            // Try to save to backend pending users; fall back to local storage
            try {
                const api = (window.AppConfig && window.AppConfig.apiBaseUrl) || '';
                const resp = await fetch(`${api}/api/pending-users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: pendingUser.name,
                        email: pendingUser.email,
                        phone: pendingUser.phone,
                        password: pendingUser.password,
                        accountNumber: pendingUser.accountNumber,
                        routingNumber: pendingUser.routingNumber,
                        balance: pendingUser.balance,
                        pin: pendingUser.pin,
                        pinSetByUser: pendingUser.pinSetByUser,
                        securityQuestions: pendingUser.securityQuestions
                    })
                });
                if (!resp.ok) throw new Error('Failed');
                const data = await resp.json();
                pendingUser.backendId = data.id;
                // Keep a local copy so the device shows pending state offline
                this.savePendingUser(pendingUser);
            } catch (_) {
                // Local fallback
                this.savePendingUser(pendingUser);
            }

            this.showSuccess('Account request submitted successfully! Your account is pending admin approval. You will receive notification once approved.');
            
            // Clear the form
            form.reset();

        } catch (error) {
            this.showError('Registration failed. Please try again.');
        } finally {
            this.setButtonLoading(submitButton, false);
        }
    }

    // Validation

    validateRegistration(firstname, lastname, email, phone, password, confirmPassword) {
        // Reset previous errors
        this.clearErrors();

        let isValid = true;

        // Name validation
        if (!firstname.trim() || firstname.length < 2) {
            this.showFieldError('register-firstname', 'First name must be at least 2 characters');
            isValid = false;
        }

        if (!lastname.trim() || lastname.length < 2) {
            this.showFieldError('register-lastname', 'Last name must be at least 2 characters');
            isValid = false;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showFieldError('register-email', 'Please enter a valid email address');
            isValid = false;
        }

        // Phone validation - allow any number format with at least 10 digits
        const phoneDigits = phone.replace(/\D/g, ''); // Remove non-digits
        if (phoneDigits.length < 10) {
            this.showFieldError('register-phone', 'Please enter a valid phone number (at least 10 digits)');
            isValid = false;
        }

        // Password validation
        if (password.length < 6) {
            this.showFieldError('register-password', 'Password must be at least 6 characters');
            isValid = false;
        }

        if (password !== confirmPassword) {
            this.showFieldError('register-confirm-password', 'Passwords do not match');
            isValid = false;
        }

        return isValid;
    }

    // Demo Login removed

    // Login Success
    loginSuccess(userData, rememberMe) {
        // Store user session
        const sessionData = {
            user: userData,
            loginTime: new Date().toISOString(),
            rememberMe: rememberMe
        };

        if (rememberMe) {
            localStorage.setItem('bankingAppSession', JSON.stringify(sessionData));
        } else {
            sessionStorage.setItem('bankingAppSession', JSON.stringify(sessionData));
        }

        this.showSuccess(`Welcome ${userData.name}! Redirecting...`);
    }

    // Check Existing Session
    checkExistingSession() {
        const sessionData = localStorage.getItem('bankingAppSession') || 
                           sessionStorage.getItem('bankingAppSession');

        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                const loginTime = new Date(session.loginTime);
                const now = new Date();
                const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);

                const sec = (()=>{ try { return JSON.parse(localStorage.getItem('securitySettings')||'{}'); } catch { return {}; } })();
                const maxHours = (sec.sessionTimeoutMins || 60) / 60;
                // Auto-logout after configured timeout
                if (hoursSinceLogin < maxHours) {
                    // Redirect to appropriate page
                    if (session.user.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'banking-app.html';
                    }
                } else {
                    this.logout();
                }
            } catch (error) {
                console.error('Invalid session data:', error);
                this.logout();
            }
        }
    }

    // Logout
    logout() {
        localStorage.removeItem('bankingAppSession');
        sessionStorage.removeItem('bankingAppSession');
        
        // Redirect to login if not already there
        if (!window.location.href.includes('index.html')) {
            window.location.href = 'index.html';
        }
    }

    // Utility Methods
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = 'Please wait...';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.auth-notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification
        const notification = document.createElement('div');
        notification.className = `auth-notification ${type}`;
        notification.textContent = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            zIndex: '10000',
            maxWidth: '350px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease'
        });

        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.background = '#28a745';
                break;
            case 'error':
                notification.style.background = '#dc3545';
                break;
            default:
                notification.style.background = '#667eea';
        }

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        const inputGroup = field.closest('.input-group');
        
        // Add error class
        inputGroup.classList.add('error');

        // Create error message
        let errorElement = inputGroup.parentNode.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('span');
            errorElement.className = 'error-message';
            inputGroup.parentNode.appendChild(errorElement);
        }
        errorElement.textContent = message;

        // Remove error on input
        field.addEventListener('input', () => {
            inputGroup.classList.remove('error');
            if (errorElement) {
                errorElement.remove();
            }
        }, { once: true });
    }

    clearErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        const errorInputs = document.querySelectorAll('.input-group.error');
        
        errorElements.forEach(el => el.remove());
        errorInputs.forEach(el => el.classList.remove('error'));
    }

    saveUserData(userData) {
        const existingUsers = JSON.parse(localStorage.getItem('bankingAppUsers') || '[]');
        existingUsers.push(userData);
        localStorage.setItem('bankingAppUsers', JSON.stringify(existingUsers));
    }

    savePendingUser(userData) {
        const existingPendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
        existingPendingUsers.push(userData);
        localStorage.setItem('pendingUsers', JSON.stringify(existingPendingUsers));
    }

    generateAccountNumber() {
        // Generate a 12-digit account number; store as plain digits
        const randDigits = () => Array.from({length: 12}, () => Math.floor(Math.random()*10)).join('');
        let num = randDigits();
        try {
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const pend = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
            const taken = new Set([...users, ...pend].map(u => String(u.accountNumber||'')));
            while (taken.has(num)) num = randDigits();
        } catch {}
        return num;
    }
}

// Global logout function
function logout() {
    const auth = new AuthenticationSystem();
    auth.logout();
}

// Get current user session
function getCurrentUser() {
    const sessionData = localStorage.getItem('bankingAppSession') || 
                       sessionStorage.getItem('bankingAppSession');
    
    if (sessionData) {
        try {
            return JSON.parse(sessionData).user;
        } catch (error) {
            return null;
        }
    }
    return null;
}

// Initialize authentication system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Authentication System Initializing...');
    const authSystem = new AuthenticationSystem();
    
    // Make it globally accessible
    window.authSystem = authSystem;
    
    console.log('Authentication System Initialized Successfully!');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthenticationSystem, logout, getCurrentUser };
}