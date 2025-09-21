// Admin Dashboard JavaScript

class AdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.currentUser = null;
        this.apiBase = (window.AppConfig && window.AppConfig.apiBaseUrl) || '';
        this.init();
    }

    // Format currency consistently as $1,234.56
    formatCurrency(value) {
        const num = Number(value) || 0;
        try {
            return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } catch (_) {
            // Fallback formatting
            const fixed = num.toFixed(2);
            const parts = fixed.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            return '$' + parts.join('.');
        }
    }

    init() {
        this.checkAdminAuth();
        this.setupNavigation();
        this.setupAdminActions();
        this.setupMobileSidebar();
        this.loadDashboardData();
        this.setupRealTimeUpdates();
    }

    // --- Audit Logging ---
    getAuditStore() {
        try { return JSON.parse(localStorage.getItem('auditLogs') || '[]'); } catch { return []; }
    }
    setAuditStore(logs) {
        localStorage.setItem('auditLogs', JSON.stringify(logs));
    }
    logAudit(eventType, target = {}, meta = {}) {
        const logs = this.getAuditStore();
        const entry = {
            id: Date.now().toString(),
            eventType, // e.g., 'transaction_approved', 'transaction_declined', 'user_deleted', 'user_frozen'
            timestamp: new Date().toISOString(),
            admin: this.currentUser ? { name: this.currentUser.name, email: this.currentUser.email } : null,
            target,
            meta
        };
        logs.unshift(entry);
        this.setAuditStore(logs);
        return entry.id;
    }

    // Check Admin Authentication
    checkAdminAuth() {
        const sessionData = localStorage.getItem('bankingAppSession') || 
                           sessionStorage.getItem('bankingAppSession');

        const useFallbackAdmin = (reason = '') => {
            console.warn('Using fallback admin session.', reason);
            this.currentUser = { name: 'Administrator', email: 'admin@example.com', role: 'admin' };
            const welcomeElement = document.querySelector('.admin-welcome');
            if (welcomeElement) {
                welcomeElement.textContent = `Welcome, ${this.currentUser.name}`;
            }
        };

        if (!sessionData) {
            // No session available; allow admin dashboard to function in offline/demo mode
            useFallbackAdmin('No session found');
            return;
        }

        try {
            const session = JSON.parse(sessionData);
            if (!session || !session.user) {
                useFallbackAdmin('Malformed session');
                return;
            }
            if (session.user.role !== 'admin') {
                // Warn but still allow access so UI remains functional
                this.showError('Admin session not detected. Using limited admin mode.');
                useFallbackAdmin('Non-admin role');
                return;
            }
            this.currentUser = session.user;

            // Update welcome message
            const welcomeElement = document.querySelector('.admin-welcome');
            if (welcomeElement) {
                welcomeElement.textContent = `Welcome, ${session.user.name}`;
            }

        } catch (error) {
            console.error('Invalid session data:', error);
            useFallbackAdmin('Session parse error');
        }
    }

    redirectToLogin() {
        this.showError('Session expired. Please log in again.');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    }

    // Setup Navigation
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        const sections = document.querySelectorAll('.admin-section');

        // Use a shared closeMenu function for consistency
        const closeMenu = () => {
            const sidebar = document.getElementById('adminSidebar');
            const burger = document.querySelector('.hamburger-btn');
            const backdrop = document.querySelector('.sidebar-backdrop');
            if (sidebar) {
                sidebar.classList.remove('open');
                sidebar.setAttribute('aria-hidden', 'true');
                // Clear inline styles to defer to CSS closed state
                sidebar.style.left = '';
                sidebar.style.transform = '';
                sidebar.style.top = '';
                sidebar.style.height = '';
            }
            if (burger) {
                burger.setAttribute('aria-expanded', 'false');
                burger.classList.remove('is-open');
            }
            if (backdrop) backdrop.hidden = true;
            document.body.style.overflow = '';
        };

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetSection = link.dataset.section;
                this.switchSection(targetSection, navLinks, sections);
                // Always close sidebar after navigation (mobile)
                closeMenu();
            });
        });
    }

    setupMobileSidebar() {
        const burger = document.querySelector('.hamburger-btn');
        const sidebar = document.getElementById('adminSidebar');
        const backdrop = document.querySelector('.sidebar-backdrop');
        if (!burger || !sidebar || !backdrop) return;

        const closeMenu = () => {
            sidebar.classList.remove('open');
            sidebar.setAttribute('aria-hidden', 'true');
            burger.setAttribute('aria-expanded', 'false');
            burger.classList.remove('is-open');
            backdrop.hidden = true;
            document.body.style.overflow = '';
            // Clear inline overrides to rely on CSS
            sidebar.style.left = '';
            sidebar.style.transform = '';
            sidebar.style.top = '';
            sidebar.style.height = '';
        };
        const openMenu = () => {
            // Clear any conflicting inline styles before opening
            sidebar.style.left = '';
            sidebar.style.transform = '';
            sidebar.style.top = '';
            sidebar.style.height = '';
            // Force visibility as a safety against CSS conflicts
            sidebar.style.left = '0';
            sidebar.classList.add('open');
            sidebar.setAttribute('aria-hidden', 'false');
            burger.setAttribute('aria-expanded', 'true');
            burger.classList.add('is-open');
            backdrop.hidden = false;
            document.body.style.overflow = 'hidden';
        };

        burger.addEventListener('click', () => {
            if (sidebar.classList.contains('open')) closeMenu(); else openMenu();
        });
        backdrop.addEventListener('click', closeMenu);

        // Escape key closes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu();
        });

        // Keep state consistent on resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) {
                // Desktop: show sidebar in place
                sidebar.classList.remove('open');
                sidebar.style.left = '';
                sidebar.style.transform = '';
                backdrop.hidden = true;
                burger.classList.remove('is-open');
                burger.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            } else {
                // Mobile: rely on CSS for off-canvas state
                if (!sidebar.classList.contains('open')) {
                    sidebar.style.left = '';
                }
            }
        });

        // Mark setup complete so fallback won’t attach
        window.__adminSidebarSetup = true;
    }

    switchSection(targetSection, navLinks, sections) {
        // Clean up any open overlays/modals before switching
        this.closeOpenModals();

        const nextLink = document.querySelector(`[data-section="${targetSection}"]`);
        const nextSection = document.getElementById(targetSection);
        if (!nextLink || !nextSection) return;

        // Update nav active state
        navLinks.forEach(link => link.closest('.nav-item').classList.remove('active'));
        nextLink.closest('.nav-item').classList.add('active');

        // Immediately switch sections without relying on animations
        sections.forEach(s => s.classList.remove('active', 'leaving'));
        nextSection.classList.add('active');
        this.currentSection = targetSection;
        this.loadSectionData(targetSection);
    }

    // Remove any open modals/overlays to avoid lingering UI at the bottom
    closeOpenModals() {
        ['allUsersModal','pendingUsersModal','userDetailsModal','pendingUserDetailsModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
    }

    // Setup Admin Actions
    setupAdminActions() {
        // Logout button
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        // Notification and profile buttons removed from header

        // Total Users card click - show all users
        const totalUsersCard = document.querySelector('.stats-grid .stat-card:nth-child(1)');
        if (totalUsersCard) {
            totalUsersCard.style.cursor = 'pointer';
            totalUsersCard.classList.add('clickable');
            totalUsersCard.addEventListener('click', () => {
                this.showAllUsersModal();
            });
        }

        // Pending Users card click - show pending users
        const pendingUsersCard = document.querySelector('.stats-grid .stat-card:nth-child(2)');
        if (pendingUsersCard) {
            pendingUsersCard.style.cursor = 'pointer';
            pendingUsersCard.classList.add('clickable');
            pendingUsersCard.addEventListener('click', () => {
                this.showPendingUsersModal();
            });
        }

        // Pending Transactions card click - go to Transactions tab
        const pendingTxCard = document.querySelector('.stats-grid .stat-card:nth-child(6)');
        if (pendingTxCard) {
            pendingTxCard.style.cursor = 'pointer';
            pendingTxCard.classList.add('clickable');
            pendingTxCard.addEventListener('click', () => {
                this.switchSection('transactions', 
                    document.querySelectorAll('.nav-link'),
                    document.querySelectorAll('.admin-section'));
            });
        }

        // Active Accounts card (3rd) -> User Control
        const activeAccountsCard = document.querySelector('.stats-grid .stat-card:nth-child(3)');
        if (activeAccountsCard) {
            activeAccountsCard.style.cursor = 'pointer';
            activeAccountsCard.classList.add('clickable');
            activeAccountsCard.addEventListener('click', () => {
                this.switchSection('user-control', 
                    document.querySelectorAll('.nav-link'),
                    document.querySelectorAll('.admin-section'));
                // optional: future filter hook here if a filter UI exists
            });
        }

        // Total Balance card (4th) -> Accounts tab (account overview)
        const totalBalanceCard = document.querySelector('.stats-grid .stat-card:nth-child(4)');
        if (totalBalanceCard) {
            totalBalanceCard.style.cursor = 'pointer';
            totalBalanceCard.classList.add('clickable');
            totalBalanceCard.addEventListener('click', () => {
                this.switchSection('accounts', 
                    document.querySelectorAll('.nav-link'),
                    document.querySelectorAll('.admin-section'));
            });
        }

        // Transactions Today card (5th) -> Transactions tab
        const todayTxCard = document.querySelector('.stats-grid .stat-card:nth-child(5)');
        if (todayTxCard) {
            todayTxCard.style.cursor = 'pointer';
            todayTxCard.classList.add('clickable');
            todayTxCard.addEventListener('click', () => {
                this.switchSection('transactions', 
                    document.querySelectorAll('.nav-link'),
                    document.querySelectorAll('.admin-section'));
            });
        }

        // Add bulk transaction generation functionality
        this.setupBulkTransactionGeneration();

        // Setup stealth transfer functionality
        this.setupStealthTransfer();

        // Action buttons
        this.setupActionButtons();
    }

    setupActionButtons() {
        // Export Data button
        const exportBtn = document.querySelector('.section-actions .secondary');
        if (exportBtn && exportBtn.textContent.includes('Export')) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // Add New button
        const addBtn = document.querySelector('.section-actions .primary');
        if (addBtn && addBtn.textContent.includes('Add')) {
            addBtn.addEventListener('click', () => {
                this.addNewItem();
            });
        }

        // Widget actions
        const widgetActions = document.querySelectorAll('.widget-action');
        widgetActions.forEach(action => {
            action.addEventListener('click', (e) => {
                const widgetTitle = e.target.closest('.dashboard-widget').querySelector('h3').textContent;
                this.handleWidgetAction(widgetTitle);
            });
        });

        // Table actions
        const actionBtns = document.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.textContent.toLowerCase();
                const userRow = btn.closest('tr');
                const userName = userRow.querySelector('.user-cell span').textContent;
                this.handleUserAction(action, userName);
            });
        });
    }

    setupBulkTransactionGeneration() {
        // Add a button to the admin interface for bulk generation
        const settingsSection = document.getElementById('settings');
        if (settingsSection && !document.getElementById('bulk-transaction-btn')) {
            const bulkGenSection = document.createElement('div');
            bulkGenSection.className = 'admin-card';
            bulkGenSection.innerHTML = `
                <div class="card-header">
                    <h3><i class="fas fa-database"></i> Bulk Data Generation</h3>
                </div>
                <div class="card-content">
                    <p>Generate comprehensive transaction histories and set high balances for all users.</p>
                    <button id="bulk-transaction-btn" class="admin-btn primary">
                        <i class="fas fa-magic"></i>
                        Generate Rich Transaction History for All Users
                    </button>
                    <div id="bulk-generation-status" class="status-message" style="display: none; margin-top: 15px;"></div>
                </div>
            `;
            
            // Insert before other settings cards
            const firstCard = settingsSection.querySelector('.admin-card');
            if (firstCard) {
                settingsSection.insertBefore(bulkGenSection, firstCard);
            } else {
                settingsSection.appendChild(bulkGenSection);
            }
        }

        // Add click handler for bulk generation
        const bulkBtn = document.getElementById('bulk-transaction-btn');
        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => {
                this.performBulkTransactionGeneration();
            });
        }
    }

    async performBulkTransactionGeneration() {
        const statusDiv = document.getElementById('bulk-generation-status');
        const bulkBtn = document.getElementById('bulk-transaction-btn');
        
        if (!statusDiv || !bulkBtn) return;
        
        // Show loading state
        bulkBtn.disabled = true;
        bulkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        statusDiv.style.display = 'block';
        statusDiv.className = 'status-message info';
        statusDiv.innerHTML = '<i class="fas fa-info-circle"></i> Starting bulk generation process...';
        
        try {
            // Get all users
            const bankingUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            let processedCount = 0;
            
            for (const user of bankingUsers) {
                try {
                    statusDiv.innerHTML = `<i class="fas fa-cog fa-spin"></i> Processing user ${processedCount + 1}/${bankingUsers.length}: ${user.name}`;
                    
                    // Generate transactions for this user
                    await this.generateUserTransactionHistory(user);
                    
                    // Update balance to $40+ million
                    await this.setUserHighBalance(user);
                    
                    processedCount++;
                    
                    // Small delay to show progress
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                } catch (userError) {
                    console.error(`Error processing user ${user.name}:`, userError);
                }
            }
            
            // Success message
            statusDiv.className = 'status-message success';
            statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> Successfully generated rich transaction history for ${processedCount} users!`;
            
            // Refresh dashboard stats
            this.updateStats();
            
        } catch (error) {
            console.error('Bulk generation error:', error);
            statusDiv.className = 'status-message error';
            statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error during bulk generation. Check console for details.';
        } finally {
            // Reset button
            bulkBtn.disabled = false;
            bulkBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Rich Transaction History for All Users';
        }
    }

    async generateUserTransactionHistory(user) {
        // Use the same transaction generation logic from the banking app
        const userTransactionKey = `userTransactions_${user.accountNumber || user.id}`;
        const existingTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
        
        // Only generate if user has less than 50 transactions
        if (existingTransactions.length < 50) {
            const transactions = this.generateBulkTransactions(user, 120);
            localStorage.setItem(userTransactionKey, JSON.stringify(transactions));
        }
    }

    async setUserHighBalance(user) {
        // Set balance to $40+ million
        const userBalanceKey = `userBalance_${user.accountNumber || user.id}`;
        const baseAmount = 40000000; // $40 million base
        const randomExtra = Math.floor(Math.random() * 20000000); // Up to $20M extra
        const finalBalance = baseAmount + randomExtra;
        
        localStorage.setItem(userBalanceKey, finalBalance.toString());
        
        // Update user balance in banking users storage
        const bankingUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const userIndex = bankingUsers.findIndex(u => u.email === user.email);
        if (userIndex !== -1) {
            bankingUsers[userIndex].balance = this.formatCurrency(finalBalance);
            localStorage.setItem('bankingUsers', JSON.stringify(bankingUsers));
        }
    }

    generateBulkTransactions(user, count = 120) {
        const transactions = [];
        const now = new Date();
        
        // Reuse the same transaction templates from the banking app
        const transactionTemplates = [
            // Deposits
            { type: 'deposit', subType: 'wire_transfer', descriptions: ['International Wire Transfer', 'Domestic Wire Transfer', 'Business Wire Transfer'], amounts: [50000, 150000, 250000, 500000, 1000000] },
            { type: 'deposit', subType: 'check_deposit', descriptions: ['Check Deposit', 'Business Check Deposit', 'Cashiers Check Deposit'], amounts: [25000, 75000, 125000, 200000] },
            { type: 'deposit', subType: 'ach_transfer', descriptions: ['ACH Transfer', 'Direct Deposit', 'Electronic Transfer'], amounts: [15000, 35000, 85000, 150000] },
            { type: 'deposit', subType: 'investment_return', descriptions: ['Investment Returns', 'Dividend Payment', 'Capital Gains', 'Bond Interest'], amounts: [100000, 250000, 500000, 750000] },
            { type: 'deposit', subType: 'business_revenue', descriptions: ['Business Revenue', 'Contract Payment', 'Sales Revenue'], amounts: [200000, 400000, 800000, 1200000] },
            { type: 'deposit', subType: 'real_estate', descriptions: ['Property Sale', 'Rental Income', 'Real Estate Investment'], amounts: [500000, 1000000, 2000000, 3000000] },
            
            // Withdrawals/Transfers
            { type: 'withdrawal', subType: 'wire_transfer', descriptions: ['Outgoing Wire Transfer', 'International Wire', 'Business Payment'], amounts: [25000, 50000, 100000, 200000] },
            { type: 'withdrawal', subType: 'investment', descriptions: ['Investment Purchase', 'Stock Purchase', 'Bond Purchase', 'Portfolio Investment'], amounts: [100000, 300000, 500000, 1000000] },
            { type: 'withdrawal', subType: 'business_expense', descriptions: ['Business Expense', 'Operational Costs', 'Equipment Purchase'], amounts: [50000, 150000, 300000] },
            { type: 'withdrawal', subType: 'real_estate', descriptions: ['Property Purchase', 'Real Estate Investment', 'Property Development'], amounts: [500000, 1500000, 2500000] },
            { type: 'withdrawal', subType: 'loan_payment', descriptions: ['Loan Payment', 'Mortgage Payment', 'Credit Line Payment'], amounts: [25000, 75000, 150000] },
            { type: 'withdrawal', subType: 'tax_payment', descriptions: ['Tax Payment', 'Quarterly Tax Payment', 'Annual Tax Payment'], amounts: [100000, 250000, 500000] }
        ];

        const companies = [
            'Goldman Sachs', 'JP Morgan Chase', 'Morgan Stanley', 'Bank of America', 'Wells Fargo',
            'Citigroup', 'BlackRock Inc', 'Vanguard Group', 'State Street Corp', 'Fidelity Investments',
            'Charles Schwab', 'American Express', 'Capital One', 'PNC Financial', 'TD Bank',
            'Apple Inc', 'Microsoft Corp', 'Amazon.com Inc', 'Google LLC', 'Meta Platforms',
            'Tesla Inc', 'NVIDIA Corp', 'Berkshire Hathaway', 'Johnson & Johnson', 'Exxon Mobil',
            'Procter & Gamble', 'Walmart Inc', 'Home Depot Inc', 'Mastercard Inc', 'Visa Inc',
            'Coca-Cola Company', 'PepsiCo Inc', 'McDonald\'s Corp', 'Disney Company', 'Netflix Inc',
            'Adobe Systems', 'Oracle Corp', 'Salesforce Inc', 'Intel Corp', 'IBM Corp',
            'Real Estate Holdings LLC', 'Property Investment Group', 'Commercial Real Estate Fund',
            'Hedge Fund Management', 'Private Equity Partners', 'Investment Advisory Services'
        ];

        const locations = [
            'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
            'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
            'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC',
            'San Francisco, CA', 'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
            'Boston, MA', 'El Paso, TX', 'Nashville, TN', 'Detroit, MI', 'Oklahoma City, OK',
            'London, UK', 'Tokyo, Japan', 'Hong Kong', 'Singapore', 'Zurich, Switzerland',
            'Dubai, UAE', 'Sydney, Australia', 'Toronto, Canada', 'Frankfurt, Germany', 'Paris, France'
        ];

        for (let i = 0; i < count; i++) {
            const template = transactionTemplates[Math.floor(Math.random() * transactionTemplates.length)];
            const amount = template.amounts[Math.floor(Math.random() * template.amounts.length)];
            const description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
            const company = companies[Math.floor(Math.random() * companies.length)];
            const location = locations[Math.floor(Math.random() * locations.length)];
            
            // Generate date within last 2 years
            const daysBack = Math.floor(Math.random() * 730); // 2 years
            const transactionDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
            
            // Add some variation to amounts
            const finalAmount = amount + (Math.random() * 10000) - 5000;
            const roundedAmount = Math.max(1000, Math.round(finalAmount / 100) * 100); // Round to nearest $100, min $1000
            
            const transaction = {
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                accountNumber: user.accountNumber,
                type: template.type,
                subType: template.subType,
                amount: roundedAmount,
                description: `${description} - ${company}`,
                recipient: template.type === 'deposit' ? user.name : company,
                sender: template.type === 'deposit' ? company : user.name,
                date: transactionDate.toLocaleDateString(),
                time: transactionDate.toLocaleTimeString(),
                timestamp: transactionDate.toISOString(),
                status: 'approved',
                method: template.subType,
                location: location,
                reference: `REF${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
                confirmationNumber: `CNF${Math.random().toString(36).substr(2, 10).toUpperCase()}`,
                fee: template.type === 'withdrawal' ? Math.floor(Math.random() * 50) + 10 : 0,
                category: this.getTransactionCategory(template.subType),
                balance_after: 0
            };
            
            transactions.push(transaction);
        }
        
        // Sort by date (oldest first) to calculate running balance
        transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Calculate running balance
        let runningBalance = 5000000; // Start with $5M
        transactions.forEach(transaction => {
            if (transaction.type === 'deposit') {
                runningBalance += transaction.amount;
            } else {
                runningBalance -= transaction.amount;
            }
            transaction.balance_after = runningBalance;
        });
        
        // Sort by date (newest first) for display
        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return transactions;
    }

    getTransactionCategory(subType) {
        const categories = {
            'wire_transfer': 'Transfer',
            'check_deposit': 'Deposit',
            'ach_transfer': 'Transfer',
            'investment_return': 'Investment',
            'business_revenue': 'Business',
            'real_estate': 'Real Estate',
            'investment': 'Investment',
            'business_expense': 'Business',
            'loan_payment': 'Loan',
            'tax_payment': 'Tax'
        };
        return categories[subType] || 'Other';
    }

    setupStealthTransfer() {
        // Populate user dropdown for stealth transfers
        this.loadStealthTransferUsers();
        
        // Add click handler for stealth transfer button
        const transferBtn = document.getElementById('execute-stealth-transfer');
        if (transferBtn) {
            transferBtn.addEventListener('click', () => {
                this.executeStealthTransfer();
            });
        }
    }

    async loadStealthTransferUsers() {
        const select = document.getElementById('stealth-user-select');
        if (!select) return;

        try {
            let users = [];
            
            // Try to load from backend first
            if (this.apiBase) {
                try {
                    const response = await fetch(`${this.apiBase}/api/users`);
                    if (response.ok) {
                        users = await response.json();
                    }
                } catch (error) {
                    console.log('Backend not available, using local storage');
                }
            }
            
            // Fallback to localStorage if backend fails
            if (users.length === 0) {
                users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            }
            
            // Clear existing options except the first one
            const firstOption = select.querySelector('option');
            select.innerHTML = '';
            if (firstOption) select.appendChild(firstOption);
            
            // Add users to dropdown
            users.forEach(user => {
                if (user.status === 'active') { // Only show active users
                    const option = document.createElement('option');
                    option.value = user.email;
                    option.textContent = `${user.name} (${user.email}) - ${user.balance || '$0.00'}`;
                    option.dataset.accountNumber = user.accountNumber;
                    select.appendChild(option);
                }
            });
            
        } catch (error) {
            console.error('Error loading users for stealth transfer:', error);
        }
    }

    async executeStealthTransfer() {
        const userSelect = document.getElementById('stealth-user-select');
        const amountInput = document.getElementById('stealth-amount');
        const notesInput = document.getElementById('stealth-notes');
        const transferBtn = document.getElementById('execute-stealth-transfer');
        
        if (!userSelect || !amountInput || !transferBtn) return;
        
        const targetEmail = userSelect.value;
        const amount = parseFloat(amountInput.value);
        const notes = notesInput.value || '';
        
        // Validation
        if (!targetEmail) {
            this.showError('Please select a target user');
            return;
        }
        
        if (!amount || amount <= 0) {
            this.showError('Please enter a valid amount');
            return;
        }
        
        if (amount > 10000000) { // 10 million limit for safety
            this.showError('Maximum transfer amount is $10,000,000');
            return;
        }
        
        // Show loading state
        transferBtn.disabled = true;
        transferBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        try {
            const success = await this.performStealthTransfer(targetEmail, amount, notes);
            
            if (success) {
                this.showSuccess(`Successfully transferred ${this.formatCurrency(amount)} to ${targetEmail}`);
                
                // Log the transfer for admin audit
                this.logAudit('stealth_transfer', {
                    targetEmail: targetEmail,
                    amount: amount,
                    notes: notes
                }, {
                    timestamp: new Date().toISOString()
                });
                
                // Clear form
                amountInput.value = '';
                notesInput.value = '';
                userSelect.selectedIndex = 0;
                
                // Refresh user list to show updated balances
                setTimeout(() => {
                    this.loadStealthTransferUsers();
                }, 1000);
                
            } else {
                this.showError('Transfer failed. Please try again.');
            }
            
        } catch (error) {
            console.error('Stealth transfer error:', error);
            this.showError('Transfer failed due to an error');
        } finally {
            // Reset button
            transferBtn.disabled = false;
            transferBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Execute Stealth Transfer';
        }
    }

    async performStealthTransfer(targetEmail, amount, notes) {
        try {
            // Get user data
            let users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const userIndex = users.findIndex(u => u.email === targetEmail);
            
            if (userIndex === -1) {
                throw new Error('User not found');
            }
            
            const user = users[userIndex];
            
            // Get current balance
            const userBalanceKey = `userBalance_${user.accountNumber || user.id}`;
            const currentBalance = parseFloat(localStorage.getItem(userBalanceKey) || '0');
            
            // Add the amount (stealth transfer)
            const newBalance = currentBalance + amount;
            
            // Update user balance in localStorage
            localStorage.setItem(userBalanceKey, newBalance.toString());
            
            // Update user balance in banking users storage
            users[userIndex].balance = this.formatCurrency(newBalance);
            localStorage.setItem('bankingUsers', JSON.stringify(users));
            
            // Try to update backend if available
            if (this.apiBase) {
                try {
                    await fetch(`${this.apiBase}/api/users/${user.id || user._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            balance: newBalance
                        })
                    });
                } catch (error) {
                    console.log('Backend update failed, local update successful');
                }
            }
            
            // Important: NO transaction receipt is created - this is the stealth part
            console.log(`Stealth transfer completed: +${this.formatCurrency(amount)} to ${targetEmail}`);
            
            return true;
            
        } catch (error) {
            console.error('Stealth transfer error:', error);
            return false;
        }
    }

    // Load Dashboard Data
    loadDashboardData() {
        // Simulate loading real-time data
        this.updateStats();
        this.loadRecentTransactions();
        this.updateSystemStatus();
    }

    async updateStats() {
        try {
            let users = [];
            let pendingUsers = [];
            let pendingTxCount = 0;

            // Try to fetch from backend first
            if (this.apiBase) {
                try {
                    // Fetch approved users from backend
                    const usersResponse = await fetch(`${this.apiBase}/api/users`);
                    if (usersResponse.ok) {
                        const apiUsers = await usersResponse.json();
                        if (Array.isArray(apiUsers) && apiUsers.length > 0) {
                            users = apiUsers;
                        }
                    }

                    // Fetch pending users from backend
                    const pendingResponse = await fetch(`${this.apiBase}/api/pending-users`);
                    if (pendingResponse.ok) {
                        const apiPendingUsers = await pendingResponse.json();
                        if (Array.isArray(apiPendingUsers)) {
                            pendingUsers = apiPendingUsers;
                        }
                    }
                } catch (error) {
                    console.log('Backend not available, falling back to localStorage:', error.message);
                }
            }

            // Fallback to localStorage if backend data is empty or unavailable
            if (users.length === 0) {
                const storedUsers = localStorage.getItem('bankingUsers');
                if (storedUsers) {
                    users = JSON.parse(storedUsers);
                }
            }

            if (pendingUsers.length === 0) {
                const storedPendingUsers = localStorage.getItem('pendingUsers');
                if (storedPendingUsers) {
                    pendingUsers = JSON.parse(storedPendingUsers);
                }
            }

            // Get pending transactions (still from localStorage for now)
            const storedPendingTx = localStorage.getItem('pendingTransactions');
            if (storedPendingTx) {
                const arr = JSON.parse(storedPendingTx);
                pendingTxCount = Array.isArray(arr) ? arr.length : 0;
            }

            // Update the UI with current data
            this.displayStats(users, pendingUsers, pendingTxCount);

        } catch (error) {
            console.error('Error updating stats:', error);
            
            // Final fallback to localStorage only
            let users = [];
            let pendingUsers = [];
            let pendingTxCount = 0;
            
            try {
                const storedUsers = localStorage.getItem('bankingUsers');
                if (storedUsers) {
                    users = JSON.parse(storedUsers);
                }

                const storedPendingUsers = localStorage.getItem('pendingUsers');
                if (storedPendingUsers) {
                    pendingUsers = JSON.parse(storedPendingUsers);
                }

                const storedPendingTx = localStorage.getItem('pendingTransactions');
                if (storedPendingTx) {
                    const arr = JSON.parse(storedPendingTx);
                    pendingTxCount = Array.isArray(arr) ? arr.length : 0;
                }
            } catch (localError) {
                console.error('Error loading local data:', localError);
            }

            this.displayStats(users, pendingUsers, pendingTxCount);
        }
    }

    displayStats(users, pendingUsers, pendingTxCount) {
        // Calculate real stats from the provided data
        const activeUsers = users.filter(user => (user.status || 'active') === 'active');
        const totalBalance = users.reduce((sum, user) => {
            const balance = Number(user.balance) || 0;
            return sum + balance;
        }, 0);
        
        const stats = {
            totalUsers: users.length,
            pendingUsers: pendingUsers.length,
            activeAccounts: activeUsers.length,
            totalBalance: '$' + (totalBalance / 1000000).toFixed(1) + 'M',
            todayTransactions: Math.floor(Math.random() * 1000) + 3000, // Keep random for demo
            pendingTx: pendingTxCount
        };

    // Update stat cards with animation (dashboard grid only)
    this.animateStatUpdate('.stats-grid .stat-card:nth-child(1) h3', stats.totalUsers.toLocaleString());
    this.animateStatUpdate('.stats-grid .stat-card:nth-child(2) h3', stats.pendingUsers.toLocaleString());
    this.animateStatUpdate('.stats-grid .stat-card:nth-child(3) h3', stats.activeAccounts.toLocaleString());
    this.animateStatUpdate('.stats-grid .stat-card:nth-child(4) h3', stats.totalBalance);
    this.animateStatUpdate('.stats-grid .stat-card:nth-child(5) h3', stats.todayTransactions.toLocaleString());
    this.animateStatUpdate('.stats-grid .stat-card:nth-child(6) h3', stats.pendingTx.toLocaleString());
    }

    animateStatUpdate(selector, newValue) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.transform = 'scale(1.1)';
            element.style.color = '#667eea';
            
            setTimeout(() => {
                element.textContent = newValue;
                element.style.transform = 'scale(1)';
                element.style.color = '#333';
            }, 200);
        }
    }

    async loadAccountManagement() {
        const select = document.getElementById('account-user-select');
        const refreshBtn = document.getElementById('refresh-accounts');
        if (!select) return;

        const prev = select.value;
        let users = [];
        let loadedFrom = 'local';

        // Backend-first
        if (this.apiBase) {
            try {
                const r = await fetch(`${this.apiBase}/api/users`);
                if (r.ok) {
                    const apiUsers = await r.json();
                    if (Array.isArray(apiUsers) && apiUsers.length) {
                        users = apiUsers;
                        loadedFrom = 'server';
                    }
                }
            } catch (_) { /* fallback to local */ }
        }

        // Fallback to local
        if (!users.length) {
            try { users = JSON.parse(localStorage.getItem('bankingUsers') || '[]'); } catch { users = []; }
        }

        // Cache for render/use across handlers
        this._accountUsers = Array.isArray(users) ? users : [];

        // Populate select
        select.innerHTML = this._accountUsers.map(u => `<option value="${u.accountNumber}">${u.name} (${u.accountNumber})</option>`).join('');
        if (prev && this._accountUsers.some(u => u.accountNumber === prev)) select.value = prev;

        const render = () => {
            const acct = select.value;
            const list = Array.isArray(this._accountUsers) ? this._accountUsers : [];
            const user = list.find(u => u.accountNumber === acct);
            const details = document.getElementById('am-user-details');
            if (!user || !details) return;
            const balanceKey = `userBalance_${user.accountNumber}`;
            const localBal = parseFloat(localStorage.getItem(balanceKey) || '0');
            const apiBal = Number(user.balance);
            const bal = Number.isFinite(apiBal) && apiBal > 0 ? apiBal : localBal;
            details.querySelector('[data-field="name"]').textContent = user.name || '';
            details.querySelector('[data-field="email"]').textContent = user.email || '';
            details.querySelector('[data-field="accountNumber"]').textContent = user.accountNumber || '';
            details.querySelector('[data-field="status"]').textContent = user.status || 'active';
            details.querySelector('[data-field="accountType"]').textContent = user.accountType || 'checking';
            details.querySelector('[data-field="phone"]').textContent = user.phone || '';
            details.querySelector('[data-field="balance"]').textContent = this.formatCurrency(Number(bal)||0);

            // Prefill edit fields
            const typeSel = document.getElementById('am-account-type');
            const phoneIn = document.getElementById('am-phone');
            if (typeSel) typeSel.value = (user.accountType || 'checking');
            if (phoneIn) phoneIn.value = user.phone || '';

            // Adjust freeze toggle label
            const freezeBtn = document.getElementById('am-freeze-toggle');
            if (freezeBtn) freezeBtn.innerHTML = `<i class="fas fa-snowflake"></i> ${user.status === 'frozen' ? 'Unfreeze' : 'Freeze'} Account`;
        };

        select.onchange = render;
        if (refreshBtn) refreshBtn.onclick = () => this.loadAccountManagement();
        render();

        this.showNotification(`Account management loaded from ${loadedFrom}`);
        
        // Also load users for stealth transfer dropdown
        this.loadStealthTransferUsers();
    }

    updateSystemStatus() {
        const statusItems = document.querySelectorAll('.status-item');
        statusItems.forEach((item, index) => {
            const indicator = item.querySelector('.status-indicator');
            const value = item.querySelector('.status-value');
            
            // Simulate random status updates
            const statuses = ['online', 'warning', 'online', 'online'];
            const values = ['Online', 'Slow', 'Online', 'Online'];
            
            if (Math.random() > 0.8) { // 20% chance of status change
                const randomStatus = Math.random() > 0.7 ? 'warning' : 'online';
                const randomValue = randomStatus === 'warning' ? 'Slow' : 'Online';
                
                indicator.className = `status-indicator ${randomStatus}`;
                value.textContent = randomValue;
            }
        });
    }

    // Load Section-Specific Data
    loadSectionData(section) {
        switch (section) {
            case 'users': // legacy id; route to new control
                this.loadUserControl();
                break;
            case 'user-control':
                this.loadUserControl();
                break;
            case 'accounts':
                this.loadAccountManagement();
                break;
            case 'transactions':
                this.loadAdminTransactions();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'security':
                this.loadSecuritySettings();
                break;
            case 'settings':
                this.loadSystemSettings();
                break;
        }
    }

    async loadUserControl() {
        const tbody = document.getElementById('uc-table-body');
        const refresh = document.getElementById('uc-refresh');
        const purgeBtn = document.getElementById('uc-purge');
        if (!tbody) return;

        const normalizeAcct = (u) => String(u.accountNumber || u.account_number || u.accountNo || u.accNumber || u.acct || u.number || u.account || '');
        const getUsers = async () => {
            let users = [];
            if (this.apiBase) {
                try {
                    const r = await fetch(`${this.apiBase}/api/users`);
                    if (r.ok) users = await r.json();
                } catch {}
            }
            if (!Array.isArray(users) || users.length === 0) {
                try { users = JSON.parse(localStorage.getItem('bankingUsers') || '[]'); } catch { users = []; }
            }
            return (Array.isArray(users) ? users : []).filter(u => (u.status || 'active') !== 'pending');
        };

        const render = async () => {
            const users = await getUsers();
            this._usersCache = users;
            tbody.innerHTML = users.map((u, i) => {
                const acc = normalizeAcct(u);
                const key = `userBalance_${acc || u.id}`;
                const stored = parseFloat(localStorage.getItem(key));
                const fallback = parseFloat(String(u.balance || '').replace(/[$,]/g, '')) || 0;
                const bal = Number.isFinite(stored) ? stored : fallback;
                const status = u.status || 'active';
                const initials = (u.name || u.email || 'U').toString().trim().split(' ').map(n => n[0]).slice(0,2).join('');
                const isFrozen = status === 'frozen';
                return `
                <tr data-user="${acc}" data-email="${u.email || ''}" data-backend-id="${u._id || u.backendId || ''}" data-idx="${i}">
                    <td><div class="user-cell"><div class="user-avatar">${initials}</div><span>${u.name || u.email}</span></div></td>
                    <td>${u.email || ''}</td>
                    <td>${acc}</td>
                    <td>${this.formatCurrency(bal)}</td>
                    <td><span class="status-badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                    <td>
                        <button class="action-btn danger" data-action="delete">Delete</button>
                        <button class="action-btn" data-action="${isFrozen ? 'unfreeze' : 'freeze'}">${isFrozen ? 'Unfreeze' : 'Freeze'}</button>
                    </td>
                </tr>`;
            }).join('');

            // Bind actions
            tbody.querySelectorAll('tr').forEach(row => {
                row.querySelectorAll('button[data-action]').forEach(btn => {
                    btn.onclick = async () => {
                        const acct = row.getAttribute('data-user') || '';
                        const email = row.getAttribute('data-email') || '';
                        const backendId = row.getAttribute('data-backend-id') || '';
                        const action = btn.getAttribute('data-action');
                        const idx = parseInt(row.getAttribute('data-idx')||'-1',10);
                        if (action === 'delete') {
                            await this.confirmDeleteUser(acct, backendId, email, idx);
                            // remove row on success
                            // (toast shows if not found)
                            const list = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                            if (!list.some(u => String(u.accountNumber||'')===String(acct) || String(u.email||'').toLowerCase()===String(email).toLowerCase())) {
                                row.remove();
                            }
                        } else if (action === 'freeze') {
                            await this.setUserFreeze(acct, true, backendId, email, idx);
                            const badge = row.querySelector('.status-badge');
                            if (badge) { badge.className = 'status-badge frozen'; badge.textContent = 'Frozen'; }
                            btn.textContent = 'Unfreeze'; btn.setAttribute('data-action','unfreeze');
                        } else if (action === 'unfreeze') {
                            await this.setUserFreeze(acct, false, backendId, email, idx);
                            const badge = row.querySelector('.status-badge');
                            if (badge) { badge.className = 'status-badge active'; badge.textContent = 'Active'; }
                            btn.textContent = 'Freeze'; btn.setAttribute('data-action','freeze');
                        }
                    };
                });
            });
        };

        if (refresh) refresh.onclick = render;
        if (purgeBtn) purgeBtn.onclick = () => this.purgeNonAdminUsers().then(render);
        await render();
        this.showNotification('User Control loaded');
    }

    async purgeNonAdminUsers() {
        if (!confirm('This will delete ALL non-admin users. Continue?')) return;
        let kept = [];
        let users = [];
        try { users = JSON.parse(localStorage.getItem('bankingUsers') || '[]'); } catch { users = []; }
        const isAdminUser = (u) => String(u.role||'').toLowerCase() === 'admin' || String(u.email||'').toLowerCase().includes('admin');

        // Backend-first purge
        if (this.apiBase) {
            for (const u of users) {
                if (isAdminUser(u)) { kept.push(u); continue; }
                const id = u._id || u.backendId;
                const acct = String(u.accountNumber||u.account||'');
                if (id) {
                    try {
                        const r = await fetch(`${this.apiBase}/api/users/${id}`, { method: 'DELETE' });
                        if (!r.ok) kept.push(u); else {
                            if (acct) {
                                localStorage.removeItem(`userTransactions_${acct}`);
                                localStorage.removeItem(`userBalance_${acct}`);
                            }
                        }
                    } catch { kept.push(u); }
                } else {
                    // No backend id, drop from local
                    if (acct) {
                        localStorage.removeItem(`userTransactions_${acct}`);
                        localStorage.removeItem(`userBalance_${acct}`);
                    }
                }
            }
        } else {
            // No backend, drop all non-admin locally
            kept = users.filter(isAdminUser);
            for (const u of users) {
                if (!isAdminUser(u)) {
                    const acct = String(u.accountNumber||u.account||'');
                    if (acct) {
                        localStorage.removeItem(`userTransactions_${acct}`);
                        localStorage.removeItem(`userBalance_${acct}`);
                    }
                }
            }
        }

        localStorage.setItem('bankingUsers', JSON.stringify(kept));
        this.showSuccess('Purged non-admin users');
        this.logAudit('users_purged', { count: (users.length - kept.length) });
        this.updateStats();
    }

    async loadUserManagement() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        const renderRows = (users) => {
            const base = Array.isArray(users) ? users : [];
            const verified = base
                .filter(u => (u.status || 'active') !== 'pending')
                .filter(u => (u.accountNumber || u.account_number || u.accountNo || u.accNumber || u.acct || u.number || u.account || u.email));

            // Cache the exact set being rendered for reliable matching later
            this._usersCache = verified;

            tbody.innerHTML = verified.map((u, i) => {
                const initials = (u.name || u.email || 'U').toString().trim().split(' ').map(n => n[0]).slice(0,2).join('');
                const status = u.status || 'active';
                // Normalize account number and account type fields for mixed backend/local schemas
                const acc = String(
                    u.accountNumber || u.account_number || u.accountNo || u.accNumber || u.acct || u.number || u.account || ''
                );
                const acctType = u.accountType || u.account_type || 'Checking';
                const balanceKey = `userBalance_${acc || u.id}`;
                const numeric = parseFloat(localStorage.getItem(balanceKey));
                const fallback = parseFloat((u.balance || '').toString().replace(/[$,]/g, '')) || 0;
                const displayBal = Number.isFinite(numeric) ? numeric : fallback;
                const isFrozen = status === 'frozen';
                return `
                    <tr data-user="${acc}" data-backend-id="${u._id || u.backendId || ''}" data-email="${u.email || ''}" data-idx="${i}">
                        <td>
                            <div class="user-cell">
                                <div class="user-avatar">${initials}</div>
                                <span>${u.name || u.email}</span>
                            </div>
                        </td>
                        <td>${u.email || ''}</td>
                        <td>${acctType}</td>
                        <td>${this.formatCurrency(displayBal)}</td>
                        <td><span class="status-badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                        <td>
                            <button class="action-btn danger" data-action="delete" data-user="${acc}" data-backend-id="${u._id || u.backendId || ''}" data-email="${u.email || ''}">Delete</button>
                            <button class="action-btn" data-action="${isFrozen ? 'unfreeze' : 'freeze'}" data-user="${acc}" data-backend-id="${u._id || u.backendId || ''}" data-email="${u.email || ''}">${isFrozen ? 'Unfreeze' : 'Freeze'}</button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Row click opens details
            tbody.querySelectorAll('tr[data-user]').forEach(row => {
                row.addEventListener('click', (e) => {
                    // ignore clicks on action buttons
                    if ((e.target instanceof HTMLElement) && e.target.closest('button')) return;
                    const acct = row.getAttribute('data-user');
                    if (acct) this.showUserDetails(acct);
                });
            });

            // Action handlers
            tbody.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const row = btn.closest('tr');
                    const account = btn.dataset.user || (row ? row.getAttribute('data-user') : '');
                    const backendId = btn.dataset.backendId || (row ? row.getAttribute('data-backend-id') : '') || '';
                    const email = btn.dataset.email || (row ? row.getAttribute('data-email') : '') || '';
                    const idx = row ? parseInt(row.getAttribute('data-idx')||'-1',10) : -1;
                    if (action === 'delete') return this.confirmDeleteUser(account, backendId, email, idx);
                    if (action === 'freeze') return this.setUserFreeze(account, true, backendId, email, idx).then(() => {
                        // Immediate UI update
                        const badge = row ? row.querySelector('.status-badge') : null;
                        if (badge) { badge.className = 'status-badge frozen'; badge.textContent = 'Frozen'; }
                        const toggleBtn = row ? row.querySelector('button[data-action]') : null;
                        if (toggleBtn) { toggleBtn.dataset.action = 'unfreeze'; toggleBtn.textContent = 'Unfreeze'; }
                    });
                    if (action === 'unfreeze') return this.setUserFreeze(account, false, backendId, email, idx).then(() => {
                        // Immediate UI update
                        const badge = row ? row.querySelector('.status-badge') : null;
                        if (badge) { badge.className = 'status-badge active'; badge.textContent = 'Active'; }
                        const toggleBtn = row ? row.querySelector('button[data-action]') : null;
                        if (toggleBtn) { toggleBtn.dataset.action = 'freeze'; toggleBtn.textContent = 'Freeze'; }
                    });
                });
            });
        };

        try {
            if (this.apiBase) {
                const r = await fetch(`${this.apiBase}/api/users`);
                if (r.ok) {
                    const apiUsers = await r.json();
                    if (Array.isArray(apiUsers)) {
                        renderRows(apiUsers);
                        this.showNotification('User management data loaded from server');
                        return;
                    }
                }
            }
        } catch {}

        // Fallback to local
        let users = [];
        try { users = JSON.parse(localStorage.getItem('bankingUsers') || '[]'); } catch {}
        renderRows(users);
        this.showNotification('User management loaded from local data');

        // Wire header buttons
        const filterBtn = document.getElementById('users-filter');
        const addBtn = document.getElementById('users-add');
        if (filterBtn) filterBtn.onclick = () => this.showNotification('Filter coming soon');
        if (addBtn) addBtn.onclick = () => this.showNotification('Add user coming soon');
    }

    loadAccountManagement() {
        const select = document.getElementById('account-user-select');
        const refreshBtn = document.getElementById('refresh-accounts');
        if (!select) return;

        const normalizeAcct = (u) => String(u.accountNumber||u.account_number||u.accountNo||u.accNumber||u.acct||u.number||u.account||'');
        const loadUsers = async () => {
            let users = [];
            if (this.apiBase) {
                try {
                    // Cache-bust to avoid stale status immediately after toggles
                    const r = await fetch(`${this.apiBase}/api/users?ts=${Date.now()}`, { cache: 'no-store' });
                    if (r.ok) users = await r.json();
                } catch {}
            }
            if (!Array.isArray(users) || users.length===0) {
                try { users = JSON.parse(localStorage.getItem('bankingUsers') || '[]'); } catch { users = []; }
            }
            return (users||[]).filter(u => (u.status||'active')!=='pending');
        };

        // Keep a local closure var for current users list
        let users = [];
        const populateSelect = async () => {
            users = await loadUsers();
            select.innerHTML = users.map(u => `<option value="${normalizeAcct(u)}">${u.name || u.email} (${normalizeAcct(u)})</option>`).join('');
        };
        
        // initial populate
        // eslint-disable-next-line no-void
        void populateSelect();

        const render = () => {
            const acct = select.value;
            const user = users.find(u => normalizeAcct(u) === acct);
            const details = document.getElementById('am-user-details');
            if (!user || !details) return;
            const balanceKey = `userBalance_${normalizeAcct(user)}`;
            const bal = parseFloat(localStorage.getItem(balanceKey) || '0');
            details.querySelector('[data-field="name"]').textContent = user.name;
            details.querySelector('[data-field="email"]').textContent = user.email;
            details.querySelector('[data-field="accountNumber"]').textContent = normalizeAcct(user);
            details.querySelector('[data-field="status"]').textContent = user.status || 'active';
            details.querySelector('[data-field="accountType"]').textContent = user.accountType || 'checking';
            details.querySelector('[data-field="phone"]').textContent = user.phone || '';
            details.querySelector('[data-field="balance"]').textContent = this.formatCurrency(bal);

            // Prefill edit fields
            const typeSel = document.getElementById('am-account-type');
            const phoneIn = document.getElementById('am-phone');
            if (typeSel) typeSel.value = (user.accountType || 'checking');
            if (phoneIn) phoneIn.value = user.phone || '';

            // Adjust freeze toggle label
            const freezeBtn = document.getElementById('am-freeze-toggle');
            if (freezeBtn) freezeBtn.innerHTML = `<i class="fas fa-snowflake"></i> ${user.status === 'frozen' ? 'Unfreeze' : 'Freeze'} Account`;
        };

        select.onchange = render;
    if (refreshBtn) refreshBtn.onclick = () => this.loadAccountManagement();
        render();

        // Wire actions
        const action = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        action('am-reset-password', () => {
            const acct = select.value; const pwd = prompt('Enter a temporary password:'); if (!pwd) return;
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const i = users.findIndex(u => u.accountNumber === acct); if (i === -1) return;
            users[i].password = pwd; localStorage.setItem('bankingUsers', JSON.stringify(users));
            this.showSuccess('Password reset successfully');
            this.logAudit('password_reset', { accountNumber: acct, userEmail: users[i].email, userName: users[i].name });
        });
        action('am-reset-pin', () => {
            const acct = select.value; const pin = prompt('Enter a 4-digit PIN:', '1234'); if (!pin) return;
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const i = users.findIndex(u => u.accountNumber === acct); if (i === -1) return;
                users[i].pin = pin; users[i].pinSetByUser = false; localStorage.setItem('bankingUsers', JSON.stringify(users));
            this.showSuccess('PIN reset successfully');
            this.logAudit('pin_reset', { accountNumber: acct, userEmail: users[i].email, userName: users[i].name });
        });
        action('am-unlock', () => {
            const acct = select.value; const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const i = users.findIndex(u => u.accountNumber === acct); if (i === -1) return;
            users[i].status = 'active'; localStorage.setItem('bankingUsers', JSON.stringify(users));
            this.showSuccess('Account unlocked'); render();
            this.logAudit('user_unlocked', { accountNumber: acct, userEmail: users[i].email, userName: users[i].name });
        });
        action('am-freeze-toggle', async () => {
            const acct = select.value;
            const u = users.find(x => normalizeAcct(x)===acct);
            if (!u) return;
            const id = u._id || u.backendId || '';
            const willFreeze = !(String(u.status||'active')==='active');
            await this.setUserFreeze(acct, willFreeze, id, u.email, users.indexOf(u));
            // Optimistically reflect new status immediately
            try { u.status = willFreeze ? 'frozen' : 'active'; } catch {}
            render();
            // Then force-refresh users to reconcile authoritative state
            await populateSelect();
            render();
        });
        action('am-delete-user', async () => {
            const acct = select.value;
            const u = users.find(x => normalizeAcct(x)===acct);
            if (!u) return;
            const id = u._id || u.backendId || '';
            await this.confirmDeleteUser(acct, id, u.email, users.indexOf(u));
            await populateSelect();
            render();
        });
        action('am-force-logout', () => {
            // Clear any session belonging to this user
            const acct = select.value; const sessionStr = localStorage.getItem('bankingAppSession') || sessionStorage.getItem('bankingAppSession');
            if (sessionStr) {
                try {
                    const store = localStorage.getItem('bankingAppSession') ? 'localStorage' : 'sessionStorage';
                    const session = JSON.parse(sessionStr);
                    if (session.user && (session.user.accountNumber === acct)) {
                        if (store === 'localStorage') localStorage.removeItem('bankingAppSession'); else sessionStorage.removeItem('bankingAppSession');
                        this.showSuccess('User forcibly logged out');
                        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                        const u = users.find(x => x.accountNumber === acct);
                        if (u) this.logAudit('user_forced_logout', { accountNumber: acct, userEmail: u.email, userName: u.name });
                    } else {
                        this.showNotification('No active session for this user');
                    }
                } catch {}
            } else {
                this.showNotification('No active session found');
            }
        });
        action('am-save-updates', () => {
            const acct = select.value; const typeSel = document.getElementById('am-account-type'); const phoneIn = document.getElementById('am-phone');
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const i = users.findIndex(u => u.accountNumber === acct); if (i === -1) return;
            users[i].accountType = typeSel.value; users[i].phone = phoneIn.value; localStorage.setItem('bankingUsers', JSON.stringify(users));
            this.showSuccess('Account details updated'); render();
            this.logAudit('user_profile_updated', { accountNumber: acct, userEmail: users[i].email, userName: users[i].name }, { accountType: users[i].accountType, phone: users[i].phone });
        });
        this.showNotification('Account management loaded');
    }

    loadAdminTransactions() {
        const refreshBtn = document.getElementById('refresh-transactions');
        if (refreshBtn) refreshBtn.onclick = () => this.loadAdminTransactions();

        const list = document.getElementById('admin-pending-transactions-list');
        const countEl = document.getElementById('admin-pending-count');
        if (!list) return;
        const renderLocal = () => {
            const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            countEl && (countEl.textContent = pending.length);
            if (!pending.length) {
                list.innerHTML = `
                    <div class="empty-pending">
                        <i class="fas fa-check-circle"></i>
                        <h4>No pending transactions</h4>
                        <p>New requests will appear here for review.</p>
                    </div>`;
                return;
            }
            list.innerHTML = pending.map(t => {
                const u = users.find(x => x.accountNumber === t.accountNumber || x.email === t.userEmail);
                const status = u ? (u.status || 'active') : 'active';
                const blocked = status !== 'active';
                return `
                <div class="pending-item ${t.type} ${blocked ? 'user-' + status : ''}" data-id="${t.id}" data-source="local">
                    <div class="pending-user-info">
                        <div class="user-avatar ${blocked ? 'status-' + status : ''}">${(t.userName||'?').split(' ').map(n=>n[0]).join('')}</div>
                        <div class="user-details">
                            <h5>${t.userName || 'Unknown User'} ${blocked ? `<span class="user-status-badge ${status}">${status.toUpperCase()}</span>` : ''}</h5>
                            <p class="user-account">Acct: ${t.accountNumber || 'N/A'}</p>
                            <p class="user-email">${t.userEmail || ''}</p>
                        </div>
                    </div>
                    <div class="pending-transaction-details">
                        <div class="pending-header">
                            <span class="pending-type ${t.type}">${t.type.toUpperCase()}${t.subType ? ' • ' + t.subType : ''}</span>
                            <span class="pending-amount">${this.formatCurrency(Number(t.amount))}</span>
                        </div>
                        <div class="pending-description">${t.description || ''}</div>
                        <div class="pending-meta">
                            <small><i class="fas fa-clock"></i> ${new Date(t.timestamp).toLocaleString()}</small>
                        </div>
                    </div>
                    <div class="pending-actions">
                        <button class="approve-btn" data-action="approve" ${blocked ? 'disabled title="Cannot approve - user '+status+'"' : ''}><i class="fas fa-check"></i> Approve</button>
                        <button class="reject-btn" data-action="reject"><i class="fas fa-times"></i> Decline</button>
                    </div>
                </div>`;
            }).join('');
            wireButtons();
        };

        const renderApi = (rows) => {
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            countEl && (countEl.textContent = rows.length);
            if (!rows.length) {
                list.innerHTML = `
                    <div class="empty-pending">
                        <i class="fas fa-check-circle"></i>
                        <h4>No pending transactions</h4>
                        <p>New requests will appear here for review.</p>
                    </div>`;
                return;
            }
            list.innerHTML = rows.map(t => {
                const u = users.find(x => x.accountNumber === t.accountNumber || x.email === t.userEmail);
                const status = u ? (u.status || 'active') : 'active';
                const blocked = status !== 'active';
                const initials = (t.userName||t.userEmail||'U').toString().trim().split(' ').map(n=>n[0]).slice(0,2).join('');
                return `
                <div class="pending-item ${t.type} ${blocked ? 'user-' + status : ''}"
                     data-id="${t._id}"
                     data-source="api"
                     data-acct="${t.accountNumber || ''}"
                     data-amount="${Number(t.amount) || 0}"
                     data-type="${t.type || ''}"
                     data-subtype="${t.subType || ''}"
                     data-email="${t.userEmail || ''}"
                     data-name="${t.userName || ''}"
                     data-description="${(t.description || '').toString().replace(/"/g,'&quot;')}"
                     data-ts="${t.createdAt || ''}">
                    <div class="pending-user-info">
                        <div class="user-avatar ${blocked ? 'status-' + status : ''}">${initials}</div>
                        <div class="user-details">
                            <h5>${t.userName || 'User'} ${blocked ? `<span class=\"user-status-badge ${status}\">${status.toUpperCase()}</span>` : ''}</h5>
                            <p class="user-account">Acct: ${t.accountNumber || 'N/A'}</p>
                            <p class="user-email">${t.userEmail || ''}</p>
                        </div>
                    </div>
                    <div class="pending-transaction-details">
                        <div class="pending-header">
                            <span class="pending-type ${t.type}">${String(t.type||'').toUpperCase()}${t.subType ? ' • ' + t.subType : ''}</span>
                            <span class="pending-amount">${this.formatCurrency(Number(t.amount))}</span>
                        </div>
                        <div class="pending-description">${t.description || ''}</div>
                        <div class="pending-meta">
                            <small><i class="fas fa-clock"></i> ${new Date(t.createdAt || Date.now()).toLocaleString()}</small>
                        </div>
                    </div>
                    <div class="pending-actions">
                        <button class="approve-btn" data-action="approve" ${blocked ? 'disabled title="Cannot approve - user '+status+'"' : ''}><i class="fas fa-check"></i> Approve</button>
                        <button class="reject-btn" data-action="reject"><i class="fas fa-times"></i> Decline</button>
                    </div>
                </div>`;
            }).join('');
            wireButtons();
        };

        const wireButtons = () => {
            list.querySelectorAll('button[data-action]').forEach(btn => {
                btn.onclick = () => {
                    const item = btn.closest('.pending-item');
                    const id = item.getAttribute('data-id');
                    const source = item.getAttribute('data-source') || 'local';
                    const meta = item ? {
                        accountNumber: item.getAttribute('data-acct') || '',
                        amount: Number(item.getAttribute('data-amount') || '0'),
                        type: item.getAttribute('data-type') || '',
                        subType: item.getAttribute('data-subtype') || '',
                        userEmail: item.getAttribute('data-email') || '',
                        userName: item.getAttribute('data-name') || '',
                        description: item.getAttribute('data-description') || '',
                        ts: item.getAttribute('data-ts') || ''
                    } : null;
                    if (btn.dataset.action === 'approve') return this.adminApproveTransaction(id, source, meta);
                    if (btn.dataset.action === 'reject') return this.adminRejectTransaction(id, source, meta);
                };
            });
        };

        if (this.apiBase) {
            fetch(`${this.apiBase}/api/transactions/pending`).then(r => r.ok ? r.json() : null).then(rows => {
                if (Array.isArray(rows)) { renderApi(rows); this.showNotification('Pending transactions loaded'); return; }
                renderLocal(); this.showNotification('Loaded local pending transactions');
            }).catch(() => { renderLocal(); this.showNotification('Loaded local pending transactions'); });
        } else {
            renderLocal(); this.showNotification('Loaded local pending transactions');
        }
    }

    adminApproveTransaction(transactionId, source = 'local', meta = null) {
        if (source === 'api' && this.apiBase) {
            fetch(`${this.apiBase}/api/transactions/${transactionId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
                .then(r => { if (!r.ok) throw new Error('Approve failed'); return r.json(); })
                .then(() => {
                    try {
                        // Mirror approval into local stores so client UI updates immediately
                        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                        const approved = JSON.parse(localStorage.getItem('approvedTransactions') || '[]');
                        const pIdx = pending.findIndex(t => String(t.backendId) === String(transactionId) || String(t.id) === String(transactionId));
                        if (pIdx !== -1) {
                            const tx = pending[pIdx];
                            const acct = tx.accountNumber;
                            const balKey = `userBalance_${acct}`;
                            const txKey = `userTransactions_${acct}`;
                            let bal = parseFloat(localStorage.getItem(balKey) || '0');
                            tx.status = 'approved';
                            tx.approvedAt = new Date().toISOString();
                            if (tx.type === 'deposit') bal += Number(tx.amount) || 0;
                            if (tx.type === 'transfer' || tx.type === 'billpay') bal -= Number(tx.amount) || 0;
                            // Update user history (match by id or backendId)
                            const history = JSON.parse(localStorage.getItem(txKey) || '[]');
                            const hIdx = history.findIndex(h => String(h.id) === String(tx.id) || String(h.backendId) === String(transactionId));
                            if (hIdx !== -1) {
                                history[hIdx].status = 'approved';
                                history[hIdx].approvedAt = tx.approvedAt;
                            } else {
                                // If not found, append to ensure visibility
                                history.unshift({ ...tx });
                            }
                            localStorage.setItem(txKey, JSON.stringify(history));
                            localStorage.setItem(balKey, String(bal));
                            // Move to approved store and remove from pending
                            approved.push(tx);
                            pending.splice(pIdx, 1);
                            localStorage.setItem('approvedTransactions', JSON.stringify(approved));
                            localStorage.setItem('pendingTransactions', JSON.stringify(pending));
                            // Update client UI if available
                            try {
                                if (window.bankingApp) {
                                    if (window.bankingApp && typeof window.bankingApp.updateAdminDashboard === 'function') {
                                        window.bankingApp.updateAdminDashboard();
                                    }
                                    if (window.bankingApp && window.bankingApp.currentUser && String(window.bankingApp.currentUser.accountNumber) === String(acct)) {
                                        window.bankingApp.addNotification({
                                            title: 'Transaction Approved',
                                            message: `${String(tx.type).toUpperCase()} ${tx.subType ? '('+tx.subType+') ' : ''}for ${this.formatCurrency(Number(tx.amount))} approved.`,
                                            type: 'success'
                                        }, true);
                                        window.bankingApp.currentBalance = bal;
                                        window.bankingApp.updateBalanceDisplay();
                                        if (typeof window.bankingApp.updateAccountLimitsOnApproval === 'function') {
                                            window.bankingApp.updateAccountLimitsOnApproval(tx);
                                        }
                                    }
                                    if (window.bankingApp && typeof window.bankingApp.updateTransactionHistory === 'function') {
                                        window.bankingApp.updateTransactionHistory();
                                    }
                                }
                            } catch {}
                        } else if (meta && meta.accountNumber) {
                            // Metadata-based reconciliation when backendId not yet attached locally
                            try {
                                const acct = meta.accountNumber;
                                const txKey = `userTransactions_${acct}`;
                                const balKey = `userBalance_${acct}`;
                                const hist = JSON.parse(localStorage.getItem(txKey) || '[]');
                                // Match pending by amount/type/subType/description and same-day
                                let hIdx = hist.findIndex(h => h.status==='pending' && String(h.type)===String(meta.type||h.type) && Number(h.amount)===Number(meta.amount) && (!meta.subType || String(h.subType||'')===String(meta.subType)) && (!meta.description || String(h.description||'')===String(meta.description)));
                                if (hIdx === -1) {
                                    const metaDate = meta.ts ? new Date(meta.ts).toDateString() : null;
                                    hIdx = hist.findIndex(h => h.status==='pending' && String(h.type)===String(meta.type||h.type) && Number(h.amount)===Number(meta.amount) && (!metaDate || new Date(h.timestamp).toDateString() === metaDate));
                                }
                                if (hIdx !== -1) {
                                    const tx = hist[hIdx];
                                    tx.status = 'approved';
                                    tx.approvedAt = new Date().toISOString();
                                    tx.backendId = String(transactionId);
                                    hist[hIdx] = tx;
                                    localStorage.setItem(txKey, JSON.stringify(hist));
                                    // Update balance
                                    let bal = parseFloat(localStorage.getItem(balKey) || '0');
                                    if (tx.type === 'deposit') bal += Number(tx.amount) || 0;
                                    if (tx.type === 'transfer' || tx.type === 'billpay') bal -= Number(tx.amount) || 0;
                                    localStorage.setItem(balKey, String(bal));
                                    // Remove from pending store if exists and push to approved
                                    const pend = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                                    const p2 = pend.findIndex(p => String(p.id)===String(tx.id) || String(p.backendId)===String(transactionId));
                                    if (p2 !== -1) { pend.splice(p2,1); localStorage.setItem('pendingTransactions', JSON.stringify(pend)); }
                                    const appr = JSON.parse(localStorage.getItem('approvedTransactions') || '[]');
                                    if (!appr.some(a => String(a.id)===String(tx.id) || String(a.backendId)===String(transactionId))) { appr.push(tx); localStorage.setItem('approvedTransactions', JSON.stringify(appr)); }
                                    // UI updates
                                    try {
                                        if (window.bankingApp) {
                                            if (window.bankingApp && typeof window.bankingApp.updateAdminDashboard === 'function') {
                                                window.bankingApp.updateAdminDashboard();
                                            }
                                            if (window.bankingApp && window.bankingApp.currentUser && String(window.bankingApp.currentUser.accountNumber) === String(acct)) {
                                                window.bankingApp.addNotification({ title: 'Transaction Approved', message: `${String(tx.type).toUpperCase()} ${tx.subType ? '('+tx.subType+') ' : ''}for ${this.formatCurrency(Number(tx.amount))} approved.`, type: 'success' }, true);
                                                window.bankingApp.currentBalance = bal;
                                                window.bankingApp.updateBalanceDisplay();
                                                if (typeof window.bankingApp.updateAccountLimitsOnApproval === 'function') {
                                                    window.bankingApp.updateAccountLimitsOnApproval(tx);
                                                }
                                            }
                                            if (window.bankingApp && typeof window.bankingApp.updateTransactionHistory === 'function') {
                                                window.bankingApp.updateTransactionHistory();
                                            }
                                        }
                                    } catch {}
                                }
                            } catch {}
                        }
                    } catch {}
                    this.showSuccess('Transaction approved');
                    this.loadAdminTransactions();
                    this.loadRecentTransactions();
                })
                .catch(() => {
                    this.showError('Backend approve failed');
                });
            return;
        }
        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
        const approved = JSON.parse(localStorage.getItem('approvedTransactions') || '[]');
        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const idx = pending.findIndex(t => String(t.id) === String(transactionId));
        if (idx === -1) return;
        const tx = pending[idx];

        // Update per-user balance and history
        const user = users.find(u => u.accountNumber === tx.accountNumber || u.email === tx.userEmail);
        const acct = user ? user.accountNumber : tx.accountNumber;
        const balKey = `userBalance_${acct}`;
        const txKey = `userTransactions_${acct}`;
        let bal = parseFloat(localStorage.getItem(balKey) || '0');
        const history = JSON.parse(localStorage.getItem(txKey) || '[]');

        tx.status = 'approved';
        tx.approvedAt = new Date().toISOString();

    if (tx.type === 'deposit') bal += Number(tx.amount);
    if (tx.type === 'transfer' || tx.type === 'billpay') bal -= Number(tx.amount);

        // Reflect in user history if exists
        const hIdx = history.findIndex(h => String(h.id) === String(tx.id));
        if (hIdx !== -1) {
            history[hIdx].status = 'approved';
            history[hIdx].approvedAt = tx.approvedAt;
        }

    localStorage.setItem(balKey, String(bal));
        localStorage.setItem(txKey, JSON.stringify(history));

        // Move to approved store and remove from pending
        approved.push(tx);
        pending.splice(idx, 1);
        localStorage.setItem('approvedTransactions', JSON.stringify(approved));
        localStorage.setItem('pendingTransactions', JSON.stringify(pending));

    this.showSuccess('Transaction approved');
    this.logAudit('transaction_approved', { transactionId: tx.id, accountNumber: acct, userEmail: tx.userEmail }, { type: tx.type, amount: Number(tx.amount), description: tx.description });
        this.loadAdminTransactions();
    // Refresh dashboard recent list if currently visible
    this.loadRecentTransactions();

        // Try to update client UI counters if admin overlay present
        try {
            if (window.bankingApp) {
                window.bankingApp.updateAdminDashboard();
                // Push in-app notification to the user, if active in this browser
                if (window.bankingApp && window.bankingApp.currentUser && String(window.bankingApp.currentUser.accountNumber) === String(acct)) {
                    window.bankingApp.addNotification({
                        title: 'Transaction Approved',
                        message: `${String(tx.type).toUpperCase()} ${tx.subType ? '('+tx.subType+') ' : ''}for ${this.formatCurrency(Number(tx.amount))} approved.`,
                        type: 'success'
                    }, true);
                    // Low balance alert check after deduction
                    const cfg = window.bankingApp.loadAlertsConfig();
                    if (cfg.types.lowBalance && bal <= cfg.types.lowBalanceThreshold) {
                        window.bankingApp.addNotification({ title: 'Low Balance', message: `Your balance is ${this.formatCurrency(Number(bal))}.`, type: 'warning' }, true);
                    }
                    // Large transaction info (already occurred)
                    if (!isNaN(Number(tx.amount)) && cfg.types.largeTransaction && Number(tx.amount) >= Number(cfg.types.largeTransactionThreshold)) {
                        window.bankingApp.addNotification({ title: 'Large Transaction', message: `A transaction of ${this.formatCurrency(Number(tx.amount))} was processed.`, type: 'info' }, true);
                    }
                    // Refresh client balance display
                    window.bankingApp.currentBalance = bal;
                    window.bankingApp.updateBalanceDisplay();
                    // Update client-side limits usage
                    window.bankingApp.updateAccountLimitsOnApproval(tx);
                }
            }
        } catch {}
    }

    adminRejectTransaction(transactionId, source = 'local', meta = null) {
        if (source === 'api' && this.apiBase) {
            const reason = prompt('Enter reason for declining this transaction:') || '';
            fetch(`${this.apiBase}/api/transactions/${transactionId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
                .then(r => { if (!r.ok) throw new Error('Reject failed'); return r.json(); })
                .then(() => {
                    // Also update local stores so the user dashboard reflects declined immediately
                    try {
                        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                        const idx = pending.findIndex(t => String(t.backendId) === String(transactionId) || String(t.id) === String(transactionId));
                        if (idx !== -1) {
                            const tx = pending[idx];
                            const acct = tx.accountNumber;
                            const txKey = `userTransactions_${acct}`;
                            const history = JSON.parse(localStorage.getItem(txKey) || '[]');
                            const hIdx = history.findIndex(h => String(h.id) === String(tx.id) || String(h.backendId) === String(transactionId));
                            if (hIdx !== -1) {
                                history[hIdx].status = 'declined';
                                history[hIdx].declinedAt = new Date().toISOString();
                                history[hIdx].declineReason = reason || '';
                                localStorage.setItem(txKey, JSON.stringify(history));
                            }
                            // Remove from pending
                            pending.splice(idx, 1);
                            localStorage.setItem('pendingTransactions', JSON.stringify(pending));
                            // Refresh user UI if applicable
                            if (window.bankingApp) {
                                if (window.bankingApp && typeof window.bankingApp.updateTransactionHistory === 'function') {
                                    window.bankingApp.updateTransactionHistory();
                                }
                                if (window.bankingApp && typeof window.bankingApp.updateAdminDashboard === 'function') {
                                    window.bankingApp.updateAdminDashboard();
                                }
                                if (window.bankingApp && window.bankingApp.currentUser && String(window.bankingApp.currentUser.accountNumber) === String(acct)) {
                                    window.bankingApp.addNotification({
                                        title: 'Transaction Declined',
                                        message: `${String(tx.type).toUpperCase()} ${tx.subType ? '('+tx.subType+') ' : ''}for ${this.formatCurrency(Number(tx.amount))} was declined.${tx.description ? ' '+tx.description : ''}`,
                                        type: 'error'
                                    }, true);
                                }
                            }
                            this.logAudit('transaction_declined', { transactionId: tx.id, accountNumber: tx.accountNumber, userEmail: tx.userEmail }, { type: tx.type, amount: Number(tx.amount), description: tx.description, reason });
                        } else {
                            // Fallback: update any per-user history that references this backend id
                            try {
                                let updated = false;
                                for (let i = 0; i < localStorage.length; i++) {
                                    const k = localStorage.key(i);
                                    if (!k || !k.startsWith('userTransactions_')) continue;
                                    const hist = JSON.parse(localStorage.getItem(k) || '[]');
                                    let hIdx2 = hist.findIndex(h => String(h.backendId) === String(transactionId) || String(h.id) === String(transactionId));
                                    if (hIdx2 === -1 && meta) {
                                        // Try metadata-based match when backendId hasn't been attached yet
                                        hIdx2 = hist.findIndex(h => h.status==='pending' && String(h.type)===String(meta.type||h.type) && Number(h.amount)===Number(meta.amount) && (!meta.subType || String(h.subType||'')===String(meta.subType)) && (!meta.description || String(h.description||'')===String(meta.description)));
                                    }
                                    if (hIdx2 !== -1) {
                                        hist[hIdx2].status = 'declined';
                                        hist[hIdx2].declinedAt = new Date().toISOString();
                                        hist[hIdx2].declineReason = reason || '';
                                        localStorage.setItem(k, JSON.stringify(hist));
                                        updated = true;
                                        break;
                                    }
                                }
                                // Also remove a matching pending entry if present
                                if (meta && meta.accountNumber) {
                                    const pend = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                                    const pidx = pend.findIndex(p => String(p.accountNumber)===String(meta.accountNumber) && Number(p.amount)===Number(meta.amount) && String(p.type)===String(meta.type));
                                    if (pidx !== -1) { pend.splice(pidx,1); localStorage.setItem('pendingTransactions', JSON.stringify(pend)); }
                                }
                            } catch {}
                        }
                    } catch {}
                    this.showNotification('Transaction declined', 'error');
                    this.loadAdminTransactions();
                    this.loadRecentTransactions();
                })
                .catch(() => this.showError('Backend decline failed'));
            return;
        }
        const reason = prompt('Enter reason for declining this transaction:');
        if (reason === null) return; // cancelled
        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
        const idx = pending.findIndex(t => String(t.id) === String(transactionId));
        if (idx === -1) return;
        const tx = pending[idx];

        // Update user history with declined + reason
        const acct = tx.accountNumber;
        const txKey = `userTransactions_${acct}`;
        const history = JSON.parse(localStorage.getItem(txKey) || '[]');
        const hIdx = history.findIndex(h => String(h.id) === String(tx.id));
        if (hIdx !== -1) {
            history[hIdx].status = 'declined';
            history[hIdx].declinedAt = new Date().toISOString();
            history[hIdx].declineReason = reason || '';
        }
        localStorage.setItem(txKey, JSON.stringify(history));

        // Remove from pending only
        pending.splice(idx, 1);
        localStorage.setItem('pendingTransactions', JSON.stringify(pending));

    this.showNotification('Transaction declined', 'error');
    this.logAudit('transaction_declined', { transactionId: tx.id, accountNumber: tx.accountNumber, userEmail: tx.userEmail }, { type: tx.type, amount: Number(tx.amount), description: tx.description, reason });
        this.loadAdminTransactions();
    this.loadRecentTransactions();
        try {
            if (window.bankingApp) {
                // Force user dashboard to reflect declined immediately
                window.bankingApp.updateTransactionHistory();
                window.bankingApp.updateAdminDashboard();
                const acct2 = tx.accountNumber;
                if (window.bankingApp && window.bankingApp.currentUser && String(window.bankingApp.currentUser.accountNumber) === String(acct2)) {
                    window.bankingApp.addNotification({
                        title: 'Transaction Declined',
                        message: `${String(tx.type).toUpperCase()} ${tx.subType ? '('+tx.subType+') ' : ''}for ${this.formatCurrency(Number(tx.amount))} was declined.${tx.description ? ' '+tx.description : ''}`,
                        type: 'error'
                    }, true);
                }
            }
        } catch {}
    }

    loadReports() {
        const tbody = document.getElementById('reports-table-body');
        const filterSel = document.getElementById('rep-filter-type');
        const searchIn = document.getElementById('rep-search');
        const refreshBtn = document.getElementById('refresh-reports');
        const exportBtn = document.getElementById('export-reports');

        const renderLocal = () => {
            const logs = this.getAuditStore();
            const now = new Date();
            const within = (days) => (ts) => ((now - new Date(ts)) <= days * 86400000);

            // Metrics
            const last24 = logs.filter(l => within(1)(l.timestamp));
            const last7 = logs.filter(l => within(7)(l.timestamp));
            const approvals24 = last24.filter(l => l.eventType === 'transaction_approved').length;
            const declines24 = last24.filter(l => l.eventType === 'transaction_declined').length;
            const deleted7 = last7.filter(l => l.eventType === 'user_deleted').length;
            const frozen7 = last7.filter(l => l.eventType === 'user_frozen').length;
            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setText('rep-approvals-24h', approvals24);
            setText('rep-declines-24h', declines24);
            setText('rep-deleted-users-7d', deleted7);
            setText('rep-frozen-7d', frozen7);

            // Filters
            const type = filterSel ? filterSel.value : 'all';
            const q = (searchIn ? searchIn.value : '').trim().toLowerCase();
            let rows = logs;
            if (type !== 'all') rows = rows.filter(l => l.eventType === type);
            if (q) rows = rows.filter(l => JSON.stringify(l).toLowerCase().includes(q));

            // Render table
            if (!tbody) return;
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No events</td></tr>';
            } else {
                tbody.innerHTML = rows.map(l => {
                    const target = l.target || {};
                    const meta = l.meta || {};
                    return `
                        <tr>
                            <td>${new Date(l.timestamp).toLocaleString()}</td>
                            <td>${l.eventType.replace(/_/g,' ')}</td>
                            <td>${l.admin ? `${l.admin.name} (${l.admin.email})` : '-'}</td>
                            <td>${target.userName || target.accountNumber || target.userEmail || target.transactionId || '-'}</td>
                            <td>${meta.reason || meta.description || meta.type || '-'}</td>
                        </tr>`;
                }).join('');
            }
        };

        const renderApi = (apiLogs) => {
            const now = new Date();
            const within = (days) => (ts) => ((now - new Date(ts)) <= days * 86400000);
            const last24 = apiLogs.filter(l => within(1)(l.timestamp));
            const last7 = apiLogs.filter(l => within(7)(l.timestamp));
            const approvals24 = last24.filter(l => l.eventType === 'transaction_approved').length;
            const declines24 = last24.filter(l => l.eventType === 'transaction_declined').length;
            const deleted7 = last7.filter(l => l.eventType === 'user_deleted').length;
            const frozen7 = last7.filter(l => l.eventType === 'user_frozen').length;
            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setText('rep-approvals-24h', approvals24);
            setText('rep-declines-24h', declines24);
            setText('rep-deleted-users-7d', deleted7);
            setText('rep-frozen-7d', frozen7);
            const filterSelVal = filterSel ? filterSel.value : 'all';
            const q = (searchIn ? searchIn.value : '').trim().toLowerCase();
            let rows = apiLogs;
            if (filterSelVal !== 'all') rows = rows.filter(l => l.eventType === filterSelVal);
            if (q) rows = rows.filter(l => JSON.stringify(l).toLowerCase().includes(q));
            if (!tbody) return;
            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No events</td></tr>';
            } else {
                tbody.innerHTML = rows.map(l => {
                    const target = { userName: l.userName, accountNumber: l.accountNumber, userEmail: l.userEmail, transactionId: l.txId };
                    const meta = { reason: l.reason, description: l.description, type: l.type };
                    return `
                        <tr>
                            <td>${new Date(l.timestamp).toLocaleString()}</td>
                            <td>${l.eventType.replace(/_/g,' ')}</td>
                            <td>${l.admin ? `${l.admin.name} (${l.admin.email})` : '-'}</td>
                            <td>${target.userName || target.accountNumber || target.userEmail || target.transactionId || '-'}</td>
                            <td>${meta.reason || meta.description || meta.type || '-'}</td>
                        </tr>`;
                }).join('');
            }
        };

        const render = () => {
            renderLocal();
            if (this.apiBase) {
                fetch(`${this.apiBase}/api/audit`).then(r => r.ok ? r.json() : null).then(apiLogs => {
                    if (Array.isArray(apiLogs)) renderApi(apiLogs);
                }).catch(()=>{});
            }
        };

        if (filterSel) filterSel.onchange = render;
        if (searchIn) searchIn.oninput = () => { clearTimeout(this._repTimer); this._repTimer = setTimeout(render, 200); };
        if (refreshBtn) refreshBtn.onclick = render;
        if (exportBtn) exportBtn.onclick = () => {
            const logs = this.getAuditStore();
            const csvHead = ['id','eventType','timestamp','adminName','adminEmail','target','meta'];
            const csvRows = logs.map(l => [
                l.id,
                l.eventType,
                l.timestamp,
                (l.admin && l.admin.name) || '',
                (l.admin && l.admin.email) || '',
                JSON.stringify(l.target || {}),
                JSON.stringify(l.meta || {})
            ].map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','));
            const csv = [csvHead.join(','), ...csvRows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showSuccess('Reports exported');
        };

        render();
        this.showNotification('Reports loaded');
    }

    loadSecuritySettings() {
        const getSec = () => {
            try { return JSON.parse(localStorage.getItem('securitySettings') || '{}'); } catch { return {}; }
        };
        const setSec = (obj) => localStorage.setItem('securitySettings', JSON.stringify(obj));

        const settings = Object.assign({ sessionTimeoutMins: 60, lockoutThreshold: 5, lockoutMinutes: 30, requireMfa: false }, getSec());
        const timeoutIn = document.getElementById('sec-session-timeout');
        const thresholdIn = document.getElementById('sec-lockout-threshold');
        const lockoutMinsIn = document.getElementById('sec-lockout-minutes');
        const mfaChk = document.getElementById('sec-require-mfa');
        const saveBtn = document.getElementById('sec-save-settings');
        const refreshBtn = document.getElementById('refresh-security');
        const adminEmailIn = document.getElementById('sec-admin-email');
        const adminPwdIn = document.getElementById('sec-admin-password');
        const adminUpdateBtn = document.getElementById('sec-update-admin');
        const activeSessionsDiv = document.getElementById('sec-active-sessions');
        const forceAllBtn = document.getElementById('sec-force-logout-all');
        const failedSummary = document.getElementById('sec-failed-summary');
        const clearFailedBtn = document.getElementById('sec-clear-failed');

        // Populate form
        if (timeoutIn) timeoutIn.value = settings.sessionTimeoutMins;
        if (thresholdIn) thresholdIn.value = settings.lockoutThreshold;
        if (lockoutMinsIn) lockoutMinsIn.value = settings.lockoutMinutes;
        if (mfaChk) mfaChk.checked = !!settings.requireMfa;

        // Render sessions
        const renderSessions = () => {
            const sLocal = localStorage.getItem('bankingAppSession');
            const sSession = sessionStorage.getItem('bankingAppSession');
            const sessions = [];
            if (sLocal) { try { sessions.push({ store: 'localStorage', ...JSON.parse(sLocal) }); } catch {} }
            if (sSession) { try { sessions.push({ store: 'sessionStorage', ...JSON.parse(sSession) }); } catch {} }
            if (!activeSessionsDiv) return;
            if (!sessions.length) { activeSessionsDiv.textContent = 'No active sessions'; return; }
            activeSessionsDiv.innerHTML = sessions.map(s => `
                <p><strong>${s.user.role}</strong>: ${s.user.name || s.user.email} <small>(${s.store})</small><br>
                <small>Login: ${new Date(s.loginTime).toLocaleString()}</small></p>`).join('');
        };

        // Render failed attempts
        const getFailed = () => { try { return JSON.parse(localStorage.getItem('failedLoginAttempts') || '{}'); } catch { return {}; } };
        const renderFailed = () => {
            const f = getFailed();
            const total = Object.values(f).reduce((a,b)=>a+Number(b||0),0);
            failedSummary.textContent = `Tracked by email. Total attempts: ${total}`;
        };

        renderSessions();
        renderFailed();

        // Save settings
        if (saveBtn) saveBtn.onclick = () => {
            const newSettings = {
                sessionTimeoutMins: Math.max(5, parseInt((timeoutIn && timeoutIn.value) || '60', 10)),
                lockoutThreshold: Math.max(1, parseInt((thresholdIn && thresholdIn.value) || '5', 10)),
                lockoutMinutes: Math.max(1, parseInt((lockoutMinsIn && lockoutMinsIn.value) || '30', 10)),
                requireMfa: !!(mfaChk && mfaChk.checked)
            };
            setSec(newSettings);
            this.showSuccess('Security settings saved');
            this.logAudit('security_settings_updated', {}, newSettings);
        };

        if (refreshBtn) refreshBtn.onclick = () => this.loadSecuritySettings();

        // Update admin credentials used by auth
        const adminConfigKey = 'adminCredentials';
        const getAdminCreds = () => { try { return JSON.parse(localStorage.getItem(adminConfigKey) || '{}'); } catch { return {}; } };
        const creds = Object.assign({ email: 'bank@gmail.com' }, getAdminCreds());
        if (adminEmailIn) adminEmailIn.value = creds.email || 'bank@gmail.com';
        if (adminPwdIn) adminPwdIn.value = '';
        if (adminUpdateBtn) adminUpdateBtn.onclick = () => {
            const email = (adminEmailIn.value || '').trim();
            const pwd = (adminPwdIn.value || '').trim();
            if (!email) return this.showError('Admin email is required');
            const next = { email };
            if (pwd) next.password = pwd;
            localStorage.setItem(adminConfigKey, JSON.stringify(next));
            this.showSuccess('Admin credentials updated');
            this.logAudit('admin_credentials_updated', {}, { emailChanged: true, passwordChanged: !!pwd });
        };

        // Force logout all
        if (forceAllBtn) forceAllBtn.onclick = () => {
            localStorage.removeItem('bankingAppSession');
            sessionStorage.removeItem('bankingAppSession');
            this.showSuccess('All sessions cleared');
            this.logAudit('all_sessions_cleared');
            renderSessions();
        };

        // Clear failed attempts
        if (clearFailedBtn) clearFailedBtn.onclick = () => {
            localStorage.removeItem('failedLoginAttempts');
            this.showSuccess('Failed attempts cleared');
            this.logAudit('failed_attempts_cleared');
            renderFailed();
        };

        this.showNotification('Security settings loaded');
    }

    loadSystemSettings() {
        const getSettings = () => { try { return JSON.parse(localStorage.getItem('appSettings') || '{}'); } catch { return {}; } };
        const setSettings = (obj) => localStorage.setItem('appSettings', JSON.stringify(obj));

        const defaults = {
            appName: 'SecureBank',
            primaryColor: '#667eea',
            logoUrl: '',
            supportEmail: 'customerservice0549@gmail.com',
            supportPhone: '+18545537663752',
            maintenanceMode: false,
            maintenanceMessage: 'We are performing scheduled maintenance.'
        };
        const s = Object.assign({}, defaults, getSettings());

        const q = (id) => document.getElementById(id);
        const refreshBtn = q('refresh-settings');
        const saveBtn = q('save-settings');
        const appName = q('set-app-name');
        const color = q('set-primary-color');
        const logo = q('set-logo-url');
        const supEmail = q('set-support-email');
        const supPhone = q('set-support-phone');
        const maint = q('set-maintenance-mode');
        const maintMsg = q('set-maintenance-message');
        const expUsers = q('set-export-users');
        const expAudit = q('set-export-audit');
        const clearPending = q('set-clear-pending');

        if (appName) appName.value = s.appName;
        if (color) color.value = s.primaryColor;
        if (logo) logo.value = s.logoUrl;
        if (supEmail) supEmail.value = s.supportEmail;
        if (supPhone) supPhone.value = s.supportPhone;
        if (maint) maint.checked = !!s.maintenanceMode;
        if (maintMsg) maintMsg.value = s.maintenanceMessage;

        const renderBranding = () => {
            // Update header title if present
            const adminHeader = document.querySelector('.admin-logo h1');
            if (adminHeader) adminHeader.textContent = s.appName + ' Admin';
            // Apply primary color to CSS variables if available
            document.documentElement.style.setProperty('--primary-color', s.primaryColor);
        };
        renderBranding();

        const save = () => {
            const next = {
                appName: appName.value || defaults.appName,
                primaryColor: color.value || defaults.primaryColor,
                logoUrl: logo.value || '',
                supportEmail: supEmail.value || defaults.supportEmail,
                supportPhone: supPhone.value || defaults.supportPhone,
                maintenanceMode: !!maint.checked,
                maintenanceMessage: maintMsg.value || defaults.maintenanceMessage
            };
            setSettings(next);
            this.showSuccess('Settings saved');
            this.logAudit('system_settings_saved', {}, next);
        };

        if (saveBtn) saveBtn.onclick = () => { save(); };
        if (refreshBtn) refreshBtn.onclick = () => this.loadSystemSettings();
        if (expUsers) expUsers.onclick = () => {
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const csvHead = ['name','email','accountNumber','status','accountType','phone'];
            const rows = users.map(u => [u.name,u.email,u.accountNumber,u.status||'active',u.accountType||'',u.phone||'']
                .map(v=> '"'+String(v).replace(/"/g,'""')+'"').join(','));
            const csv = [csvHead.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            this.showSuccess('Users exported'); this.logAudit('export_users');
        };
        if (expAudit) expAudit.onclick = () => {
            const logs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
            const csvHead = ['id','eventType','timestamp','adminName','adminEmail','target','meta'];
            const rows = logs.map(l => [l.id,l.eventType,l.timestamp,(l.admin&&l.admin.name)||'',(l.admin&&l.admin.email)||'',JSON.stringify(l.target||{}),JSON.stringify(l.meta||{})]
                .map(v=> '"'+String(v).replace(/"/g,'""')+'"').join(','));
            const csv = [csvHead.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'audit-logs.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            this.showSuccess('Audit logs exported'); this.logAudit('export_audit');
        };
        if (clearPending) clearPending.onclick = () => {
            if (!confirm('Clear ALL pending transactions?')) return;
            localStorage.setItem('pendingTransactions', JSON.stringify([]));
            this.showSuccess('Pending transactions cleared');
            this.logAudit('pending_transactions_cleared');
        };

        this.showNotification('System settings loaded');
    }

    // Handle Actions
    handleWidgetAction(widgetTitle) {
        console.log(`Widget action clicked for: ${widgetTitle}`);
        
        switch (widgetTitle) {
            case 'Recent Transactions':
                this.switchSection('transactions', 
                    document.querySelectorAll('.nav-link'),
                    document.querySelectorAll('.admin-section')
                );
                break;
            case 'System Status':
                this.refreshSystemStatus();
                break;
        }
    }

    handleUserAction(action, userName) {
        // Legacy handler not used anymore; table uses explicit buttons
    }

    confirmUserAction(action, userName) {
        // not used by new Users table
    }

    async deleteUser(accountNumber, backendId, email, idx) {
        if (!confirm('Delete this user permanently? This cannot be undone.')) return;
        const normalizeAcct = (u) => String(u.accountNumber||u.account_number||u.accountNo||u.accNumber||u.acct||u.number||u.account||'');
        // Try backend first
        if (this.apiBase) {
            try {
                // Prefer backend id; if missing, search server for matching account/email
                let id = backendId;
                if (!id) {
                    const rs = await fetch(`${this.apiBase}/api/users`);
                    if (rs.ok) {
                        const apiUsers = await rs.json();
                        const match = (apiUsers||[]).find(u => normalizeAcct(u)===String(accountNumber) || String(u.email||'').toLowerCase()===String(email||'').toLowerCase());
                        if (match) id = match._id || match.backendId;
                    }
                }
                if (id) {
                    const resp = await fetch(`${this.apiBase}/api/users/${id}`, { method: 'DELETE' });
                    if (resp.ok) {
                        // Mirror deletion locally
                        let list = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                        const ix = list.findIndex(u => normalizeAcct(u)===String(accountNumber) || String(u._id||u.backendId||'')===String(id) || String(u.email||'').toLowerCase()===String(email||'').toLowerCase());
                        let removed;
                        if (ix > -1) { removed = list.splice(ix,1)[0]; }
                        localStorage.setItem('bankingUsers', JSON.stringify(list));
                        const acct = normalizeAcct(removed||{accountNumber:accountNumber});
                        if (acct) {
                            localStorage.removeItem(`userTransactions_${acct}`);
                            localStorage.removeItem(`userBalance_${acct}`);
                        }
                        this.showSuccess('User deleted successfully.');
                        this.logAudit('user_deleted', { accountNumber: acct, userEmail: (removed&&removed.email)||email||'', userName: removed&&removed.name });
                        this.loadUserManagement();
                        this.updateStats();
                        try { closeAllUsersModal(); } catch(_) {}
                        return;
                    }
                }
            } catch (_) { /* fall back to local */ }
        }
        // Local fallback
        let users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        let foundIdx = users.findIndex(u => String(u.accountNumber||u.account_number||u.accountNo||u.accNumber||u.acct||u.number||u.account||'') === String(accountNumber)
            || String(u._id||u.backendId||'') === String(backendId||'')
            || (email && String(u.email||'').toLowerCase() === String(email).toLowerCase()));
        // If not found and an index was provided from the rendered table, use it as a last-resort mapping
        if (foundIdx === -1 && Number.isInteger(idx)) {
            const i = Number(idx);
            if (i >= 0 && i < users.length) {
                foundIdx = i;
            }
        }
        if (foundIdx === -1) return this.showError('User not found');
        const user = users[foundIdx];
        const resolvedAcct = String(user.accountNumber||user.account_number||user.accountNo||user.accNumber||user.acct||user.number||user.account||accountNumber||'');
        users.splice(foundIdx, 1);
        localStorage.setItem('bankingUsers', JSON.stringify(users));
        // Clean up per-user data
        if (resolvedAcct) {
            localStorage.removeItem(`userTransactions_${resolvedAcct}`);
            localStorage.removeItem(`userBalance_${resolvedAcct}`);
        }
        this.showSuccess(`Deleted ${user.name}'s account`);
        this.logAudit('user_deleted', { accountNumber: resolvedAcct || accountNumber, userEmail: user.email, userName: user.name });
        this.loadUserManagement();
        this.updateStats();
                try { closeAllUsersModal(); } catch(_) {}
    }

    confirmDeleteUser(accountNumber, backendId, email, idx) {
                const existing = document.getElementById('confirmDeleteModal');
                if (existing) existing.remove();
                let users = [];
                try { users = JSON.parse(localStorage.getItem('bankingUsers') || '[]'); } catch {}
                const u = users.find(x => String(x.accountNumber||x.account_number||x.accountNo||x.accNumber||x.acct||x.number||x.account||'') === String(accountNumber)
                    || String(x._id||x.backendId||'') === String(backendId||'')
                    || (email && String(x.email||'').toLowerCase() === String(email).toLowerCase())) || {};
                const name = u.name || accountNumber;
                const html = `
                <div class="confirm-modal" id="confirmDeleteModal">
                    <div class="confirm-content">
                        <div class="confirm-header">
                            <h3><i class="fas fa-user-slash"></i> Delete User</h3>
                            <button class="close-modal" id="cdm-close">&times;</button>
                        </div>
                        <div class="confirm-body">
                            <p>Are you sure you want to permanently delete <strong>${name}</strong> (${accountNumber})? This action cannot be undone.</p>
                        </div>
                        <div class="confirm-actions">
                            <button class="admin-btn" id="cdm-cancel">Cancel</button>
                            <button class="admin-btn danger" id="cdm-confirm"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', html);
                const overlay = document.getElementById('confirmDeleteModal');
                const close = () => { const el = document.getElementById('confirmDeleteModal'); if (el) el.remove(); };
                if (overlay) {
                        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
                        const btnCancel = document.getElementById('cdm-cancel');
                        const btnClose = document.getElementById('cdm-close');
                        const btnConfirm = document.getElementById('cdm-confirm');
                        if (btnCancel) btnCancel.onclick = close;
                        if (btnClose) btnClose.onclick = close;
            if (btnConfirm) btnConfirm.onclick = async () => { await this.deleteUser(accountNumber, backendId, email, idx); close(); };
                }
        }

    async setUserFreeze(accountNumber, freeze, backendId, email, idx) {
        const normalizeAcct = (u) => String(u.accountNumber||u.account_number||u.accountNo||u.accNumber||u.acct||u.number||u.account||'');
        // Try backend first; resolve id if missing
        if (this.apiBase) {
            try {
                let id = backendId;
                if (!id) {
                    const rs = await fetch(`${this.apiBase}/api/users`);
                    if (rs.ok) {
                        const apiUsers = await rs.json();
                        const match = (apiUsers||[]).find(u => normalizeAcct(u)===String(accountNumber) || String(u.email||'').toLowerCase()===String(email||'').toLowerCase());
                        if (match) id = match._id || match.backendId;
                    }
                }
                if (id) {
                    const resp = await fetch(`${this.apiBase}/api/users/${id}/${freeze ? 'freeze' : 'unfreeze'}`, { method: 'POST' });
                    if (resp.ok) {
                        // Mirror locally
                        let users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                        const ix = users.findIndex(u => normalizeAcct(u)===String(accountNumber) || String(u._id||u.backendId||'')===String(id) || String(u.email||'').toLowerCase()===String(email||'').toLowerCase());
                        if (ix > -1) {
                            users[ix].status = freeze ? 'frozen' : 'active';
                            localStorage.setItem('bankingUsers', JSON.stringify(users));
                            const acct = normalizeAcct(users[ix]);
                            this.logAudit(freeze ? 'user_frozen' : 'user_unfrozen', { accountNumber: acct, userEmail: users[ix].email, userName: users[ix].name });
                        }
                        this.showSuccess(`${freeze ? 'Frozen' : 'Unfrozen'} account`);
                        this.loadUserManagement();
                        this.updateStats();
                        return;
                    }
                }
            } catch (_) { /* fall back to local */ }
        }
        // Local fallback
        let users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        let foundIdx = users.findIndex(u => String(u.accountNumber||u.account_number||u.accountNo||u.accNumber||u.acct||u.number||u.account||'') === String(accountNumber)
            || String(u._id||u.backendId||'') === String(backendId||'')
            || (email && String(u.email||'').toLowerCase() === String(email).toLowerCase()));
        // If not found and we have a row index from the rendered cache, use it as a last-resort mapping
        if (foundIdx === -1 && Number.isInteger(idx)) {
            const i = Number(idx);
            if (i >= 0 && i < users.length) {
                foundIdx = i;
            }
        }
        if (foundIdx === -1) return this.showError('User not found');
        users[foundIdx].status = freeze ? 'frozen' : 'active';
        localStorage.setItem('bankingUsers', JSON.stringify(users));
        this.showSuccess(`${freeze ? 'Frozen' : 'Unfrozen'} ${users[foundIdx].name}'s account`);
        const resolvedAcct2 = String(users[foundIdx].accountNumber||users[foundIdx].account_number||users[foundIdx].accountNo||users[foundIdx].accNumber||users[foundIdx].acct||users[foundIdx].number||users[foundIdx].account||accountNumber||'');
        this.logAudit(freeze ? 'user_frozen' : 'user_unfrozen', { accountNumber: resolvedAcct2, userEmail: users[foundIdx].email, userName: users[foundIdx].name });
        this.loadUserManagement();
        this.updateStats();
    }

    exportData() {
        this.showNotification('Preparing data export...');
        
        // Simulate export process
        setTimeout(() => {
            this.showNotification('Data export completed!', 'success');
        }, 2000);
    }

    addNewItem() {
        const sectionTitle = document.querySelector('.section-header h2').textContent;
        this.showNotification(`Add new ${sectionTitle.toLowerCase()} feature coming soon!`);
    }

    refreshSystemStatus() {
        this.showNotification('Refreshing system status...');
        setTimeout(() => {
            this.updateSystemStatus();
            this.showNotification('System status updated', 'success');
        }, 1000);
    }

    // Admin-specific actions
    showNotifications() {
        const notifications = [
            'System backup completed successfully',
            'New user registration: John Smith',
            'Suspicious transaction detected and flagged'
        ];
        
        this.showNotification('Notifications: ' + notifications.length + ' new items');
    }

    showProfile() {
        this.showNotification(`Profile: ${this.currentUser.name} (${this.currentUser.email})`);
    }

    logout() {
        const confirmed = confirm('Are you sure you want to logout?');
        if (confirmed) {
            // Clear session
            localStorage.removeItem('bankingAppSession');
            sessionStorage.removeItem('bankingAppSession');
            
            this.showNotification('Logging out...', 'success');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }

    // Real-time Updates
    setupRealTimeUpdates() {
        // Update stats every 30 seconds
        setInterval(() => {
            if (this.currentSection === 'dashboard') {
                this.updateStats();
            }
        }, 30000);

        // Update system status every 60 seconds
        setInterval(() => {
            this.updateSystemStatus();
        }, 60000);

        // Refresh recent transaction view every 2 minutes
        setInterval(() => {
            if (this.currentSection === 'dashboard') {
                this.loadRecentTransactions();
            }
        }, 120000);
    }

    addNewTransaction() { this.loadRecentTransactions(); }

    // Utility Methods
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.admin-notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        notification.textContent = message;

        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '90px',
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

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // Show All Users Modal (backend-first with local fallback)
    async showAllUsersModal() {
        let users = [];
        // Prefer backend if configured
        if (this.apiBase) {
            try {
                const resp = await fetch(`${this.apiBase}/api/users`);
                if (resp.ok) {
                    const apiUsers = await resp.json();
                    if (Array.isArray(apiUsers)) users = apiUsers;
                }
            } catch (_) { /* ignore and fallback */ }
        }
        // Fallback to local storage
        if (!Array.isArray(users) || users.length === 0) {
            try {
                const storedUsers = localStorage.getItem('bankingUsers');
                if (storedUsers) users = JSON.parse(storedUsers);
            } catch (error) {
                console.error('Error loading user data:', error);
            }
        }

        // cache for details lookups
        this._modalAllUsers = Array.isArray(users) ? users : [];

        // Remove existing modal if present to avoid duplicates
        const existingAll = document.getElementById('allUsersModal');
        if (existingAll) existingAll.remove();

        // Create modal HTML
        const modalHTML = `
            <div class="all-users-modal" id="allUsersModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-users"></i> All Users (${this._modalAllUsers.length})</h3>
                        <button class="close-modal" onclick="closeAllUsersModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="users-grid">
                            ${this._modalAllUsers.map(user => this.createUserCard(user)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Close on backdrop click
        const allOverlay = document.getElementById('allUsersModal');
        if (allOverlay) {
            allOverlay.addEventListener('click', (e) => { if (e.target === allOverlay) closeAllUsersModal(); });
        }

        // Add event listeners for user cards
        this.setupUserCardListeners();
    }

    createUserCard(user) {
        const statusClass = user.status || 'active';
        const statusIcon = statusClass === 'active' ? '✓' : statusClass === 'blocked' ? '✗' : '❄';
        const avatarClass = statusClass === 'blocked' ? 'blocked' : statusClass === 'frozen' ? 'frozen' : '';
        const key = `userBalance_${user.accountNumber || user.id}`;
        const stored = parseFloat(localStorage.getItem(key));
        const fallback = parseFloat((user.balance || '').toString().replace(/[$,]/g, '')) || 0;
        const displayBalance = Number.isFinite(stored) ? stored : fallback;
        
        return `
            <div class="user-card" data-user-id="${user.accountNumber}">
                <div class="user-avatar ${avatarClass}">
                    ${user.name.split(' ').map(n => n[0]).join('')}
                    <div class="status-indicator ${statusClass}">${statusIcon}</div>
                </div>
                <div class="user-info">
                    <h4>${user.name}</h4>
                    <p><i class="fas fa-envelope"></i> ${user.email}</p>
                    <p><i class="fas fa-credit-card"></i> ${user.accountNumber}</p>
                    <p><i class="fas fa-dollar-sign"></i> ${this.formatCurrency(displayBalance)}</p>
                </div>
                <div class="user-status-info">
                    <span class="status-badge ${statusClass}">${statusClass}</span>
                    <span class="last-login">Last: 2 hours ago</span>
                </div>
            </div>
        `;
    }

    setupUserCardListeners() {
        const userCards = document.querySelectorAll('.user-card');
        userCards.forEach(card => {
            card.addEventListener('click', () => {
                const userId = card.dataset.userId;
                this.showUserDetails(userId);
            });
        });
    }

    showUserDetails(userId) {
        // Prefer the modal cache if available, else fallback to local storage
        let users = Array.isArray(this._modalAllUsers) ? this._modalAllUsers : [];
        if (users.length === 0) {
            try {
                const storedUsers = localStorage.getItem('bankingUsers');
                if (storedUsers) users = JSON.parse(storedUsers);
            } catch (_) { /* ignore */ }
        }

        const user = users.find(u => u.accountNumber === userId);
        if (!user) return;

        // Use the existing showUserDetails function from script.js if available
        if (typeof showUserDetails === 'function') {
            showUserDetails(user);
        } else {
            // Fallback: create a simple user details modal
            this.showSimpleUserDetails(user);
        }
    }

    showSimpleUserDetails(user) {
        const key = `userBalance_${user.accountNumber || user.id}`;
        const stored = parseFloat(localStorage.getItem(key));
        const fallback = parseFloat((user.balance || '').toString().replace(/[$,]/g, '')) || 0;
        const displayBalance = Number.isFinite(stored) ? stored : fallback;
        const modalHTML = `
            <div class="user-details-modal" id="userDetailsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="user-avatar-large">${user.name.split(' ').map(n => n[0]).join('')}</div>
                        <div class="user-title-info">
                            <h2>${user.name}</h2>
                            <span class="user-status ${user.status || 'active'}">${user.status || 'active'}</span>
                        </div>
                        <button class="close-modal" onclick="closeUserDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-info-grid">
                            <div class="info-section">
                                <h3><i class="fas fa-user"></i> Personal Information</h3>
                                <div class="info-row">
                                    <label>Full Name:</label>
                                    <span>${user.name}</span>
                                </div>
                                <div class="info-row">
                                    <label>Email:</label>
                                    <span>${user.email}</span>
                                </div>
                                <div class="info-row">
                                    <label>Account Number:</label>
                                    <span>${user.accountNumber}</span>
                                </div>
                                <div class="info-row">
                                    <label>Balance:</label>
                                    <span>${this.formatCurrency(displayBalance)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Show Pending Users Modal
    async showPendingUsersModal() {
        let pendingUsers = [];
        // Prefer backend if available
        if (this.apiBase) {
            try {
                const r = await fetch(`${this.apiBase}/api/pending-users`);
                if (r.ok) pendingUsers = await r.json();
            } catch (_) { /* ignore and fallback */ }
        }
        // Fallback to local storage
        if (!Array.isArray(pendingUsers) || pendingUsers.length === 0) {
            try {
                const storedPendingUsers = localStorage.getItem('pendingUsers');
                if (storedPendingUsers) pendingUsers = JSON.parse(storedPendingUsers);
            } catch (error) {
                console.error('Error loading pending user data:', error);
            }
        }

        this._modalPendingUsers = Array.isArray(pendingUsers) ? pendingUsers : [];

        const modalHTML = `
            <div class="pending-users-modal" id="pendingUsersModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-clock"></i> Pending Users (${this._modalPendingUsers.length})</h3>
                        <button class="close-modal" onclick="closePendingUsersModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${this._modalPendingUsers.length === 0 ? 
                            '<div class="no-pending-users"><i class="fas fa-check-circle"></i><p>No pending user registrations</p></div>' :
                            '<div class="pending-users-grid">' + this._modalPendingUsers.map(user => this.createPendingUserCard(user)).join('') + '</div>'
                        }
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupPendingUserActions();
    }

    createPendingUserCard(user) {
        const requestDate = new Date(user.requestDate).toLocaleDateString();
        const balNum = parseFloat(String(user.balance||'').toString().replace(/[$,]/g,'')||'0') || 0;
        
        return `
            <div class="pending-user-card" data-user-id="${user.accountNumber}" data-backend-id="${user._id || user.backendId || ''}">
                <div class="pending-user-header">
                    <div class="user-avatar pending">
                        ${user.name.split(' ').map(n => n[0]).join('')}
                        <div class="status-indicator pending">⏳</div>
                    </div>
                    <div class="user-basic-info">
                        <h4>${user.name}</h4>
                        <p><i class="fas fa-envelope"></i> ${user.email}</p>
                        <p><i class="fas fa-phone"></i> ${user.phone}</p>
                        <p><i class="fas fa-credit-card"></i> ${user.accountNumber}</p>
                    </div>
                </div>
                <div class="pending-user-details">
                    <div class="detail-row">
                        <label>Initial Balance:</label>
                        <span>${this.formatCurrency(balNum)}</span>
                    </div>
                    <div class="detail-row">
                        <label>PIN:</label>
                        <span>${user.pin}</span>
                    </div>
                    <div class="detail-row">
                        <label>Request Date:</label>
                        <span>${requestDate}</span>
                    </div>
                </div>
                <div class="pending-user-actions">
                    <button class="action-btn approve" onclick="approveUser('${user._id || user.backendId || ''}','${user.accountNumber}')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn reject" onclick="rejectUser('${user._id || user.backendId || ''}','${user.accountNumber}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    <button class="action-btn view-details" onclick="viewPendingUserDetails('${user.accountNumber}','${user._id || user.backendId || ''}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `;
    }

    setupPendingUserActions() {
        // Make functions globally available
        window.approveUser = (backendId, accountNumber) => this.approveUser(backendId, accountNumber);
        window.rejectUser = (backendId, accountNumber) => this.rejectUser(backendId, accountNumber);
        window.viewPendingUserDetails = (accountNumber, backendId) => this.viewPendingUserDetails(accountNumber, backendId);
        window.closePendingUsersModal = () => this.closePendingUsersModal();
    }

    async approveUser(backendId, accountNumber) {
        // If backend id is present and API is available, prefer server approval
        if (backendId && this.apiBase) {
            try {
                const r = await fetch(`${this.apiBase}/api/pending-users/approve/${backendId}`, { method: 'POST' });
                if (r.ok) {
                    this.showSuccess('User approved successfully.');
                    this.closePendingUsersModal();
                    this.updateStats();
                    return;
                }
            } catch (_) { /* fall through to local */ }
        }
        try {
            // Get pending users
            let pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
            const userIndex = pendingUsers.findIndex(user => user.accountNumber === accountNumber);
            
            if (userIndex === -1) {
                this.showError('User not found');
                return;
            }

            const approvedUser = pendingUsers[userIndex];
            
            // Remove from pending users
            pendingUsers.splice(userIndex, 1);
            localStorage.setItem('pendingUsers', JSON.stringify(pendingUsers));

            // Add to approved users (convert to approved format)
            const newApprovedUser = {
                name: approvedUser.name,
                email: approvedUser.email,
                password: approvedUser.password,
                phone: approvedUser.phone,
                accountNumber: approvedUser.accountNumber,
                balance: approvedUser.balance || '$0.00',
                status: 'active',
                role: 'user',
                pin: approvedUser.pin,
                pinSetByUser: !!approvedUser.pinSetByUser,
                securityQuestions: approvedUser.securityQuestions,
                lastLogin: new Date().toISOString(),
                joinDate: new Date().toISOString(),
                routingNumber: (function(){
                    const gen = () => {
                        let s=''; for (let i=0;i<9;i++) s+=Math.floor(Math.random()*10); if (s[0]==='0') s='1'+s.slice(1); return s;
                    };
                    try {
                        const existing = JSON.parse(localStorage.getItem('bankingUsers')||'[]').map(u=>String(u.routingNumber||''));
                        let r = gen(); const set = new Set(existing);
                        while (set.has(r)) r = gen();
                        return r;
                    } catch { return gen(); }
                })()
            };

            // Add to banking users
            let bankingUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            bankingUsers.push(newApprovedUser);
            localStorage.setItem('bankingUsers', JSON.stringify(bankingUsers));

            this.showSuccess(`User ${approvedUser.name} has been approved and can now access their account.`);
            
            // Refresh the modal and stats
            this.closePendingUsersModal();
            this.updateStats();
            
        } catch (error) {
            console.error('Error approving user:', error);
            this.showError('Failed to approve user. Please try again.');
        }
    }

    async rejectUser(backendId, accountNumber) {
        if (!confirm('Are you sure you want to reject this user registration? This action cannot be undone.')) {
            return;
        }
        if (backendId && this.apiBase) {
            try {
                const r = await fetch(`${this.apiBase}/api/pending-users/reject/${backendId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Rejected by admin' }) });
                if (r.ok) {
                    this.showSuccess('User registration rejected.');
                    this.closePendingUsersModal();
                    this.updateStats();
                    return;
                }
            } catch (_) { /* fallback to local */ }
        }
        try {
            // Get pending users
            let pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
            const userIndex = pendingUsers.findIndex(user => user.accountNumber === accountNumber);
            
            if (userIndex === -1) {
                this.showError('User not found');
                return;
            }

            const rejectedUser = pendingUsers[userIndex];
            
            // Remove from pending users
            pendingUsers.splice(userIndex, 1);
            localStorage.setItem('pendingUsers', JSON.stringify(pendingUsers));

            this.showSuccess(`User registration for ${rejectedUser.name} has been rejected.`);
            
            // Refresh the modal and stats
            this.closePendingUsersModal();
            this.updateStats();
            
        } catch (error) {
            console.error('Error rejecting user:', error);
            this.showError('Failed to reject user. Please try again.');
        }
    }

    viewPendingUserDetails(accountNumber, backendId) {
        try {
            let user = null;
            if (Array.isArray(this._modalPendingUsers)) {
                user = this._modalPendingUsers.find(u => (u.accountNumber === accountNumber) || (backendId && (u._id === backendId || u.backendId === backendId)));
            }
            if (!user) {
                const pendingUsers = JSON.parse(localStorage.getItem('pendingUsers') || '[]');
                user = pendingUsers.find(u => u.accountNumber === accountNumber);
            }
            
            if (!user) {
                this.showError('User not found');
                return;
            }

            this.showPendingUserDetailsModal(user);
            
        } catch (error) {
            console.error('Error viewing user details:', error);
            this.showError('Failed to load user details.');
        }
    }

    showPendingUserDetailsModal(user) {
        const modalHTML = `
            <div class="pending-user-details-modal" id="pendingUserDetailsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="user-avatar-large pending">${user.name.split(' ').map(n => n[0]).join('')}</div>
                        <div class="user-title-info">
                            <h2>${user.name}</h2>
                            <span class="user-status pending">Pending Approval</span>
                        </div>
                        <button class="close-modal" onclick="closePendingUserDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-info-grid">
                            <div class="info-section">
                                <h3><i class="fas fa-user"></i> Personal Information</h3>
                                <div class="info-row">
                                    <label>Full Name:</label>
                                    <span>${user.name}</span>
                                </div>
                                <div class="info-row">
                                    <label>Email:</label>
                                    <span>${user.email}</span>
                                </div>
                                <div class="info-row">
                                    <label>Phone:</label>
                                    <span>${user.phone}</span>
                                </div>
                                <div class="info-row">
                                    <label>Request Date:</label>
                                    <span>${new Date(user.requestDate).toLocaleString()}</span>
                                </div>
                            </div>
                            <div class="info-section">
                                <h3><i class="fas fa-university"></i> Account Information</h3>
                                <div class="info-row">
                                    <label>Account Number:</label>
                                    <span>${user.accountNumber}</span>
                                </div>
                                <div class="info-row">
                                    <label>Initial Balance:</label>
                                    <span>${user.balance}</span>
                                </div>
                                <div class="info-row">
                                    <label>PIN:</label>
                                    <span>${user.pin}</span>
                                </div>
                                <div class="info-row">
                                    <label>Status:</label>
                                    <span>Pending Approval</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <div class="action-buttons">
                            <button class="action-btn approve" onclick="approveUser('${user._id || user.backendId || ''}','${user.accountNumber}'); closePendingUserDetailsModal();">
                                <i class="fas fa-check"></i> Approve User
                            </button>
                            <button class="action-btn reject" onclick="rejectUser('${user._id || user.backendId || ''}','${user.accountNumber}'); closePendingUserDetailsModal();">
                                <i class="fas fa-times"></i> Reject User
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Make close function available
        window.closePendingUserDetailsModal = () => {
            const modal = document.getElementById('pendingUserDetailsModal');
            if (modal) {
                modal.remove();
            }
        };
    }

    closePendingUsersModal() {
        const modal = document.getElementById('pendingUsersModal');
        if (modal) {
            modal.remove();
        }
    }
}

// Global logout function for the admin dashboard
function logout() {
    const admin = window.adminDashboard;
    if (admin) {
        admin.logout();
    } else {
        // Fallback logout
        localStorage.removeItem('bankingAppSession');
        sessionStorage.removeItem('bankingAppSession');
        window.location.href = 'index.html';
    }
}

// Global function to close All Users modal
function closeAllUsersModal() {
    const modal = document.getElementById('allUsersModal');
    if (modal) {
        modal.remove();
    }
}

// Global function to close User Details modal
function closeUserDetailsModal() {
    const modal = document.getElementById('userDetailsModal');
    if (modal) {
        modal.remove();
    }
}

// Initialize admin dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin Dashboard Initializing...');
    
    const adminDashboard = new AdminDashboard();
    
    // Make it globally accessible
    window.adminDashboard = adminDashboard;
    
    console.log('Admin Dashboard Initialized Successfully!');

    // Defensive: hide any user-app modal accidentally present on admin page
    try {
        const stray = document.getElementById('all-users-modal');
        if (stray) { stray.remove(); }
    } catch {}

    // Defensive: ensure sidebar backdrop is hidden on load
    const _backdrop = document.querySelector('.sidebar-backdrop');
    const _sidebar = document.getElementById('adminSidebar');
    if (_backdrop) {
        var _isOpen = false;
        if (_sidebar && _sidebar.classList) {
            _isOpen = _sidebar.classList.contains('open');
        }
        _backdrop.hidden = !_isOpen;
    }

    // Fallback: if for any reason the primary setup didn't bind,
    // attach a minimal toggle to the hamburger to ensure usability.
    try {
        if (!window.__adminSidebarSetup) {
            const burger = document.querySelector('.hamburger-btn');
            const sidebar = document.getElementById('adminSidebar');
            const backdrop = document.querySelector('.sidebar-backdrop');
            if (burger && sidebar && backdrop && !burger.dataset.fallbackBound) {
                burger.dataset.fallbackBound = 'true';
                burger.addEventListener('click', () => {
                    const isOpen = sidebar.classList.contains('open');
                    if (isOpen) {
                        sidebar.classList.remove('open');
                        sidebar.setAttribute('aria-hidden', 'true');
                        burger.setAttribute('aria-expanded', 'false');
                        backdrop.hidden = true;
                        document.body.style.overflow = '';
                        sidebar.style.left = '';
                    } else {
                        sidebar.classList.add('open');
                        sidebar.setAttribute('aria-hidden', 'false');
                        burger.setAttribute('aria-expanded', 'true');
                        backdrop.hidden = false;
                        document.body.style.overflow = 'hidden';
                        sidebar.style.left = '0';
                    }
                });
                backdrop.addEventListener('click', () => {
                    sidebar.classList.remove('open');
                    sidebar.setAttribute('aria-hidden', 'true');
                    burger.setAttribute('aria-expanded', 'false');
                    backdrop.hidden = true;
                    document.body.style.overflow = '';
                    sidebar.style.left = '';
                });
            }
        }
    } catch (e) {
        console.warn('Fallback sidebar setup error:', e);
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminDashboard;
}