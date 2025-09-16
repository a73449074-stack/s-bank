// Banking App JavaScript Functionality

class BankingApp {
    constructor() {
    this.currentTab = 'manage';
        this.currentBottomNav = 'Accounts';
        this.currentBalance = 0.0; // Starting balance
        this.currentUser = this.getCurrentUser(); // Get current user
        if (!this.currentUser) {
            try { window.location.href = 'index.html'; } catch {}
            return;
        }
        this.init();
    }

    getCurrentUser() {
        // First check for logged-in user session
        const sessionData = localStorage.getItem('bankingAppSession') || 
                           sessionStorage.getItem('bankingAppSession');
        
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                const sessionUser = session.user;
                
                // Get full user data from banking users storage
                const bankingUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                const fullUserData = bankingUsers.find(u => u.email === sessionUser.email);
                
                if (fullUserData) {
                    // Return full user data with session info
                    return {
                        id: fullUserData.accountNumber || 'user_' + Date.now(),
                        name: fullUserData.name,
                        email: fullUserData.email,
                        password: fullUserData.password,
                        transactionPin: fullUserData.pin || null,
                        phoneNumber: fullUserData.phone || 'Not provided',
                        accountNumber: fullUserData.accountNumber,
                        routingNumber: fullUserData.routingNumber || null,
                        avatar: fullUserData.name.split(' ').map(n => n[0]).join(''),
                        status: fullUserData.status || 'active',
                        accountType: fullUserData.accountType || 'checking',
                        dateCreated: fullUserData.dateCreated || fullUserData.joinDate || new Date().toISOString(),
                        joinDate: fullUserData.joinDate || null,
                        lastLogin: new Date().toISOString(),
                        balance: fullUserData.balance || '$0.00',
                        address: fullUserData.address || {
                            street: 'Not provided',
                            city: 'Not provided',
                            state: 'Not provided',
                            zipCode: 'Not provided'
                        },
                        securityQuestions: fullUserData.securityQuestions || [
                            { question: 'What was your first pet\'s name?', answer: 'Not set' },
                            { question: 'What city were you born in?', answer: 'Not set' }
                        ],
                        profilePicture: fullUserData.profilePicture || null
                    };
                }
                // Deleted or missing user; invalidate session
                try {
                    localStorage.removeItem('bankingAppSession');
                    sessionStorage.removeItem('bankingAppSession');
                } catch {}
                return null;
                
            } catch (error) {
                console.error('Error parsing session data:', error);
            }
        }
        
        // No valid session found
        return null;
    }

    // initializeDemoUsers removed

    // remove demo transaction creation
    createDemoTransactions() {
        // no-op
    }

    init() {
        this.setupTabNavigation();
        this.setupBottomNavigation();
        this.setupButtonHandlers();
        this.setupSearchFunctionality();
        this.setupTransactionSystem();
        this.setupAdminDashboard();
        
        // Initialize to show main content by default (Accounts tab)
        this.initializeDefaultView();
        this.updateBalanceDisplay();
        // Render menu profile if markup exists
    this.renderMenuProfile();
    this.updateAccountTitle();

        // Ensure user has bank identifiers (e.g., routing number)
        this.ensureUserBankIdentifiers();

        // Show frozen banner if applicable
        this.renderFrozenBanner();
        // Render actual recent activity list
        this.renderRecentTransfers();
        // Render beneficiaries from storage (removes static samples)
        this.renderBeneficiariesList();
        // Render account limits from storage
        this.renderAccountLimits();

        // Populate routing tab dynamic fields
        this.renderRoutingInfo();
        // Render balance breakdown
        this.renderBalanceBreakdown();

        // Apply persisted theme on load
        this.applyPersistedTheme();
    }

    updateAccountTitle() {
        try {
            const el = document.querySelector('.account-title');
            if (!el || !this.currentUser) return;
            const name = this.currentUser.name || '';
            const first = name.split(' ')[0] || name || 'User';
            el.textContent = `Welcome back, ${first}`;
        } catch {}
    }

    // Transaction System
    setupTransactionSystem() {
        // Initialize transaction storage if not exists
        if (!localStorage.getItem('pendingTransactions')) {
            localStorage.setItem('pendingTransactions', JSON.stringify([]));
        }
        if (!localStorage.getItem('approvedTransactions')) {
            localStorage.setItem('approvedTransactions', JSON.stringify([]));
        }
        
        // Initialize user-specific transactions storage
        const userTransactionKey = this.getUserTransactionKey();
        if (!localStorage.getItem(userTransactionKey)) {
            localStorage.setItem(userTransactionKey, JSON.stringify([]));
        }
        
        // Initialize user-specific balance
        const userBalanceKey = this.getUserBalanceKey();
        if (!localStorage.getItem(userBalanceKey)) {
            // Set initial balance from user data
            const balanceFromUser = this.currentUser.balance || '$0.00';
            const numericBalance = parseFloat(balanceFromUser.replace(/[$,]/g, ''));
            localStorage.setItem(userBalanceKey, numericBalance.toString());
        }
        
    // Load current balance for this user
    this.currentBalance = parseFloat(localStorage.getItem(userBalanceKey) || '0');
        
        // Setup form handlers
        this.setupDepositForms();
        this.setupTransferForms();
        this.updateTransactionHistory();
        
        // Refresh transaction history every 5 seconds
        setInterval(() => {
            this.updateTransactionHistory();
        }, 5000);
        
        // Do not create demo transactions
    }

    // Get user-specific transaction storage key
    getUserTransactionKey() {
        return `userTransactions_${this.currentUser.accountNumber || this.currentUser.id}`;
    }

    // Get user-specific balance storage key
    getUserBalanceKey() {
        return `userBalance_${this.currentUser.accountNumber || this.currentUser.id}`;
    }

    // Cards storage key per user
    getUserCardsKey() {
        return `userCards_${this.currentUser.accountNumber || this.currentUser.id}`;
    }

    loadUserCards() {
        const key = this.getUserCardsKey();
        try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    }

    saveUserCards(cards) {
        const key = this.getUserCardsKey();
        localStorage.setItem(key, JSON.stringify(cards));
    }

    // forceDemoTransactions removed

    updateBalanceDisplay() {
        const balanceElements = document.querySelectorAll('.balance');
        balanceElements.forEach(el => {
            el.textContent = `$${this.currentBalance.toFixed(1)}`;
        });
        
        // Also update balance amounts in bottom navigation
        const balanceAmounts = document.querySelectorAll('.balance-amount');
        balanceAmounts.forEach(el => {
            if (el.textContent.startsWith('$')) {
                el.textContent = `$${this.currentBalance.toFixed(1)}`;
            }
        });

        // Keep frozen banner state in sync
        this.renderFrozenBanner();
        // Refresh routing balance breakdown
        this.renderBalanceBreakdown();
    }

    createTransaction(type, amount, description, recipient = null) {
        // Require transaction PIN set
        if (!this.requireTransactionPinOrSetup('make a transaction')) return null;
        // Block transactions for non-active users
        if (!this.isUserActiveForTransactions()) {
            this.showNotification('Your account is frozen. Transactions are disabled.', 'error');
            return null;
        }
        // Confirm PIN for this transaction
        if (!this.promptForPinConfirmation()) { this.showNotification('Transaction cancelled.', 'error'); return null; }
        const transaction = {
            id: Date.now(),
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            userEmail: this.currentUser.email,
            userAvatar: this.currentUser.avatar,
            accountNumber: this.currentUser.accountNumber,
            type: type, // 'deposit' or 'transfer'
            amount: parseFloat(amount),
            description: description,
            recipient: recipient,
            status: 'pending',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };
        
        // Add to pending transactions
        const pending = JSON.parse(localStorage.getItem('pendingTransactions'));
        pending.push(transaction);
        localStorage.setItem('pendingTransactions', JSON.stringify(pending));
        
    // Also add to this user's local history as pending
    const userTransactionKey = this.getUserTransactionKey();
    const userTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
    userTransactions.unshift(transaction);
    localStorage.setItem(userTransactionKey, JSON.stringify(userTransactions));

    // Show success message
        this.showNotification(`${type === 'deposit' ? 'Deposit' : 'Transfer'} request submitted for admin approval`, 'success');
        
        return transaction;
    }

    setupDepositForms() {
        // Handle deposit button clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.deposit-btn') || e.target.closest('.deposit-btn')) {
                e.preventDefault();
                this.handleDepositClick(e.target.closest('.deposit-btn') || e.target);
            }
            if (e.target.matches('[data-action="view-all-deposits"]')) {
                e.preventDefault();
                this.openAllDepositsModal();
            }
        });

        // Render deposits list on load
        this.renderRecentDeposits();
    }

    handleDepositClick(depositBtn) {
        const depositType = depositBtn.dataset.deposit;
        
        // Start deposit flow based on type
        switch(depositType) {
            case 'mobile-check':
                this.startMobileCheckDeposit();
                break;
            case 'direct-deposit':
                this.startDirectDeposit();
                break;
            case 'find-atm':
                this.startATMDeposit();
                break;
            case 'card-deposit':
                this.startCardDeposit();
                break;
            case 'wire-transfer':
                this.startWireTransfer();
                break;
            default:
                this.showNotification('Deposit type not recognized', 'error');
        }
    }

    startMobileCheckDeposit() {
        this.showDepositWizard('Mobile Check Deposit', 'mobile-check');
    }

    startDirectDeposit() {
        this.openDirectDepositSetup();
    }

    startATMDeposit() {
        this.showDepositWizard('ATM Cash Deposit', 'atm-deposit');
    }

    startCardDeposit() {
        this.showDepositWizard('Card Deposit', 'card-deposit');
    }

    startWireTransfer() {
        this.showDepositWizard('Wire Transfer Deposit', 'wire-transfer');
    }

    showDepositWizard(title, type) {
        // Create deposit wizard overlay
        const wizardHTML = `
            <div class="deposit-wizard-overlay" id="deposit-wizard">
                <div class="deposit-wizard">
                    <div class="wizard-header">
                        <h3>${title}</h3>
                        <button class="close-wizard">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="wizard-content">
                        <div class="wizard-step active" id="step-1">
                            <div class="step-header">
                                <h4>Step 1: Enter Amount</h4>
                                <p>How much would you like to deposit?</p>
                            </div>
                            <div class="amount-input-section">
                                <div class="currency-symbol">$</div>
                                <input type="number" id="deposit-amount" placeholder="0.00" min="0.01" step="0.01" autofocus>
                            </div>
                            <div class="quick-amounts">
                                <button class="quick-amount" data-amount="25">$25</button>
                                <button class="quick-amount" data-amount="50">$50</button>
                                <button class="quick-amount" data-amount="100">$100</button>
                                <button class="quick-amount" data-amount="200">$200</button>
                            </div>
                        </div>
                        
                        <div class="wizard-step" id="step-2">
                            ${this.getDepositStep2Content(type)}
                        </div>
                        
                        <div class="wizard-step" id="step-3">
                            <div class="step-header">
                                <h4>Step 3: Confirm Deposit</h4>
                                <p>Review your deposit details</p>
                            </div>
                            <div class="deposit-summary">
                                <div class="summary-row">
                                    <span>Amount:</span>
                                    <span id="summary-amount">$0.00</span>
                                </div>
                                <div class="summary-row">
                                            <span>Deposit Type:</span>
                                            <span id="summary-type">${title}</span>
                                        </div>
                                <div class="summary-row">
                                    <span>Account:</span>
                                    <span>Everyday Checking ...0630</span>
                                </div>
                                ${type === 'atm-deposit' ? `
                                <div class="summary-row"><span>ATM:</span><span id="summary-atm-name">—</span></div>
                                <div class="summary-row"><span>ATM ID:</span><span id="summary-atm-id">—</span></div>
                                <div class="summary-row"><span>PIN:</span>
                                    <span><input type="password" id="atm-pin" placeholder="Enter your 4-digit transaction PIN" maxlength="4" inputmode="numeric"></span>
                                </div>` : ''}
                                ${type === 'card-deposit' ? `
                                <div class="summary-row"><span>Card:</span><span id="summary-card-name">—</span></div>
                                <div class="summary-row"><span>Card Number:</span><span id="summary-card-last4">—</span></div>` : ''}
                                ${type === 'wire-transfer' ? `
                                <div class="summary-row"><span>Sender:</span><span id="summary-wire-sender">—</span></div>
                                <div class="summary-row"><span>Bank:</span><span id="summary-wire-bank">—</span></div>
                                <div class="summary-row"><span>Reference:</span><span id="summary-wire-ref">—</span></div>` : ''}
                                ${type === 'mobile-check' ? `
                                <div class="summary-row"><span>Check #:</span><span id="summary-check-number">—</span></div>
                                <div class="summary-row"><span>Images:</span><span id="summary-check-images">Front & Back uploaded</span></div>` : ''}
                                <div class="summary-note">
                                    <i class="fas fa-info-circle"></i>
                                    Your deposit will be reviewed by an administrator before being processed.
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="wizard-actions">
                        <button class="wizard-btn secondary" id="back-btn" style="display: none;">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                        <button class="wizard-btn primary" id="next-btn">
                            Next <i class="fas fa-arrow-right"></i>
                        </button>
                        <button class="wizard-btn success" id="submit-btn" style="display: none;">
                            <i class="fas fa-check"></i> Submit Deposit
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add wizard to page
        document.body.insertAdjacentHTML('beforeend', wizardHTML);
        
        // Setup wizard functionality
        this.setupDepositWizardHandlers(type);
    }

    setupDepositWizardHandlers(depositType) {
        let currentStep = 1;
        let depositAmount = 0;
        let selectedATM = null;
    let checkFront = null;
        let checkBack = null;
        let checkNumber = '';
        let wireDetails = { senderName: '', bankName: '', senderAccount: '', reference: '' };
    let selectedCardIndex = null;
        
        const wizard = document.getElementById('deposit-wizard');
        const backBtn = document.getElementById('back-btn');
        const nextBtn = document.getElementById('next-btn');
        const submitBtn = document.getElementById('submit-btn');
        const amountInput = document.getElementById('deposit-amount');
        const summaryAmount = document.getElementById('summary-amount');

        if (depositType === 'atm-deposit') {
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Confirm Deposit';
        }
        
        // Close wizard
        wizard.querySelector('.close-wizard').addEventListener('click', () => {
            wizard.remove();
        });
        
        // Quick amount buttons
        wizard.querySelectorAll('.quick-amount').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = btn.dataset.amount;
                amountInput.value = amount;
                depositAmount = parseFloat(amount);
                summaryAmount.textContent = `$${amount}.00`;
            });
        });
        
        // Amount input
        amountInput.addEventListener('input', () => {
            depositAmount = parseFloat(amountInput.value) || 0;
            summaryAmount.textContent = `$${depositAmount.toFixed(2)}`;
        });

        // Type-specific setup
        if (depositType === 'atm-deposit') {
            const refreshBtn = wizard.querySelector('#atm-refresh');
            const listEl = wizard.querySelector('#atm-list');
            const render = () => {
                const atms = this.generateRandomATMs(6);
                listEl.innerHTML = atms.map(a => `
                    <label class="atm-item">
                        <input type="radio" name="atmSel" value="${a.id}" data-name="${a.name}">
                        <div class="atm-meta">
                            <strong>${a.name}</strong>
                            <span>${a.address} • ${a.distance.toFixed(1)} mi</span>
                        </div>
                        <span class="atm-id">${a.id}</span>
                    </label>
                `).join('');
                listEl.querySelectorAll('input[name="atmSel"]').forEach(inp => {
                    inp.addEventListener('change', () => {
                        selectedATM = { id: inp.value, name: inp.dataset.name };
                        const sumName = wizard.querySelector('#summary-atm-name');
                        const sumId = wizard.querySelector('#summary-atm-id');
                        if (sumName) sumName.textContent = selectedATM.name;
                        if (sumId) sumId.textContent = selectedATM.id;
                    });
                });
            };
            render();
            if (refreshBtn) refreshBtn.onclick = render;
        }

        if (depositType === 'mobile-check') {
            const frontIn = wizard.querySelector('#check-front');
            const backIn = wizard.querySelector('#check-back');
            const numIn = wizard.querySelector('#check-number');
            const updateNum = () => {
                checkNumber = (numIn.value || '').trim();
                const sumNum = wizard.querySelector('#summary-check-number');
                if (sumNum) sumNum.textContent = checkNumber || '—';
            };
            if (frontIn) frontIn.onchange = (e) => { checkFront = (e.target.files && e.target.files[0]) ? true : null; };
            if (backIn) backIn.onchange = (e) => { checkBack = (e.target.files && e.target.files[0]) ? true : null; };
            if (numIn) numIn.oninput = updateNum;
        }

        if (depositType === 'card-deposit') {
            const cards = this.loadUserCards();
            const listEl = wizard.querySelector('#card-list');
            if (listEl) {
                if (!cards || cards.length === 0) {
                    listEl.innerHTML = `<div class="empty-cards">No linked cards. <button class="link-card-btn" id="link-card-inline">Link a card</button></div>`;
                    const linkBtn = wizard.querySelector('#link-card-inline');
                    if (linkBtn) linkBtn.addEventListener('click', () => this.showCardControls());
                } else {
                    listEl.innerHTML = cards.map((c, idx) => {
                        const last4 = (c.cardNumber||'').replace(/\s+/g,'').slice(-4);
                        return `
                        <label class="atm-item">
                            <input type="radio" name="cardSel" value="${idx}" data-name="${c.name}" data-last4="${last4}">
                            <div class="atm-meta">
                                <strong>${c.name || c.cardType || 'Card'}</strong>
                                <span>${c.cardType || ''} • •••• ${last4}</span>
                            </div>
                            <span class="atm-id">${c.expiry || ''}</span>
                        </label>`;
                    }).join('');
                    listEl.querySelectorAll('input[name="cardSel"]').forEach(inp => {
                        inp.addEventListener('change', () => {
                            selectedCardIndex = Number(inp.value);
                            const sumName = wizard.querySelector('#summary-card-name');
                            const sumLast4 = wizard.querySelector('#summary-card-last4');
                            if (sumName) sumName.textContent = inp.dataset.name || 'Card';
                            if (sumLast4) sumLast4.textContent = `•••• ${inp.dataset.last4}`;
                        });
                    });
                }
            }
        }

        if (depositType === 'wire-transfer') {
            const senderIn = wizard.querySelector('#wire-sender');
            const bankIn = wizard.querySelector('#wire-bank');
            const acctIn = wizard.querySelector('#wire-sender-account');
            const refIn = wizard.querySelector('#wire-reference');
            const reflect = () => {
                const sSender = wizard.querySelector('#summary-wire-sender');
                const sBank = wizard.querySelector('#summary-wire-bank');
                const sRef = wizard.querySelector('#summary-wire-ref');
                if (sSender) sSender.textContent = senderIn.value || '—';
                if (sBank) sBank.textContent = bankIn.value || '—';
                if (sRef) sRef.textContent = refIn.value || '—';
            };
            [senderIn, bankIn, acctIn, refIn].forEach(inp => inp && (inp.oninput = () => {
                wireDetails = {
                    senderName: senderIn.value || '',
                    bankName: bankIn.value || '',
                    senderAccount: acctIn.value || '',
                    reference: refIn.value || ''
                };
                reflect();
            }));
        }
        
        // Navigation buttons
        backBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                this.updateWizardStep(currentStep);
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (this.validateCurrentStep(currentStep, depositAmount, depositType, { selectedATM, checkFront, checkBack, checkNumber, wireDetails, selectedCardIndex })) {
                if (currentStep < 3) {
                    currentStep++;
                    this.updateWizardStep(currentStep);
                }
            }
        });
        
        submitBtn.addEventListener('click', () => {
            if (depositAmount > 0) {
                // For ATM deposits, require typed 4-digit transaction PIN matching stored PIN
                if (depositType === 'atm-deposit') {
                    const pinEl = wizard.querySelector('#atm-pin');
                    const typed = (pinEl && pinEl.value) ? String(pinEl.value).replace(/[^\d]/g,'').slice(0,4) : '';
                    if (typed.length !== 4) { this.showNotification('Please enter a 4-digit PIN', 'error'); return; }
                    try {
                        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                        const user = users.find(u => u.email === this.currentUser.email || u.accountNumber === this.currentUser.accountNumber);
                        const pin = user && user.pin;
                        const userSet = !!(user && user.pinSetByUser);
                        if (!pin || !userSet) { this.showSecuritySettingsModal(); return; }
                        if (String(typed) !== String(pin)) { this.showNotification('Incorrect PIN.', 'error'); return; }
                    } catch { this.showNotification('Unable to verify PIN', 'error'); return; }
                }
                // For Card deposits, require normal PIN confirmation
                if (depositType === 'card-deposit') {
                    if (!this.promptForPinConfirmation()) { this.showNotification('Transaction cancelled.', 'error'); return; }
                }
                // Create pending transaction with details by type
                let details = null;
                if (depositType === 'atm-deposit') { details = { atmId: selectedATM?.id, atmName: selectedATM?.name }; }
                if (depositType === 'card-deposit') {
                    const cards = this.loadUserCards();
                    const card = (selectedCardIndex!=null) ? cards[selectedCardIndex] : null;
                    if (!card) { this.showNotification('Please select a card', 'error'); return; }
                    const last4 = (card.cardNumber||'').replace(/\s+/g,'').slice(-4);
                    details = { cardName: card.name || card.cardType || 'Card', last4, cardType: card.cardType || '' };
                }
                if (depositType === 'mobile-check') { details = { checkNumber: checkNumber || '', frontUploaded: !!checkFront, backUploaded: !!checkBack }; }
                if (depositType === 'wire-transfer') { details = { ...wireDetails }; }
                const transaction = this.createPendingTransaction('deposit', depositAmount, `${depositType} - $${depositAmount.toFixed(2)}`, depositType, details);
                if (!transaction) return;
                // Show success and close wizard
                this.showNotification('Deposit request submitted successfully! Check your transaction history.', 'success');
                wizard.remove();
                // Update transaction history immediately
                this.updateTransactionHistory();
                this.renderRecentDeposits();
            }
        });
    }

    validateCurrentStep(step, amount, type = 'mobile-check', ctx = {}) {
        switch(step) {
            case 1:
                if (amount <= 0) {
                    this.showNotification('Please enter a valid amount', 'error');
                    return false;
                }
                return true;
            case 2:
                if (type === 'atm-deposit') {
                    if (!ctx.selectedATM) { this.showNotification('Please select an ATM', 'error'); return false; }
                }
                if (type === 'card-deposit') {
                    if (ctx.selectedCardIndex == null) { this.showNotification('Please select a linked card', 'error'); return false; }
                }
                if (type === 'mobile-check') {
                    if (!ctx.checkFront || !ctx.checkBack) { this.showNotification('Please upload front and back images of the check', 'error'); return false; }
                    if (!ctx.checkNumber || !/^[0-9A-Za-z-]{2,}$/.test(ctx.checkNumber)) { this.showNotification('Please enter a valid check number', 'error'); return false; }
                }
                if (type === 'wire-transfer') {
                    const w = ctx.wireDetails || {};
                    if (!w.senderName || !w.bankName || !w.senderAccount) { this.showNotification('Please fill all required wire fields', 'error'); return false; }
                }
                return true;
            case 3:
                return true;
            default:
                return false;
        }
    }

    getDepositStep2Content(type) {
        if (type === 'atm-deposit') {
            return `
            <div class="step-header">
                <h4>Step 2: Find an ATM</h4>
                <p>Select an ATM to proceed</p>
            </div>
            <div class="atm-finder">
                <div class="row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span>Nearby ATMs</span>
                    <button class="btn-outline" id="atm-refresh"><i class="fas fa-sync"></i> Refresh</button>
                </div>
                <div id="atm-list" class="atm-list"></div>
            </div>`;
        }
        if (type === 'card-deposit') {
            return `
            <div class="step-header">
                <h4>Step 2: Choose Card</h4>
                <p>Select one of your linked cards</p>
            </div>
            <div class="atm-finder">
                <div class="row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span>Linked Cards</span>
                    <button class="btn-outline" id="atm-refresh" disabled><i class="fas fa-credit-card"></i> Cards</button>
                </div>
                <div id="card-list" class="atm-list"></div>
            </div>`;
        }
        if (type === 'mobile-check') {
            return `
            <div class="step-header">
                <h4>Step 2: Capture Check</h4>
                <p>Upload clear photos of the front and back</p>
            </div>
            <div class="check-capture">
                <label>Check Number
                    <input type="text" id="check-number" placeholder="e.g., 1042" />
                </label>
                <label>Front of Check
                    <input type="file" id="check-front" accept="image/*" />
                </label>
                <label>Back of Check
                    <input type="file" id="check-back" accept="image/*" />
                </label>
            </div>`;
        }
        if (type === 'wire-transfer') {
            return `
            <div class="step-header">
                <h4>Step 2: Wire Details</h4>
                <p>Provide sender and reference information</p>
            </div>
            <div class="wire-form">
                <label>Sender Name
                    <input type="text" id="wire-sender" placeholder="Sender full name" />
                </label>
                <label>Sending Bank Name
                    <input type="text" id="wire-bank" placeholder="e.g., Global Bank" />
                </label>
                <label>Sender Account Number
                    <input type="text" id="wire-sender-account" placeholder="e.g., 00123456789" />
                </label>
                <label>Reference (optional)
                    <input type="text" id="wire-reference" placeholder="Invoice or memo" />
                </label>
            </div>`;
        }
        // Default: account selection
        return `
        <div class="step-header">
            <h4>Step 2: Select Account</h4>
            <p>Choose the account to deposit into</p>
        </div>
        <div class="account-selection">
            <div class="account-option selected" data-account="checking">
                <div class="account-info">
                    <h5>Everyday Checking ...0630</h5>
                    <p>Current Balance: $${this.currentBalance.toFixed(2)}</p>
                </div>
                <i class="fas fa-check-circle"></i>
            </div>
        </div>`;
    }

    generateRandomATMs(n = 5) {
        const streets = ['Main St', 'Elm St', 'Maple Ave', 'Oak Blvd', 'Pine Rd', 'Cedar Ln', 'Broadway', 'Market St', '5th Ave', 'Sunset Blvd'];
        const cities = ['Downtown', 'Midtown', 'Riverside', 'Uptown', 'Westside', 'Eastside'];
        const brands = ['Allpoint', 'MoneyPass', 'CO-OP', 'Chase', 'Wells Fargo', 'Bank of America', 'Citi', 'PNC', 'US Bank', 'Capital One'];
        const list = [];
        for (let i = 0; i < n; i++) {
            const num = Math.floor(100 + Math.random() * 900);
            const id = `ATM-${Math.floor(1000 + Math.random() * 9000)}`;
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const name = `${brand} ATM #${num}`;
            const address = `${Math.floor(100 + Math.random() * 9900)} ${streets[Math.floor(Math.random()*streets.length)]}, ${cities[Math.floor(Math.random()*cities.length)]}`;
            const distance = Math.random() * 10;
            list.push({ id, name, address, distance });
        }
        return list;
    }

    openDirectDepositSetup() {
        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const user = users.find(u => u.email === this.currentUser.email || u.accountNumber === this.currentUser.accountNumber) || {};
        const routing = user.routingNumber || '—';
        const acct = user.accountNumber || '—';
        const html = `
            <div class="deposit-wizard-overlay" id="direct-deposit-modal">
                <div class="deposit-wizard">
                    <div class="wizard-header">
                        <h3>Direct Deposit Setup</h3>
                        <button class="close-wizard" id="dd-close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="wizard-content">
                        <div class="step-header">
                            <h4>Your Direct Deposit Information</h4>
                            <p>Provide these details to your employer</p>
                        </div>
                        <div class="dd-info" style="display:grid;gap:8px;">
                            <div><strong>Routing Number:</strong> <span id="dd-routing">${routing}</span> <button class="btn-outline" data-copy="#dd-routing">Copy</button></div>
                            <div><strong>Account Number:</strong> <span id="dd-account">${acct}</span> <button class="btn-outline" data-copy="#dd-account">Copy</button></div>
                            <div><strong>Account Type:</strong> Checking</div>
                        </div>
                        <hr/>
                        <div class="step-header">
                            <h4>Employer Details</h4>
                            <p>Save your employer info for reference</p>
                        </div>
                        <div class="dd-form" style="display:grid;gap:8px;">
                            <label>Employer Name<input type="text" id="dd-employer" placeholder="Company Inc."/></label>
                            <label>HR/Payroll Email (optional)<input type="email" id="dd-email" placeholder="payroll@company.com"/></label>
                            <label>Pay Frequency
                                <select id="dd-frequency">
                                    <option value="biweekly">Bi-Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="weekly">Weekly</option>
                                </select>
                            </label>
                            <label>Next Pay Date<input type="date" id="dd-date"/></label>
                            <label>Expected Amount (optional)<input type="number" step="0.01" id="dd-amount" placeholder="0.00"/></label>
                            <label class="remember-me"><input type="checkbox" id="dd-submit-now"/> <span class="checkmark"></span> Submit expected deposit for admin approval</label>
                        </div>
                    </div>
                    <div class="wizard-actions">
                        <button class="wizard-btn secondary" id="dd-cancel">Cancel</button>
                        <button class="wizard-btn primary" id="dd-save">Save</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById('direct-deposit-modal');
        const close = () => overlay && overlay.remove();
        overlay.querySelectorAll('#dd-close,#dd-cancel').forEach(b => b.addEventListener('click', close));
        overlay.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sel = btn.getAttribute('data-copy'); const el = overlay.querySelector(sel);
                if (el) navigator.clipboard.writeText(el.textContent.trim()).then(()=>this.showNotification('Copied', 'success'));
            });
        });
        overlay.querySelector('#dd-save').addEventListener('click', () => {
            const data = {
                employer: overlay.querySelector('#dd-employer').value || '',
                email: overlay.querySelector('#dd-email').value || '',
                frequency: overlay.querySelector('#dd-frequency').value || 'biweekly',
                nextPayDate: overlay.querySelector('#dd-date').value || '',
                expectedAmount: parseFloat(overlay.querySelector('#dd-amount').value || '0') || 0
            };
            const key = `userDirectDeposit_${this.currentUser.accountNumber}`;
            localStorage.setItem(key, JSON.stringify(data));
            this.showSuccess('Direct deposit details saved');
            const submitNow = overlay.querySelector('#dd-submit-now').checked;
            if (submitNow && data.expectedAmount > 0) {
                const desc = `direct-deposit (expected) - $${data.expectedAmount.toFixed(2)} from ${data.employer || 'Employer'}`;
                this.createPendingTransaction('deposit', data.expectedAmount, desc, 'direct-deposit', { employer: data.employer, nextPayDate: data.nextPayDate });
                this.updateTransactionHistory();
                this.renderRecentDeposits();
            }
            close();
        });
    }

    openAllDepositsModal() {
        const key = this.getUserTransactionKey();
        const all = JSON.parse(localStorage.getItem(key) || '[]').filter(t => t.type === 'deposit');
        const html = `
            <div class="deposit-wizard-overlay" id="all-deposits-modal">
                <div class="deposit-wizard">
                    <div class="wizard-header">
                        <h3>All Deposits</h3>
                        <button class="close-wizard" id="ad-close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="wizard-content" style="max-height:60vh;overflow:auto;">
                        ${all.length === 0 ? '<div class="empty-transactions" style="padding:16px;text-align:center;">No deposits yet</div>' :
                            all.map(t => `
                                <div class="deposit-item ${t.status}">
                                    <div class="deposit-status ${t.status === 'approved' ? 'completed' : t.status}">
                                        <i class="fas fa-${t.status==='approved'?'check-circle':t.status==='pending'?'clock':'times-circle'}"></i>
                                    </div>
                                    <div class="deposit-details">
                                        <h5>${(t.subType||'deposit').replace(/-/g,' ')}</h5>
                                        <p>${t.description||''}</p>
                                        <span class="deposit-date">${new Date(t.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div class="deposit-amount ${t.status==='declined'?'pending':'success'}">+$${Number(t.amount).toFixed(2)}</div>
                                </div>`).join('')
                        }
                    </div>
                    <div class="wizard-actions">
                        <button class="wizard-btn primary" id="ad-ok">Close</button>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById('all-deposits-modal');
        const close = () => overlay && overlay.remove();
        overlay.querySelectorAll('#ad-close,#ad-ok').forEach(b => b.addEventListener('click', close));
    }

    renderRecentDeposits() {
        try {
            const container = document.querySelector('#deposit-content .deposits-list');
            if (!container) return;
            const key = this.getUserTransactionKey();
            const all = JSON.parse(localStorage.getItem(key) || '[]').filter(t => t.type === 'deposit');
            const latest = all.sort((a,b)=> new Date(b.timestamp)-new Date(a.timestamp)).slice(0,5);
            if (latest.length === 0) {
                container.innerHTML = `<div class="empty-transactions" style="padding:16px 0;">
                    <div class="empty-icon"><i class="fas fa-inbox"></i></div>
                    <h4>No deposits yet</h4>
                    <p>New deposits will appear here after you submit them.</p>
                </div>`;
                return;
            }
            container.innerHTML = latest.map(t => {
                const isApproved = t.status === 'approved';
                const isPending = t.status === 'pending';
                return `
                    <div class="deposit-item ${isApproved ? 'completed' : (isPending ? 'pending' : 'declined')} ">
                        <div class="deposit-status ${isApproved ? 'completed' : (isPending ? 'pending' : 'declined')}">
                            <i class="fas fa-${isApproved ? 'check-circle' : (isPending ? 'clock' : 'times-circle')}"></i>
                        </div>
                        <div class="deposit-details">
                            <h5>${(t.subType||'Deposit').replace(/-/g,' ')}</h5>
                            <p>${t.description || ''}</p>
                            <span class="deposit-date">${new Date(t.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div class="deposit-amount ${isApproved ? 'success' : (isPending ? 'pending' : '')}">+$${Number(t.amount).toFixed(2)}</div>
                    </div>`;
            }).join('');
        } catch {}
    }

    updateWizardStep(step) {
        const steps = document.querySelectorAll('.wizard-step');
        const backBtn = document.getElementById('back-btn');
        const nextBtn = document.getElementById('next-btn');
        const submitBtn = document.getElementById('submit-btn');
        
        // Hide all steps
        steps.forEach(s => s.classList.remove('active'));
        
        // Show current step
        document.getElementById(`step-${step}`).classList.add('active');
        
        // Update buttons
        backBtn.style.display = step > 1 ? 'block' : 'none';
        nextBtn.style.display = step < 3 ? 'block' : 'none';
        submitBtn.style.display = step === 3 ? 'block' : 'none';
    }

    createPendingTransaction(type, amount, description, subType = null, details = null) {
        // Require transaction PIN set
        if (!this.requireTransactionPinOrSetup('make a transaction')) return null;
        // Block transactions for non-active users
        if (!this.isUserActiveForTransactions()) {
            this.showNotification('Your account is frozen. Transactions are disabled.', 'error');
            return null;
        }
        // Enforce daily transfer limit (applies to transfer and bill pay)
        try {
            if (type === 'transfer' || type === 'billpay') {
                const limits = this.loadUserLimits();
                const limit = Number(limits?.dailyTransferLimit || 0);
                const todayStr = new Date().toDateString();
                const userTransactionKey = this.getUserTransactionKey();
                const allTx = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
                const usedApproved = allTx
                    .filter(t => (t.type === 'transfer' || t.type === 'billpay') && t.status === 'approved' && new Date(t.timestamp).toDateString() === todayStr)
                    .reduce((s, t) => s + Number(t.amount || 0), 0);
                if (limit > 0 && (usedApproved + Number(amount)) > limit) {
                    this.showNotification(`Daily transfer limit reached. Limit: ${this.formatCurrency(limit)}. Used: ${this.formatCurrency(usedApproved)}.`, 'error');
                    return null;
                }
                // Also ensure sufficient available funds (consider pending outgoings)
                const available = Number(this.currentBalance) || 0;
                try {
                    const allPending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                    const pendingOut = allPending
                        .filter(t => t.accountNumber === this.currentUser.accountNumber && (t.type === 'transfer' || t.type === 'billpay'))
                        .reduce((s, t) => s + Number(t.amount || 0), 0);
                    const effectiveAvailable = available - pendingOut;
                    if (Number(amount) > effectiveAvailable) {
                        this.showNotification(`Insufficient funds. Available after pending: $${Math.max(0, effectiveAvailable).toFixed(2)}`, 'error');
                        return null;
                    }
                } catch {
                    if (Number(amount) > available) {
                        this.showNotification(`Insufficient funds. Available: $${available.toFixed(2)}`, 'error');
                        return null;
                    }
                }
            }
        } catch {}
        const transaction = {
            id: Date.now(),
            userId: this.currentUser.id,
            userName: this.currentUser.name,
            userEmail: this.currentUser.email,
            userAvatar: this.currentUser.avatar,
            accountNumber: this.currentUser.accountNumber,
            type: type,
            subType: subType,
            details: details,
            amount: parseFloat(amount),
            description: description,
            status: 'pending',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };
        
    // Confirm PIN for this transaction
    const confirmed = this.promptForPinConfirmation();
    if (!confirmed) { this.showNotification('Transaction cancelled.', 'error'); return null; }

    // Add to pending transactions
        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
        pending.push(transaction);
        localStorage.setItem('pendingTransactions', JSON.stringify(pending));
        
        // Add to user's transaction history as pending (per-user key)
        const userTransactionKey = this.getUserTransactionKey();
        const userTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
        userTransactions.unshift(transaction);
        localStorage.setItem(userTransactionKey, JSON.stringify(userTransactions));
        
        // Try to sync to backend in background (non-blocking)
        try {
            const api = (window.AppConfig && window.AppConfig.apiBaseUrl) || '';
            if (api) {
                fetch(`${api}/api/transactions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: transaction.type,
                        amount: transaction.amount,
                        description: transaction.description,
                        subType: transaction.subType,
                        details: transaction.details,
                        accountNumber: transaction.accountNumber,
                        userEmail: transaction.userEmail,
                        userName: transaction.userName
                    })
                }).then(r => r.ok ? r.json() : null).then(data => {
                    if (data && data.id) {
                        transaction.backendId = data.id;
                        // Optionally update local record with backendId
                        const key = this.getUserTransactionKey();
                        const hist = JSON.parse(localStorage.getItem(key) || '[]');
                        const idx = hist.findIndex(x => String(x.id) === String(transaction.id));
                        if (idx !== -1) { hist[idx].backendId = data.id; localStorage.setItem(key, JSON.stringify(hist)); }
                        const pend = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                        const pIdx = pend.findIndex(x => String(x.id) === String(transaction.id));
                        if (pIdx !== -1) { pend[pIdx].backendId = data.id; localStorage.setItem('pendingTransactions', JSON.stringify(pend)); }
                    }
                }).catch(() => {/* ignore */});
            }
        } catch {}
        return transaction;
    }

    promptForPinConfirmation() {
        try {
            if (this._pinBypass) return true;
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const user = users.find(u => u.email === this.currentUser.email || u.accountNumber === this.currentUser.accountNumber);
            const pin = user && user.pin;
            const userSet = !!(user && user.pinSetByUser);
            if (!pin || !userSet) { this.showSecuritySettingsModal(); return false; }
            // Simple synchronous prompt to preserve call sites
            const input = window.prompt('Enter your 4-digit transaction PIN:','');
            if (input === null) return false;
            return String(input).replace(/[^\d]/g,'').slice(0,4) === String(pin);
        } catch { return false; }
    }

    // Require a stored transaction PIN for sensitive operations
    requireTransactionPinOrSetup(contextLabel = 'perform this action') {
        try {
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const user = users.find(u => u.email === this.currentUser.email || u.accountNumber === this.currentUser.accountNumber);
            const pin = user && user.pin;
            const userSet = !!(user && user.pinSetByUser);
            if (!pin || !userSet) {
                this.showNotification(`A transaction PIN is required to ${contextLabel}. Please set it in Security Settings.`, 'error');
                // Offer to open security settings directly
                this.showSecuritySettingsModal();
                return false;
            }
            return true;
        } catch { return false; }
    }

    // Helper to ensure latest status from storage
    isUserActiveForTransactions() {
        try {
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const u = users.find(x => x.email === this.currentUser.email || x.accountNumber === this.currentUser.accountNumber);
            if (!u) return false; // deleted user
            return (u.status || 'active') === 'active';
        } catch {
            return false;
        }
    }

    renderFrozenBanner() {
        try {
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const u = users.find(x => x.email === this.currentUser.email || x.accountNumber === this.currentUser.accountNumber);
            const banner = document.getElementById('frozen-banner');
            if (!banner) return;
            if (u && u.status === 'frozen') {
                banner.style.display = 'flex';
            } else {
                banner.style.display = 'none';
            }
        } catch {}
    }

    setupTransferForms() {
        // Handle transfer button clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('.quick-pay-item') || e.target.closest('.quick-pay-item')) {
                e.preventDefault();
                this.handleTransferClick(e.target.closest('.quick-pay-item') || e.target);
            }
        });
    }

    handleTransferClick(transferItem) {
        const recipient = transferItem.querySelector('span')?.textContent || '';
        this.showTransferWizard('Quick Transfer', { recipientName: recipient });
    }

    updateTransactionHistory() {
        const transactionList = document.querySelector('.transaction-list');
        if (!transactionList) return;

        // Use user-specific transaction key
        const userTransactionKey = this.getUserTransactionKey();
        const userTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
        const approved = JSON.parse(localStorage.getItem('approvedTransactions') || '[]');

        // Combine and sort by timestamp (newest first)
        const allTransactions = [...userTransactions];

        // Add approved transactions that aren't already in user transactions
        approved.forEach(approvedTx => {
            if (!userTransactions.find(tx => tx.id === approvedTx.id && tx.accountNumber === this.currentUser.accountNumber)) {
                // Only add if this transaction belongs to this user
                if (approvedTx.accountNumber === this.currentUser.accountNumber) {
                    allTransactions.push(approvedTx);
                }
            }
        });

        // Sort by timestamp
        allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (allTransactions.length === 0) {
            // Show empty state
            transactionList.innerHTML = `
                <div class="empty-transactions">
                    <div class="empty-icon">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <h4>No transactions yet</h4>
                    <p>Your transaction history will appear here once you start making deposits and transfers.</p>
                </div>
            `;
        } else {
            // Show transactions with status indicators
            transactionList.innerHTML = allTransactions.map(transaction => {
                const statusClass = transaction.status || 'approved';
                const statusIcon = this.getStatusIcon(statusClass);
                const statusText = this.getStatusText(statusClass);
                const amountClass = transaction.type === 'deposit' ? 'positive' : 'negative';
                const amountPrefix = transaction.type === 'deposit' ? '+' : '-';
                
                return `
                    <div class="transaction-item ${statusClass}" data-txid="${transaction.id}" data-method="${transaction.subType || ''}">
                        <div class="transaction-date">${transaction.date}</div>
                        <div class="transaction-details">
                            <div class="transaction-description">
                                <span class="transaction-main">${transaction.description}</span>
                                <div class="transaction-status ${statusClass}">
                                    <i class="fas fa-${statusIcon}"></i>
                                    <span>${statusText}</span>
                                </div>
                            </div>
                            <div class="transaction-amount ${amountClass}">
                                ${amountPrefix}$${transaction.amount.toFixed(2)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        // Also reflect pay & transfer recent list
        this.renderRecentTransfers();
        // Refresh balance breakdown as pending/approved may have changed
        this.renderBalanceBreakdown();
        // Keep recent deposits list in sync
        this.renderRecentDeposits();
    }

    // Compute and render balance breakdown in Routing tab
    renderBalanceBreakdown() {
        try {
            const txKey = this.getUserTransactionKey();
            const all = JSON.parse(localStorage.getItem(txKey) || '[]');
            const pending = all.filter(t => t.status === 'pending');
            const approved = all.filter(t => t.status === 'approved');

            // Pending total: deposits positive; outgoing (transfer/billpay) negative
            const pendingTotal = pending.reduce((sum, t) => {
                const amt = Number(t.amount) || 0;
                if (t.type === 'deposit') return sum + amt;
                if (t.type === 'transfer' || t.type === 'billpay') return sum - amt;
                return sum;
            }, 0);

            const available = Number(this.currentBalance) || 0;
            const currentInclPending = available + pendingTotal;

            // Average Daily Balance (last 30 days) from approved transactions
            const days = 30;
            const today = new Date();
            const windowStart = new Date(today.getTime() - (days - 1) * 86400000);
            const inWindow = approved.filter(t => new Date(t.timestamp) >= windowStart);
            const balKey = this.getUserBalanceKey();
            const endBal = Number(localStorage.getItem(balKey) || '0');
            const netChange = inWindow.reduce((sum, t) => {
                const amt = Number(t.amount) || 0;
                if (t.type === 'deposit') return sum - amt;
                if (t.type === 'transfer' || t.type === 'billpay') return sum + amt;
                return sum;
            }, 0);
            let startBal = endBal + netChange;
            const daily = new Array(days).fill(0).map((_, i) => ({ date: new Date(windowStart.getTime() + i * 86400000), bal: 0 }));
            let running = startBal;
            for (let i = 0; i < days; i++) {
                const d0 = daily[i].date.toDateString();
                const dayTx = inWindow.filter(t => new Date(t.timestamp).toDateString() === d0);
                dayTx.sort((a,b)=> new Date(a.timestamp)-new Date(b.timestamp));
                for (const t of dayTx) {
                    const amt = Number(t.amount) || 0;
                    if (t.type === 'deposit') running += amt;
                    if (t.type === 'transfer' || t.type === 'billpay') running -= amt;
                }
                daily[i].bal = running;
            }
            const avgDaily = daily.reduce((s, d) => s + d.bal, 0) / days;

            const cards = document.querySelectorAll('#routing .balance-cards .balance-card');
            if (cards && cards.length >= 4) {
                // Available
                const availEl = cards[0].querySelector('.balance-amount');
                const availNote = cards[0].querySelector('.balance-note');
                if (availEl) availEl.textContent = `$${available.toFixed(2)}`;
                if (availNote) availNote.textContent = available === 0 ? 'No available funds' : 'Ready to spend';

                // Pending
                const pendEl = cards[1].querySelector('.balance-amount');
                const pendNote = cards[1].querySelector('.balance-note');
                if (pendEl) pendEl.textContent = `${pendingTotal < 0 ? '-' : ''}$${Math.abs(pendingTotal).toFixed(2)}`;
                if (pendNote) pendNote.textContent = pending.length ? `${pending.length} pending ${pending.length === 1 ? 'item' : 'items'}` : 'No pending';

                // Current incl pending
                const currEl = cards[2].querySelector('.balance-amount');
                const currNote = cards[2].querySelector('.balance-note');
                if (currEl) currEl.textContent = `$${currentInclPending.toFixed(2)}`;
                if (currNote) currNote.textContent = 'Including pending';

                // Average daily
                const avgEl = cards[3].querySelector('.balance-amount');
                const avgNote = cards[3].querySelector('.balance-note');
                if (avgEl) avgEl.textContent = `$${(isFinite(avgDaily) ? avgDaily : 0).toFixed(2)}`;
                if (avgNote) avgNote.textContent = 'Last 30 days';
            }

            const lu = document.querySelector('#routing .balance-breakdown .last-updated');
            if (lu) lu.textContent = `Last updated: ${new Date().toLocaleString()}`;
        } catch {}
    }

    // Simple HTML escape utility
    escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    renderRecentTransfers() {
        const container = document.querySelector('.transfers-list');
        if (!container) return;
        const userTransactionKey = this.getUserTransactionKey();
        const userTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
        const approved = JSON.parse(localStorage.getItem('approvedTransactions') || '[]');
        const all = [...userTransactions];
        approved.forEach(t => {
            if (!userTransactions.find(x => x.id === t.id && x.accountNumber === this.currentUser.accountNumber)) {
                if (t.accountNumber === this.currentUser.accountNumber) all.push(t);
            }
        });
        all.sort((a,b)=> new Date(b.timestamp) - new Date(a.timestamp));
        const recent = all.slice(0, 5);
        if (!recent.length) {
            container.innerHTML = `
                <div class="empty-transactions">
                    <div class="empty-icon"><i class="fas fa-receipt"></i></div>
                    <h4>No recent activity</h4>
                    <p>New transfers and deposits will appear here.</p>
                </div>`;
            return;
        }
        container.innerHTML = recent.map(tx => {
            const isDeposit = tx.type === 'deposit';
            const amountClass = isDeposit ? 'received' : 'sent';
            const sign = isDeposit ? '+' : '-';
            const methodLabel = tx.subType ? (tx.subType.charAt(0).toUpperCase()+tx.subType.slice(1)) : (isDeposit ? 'Deposit' : 'Transfer');
            const title = tx.description || (isDeposit ? 'Deposit' : 'Transfer');
            const date = new Date(tx.timestamp).toLocaleDateString();
            return `
                <div class="transfer-item">
                    <div class="transfer-icon ${amountClass}">
                        <i class="fas fa-arrow-${isDeposit ? 'down' : 'up'}"></i>
                    </div>
                    <div class="transfer-details">
                        <h5>${this.escapeHtml(title)}</h5>
                        <p>${this.escapeHtml(methodLabel)} • ${date}</p>
                    </div>
                    <div class="transfer-amount ${amountClass}">${sign}$${Number(tx.amount).toFixed(2)}</div>
                </div>`;
        }).join('');
    }

    getStatusIcon(status) {
        switch(status) {
            case 'pending': return 'clock';
            case 'approved': return 'check-circle';
            case 'declined': return 'times-circle';
            default: return 'check-circle';
        }
    }

    getStatusText(status) {
        switch(status) {
            case 'pending': return 'Pending Approval';
            case 'approved': return 'Approved';
            case 'declined': return 'Declined';
            default: return 'Completed';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Admin Dashboard
    setupAdminDashboard() {
        const adminBtn = document.getElementById('admin-dashboard-btn');
        const adminDashboard = document.getElementById('admin-dashboard');
        const backBtn = document.querySelector('.back-to-menu');
        
        if (adminBtn) {
            adminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showAdminDashboard();
            });
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.hideAdminDashboard();
            });
        }
        
        // Setup approval/rejection handlers with better event delegation
        document.addEventListener('click', (e) => {
            // Handle approve/reject buttons
            if (e.target.matches('.approve-btn') || e.target.closest('.approve-btn')) {
                const btn = e.target.matches('.approve-btn') ? e.target : e.target.closest('.approve-btn');
                const transactionId = btn.dataset.transactionId;
                if (transactionId && !btn.disabled) {
                    this.approveTransaction(transactionId);
                }
            } else if (e.target.matches('.reject-btn') || e.target.closest('.reject-btn')) {
                const btn = e.target.matches('.reject-btn') ? e.target : e.target.closest('.reject-btn');
                const transactionId = btn.dataset.transactionId;
                if (transactionId) {
                    this.rejectTransaction(transactionId);
                }
            }
            // Handle clickable user elements
            else if (e.target.matches('.clickable') || e.target.closest('.clickable')) {
                const element = e.target.matches('.clickable') ? e.target : e.target.closest('.clickable');
                const userId = element.dataset.userId;
                console.log('Clicked user element with ID:', userId);
                if (userId) {
                    this.showUserDetails(userId);
                }
            }
            // Handle user avatar clicks specifically
            else if (e.target.matches('.user-avatar') || e.target.closest('.user-avatar')) {
                const element = e.target.matches('.user-avatar') ? e.target : e.target.closest('.user-avatar');
                const userId = element.dataset.userId;
                console.log('Clicked user avatar with ID:', userId);
                if (userId) {
                    this.showUserDetails(userId);
                }
            }
            // Handle user name clicks specifically
            else if (e.target.matches('.user-name') || e.target.closest('.user-name')) {
                const element = e.target.matches('.user-name') ? e.target : e.target.closest('.user-name');
                const userId = element.dataset.userId;
                console.log('Clicked user name with ID:', userId);
                if (userId) {
                    this.showUserDetails(userId);
                }
            }
            // Handle Total Users card click
            else if (e.target.matches('#total-users-card') || e.target.closest('#total-users-card')) {
                console.log('Clicked Total Users card');
                this.showAllUsersModal();
            }
        });
    }

    showUserDetails(userId) {
        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const user = users.find(u => u.accountNumber === userId || u.email === userId);
        
        if (!user) {
            this.showNotification('User not found', 'error');
            return;
        }

        // Create user details modal
        const modalHTML = `
            <div class="user-details-modal" id="user-details-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="user-avatar-large">
                            <span>${user.avatar}</span>
                        </div>
                        <div class="user-title-info">
                            <h2>${user.name}</h2>
                            <span class="user-status ${user.status}">${user.status.toUpperCase()}</span>
                        </div>
                        <button class="close-modal">
                            <i class="fas fa-times"></i>
                        </button>
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
                                    <span>${user.phoneNumber}</span>
                                </div>
                                <div class="info-row">
                                    <label>Account Number:</label>
                                    <span>${user.accountNumber}</span>
                                </div>
                                <div class="info-row">
                                    <label>Account Type:</label>
                                    <span>${user.accountType}</span>
                                </div>
                                <div class="info-row">
                                    <label>Date Created:</label>
                                    <span>${user.dateCreated}</span>
                                </div>
                                <div class="info-row">
                                    <label>Last Login:</label>
                                    <span>${new Date(user.lastLogin).toLocaleString()}</span>
                                </div>
                            </div>
                            
                            <div class="info-section">
                                <h3><i class="fas fa-shield-alt"></i> Security Information</h3>
                                <div class="info-row">
                                    <label>Login Password:</label>
                                    <span class="password-field">
                                        <span class="password-hidden">••••••••••</span>
                                        <button class="show-password" data-password="${user.password}">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </span>
                                </div>
                                <div class="info-row">
                                    <label>Transaction PIN:</label>
                                    <span class="password-field">
                                        <span class="pin-hidden">••••</span>
                                        <button class="show-pin" data-pin="${user.transactionPin}">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </span>
                                </div>
                                <div class="info-row">
                                    <label>Security Questions:</label>
                                    <div class="security-questions">
                                        ${user.securityQuestions.map((sq, index) => `
                                            <div class="question-item">
                                                <strong>Q${index + 1}:</strong> ${sq.question}<br>
                                                <strong>A:</strong> <span class="answer-hidden">••••••••</span>
                                                <button class="show-answer" data-answer="${sq.answer}">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="info-section">
                                <h3><i class="fas fa-map-marker-alt"></i> Address Information</h3>
                                <div class="info-row">
                                    <label>Street:</label>
                                    <span>${user.address.street}</span>
                                </div>
                                <div class="info-row">
                                    <label>City:</label>
                                    <span>${user.address.city}</span>
                                </div>
                                <div class="info-row">
                                    <label>State:</label>
                                    <span>${user.address.state}</span>
                                </div>
                                <div class="info-row">
                                    <label>ZIP Code:</label>
                                    <span>${user.address.zipCode}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <div class="action-buttons">
                            <button class="action-btn ${user.status === 'blocked' ? 'unblock' : 'block'}" data-user-id="${user.accountNumber}" data-action="${user.status === 'blocked' ? 'unblock' : 'block'}">
                                <i class="fas fa-${user.status === 'blocked' ? 'unlock' : 'ban'}"></i>
                                ${user.status === 'blocked' ? 'Unblock' : 'Block'} Account
                            </button>
                            <button class="action-btn ${user.status === 'frozen' ? 'unfreeze' : 'freeze'}" data-user-id="${user.accountNumber}" data-action="${user.status === 'frozen' ? 'unfreeze' : 'freeze'}">
                                <i class="fas fa-${user.status === 'frozen' ? 'fire' : 'snowflake'}"></i>
                                ${user.status === 'frozen' ? 'Unfreeze' : 'Freeze'} Account
                            </button>
                            <button class="action-btn delete" data-user-id="${user.accountNumber}" data-action="delete">
                                <i class="fas fa-trash"></i>
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Setup modal event handlers
        this.setupUserDetailsModalHandlers(user);
    }

    setupUserDetailsModalHandlers(user) {
        const modal = document.getElementById('user-details-modal');
        
        // Close modal
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Show/hide password
        modal.querySelectorAll('.show-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const passwordSpan = btn.parentElement.querySelector('.password-hidden');
                const isHidden = passwordSpan.textContent.includes('•');
                passwordSpan.textContent = isHidden ? btn.dataset.password : '••••••••••';
                btn.querySelector('i').className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        });
        
        // Show/hide PIN
        modal.querySelectorAll('.show-pin').forEach(btn => {
            btn.addEventListener('click', () => {
                const pinSpan = btn.parentElement.querySelector('.pin-hidden');
                const isHidden = pinSpan.textContent.includes('•');
                pinSpan.textContent = isHidden ? btn.dataset.pin : '••••';
                btn.querySelector('i').className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        });
        
        // Show/hide security answers
        modal.querySelectorAll('.show-answer').forEach(btn => {
            btn.addEventListener('click', () => {
                const answerSpan = btn.parentElement.querySelector('.answer-hidden');
                const isHidden = answerSpan.textContent.includes('•');
                answerSpan.textContent = isHidden ? btn.dataset.answer : '••••••••';
                btn.querySelector('i').className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        });
        
        // Account actions
        modal.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                const action = btn.dataset.action;
                this.performUserAction(userId, action);
                modal.remove();
            });
        });
    }

    performUserAction(userId, action) {
        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const userIndex = users.findIndex(u => u.accountNumber === userId || u.email === userId);
        if (userIndex === -1) { this.showNotification('User not found', 'error'); return; }
        const user = users[userIndex];
        
        switch(action) {
            case 'block':
                user.status = 'blocked';
                this.showNotification(`${user.name}'s account has been blocked`, 'success');
                break;
            case 'unblock':
                user.status = 'active';
                this.showNotification(`${user.name}'s account has been unblocked`, 'success');
                break;
            case 'freeze':
                user.status = 'frozen';
                this.showNotification(`${user.name}'s account has been frozen`, 'success');
                break;
            case 'unfreeze':
                user.status = 'active';
                this.showNotification(`${user.name}'s account has been unfrozen`, 'success');
                break;
            case 'delete':
                if (confirm(`Are you sure you want to delete ${user.name}'s account? This action cannot be undone.`)) {
                    users.splice(userIndex, 1);
                    if (user.accountNumber) {
                        localStorage.removeItem(`userTransactions_${user.accountNumber}`);
                        localStorage.removeItem(`userBalance_${user.accountNumber}`);
                    }
                    this.showNotification(`${user.name}'s account has been deleted`, 'error');
                } else {
                    return; // Don't save if cancelled
                }
                break;
            default:
                this.showNotification('Unknown action', 'error');
                return;
        }
        
        // Save updated users
        localStorage.setItem('bankingUsers', JSON.stringify(users));
        
        // Refresh admin dashboard if it's open
        if (document.getElementById('admin-dashboard').style.display === 'block') {
            this.updateAdminDashboard();
        }
        
        // Refresh all users modal if it's open
        if (document.getElementById('all-users-modal').style.display === 'block') {
            this.showAllUsersModal();
        }
    }

    showAllUsersModal() {
        const modal = document.getElementById('all-users-modal');
        const usersGrid = document.getElementById('all-users-grid');
        const allUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        
        console.log('Showing all users modal with', allUsers.length, 'users');
        
        // Generate users grid HTML
        usersGrid.innerHTML = allUsers.map(user => {
            const statusClass = user.status === 'blocked' ? 'blocked' : user.status === 'frozen' ? 'frozen' : 'active';
            const statusIcon = user.status === 'blocked' ? 'fas fa-ban' : user.status === 'frozen' ? 'fas fa-snowflake' : 'fas fa-check-circle';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '—';
            
            return `
                <div class="user-card clickable" data-user-id="${user.accountNumber}">
                    <div class="user-avatar ${statusClass}">
                        <span>${(user.name || '').split(' ').map(n => n[0]).join('')}</span>
                        <div class="status-indicator ${statusClass}">
                            <i class="${statusIcon}"></i>
                        </div>
                    </div>
                    <div class="user-info">
                        <h4 class="user-name">${user.name}</h4>
                        <p class="user-email">${user.email}</p>
                        <p class="user-account">Account: ${user.accountNumber}</p>
                        <p class="user-type">${(user.accountType || 'checking').charAt(0).toUpperCase() + (user.accountType || 'checking').slice(1)}</p>
                        <div class="user-status-info">
                            <span class="status-badge ${statusClass}">
                                <i class="${statusIcon}"></i>
                                ${user.status.toUpperCase()}
                            </span>
                            <span class="last-login">Last login: ${lastLogin}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        modal.style.display = 'block';
    }

    showAdminDashboard() {
        console.log('Opening admin dashboard...');
        const dashboard = document.getElementById('admin-dashboard');
        
        if (!dashboard) {
            console.error('Admin dashboard element not found!');
            return;
        }
        
        dashboard.style.display = 'block';
        console.log('Admin dashboard made visible');
        
    // Do not create demo transactions
        
        // Update dashboard content
        this.updateAdminDashboard();
    }

    hideAdminDashboard() {
        const dashboard = document.getElementById('admin-dashboard');
        dashboard.style.display = 'none';
    }

    updateAdminDashboard() {
        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
        const approved = JSON.parse(localStorage.getItem('approvedTransactions') || '[]');
        
        console.log('Admin Dashboard - Pending transactions:', pending);
        console.log('Admin Dashboard - Approved transactions:', approved);
        
        // Update stats
        document.getElementById('pending-count').textContent = pending.length;
        document.getElementById('approved-count').textContent = approved.filter(t => 
            new Date(t.timestamp).toDateString() === new Date().toDateString()
        ).length;
        
    // Update total users count from approved users
    const approvedUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
    const totalUsersEl = document.getElementById('total-users-count');
    if (totalUsersEl) totalUsersEl.textContent = approvedUsers.length;
        
        // Update pending list
        const pendingList = document.getElementById('pending-transactions-list');
        
        if (!pendingList) {
            console.error('Pending transactions list element not found!');
            return;
        }
        
    if (pending.length === 0) {
            pendingList.innerHTML = `
                <div class="empty-pending">
                    <i class="fas fa-check-circle"></i>
                    <h4>All caught up!</h4>
                    <p>No pending transactions to review</p>
                </div>
            `;
        } else {
            console.log('Rendering', pending.length, 'pending transactions');
            pendingList.innerHTML = pending.map(transaction => {
                // Get user status for visual indicators from approved users
                const approvedUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                const user = approvedUsers.find(u => u.accountNumber === transaction.accountNumber || u.email === transaction.userEmail);
                const userStatus = user ? (user.status || 'active') : 'active';
                
                return `
                <div class="pending-item ${transaction.type} ${userStatus !== 'active' ? 'user-' + userStatus : ''}">
                    <div class="pending-user-info">
                        <div class="user-avatar clickable ${userStatus !== 'active' ? 'status-' + userStatus : ''}" data-user-id="${transaction.userId}" title="Click to view user details">
                            <span>${transaction.userAvatar || 'U'}</span>
                            ${userStatus !== 'active' ? `<div class="status-indicator ${userStatus}"></div>` : ''}
                        </div>
                        <div class="user-details">
                            <h5 class="user-name clickable" data-user-id="${transaction.userId}">
                                ${transaction.userName || 'Unknown User'}
                                ${userStatus !== 'active' ? `<span class="user-status-badge ${userStatus}">${userStatus.toUpperCase()}</span>` : ''}
                            </h5>
                            <p class="user-account">Account: ${transaction.accountNumber || 'N/A'}</p>
                            <p class="user-email">${transaction.userEmail || ''}</p>
                        </div>
                    </div>
                    <div class="pending-transaction-details">
                        <div class="pending-header">
                            <span class="pending-type ${transaction.type}">${transaction.type.toUpperCase()}</span>
                            <span class="pending-amount">$${transaction.amount.toFixed(2)}</span>
                        </div>
                        <div class="pending-description">${transaction.description}</div>
                        <div class="pending-meta">
                            <small><i class="fas fa-clock"></i> Submitted: ${new Date(transaction.timestamp).toLocaleString()}</small>
                            ${transaction.subType ? `<br><small><i class="fas fa-tag"></i> Type: ${transaction.subType}</small>` : ''}
                        </div>
                    </div>
                    <div class="pending-actions">
                        <button class="approve-btn" data-transaction-id="${transaction.id}" ${userStatus !== 'active' ? 'disabled title="Cannot approve - user account is ' + userStatus + '"' : ''}>
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button class="reject-btn" data-transaction-id="${transaction.id}">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                </div>
            `;
            }).join('');
        }
    }

    approveTransaction(transactionId) {
        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
        const approved = JSON.parse(localStorage.getItem('approvedTransactions') || '[]');
        const userTransactionKey = this.getUserTransactionKey();
        const userTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
        
        const transactionIndex = pending.findIndex(t => t.id == transactionId);
        if (transactionIndex === -1) return;
        
        const transaction = pending[transactionIndex];
        transaction.status = 'approved';
        transaction.approvedAt = new Date().toISOString();
        
        // Update balance
        if (transaction.type === 'deposit') {
            this.currentBalance += transaction.amount;
        } else if (transaction.type === 'transfer') {
            this.currentBalance -= transaction.amount;
        }
        
    // Save new balance (per-user key)
    const userBalanceKey = this.getUserBalanceKey();
    localStorage.setItem(userBalanceKey, this.currentBalance.toString());
        
        // Update transaction in user's transaction history
        const userTxIndex = userTransactions.findIndex(t => t.id == transactionId);
        if (userTxIndex !== -1) {
            userTransactions[userTxIndex].status = 'approved';
            userTransactions[userTxIndex].approvedAt = transaction.approvedAt;
        }
        
        // Move to approved
        approved.push(transaction);
        pending.splice(transactionIndex, 1);
        
        // Update storage
        localStorage.setItem('pendingTransactions', JSON.stringify(pending));
        localStorage.setItem('approvedTransactions', JSON.stringify(approved));
    localStorage.setItem(userTransactionKey, JSON.stringify(userTransactions));
        
        // Update UI
        this.updateBalanceDisplay();
        this.updateTransactionHistory();
        this.updateAdminDashboard();
        
        this.showNotification(`${transaction.type === 'deposit' ? 'Deposit' : 'Transfer'} approved successfully`, 'success');
    }

    rejectTransaction(transactionId) {
        const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
        const userTransactionKey = this.getUserTransactionKey();
        const userTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
        
        const transactionIndex = pending.findIndex(t => t.id == transactionId);
        if (transactionIndex === -1) return;
        
        const transaction = pending[transactionIndex];
        
        // Update transaction status in user's transaction history
        const userTxIndex = userTransactions.findIndex(t => t.id == transactionId);
        if (userTxIndex !== -1) {
            userTransactions[userTxIndex].status = 'declined';
            userTransactions[userTxIndex].declinedAt = new Date().toISOString();
        }
        
        // Remove from pending
        pending.splice(transactionIndex, 1);
        localStorage.setItem('pendingTransactions', JSON.stringify(pending));
    localStorage.setItem(userTransactionKey, JSON.stringify(userTransactions));
        
        // Update UI
        this.updateTransactionHistory();
        this.updateAdminDashboard();
        
        this.showNotification(`${transaction.type === 'deposit' ? 'Deposit' : 'Transfer'} declined`, 'error');
    }

    initializeDefaultView() {
        // Ensure main content is visible by default
        const mainContent = document.querySelector('.content-area');
        if (mainContent) {
            mainContent.style.display = 'block';
        }
        
        // Hide all bottom tab contents initially
        const bottomTabContents = document.querySelectorAll('.bottom-tab-content');
        bottomTabContents.forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });
    }

    // Tab Navigation Functionality
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.nav-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchTab(targetTab, tabButtons, tabContents);
            });
        });
    }

    switchTab(targetTab, tabButtons, tabContents) {
        // Remove active class from all tabs and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        const activeButton = document.querySelector(`[data-tab="${targetTab}"]`);
        const activeContent = document.getElementById(targetTab);

        if (activeButton && activeContent) {
            activeButton.classList.add('active');
            activeContent.classList.add('active');
            this.currentTab = targetTab;
        }
    }

    // Bottom Navigation Functionality
    setupBottomNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // Remove active class from all nav items
                navItems.forEach(nav => nav.classList.remove('active'));
                
                // Add active class to clicked item
                e.currentTarget.classList.add('active');
                
                // Get the nav item name
                const navName = e.currentTarget.querySelector('span').textContent;
                this.currentBottomNav = navName;
                
                // Handle navigation actions
                this.handleBottomNavigation(navName);
            });
        });
    }

    handleBottomNavigation(navName) {
        // Hide all bottom tab contents
        const bottomTabContents = document.querySelectorAll('.bottom-tab-content');
        bottomTabContents.forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });

        // Get main content area
        const mainContent = document.querySelector('.content-area');

        // Show appropriate content based on navigation
        switch(navName) {
            case 'Accounts':
                // Show main content (Overview, Manage, Routing tabs) for Accounts
                if (mainContent) {
                    mainContent.style.display = 'block';
                }
                break;
            case 'Deposit':
                // Hide main content and show deposit content
                if (mainContent) {
                    mainContent.style.display = 'none';
                }
                this.showBottomTabContent('deposit-content');
                break;
            case 'Pay & Transfer':
                // Hide main content and show pay & transfer content
                if (mainContent) {
                    mainContent.style.display = 'none';
                }
                this.showBottomTabContent('pay-transfer-content');
                break;
            case 'Explore':
                // Hide main content and show explore content
                if (mainContent) {
                    mainContent.style.display = 'none';
                }
                this.showBottomTabContent('explore-content');
                break;
            case 'Menu':
                // Hide main content and show menu content
                if (mainContent) {
                    mainContent.style.display = 'none';
                }
                this.showBottomTabContent('menu-content');
                this.renderMenuProfile();
                break;
        }
    }

    showBottomTabContent(contentId) {
        const content = document.getElementById(contentId);
        if (content) {
            content.style.display = 'block';
            content.classList.add('active');
        }
    }

    // Button Handlers
    setupButtonHandlers() {
        // Back button removed

        // Notification button removed from header

        // Sign off button
        const signOffBtn = document.querySelector('.sign-off-btn');
        if (signOffBtn) {
            signOffBtn.addEventListener('click', () => {
                console.log('Sign off clicked');
                this.logout();
            });
        }

        // Account routing button removed

        // Transaction controls
        const searchTransactionsBtn = document.querySelector('.search-transactions');
        const filterTransactionsBtn = document.querySelector('.filter-transactions');

        if (searchTransactionsBtn) {
            searchTransactionsBtn.addEventListener('click', () => {
                console.log('Search transactions clicked');
                this.toggleTransactionSearch();
            });
        }

        if (filterTransactionsBtn) {
            filterTransactionsBtn.addEventListener('click', () => {
                console.log('Filter transactions clicked');
                this.showFilterOptions();
            });
        }

        // Transaction items: show receipt on click
        document.addEventListener('click', (e) => {
            const item = e.target.closest('.transaction-item');
            if (item && item.closest('#overview')) {
                this.showTransactionReceipt(item);
            }
        });

        // Manage Tab Features
        this.setupManageFeatures();

        // Routing Tab Features
        this.setupRoutingFeatures();

        // Bottom Navigation Features
        this.setupBottomNavigationFeatures();
    }

    // Bottom Navigation Features Setup
    setupBottomNavigationFeatures() {
        // Deposit Tab Features  
        this.setupDepositFeatures();

        // Pay & Transfer Tab Features
        this.setupPayTransferFeatures();

        // Explore Tab Features
    this.setupExploreFeatures();

        // Menu Tab Features
        this.setupMenuFeatures();
    }

    // Deposit Tab Features
    setupDepositFeatures() {
        // Deposit buttons
        const depositBtns = document.querySelectorAll('.deposit-btn');
        depositBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const depositType = btn.dataset.deposit;
                this.handleDepositAction(depositType);
            });
        });

        // View all deposits
        const viewAllDepositsBtn = document.querySelector('[data-action="view-all-deposits"]');
        if (viewAllDepositsBtn) {
            viewAllDepositsBtn.addEventListener('click', () => {
                this.viewAllDeposits();
            });
        }
    }

    // Pay & Transfer Tab Features
    setupPayTransferFeatures() {
        // Quick pay actions
        const quickPayCards = document.querySelectorAll('.quick-pay-card');
        quickPayCards.forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                this.handlePayTransferAction(action);
            });
        });

        // Payment method cards
        const methodCards = document.querySelectorAll('.method-card');
        methodCards.forEach(card => {
            card.addEventListener('click', () => {
                const method = card.dataset.method;
                this.handlePaymentMethod(method);
            });
        });

        // Scheduled payments removed (UI and handlers)

        // View all transfers (list populated from actual transactions elsewhere)
        const viewAllTransfersBtn = document.querySelector('[data-action="view-all-transfers"]');
        if (viewAllTransfersBtn) {
            viewAllTransfersBtn.addEventListener('click', () => {
                this.viewAllTransfers();
            });
        }
    }

    // Explore Tab Features
    setupExploreFeatures() {
        // Featured offers buttons
        document.querySelectorAll('.offer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const offer = btn.dataset.offer;
                this.handleOffer(offer);
            });
        });

        // Financial tools
        document.querySelectorAll('.tool-card').forEach(card => {
            card.addEventListener('click', () => {
                const tool = card.dataset.tool;
                this.handleFinancialTool(tool);
            });
        });

        // Education
        document.querySelectorAll('.education-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const education = btn.dataset.education;
                this.handleEducationContent(education);
            });
        });

        // Rewards quick actions
        const redeemBtn = document.querySelector('.rewards-btn[data-action="redeem-rewards"]');
        if (redeemBtn) {
            redeemBtn.addEventListener('click', () => this.redeemRewards());
        }
        document.querySelectorAll('.reward-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const reward = btn.dataset.reward;
                this.handleRewardOption(reward);
            });
        });

        // Render rewards points if card exists
        this.renderRewardsDisplay();
    }

    // Pay & Transfer Action Handlers
    handlePayTransferAction(action) {
        switch(action) {
            case 'send-money':
                this.showTransferWizard('Send Money');
                break;
            case 'pay-bills':
                this.showBillPayWizard();
                break;
            case 'between-accounts':
                this.showTransferWizard('Transfer Between Accounts');
                break;
            default:
                this.showNotification(`${action} feature`);
        }
    }

    showBillPayWizard() {
        if (!this.requireTransactionPinOrSetup('pay a bill')) return;
        if (!this.isUserActiveForTransactions()) { this.showNotification('Your account is frozen. Transactions are disabled.', 'error'); return; }
        const overlay = document.createElement('div');
        overlay.className = 'deposit-wizard-overlay';
        overlay.innerHTML = `
            <div class="deposit-wizard">
                <div class="wizard-header">
                    <h3>Pay a Bill</h3>
                    <button class="close-wizard" aria-label="Close">&times;</button>
                </div>
                <div class="wizard-content">
                    <div class="wizard-step active" id="bp-step-1">
                        <div class="step-header"><h4>Step 1: Biller</h4><p>Enter biller and account details.</p></div>
                        <div class="form-grid">
                            <div><label>Biller Name</label><input type="text" id="bp-biller" placeholder="e.g., City Power" maxlength="60"></div>
                            <div><label>Account/Invoice #</label><input type="text" id="bp-ref" placeholder="e.g., 123-456-789"></div>
                            <div><label>Category</label>
                                <select id="bp-category">
                                    <option value="utilities">Utilities</option>
                                    <option value="internet">Internet</option>
                                    <option value="rent">Rent/Mortgage</option>
                                    <option value="phone">Phone</option>
                                    <option value="other" selected>Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="wizard-step" id="bp-step-2">
                        <div class="step-header"><h4>Step 2: Amount</h4><p>Enter amount and memo.</p></div>
                        <div class="form-grid">
                            <div>
                                <label>Amount</label>
                                <div class="amount-input-section">
                                    <div class="currency-symbol">$</div>
                                    <input type="number" id="bp-amount" placeholder="0.00" min="0.01" step="0.01">
                                </div>
                            </div>
                            <div><label>Memo (optional)</label><input type="text" id="bp-memo" maxlength="80" placeholder="e.g., September bill"></div>
                        </div>
                    </div>
                    <div class="wizard-step" id="bp-step-3">
                        <div class="step-header"><h4>Step 3: Review & Confirm</h4><p>Verify and confirm with your transaction PIN.</p></div>
                        <div class="deposit-summary" id="bp-summary"></div>
                        <div class="form-grid">
                            <div><label>Transaction PIN (4 digits)</label><input type="password" id="bp-pin" maxlength="4" inputmode="numeric" autocomplete="off" placeholder="••••"></div>
                        </div>
                    </div>
                </div>
                <div class="wizard-actions">
                    <button class="wizard-btn secondary" id="bp-back" style="display:none;"><i class="fas fa-arrow-left"></i> Back</button>
                    <button class="wizard-btn primary" id="bp-next">Next <i class="fas fa-arrow-right"></i></button>
                    <button class="wizard-btn success" id="bp-confirm" style="display:none;"><i class="fas fa-check"></i> Pay Bill</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); });
        overlay.querySelector('.close-wizard').addEventListener('click', close);

        let step = 1; const get = (sel)=>overlay.querySelector(sel);
        const showStep = (n) => {
            ['#bp-step-1','#bp-step-2','#bp-step-3'].forEach((id,i)=>{
                const el = get(id); if (el) el.classList.toggle('active', i === (n-1));
            });
            get('#bp-back').style.display = n>1 ? 'block' : 'none';
            get('#bp-next').style.display = n<3 ? 'block' : 'none';
            get('#bp-confirm').style.display = n===3 ? 'block' : 'none';
        };
        const validate1 = () => {
            const biller = (get('#bp-biller').value||'').trim();
            const ref = (get('#bp-ref').value||'').trim();
            if (!biller) { this.showNotification('Enter biller name', 'error'); return false; }
            if (!ref) { this.showNotification('Enter account/invoice number', 'error'); return false; }
            return true;
        };
        const validate2 = () => {
            const amt = parseFloat(get('#bp-amount').value||'0');
            if (!Number.isFinite(amt) || amt <= 0) { this.showNotification('Enter a valid amount', 'error'); return false; }
            return true;
        };
        const renderSummary = () => {
            const biller = (get('#bp-biller').value||'').trim();
            const ref = (get('#bp-ref').value||'').trim();
            const cat = (get('#bp-category').value||'other');
            const amt = parseFloat(get('#bp-amount').value||'0');
            const memo = (get('#bp-memo').value||'').trim();
            get('#bp-summary').innerHTML = `
                <div class="summary-row"><span>Biller:</span><span>${biller}</span></div>
                <div class="summary-row"><span>Account/Invoice #:</span><span>${ref}</span></div>
                <div class="summary-row"><span>Category:</span><span>${cat}</span></div>
                <div class="summary-row"><span>Amount:</span><span>$${amt.toFixed(2)}</span></div>
                <div class="summary-row"><span>Memo:</span><span>${memo || '—'}</span></div>`;
        };
        get('#bp-back').onclick = () => { if (step>1) { step--; showStep(step); } };
        get('#bp-next').onclick = () => { if ((step===1 && !validate1()) || (step===2 && !validate2())) return; step++; if (step===3) renderSummary(); showStep(step); };
        get('#bp-confirm').onclick = () => {
            // Verify PIN
            const entered = (get('#bp-pin').value||'').replace(/\D/g,'').slice(0,4);
            try {
                const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                const u = users.find(x => x.email === this.currentUser.email || x.accountNumber === this.currentUser.accountNumber);
                if (!u || !u.pin) { this.showSecuritySettingsModal(); return; }
                if (entered !== String(u.pin)) { this.showNotification('Incorrect PIN', 'error'); return; }
            } catch { this.showNotification('Unable to verify PIN', 'error'); return; }

            const biller = (get('#bp-biller').value||'').trim();
            const ref = (get('#bp-ref').value||'').trim();
            const cat = (get('#bp-category').value||'other');
            const amt = parseFloat(get('#bp-amount').value||'0');
            const memo = (get('#bp-memo').value||'').trim();
            // Enforce daily transfer limit pre-check
            try {
                const limits = this.loadUserLimits();
                const limit = Number(limits?.dailyTransferLimit || 0);
                const todayStr = new Date().toDateString();
                const userTransactionKey = this.getUserTransactionKey();
                const allTx = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
                const usedApproved = allTx
                    .filter(t => (t.type === 'transfer' || t.type === 'billpay') && t.status === 'approved' && new Date(t.timestamp).toDateString() === todayStr)
                    .reduce((s, t) => s + Number(t.amount || 0), 0);
                const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                const pendingToday = pending
                    .filter(t => t.accountNumber === this.currentUser.accountNumber && (t.type === 'transfer' || t.type === 'billpay') && new Date(t.timestamp).toDateString() === todayStr)
                    .reduce((s, t) => s + Number(t.amount || 0), 0);
                const projected = usedApproved + pendingToday + (Number(amt) || 0);
                if (projected > limit) {
                    const remaining = Math.max(0, limit - usedApproved - pendingToday);
                    this.showNotification(`Daily transfer limit exceeded. Remaining today: $${remaining.toFixed(2)}`, 'error');
                    return;
                }
            } catch {}
            // Insufficient funds check for bill payments
            try {
                const available = Number(this.currentBalance) || 0;
                if (Number(amt) > available) {
                    this.showNotification(`Insufficient funds. Available: $${available.toFixed(2)}`, 'error');
                    return;
                }
            } catch {}
            const desc = `Bill payment to ${biller} (${ref})${memo?` - ${memo}`:''}`;
            const details = { biller, reference: ref, category: cat, reason: memo };
            this._pinBypass = true;
            const tx = this.createPendingTransaction('billpay', amt, desc, cat, details);
            this._pinBypass = false;
            if (!tx) return;
            this.showNotification('Bill payment submitted and pending admin approval.', 'success');
            close();
            this.updateTransactionHistory();
        };
        showStep(step);
    }

    handlePaymentMethod(method) {
        const methodNames = {
            'zelle': 'Zelle®',
            'wire': 'Wire Transfer',
            'ach': 'ACH Transfer',
            'check': 'Online Check'
        };
        const methodName = methodNames[method] || method;
        this.showTransferWizard(methodName, {}, method);
    }

    // addScheduledPayment removed

    handlePaymentAction(action) {
        switch(action) {
            case 'edit-payment':
                this.showNotification('Edit payment settings', 'info');
                break;
            case 'cancel-payment':
                // handled via renderScheduledPayments listener
                break;
            default:
                this.showNotification(`${action} payment`);
        }
    }

    viewAllTransfers() {
        this.showNotification('Loading all transfer history...', 'info');
    }

    // Explore Action Handlers
    handleOffer(offer) {
        const offerData = {
            savings: {
                title: 'High Yield Savings',
                subtitle: 'Earn 4.50% APY with no minimums',
                cta: 'Open Savings',
                fine: 'APY subject to change; terms apply.'
            },
            credit: {
                title: 'Cashback Credit Card',
                subtitle: '3% on gas and groceries',
                cta: 'Apply for Card',
                fine: 'Approval subject to credit review.'
            },
            loan: {
                title: 'Personal Loan',
                subtitle: 'Rates from 5.99% APR',
                cta: 'Get Loan Quote',
                fine: 'Rates vary by creditworthiness and term.'
            }
        };
        const data = offerData[offer] || { title: 'Special Offer', subtitle: 'Limited-time promotion', cta: 'Continue', fine: '' };
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header">
                    <h3>${data.title}</h3>
                    <button class="cards-close" aria-label="Close">&times;</button>
                </div>
                <div class="cards-body">
                    <p style="margin:0 0 8px;">${data.subtitle}</p>
                    <div class="form-actions" style="justify-content:flex-end;">
                        <button class="btn-outline" id="offer-learn">Learn More</button>
                        <button class="btn-primary" id="offer-cta">${data.cta}</button>
                    </div>
                    <p style="margin-top:12px;color:#666;font-size:12px;">${data.fine}</p>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#offer-learn').addEventListener('click', ()=>{
            this.showNotification('Opening detailed offer info...', 'info');
        });
        overlay.querySelector('#offer-cta').addEventListener('click', async ()=>{
            // Require PIN for product application as a sensitive action
            if (!this.requireTransactionPinOrSetup(`proceed with ${data.title}`)) return;
            const ok = await this.promptForPinConfirmation();
            if (!ok) return;
            this.showNotification(`${data.title} request submitted. A specialist will contact you.`, 'success');
            close();
        });
    }

    handleFinancialTool(tool) {
        const overlay = document.createElement('div');
        overlay.className = 'deposit-wizard-overlay';
        const toolViews = {
            calculator: `
                <div class="wizard-step active">
                  <div class="step-header"><h4>Loan Calculator</h4><p>Estimate monthly payments.</p></div>
                  <div class="form-grid">
                    <div><label>Loan Amount</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="lc-amount" placeholder="10000" min="0" step="100"></div></div>
                    <div><label>APR (%)</label><input type="number" id="lc-rate" placeholder="6.0" min="0" step="0.01"></div>
                    <div><label>Term (months)</label><input type="number" id="lc-term" placeholder="36" min="1" step="1"></div>
                  </div>
                  <div class="deposit-summary" id="lc-result" style="display:none"></div>
                </div>`,
            budget: `
                <div class="wizard-step active">
                  <div class="step-header"><h4>Budget Tracker</h4><p>Track monthly expenses vs. income.</p></div>
                  <div class="form-grid">
                    <div><label>Monthly Income</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="bg-income" placeholder="3000" min="0" step="1"></div></div>
                    <div><label>Fixed Expenses</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="bg-fixed" placeholder="1500" min="0" step="1"></div></div>
                    <div><label>Variable Expenses</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="bg-variable" placeholder="600" min="0" step="1"></div></div>
                  </div>
                  <div class="deposit-summary" id="bg-result" style="display:none"></div>
                </div>`,
            investment: `
                <div class="wizard-step active">
                  <div class="step-header"><h4>Investment Growth</h4><p>Project future value.</p></div>
                  <div class="form-grid">
                    <div><label>Initial Amount</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="iv-principal" placeholder="5000" min="0" step="100"></div></div>
                    <div><label>Monthly Contribution</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="iv-monthly" placeholder="200" min="0" step="10"></div></div>
                    <div><label>Annual Return (%)</label><input type="number" id="iv-return" placeholder="7" min="0" step="0.1"></div>
                    <div><label>Years</label><input type="number" id="iv-years" placeholder="10" min="1" step="1"></div>
                  </div>
                  <div class="deposit-summary" id="iv-result" style="display:none"></div>
                </div>`,
            retirement: `
                <div class="wizard-step active">
                  <div class="step-header"><h4>Retirement Planning</h4><p>Estimate retirement savings.</p></div>
                  <div class="form-grid">
                    <div><label>Current Savings</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="rt-current" placeholder="20000" min="0" step="100"></div></div>
                    <div><label>Monthly Contribution</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="rt-monthly" placeholder="400" min="0" step="10"></div></div>
                    <div><label>Annual Return (%)</label><input type="number" id="rt-return" placeholder="6" min="0" step="0.1"></div>
                    <div><label>Years to Retire</label><input type="number" id="rt-years" placeholder="25" min="1" step="1"></div>
                  </div>
                  <div class="deposit-summary" id="rt-result" style="display:none"></div>
                </div>`
        };
        overlay.innerHTML = `
            <div class="deposit-wizard" role="dialog" aria-modal="true">
              <div class="wizard-header">
                <h3>${tool === 'calculator' ? 'Loan Calculator' : tool === 'budget' ? 'Budget Tracker' : tool === 'investment' ? 'Investment Growth' : 'Retirement Planning'}</h3>
                <button class="close-wizard" aria-label="Close">&times;</button>
              </div>
              <div class="wizard-content">${toolViews[tool] || '<div class="wizard-step active"><p>Tool not available.</p></div>'}</div>
              <div class="wizard-actions">
                <button class="wizard-btn primary" id="tool-run">Calculate</button>
                <button class="wizard-btn secondary" id="tool-close">Close</button>
              </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.close-wizard').addEventListener('click', close);
        overlay.querySelector('#tool-close').addEventListener('click', close);

        const fmt = (n)=> this.formatCurrency(parseFloat(n)||0);
        overlay.querySelector('#tool-run').addEventListener('click', () => {
            switch(tool) {
                case 'calculator': {
                    const P = parseFloat(overlay.querySelector('#lc-amount').value||'0');
                    const r = (parseFloat(overlay.querySelector('#lc-rate').value||'0')/100)/12;
                    const n = parseInt(overlay.querySelector('#lc-term').value||'0',10);
                    if (P<=0 || r<0 || n<=0) { this.showNotification('Enter valid amount, rate, and term', 'error'); return; }
                    const m = r===0 ? P/n : (P * r) / (1 - Math.pow(1+r, -n));
                    const total = m*n;
                    const interest = total - P;
                    const out = overlay.querySelector('#lc-result');
                    out.style.display = 'block';
                    out.innerHTML = `
                        <div class="summary-row"><span>Monthly Payment:</span><span>${fmt(m.toFixed(2))}</span></div>
                        <div class="summary-row"><span>Total Paid:</span><span>${fmt(total.toFixed(2))}</span></div>
                        <div class="summary-row"><span>Total Interest:</span><span>${fmt(interest.toFixed(2))}</span></div>`;
                    break;
                }
                case 'budget': {
                    const income = parseFloat(overlay.querySelector('#bg-income').value||'0');
                    const fixed = parseFloat(overlay.querySelector('#bg-fixed').value||'0');
                    const variable = parseFloat(overlay.querySelector('#bg-variable').value||'0');
                    if (income<0||fixed<0||variable<0) { this.showNotification('Values cannot be negative', 'error'); return; }
                    const savings = income - fixed - variable;
                    const out = overlay.querySelector('#bg-result');
                    out.style.display = 'block';
                    out.innerHTML = `
                        <div class="summary-row"><span>Disposable / Savings:</span><span>${fmt(savings.toFixed(2))}</span></div>
                        <div class="summary-row"><span>Expenses (% Income):</span><span>${((fixed+variable)/Math.max(income,1)*100).toFixed(1)}%</span></div>`;
                    // Persist last budget snapshot per user
                    try {
                        const key = `userBudget_${this.currentUser.accountNumber || this.currentUser.id}`;
                        localStorage.setItem(key, JSON.stringify({ income, fixed, variable, ts: Date.now() }));
                    } catch {}
                    break;
                }
                case 'investment': {
                    let principal = parseFloat(overlay.querySelector('#iv-principal').value||'0');
                    const monthly = parseFloat(overlay.querySelector('#iv-monthly').value||'0');
                    const rate = (parseFloat(overlay.querySelector('#iv-return').value||'0')/100)/12;
                    const years = parseInt(overlay.querySelector('#iv-years').value||'0',10);
                    if (principal<0||monthly<0||rate<0||years<=0) { this.showNotification('Enter valid inputs', 'error'); return; }
                    const months = years*12;
                    let future = principal * Math.pow(1+rate, months);
                    if (rate===0) future += monthly*months; else future += monthly * ( (Math.pow(1+rate, months)-1)/rate );
                    const out = overlay.querySelector('#iv-result');
                    out.style.display = 'block';
                    out.innerHTML = `
                        <div class="summary-row"><span>Projected Value:</span><span>${fmt(future.toFixed(2))}</span></div>
                        <div class="summary-row"><span>Total Contributions:</span><span>${fmt((principal + monthly*months).toFixed(2))}</span></div>`;
                    break;
                }
                case 'retirement': {
                    let current = parseFloat(overlay.querySelector('#rt-current').value||'0');
                    const monthly = parseFloat(overlay.querySelector('#rt-monthly').value||'0');
                    const rate = (parseFloat(overlay.querySelector('#rt-return').value||'0')/100)/12;
                    const years = parseInt(overlay.querySelector('#rt-years').value||'0',10);
                    if (current<0||monthly<0||rate<0||years<=0) { this.showNotification('Enter valid inputs', 'error'); return; }
                    const months = years*12;
                    let future = current * Math.pow(1+rate, months);
                    if (rate===0) future += monthly*months; else future += monthly * ( (Math.pow(1+rate, months)-1)/rate );
                    const out = overlay.querySelector('#rt-result');
                    out.style.display = 'block';
                    out.innerHTML = `
                        <div class="summary-row"><span>Projected Retirement Savings:</span><span>${fmt(future.toFixed(2))}</span></div>`;
                    break;
                }
            }
        });
    }

    handleEducationContent(education) {
        const topics = {
            credit: { title: 'Building Credit Score', body: 'Pay on time, keep utilization low, diversify accounts, and monitor reports.' },
            home: { title: 'First-Time Home Buying', body: 'Get pre-approved, budget for closing costs, inspect homes, and compare rates.' },
            protection: { title: 'Identity Protection', body: 'Use strong passwords, enable 2FA, freeze credit if needed, and avoid phishing.' }
        };
        const t = topics[education] || { title: 'Financial Education', body: 'Learn tips to improve your financial well-being.' };
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header">
                    <h3>${t.title}</h3>
                    <button class="cards-close" aria-label="Close">&times;</button>
                </div>
                <div class="cards-body">
                    <p style="line-height:1.6;">${t.body}</p>
                    <div class="form-actions" style="justify-content:flex-end;">
                        <button class="btn-primary" id="edu-done">Done</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#edu-done').addEventListener('click', close);
    }

    getRewardsKey() {
        return `userRewards_${this.currentUser.accountNumber || this.currentUser.id}`;
    }

    loadRewardsPoints() {
        try { return parseInt(localStorage.getItem(this.getRewardsKey())||'8347',10); } catch { return 8347; }
    }

    saveRewardsPoints(points) {
        localStorage.setItem(this.getRewardsKey(), String(Math.max(0, Math.floor(points))));
    }

    renderRewardsDisplay() {
        const el = document.querySelector('#explore-content .rewards-balance');
        if (!el) return;
        const pts = this.loadRewardsPoints();
        el.textContent = `${pts.toLocaleString()} points`;
        const valueEl = el.parentElement?.querySelector('p:nth-of-type(2)');
        if (valueEl) valueEl.textContent = `$${(pts/100).toFixed(2)} value`;
    }

    redeemRewards() {
        const pts = this.loadRewardsPoints();
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header">
                    <h3>Redeem Rewards</h3>
                    <button class="cards-close" aria-label="Close">&times;</button>
                </div>
                <div class="cards-body">
                    <p>You have <strong>${pts.toLocaleString()}</strong> points ($${(pts/100).toFixed(2)} value).</p>
                    <div class="form-grid">
                        <div>
                          <label>Redeem Type</label>
                          <select id="rw-type">
                             <option value="cashback">Cash Back (100pts = $1)</option>
                             <option value="gift-cards">Gift Cards</option>
                             <option value="travel">Travel</option>
                          </select>
                        </div>
                        <div>
                          <label>Points to Redeem</label>
                          <input type="number" id="rw-pts" min="100" step="100" placeholder="1000">
                        </div>
                    </div>
                    <div class="form-actions" style="justify-content:flex-end;">
                        <button class="btn-outline" id="rw-cancel">Cancel</button>
                        <button class="btn-primary" id="rw-confirm">Redeem</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#rw-cancel').addEventListener('click', close);
        overlay.querySelector('#rw-confirm').addEventListener('click', async ()=>{
            const type = overlay.querySelector('#rw-type').value;
            const redeemPts = parseInt(overlay.querySelector('#rw-pts').value||'0',10);
            if (!Number.isFinite(redeemPts) || redeemPts<=0 || redeemPts>this.loadRewardsPoints()) { this.showNotification('Enter a valid points amount', 'error'); return; }
            if (redeemPts % 100 !== 0) { this.showNotification('Redeem in multiples of 100 points', 'error'); return; }
            // Confirm via PIN
            if (!this.requireTransactionPinOrSetup('redeem rewards')) return;
            const ok = await this.promptForPinConfirmation();
            if (!ok) return;
            const remaining = this.loadRewardsPoints() - redeemPts;
            this.saveRewardsPoints(remaining);
            this.renderRewardsDisplay();
            this.showNotification(`Redeemed ${redeemPts.toLocaleString()} points for ${type.replace('-', ' ')}.`, 'success');
            close();
        });
    }

    handleRewardOption(reward) {
        // Shortcut to open redeem modal with pre-selected type
        this.redeemRewards();
        setTimeout(() => {
            const sel = document.querySelector('.cards-modal #rw-type');
            if (sel) sel.value = reward;
        }, 0);
    }

    // Menu Action Handlers
    openProfileEditor() {
        const modal = document.createElement('div');
        modal.className = 'profile-modal-overlay';
        modal.innerHTML = `
            <div class="profile-modal">
                <div class="modal-header">
                    <h3>Edit Profile</h3>
                    <button class="close-modal"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <div class="profile-avatar-edit">
                        <div class="avatar-preview" id="avatar-preview">
                            ${this.currentUser.profilePicture ? `<img src="${this.currentUser.profilePicture}" alt="Profile"/>` : `<div class="avatar-fallback">${this.currentUser.avatar}</div>`}
                        </div>
                        <input type="file" id="avatar-input" accept="image/*" />
                        <small>Upload a square image for best results.</small>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="save-profile btn-primary">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('.close-modal').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        const input = modal.querySelector('#avatar-input');
        let newImageData = null;
        input.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                newImageData = ev.target.result;
                const prev = modal.querySelector('#avatar-preview');
                prev.innerHTML = `<img src="${newImageData}" alt="Profile"/>`;
            };
            reader.readAsDataURL(file);
        });

        modal.querySelector('.save-profile').addEventListener('click', () => {
            if (newImageData) {
                this.saveProfilePicture(newImageData);
                this.showNotification('Profile picture updated', 'success');
                this.renderMenuProfile();
            }
            close();
        });
    }

    saveProfilePicture(dataUrl) {
        // update current user record in bankingUsers
        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const idx = users.findIndex(u => u.email === this.currentUser.email);
        if (idx !== -1) {
            users[idx].profilePicture = dataUrl;
            localStorage.setItem('bankingUsers', JSON.stringify(users));
        }
        // update session copy
        this.currentUser.profilePicture = dataUrl;
        const sessionStr = localStorage.getItem('bankingAppSession') || sessionStorage.getItem('bankingAppSession');
        if (sessionStr) {
            try {
                const store = localStorage.getItem('bankingAppSession') ? 'localStorage' : 'sessionStorage';
                const session = JSON.parse(sessionStr);
                session.user.profilePicture = dataUrl;
                if (store === 'localStorage') {
                    localStorage.setItem('bankingAppSession', JSON.stringify(session));
                } else {
                    sessionStorage.setItem('bankingAppSession', JSON.stringify(session));
                }
            } catch {}
        }
    }

    renderMenuProfile() {
        const container = document.querySelector('#menu-content .user-profile');
        if (!container) return;
        const avatarEl = container.querySelector('.user-avatar');
        const nameEl = container.querySelector('.user-info h3');
        if (nameEl) nameEl.textContent = this.currentUser.name;
        if (avatarEl) {
            avatarEl.innerHTML = '';
            if (this.currentUser.profilePicture) {
                const img = document.createElement('img');
                img.src = this.currentUser.profilePicture;
                img.alt = 'Profile';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '50%';
                avatarEl.appendChild(img);
            } else {
                const fallback = document.createElement('div');
                fallback.className = 'avatar-fallback';
                fallback.textContent = this.currentUser.avatar;
                avatarEl.appendChild(fallback);
            }
        }
    }

    handleMenuAction(menu) {
        const actions = {
            'personal-info': () => this.openProfileEditor(),
            'documents': () => this.openDocumentsAndStatements(),
            'tax-documents': () => this.openTaxDocuments(),
            'security-settings': () => this.showSecuritySettingsModal(),
            'privacy-controls': () => this.openPrivacyControls(),
            'customer-service': () => this.openCustomerServiceMail(),
            'terms': () => this.openTermsConditions(),
            'privacy-policy': () => this.openPrivacyPolicy(),
            'about': () => this.showNotification('About This App')
        };
        (actions[menu] || (() => this.showNotification(`Opening ${menu}...`, 'info')))();
    }

    // Customer Service opens mailto
    openCustomerServiceMail() {
        let supportEmail = 'customerservice0549@gmail.com';
        try {
            const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            if (appSettings.supportEmail) supportEmail = appSettings.supportEmail;
        } catch {}
        window.location.href = `mailto:${supportEmail}`;
    }

    showSecuritySettingsModal() {
        const overlay = document.createElement('div');
        overlay.className = 'security-overlay';
        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const i = users.findIndex(u => u.email === this.currentUser.email || u.accountNumber === this.currentUser.accountNumber);
        const hasUserSetPin = i !== -1 && !!users[i].pinSetByUser; // only require current PIN if user set it themselves
        overlay.innerHTML = `
            <div class="security-modal" role="dialog" aria-modal="true">
                <div class="security-header">
                    <h3>Security Settings</h3>
                    <button class="security-close" aria-label="Close">&times;</button>
                </div>
                <div class="security-body">
                    <div class="form-row">
                        <label>Registered Email Address</label>
                        <input type="email" id="sec-email" placeholder="you@example.com" required>
                        <div class="security-note">Enter your registered email to change your transaction PIN.</div>
                    </div>
                    <div class="form-row" id="current-pin-row" style="display:${hasUserSetPin ? 'grid' : 'none'};">
                        <label>Current Transaction PIN</label>
                        <input type="password" id="sec-current-pin" maxlength="4" placeholder="••••">
                    </div>
                    <div class="form-row">
                        <label>New Transaction PIN (4 digits)</label>
                        <input type="password" id="sec-new-pin" maxlength="4" placeholder="1234" required>
                    </div>
                    <div class="form-row">
                        <label>Confirm New PIN</label>
                        <input type="password" id="sec-confirm-pin" maxlength="4" placeholder="1234" required>
                    </div>
                </div>
                <div class="security-actions">
                    <button class="btn-outline" id="sec-cancel">Cancel</button>
                    <button class="btn-primary" id="sec-save">Save PIN</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('.security-close').addEventListener('click', close);
        overlay.querySelector('#sec-cancel').addEventListener('click', close);

        const emailInput = overlay.querySelector('#sec-email');
        emailInput.value = '';
        const norm = v => (v || '').replace(/[^\d]/g,'').slice(0,4);

        overlay.querySelector('#sec-save').addEventListener('click', () => {
            const enteredEmail = (emailInput.value || '').trim().toLowerCase();
            const regEmail = (this.currentUser.email || '').toLowerCase();
            if (!enteredEmail || enteredEmail !== regEmail) {
                this.showNotification('Please enter your registered email address to proceed.', 'error');
                return;
            }
            const cur = norm(overlay.querySelector('#sec-current-pin')?.value);
            const np = norm(overlay.querySelector('#sec-new-pin')?.value);
            const cp = norm(overlay.querySelector('#sec-confirm-pin')?.value);
            if (!np || np.length !== 4) { this.showNotification('New PIN must be 4 digits.', 'error'); return; }
            if (np !== cp) { this.showNotification('PINs do not match.', 'error'); return; }
            if (hasUserSetPin && cur !== String(users[i].pin)) { this.showNotification('Current PIN is incorrect.', 'error'); return; }
            users[i].pin = np;
            users[i].pinSetByUser = true;
            localStorage.setItem('bankingUsers', JSON.stringify(users));
            this.currentUser.transactionPin = np;
            this.showNotification('Transaction PIN updated successfully', 'success');
            close();
        });
    }

    handleToggleSetting(setting, enabled) {
        const settingNames = {
            'push-notifications': 'Push Notifications',
            'dark-mode': 'Dark Mode'
        };
        const settingName = settingNames[setting] || setting;
        const status = enabled ? 'enabled' : 'disabled';
        this.showNotification(`${settingName} ${status}`, enabled ? 'success' : 'info');
        
        // Handle dark mode toggle
        if (setting === 'dark-mode') {
            this.toggleDarkMode(enabled);
        }
    }

    toggleDarkMode(enabled) {
        if (enabled) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        const prefs = this.loadUserPrefs();
        prefs.theme = prefs.theme || {};
        prefs.theme.dark = !!enabled;
        this.saveUserPrefs(prefs);
        this.updateThemeToggles(enabled);
    }

    applyPersistedTheme() {
        try {
            const prefs = this.loadUserPrefs();
            const dark = !!prefs?.theme?.dark;
            if (dark) document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
            this.updateThemeToggles(dark);
        } catch {}
    }

    updateThemeToggles(isDark) {
        try {
            const toggle = document.querySelector('#dark-mode');
            if (toggle) toggle.checked = !!isDark;
        } catch {}
    }

    // Manage Tab Feature Setup
    setupManageFeatures() {
        // Quick Action Cards
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const action = card.querySelector('.action-btn').dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Action buttons
        const actionBtns = document.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Setting toggles
        const settingToggles = document.querySelectorAll('.setting-toggle');
        settingToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const setting = toggle.dataset.setting;
                this.handleSettingToggle(setting);
            });
        });

        // Switch toggles
        const switches = document.querySelectorAll('.setting-switch input[type="checkbox"], .toggle-switch input[type="checkbox"]');
        // Restore saved switch states
        try {
            const prefs = this.loadUserPrefs();
            const saved = prefs?.switches || {};
            switches.forEach(sw => {
                const id = sw.id;
                if (id === 'dark-mode' && prefs?.theme) { sw.checked = !!prefs.theme.dark; return; }
                if (Object.prototype.hasOwnProperty.call(saved, id)) { sw.checked = !!saved[id]; }
            });
        } catch {}
        switches.forEach(switchEl => {
            switchEl.addEventListener('change', (e) => {
                const settingName = e.target.id;
                const isEnabled = e.target.checked;
                if (settingName === 'dark-mode') { this.toggleDarkMode(isEnabled); return; }
                this.handleSwitchToggle(settingName, isEnabled);
            });
        });

        // Beneficiary actions
        const beneficiaryBtns = document.querySelectorAll('.beneficiary-btn');
        beneficiaryBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const beneficiaryName = btn.closest('.beneficiary-item').querySelector('h5').textContent;
                this.handleBeneficiaryAction(action, beneficiaryName);
            });
        });

        // Add beneficiary button
        const addBeneficiaryBtn = document.querySelector('.add-beneficiary-btn');
        if (addBeneficiaryBtn) {
            addBeneficiaryBtn.addEventListener('click', () => {
                this.showAddBeneficiaryForm();
            });
        }

        // Limit edit buttons
        const limitEditBtns = document.querySelectorAll('.limit-edit');
        limitEditBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const limitType = btn.dataset.limit;
                this.handleLimitEdit(limitType);
            });
        });
    }

    // Routing Tab Feature Setup
    setupRoutingFeatures() {
        // Copy buttons
        const copyBtns = document.querySelectorAll('.copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const copyType = btn.dataset.copy;
                this.handleCopyToClipboard(copyType);
            });
        });

        // Toggle account number visibility
        this.ensureAccountNumberToggleButton();

        // Statement download buttons
        const statementBtns = document.querySelectorAll('.statement-download');
        statementBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const statement = btn.dataset.statement;
                this.handleStatementDownload(statement);
            });
        });

        // Download all button
        const downloadAllBtn = document.querySelector('.download-all-btn');
        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', () => {
                this.handleDownloadAllStatements();
            });
        }

        // Contact buttons
        const contactBtns = document.querySelectorAll('.contact-btn');
        contactBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const contactCard = btn.closest('.contact-card');
                const contactType = contactCard.querySelector('h5').textContent;
                this.handleContactAction(contactType);
            });
        });
    }

    ensureAccountNumberToggleButton() {
        try {
            const acctEl = document.querySelector('#routing .account-summary-card [data-field="accountNumber"]');
            if (!acctEl) return;
            let toggleBtn = acctEl.querySelector('button.toggle-visibility-btn[data-toggle="account-number"]');
            if (!toggleBtn) {
                toggleBtn = document.createElement('button');
                toggleBtn.className = 'toggle-visibility-btn';
                toggleBtn.setAttribute('data-toggle', 'account-number');
                toggleBtn.setAttribute('aria-label', 'Show account number');
                toggleBtn.setAttribute('aria-pressed', 'false');
                const i = document.createElement('i'); i.className = 'fas fa-eye'; toggleBtn.appendChild(i);
                // insert before copy button if exists
                const copyBtn = acctEl.querySelector('button.copy-btn');
                if (copyBtn) acctEl.insertBefore(toggleBtn, copyBtn);
                else acctEl.appendChild(toggleBtn);
            }
            // Bind once
            if (!toggleBtn._bound) {
                toggleBtn.addEventListener('click', () => {
                    const pressed = toggleBtn.getAttribute('aria-pressed') === 'true';
                    const next = !pressed;
                    toggleBtn.setAttribute('aria-pressed', String(next));
                    const icon = toggleBtn.querySelector('i');
                    if (icon) icon.className = next ? 'fas fa-eye-slash' : 'fas fa-eye';
                    this.updateAccountNumberVisibility(next);
                });
                toggleBtn._bound = true;
            }
        } catch {}
    }

    updateAccountNumberVisibility(showFull) {
        try {
            const acctEl = document.querySelector('#routing .account-summary-card [data-field="accountNumber"]');
            if (!acctEl) return;
            const copyBtn = acctEl.querySelector('button.copy-btn');
            const toggleBtn = acctEl.querySelector('button.toggle-visibility-btn');
            const numberText = showFull ? (this.currentUser.accountNumber || '') : this.maskAccountNumber(this.currentUser.accountNumber);
            // clean text but keep buttons
            if (copyBtn) copyBtn.remove();
            if (toggleBtn) toggleBtn.remove();
            acctEl.textContent = numberText + ' ';
            if (toggleBtn) acctEl.appendChild(toggleBtn);
            if (copyBtn) acctEl.appendChild(copyBtn);
            // Ensure button exists and bound (in case of re-renders)
            this.ensureAccountNumberToggleButton();
        } catch {}
    }

    // Ensure per-user routing number exists and is unique among users
    ensureUserBankIdentifiers() {
        try {
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const i = users.findIndex(u => u.email === this.currentUser.email || u.accountNumber === this.currentUser.accountNumber);
            if (i === -1) return;
            // Fix legacy masked/short account numbers to a 12-digit unique number
            const isNumeric = v => typeof v === 'string' && /^\d+$/.test(v);
            if (!isNumeric(users[i].accountNumber) || String(users[i].accountNumber).length < 8) {
                const rand12 = () => Array.from({length: 12}, () => Math.floor(Math.random()*10)).join('');
                let newAcct = rand12();
                const taken = new Set([
                    ...users.map(u => String(u.accountNumber||'')),
                    ...JSON.parse(localStorage.getItem('pendingUsers')||'[]').map(u=>String(u.accountNumber||''))
                ]);
                while (taken.has(newAcct)) newAcct = rand12();
                users[i].accountNumber = newAcct;
            }
            if (!users[i].routingNumber) {
                let rn = this.generateRoutingNumber();
                const taken = new Set(users.map(u => String(u.routingNumber || '')));
                while (taken.has(rn)) rn = this.generateRoutingNumber();
                users[i].routingNumber = rn;
            }
            // Ensure joinDate exists, default to approval date fallback
            users[i].joinDate = users[i].joinDate || users[i].dateCreated || new Date().toISOString();
            localStorage.setItem('bankingUsers', JSON.stringify(users));
            // Sync to currentUser snapshot
            this.currentUser.routingNumber = users[i].routingNumber;
            this.currentUser.accountNumber = users[i].accountNumber;
            this.currentUser.joinDate = users[i].joinDate;

            // Also update session copy so future reads are consistent
            const sLocal = localStorage.getItem('bankingAppSession');
            const sSess = !sLocal && sessionStorage.getItem('bankingAppSession');
            const store = sLocal ? 'localStorage' : (sSess ? 'sessionStorage' : null);
            if (store) {
                try {
                    const sess = JSON.parse((store === 'localStorage' ? sLocal : sSess) || '{}');
                    if (sess && sess.user && (sess.user.email === users[i].email)) {
                        sess.user.accountNumber = users[i].accountNumber;
                        sess.user.name = users[i].name;
                        sess.user.routingNumber = users[i].routingNumber;
                        sess.user.joinDate = users[i].joinDate;
                        if (store === 'localStorage') localStorage.setItem('bankingAppSession', JSON.stringify(sess));
                        else sessionStorage.setItem('bankingAppSession', JSON.stringify(sess));
                    }
                } catch {}
            }
        } catch {}
    }

    generateRoutingNumber() {
        // Simple 9-digit generator (not validating checksum for demo)
        let s = '';
        for (let i = 0; i < 9; i++) s += Math.floor(Math.random() * 10);
        if (s[0] === '0') s = '1' + s.slice(1);
        return s;
    }

    maskAccountNumber(n) {
        const raw = (n || '').toString();
        const digits = raw.replace(/\D/g, '');
        if (!digits) return raw || '****0000';
        const last4 = digits.slice(-4);
        return '****' + last4.padStart(4, '0');
    }

    renderRoutingInfo() {
        try {
            // Refresh from storage to avoid stale values
            try {
                const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                const u = users.find(x => x.email === this.currentUser.email);
                if (u) {
                    this.currentUser.name = u.name || this.currentUser.name;
                    this.currentUser.accountNumber = u.accountNumber || this.currentUser.accountNumber;
                    this.currentUser.routingNumber = u.routingNumber || this.currentUser.routingNumber;
                    this.currentUser.joinDate = u.joinDate || this.currentUser.joinDate;
                }
            } catch {}
            const nameEl = document.querySelector('#routing .account-summary-card [data-field="accountHolder"]');
            const acctEl = document.querySelector('#routing .account-summary-card [data-field="accountNumber"]');
            const rtgEl  = document.querySelector('#routing .account-summary-card [data-field="routingNumber"]');
            const openEl = document.querySelector('#routing .account-summary-card [data-field="accountOpened"]');
            if (nameEl) nameEl.textContent = this.currentUser.name || '';
            const maskedAcct = this.maskAccountNumber(this.currentUser.accountNumber);
            if (acctEl) {
                const copyBtn = acctEl.querySelector('button.copy-btn');
                const toggleBtn = acctEl.querySelector('button.toggle-visibility-btn');
                if (copyBtn) copyBtn.remove();
                if (toggleBtn) toggleBtn.remove();
                acctEl.textContent = maskedAcct + ' ';
                if (toggleBtn) acctEl.appendChild(toggleBtn);
                if (copyBtn) acctEl.appendChild(copyBtn);
            }
            const rn = this.currentUser.routingNumber || '021000021';
            if (rtgEl) {
                const btn = rtgEl.querySelector('button.copy-btn');
                if (btn && btn.parentElement === rtgEl) {
                    btn.remove();
                    rtgEl.textContent = rn + ' ';
                    rtgEl.appendChild(btn);
                } else {
                    rtgEl.textContent = rn;
                }
            }
            const opened = this.currentUser.joinDate || this.currentUser.dateCreated || null;
            if (openEl) openEl.textContent = opened ? new Date(opened).toLocaleString() : '';
        } catch {}
    }

    // Menu Tab Features (restore Menu actions wiring)
    setupMenuFeatures() {
        try {
            const items = document.querySelectorAll('#menu-content .menu-item[data-menu]');
            items.forEach(btn => {
                btn.addEventListener('click', () => {
                    const menu = btn.getAttribute('data-menu');
                    this.handleMenuAction(menu);
                });
            });
        } catch {}
    }

    // Quick Action Handlers
    handleQuickAction(action) {
        switch(action) {
            case 'card-controls':
                this.showCardControls();
                break;
            case 'transfer':
                this.showTransferMoney();
                break;
            case 'statements':
                this.openDocumentsAndStatements();
                break;
            case 'alerts':
                this.showAlertsSettings();
                break;
            default:
                this.showNotification(`${action} feature coming soon!`);
        }
    }

    showCardControls() {
        // Build cards modal
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        const cards = this.loadUserCards();
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header">
                    <h3>My Cards</h3>
                    <button class="cards-close" aria-label="Close">&times;</button>
                </div>
                <div class="cards-body">
                    ${cards.length === 0 ? `
                        <div class="empty-cards">
                            <p>No cards linked yet.</p>
                            <button class="link-card-btn">Link Card</button>
                        </div>
                    ` : `
                        <div class="cards-grid">
                            ${cards.map((c, idx) => this.renderBankCardHTML(c, idx)).join('')}
                        </div>
                        <div style="margin-top:12px; text-align:right;">
                            <button class="link-card-btn">Link Card</button>
                        </div>
                    `}
                </div>
            </div>`;

        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);

        // Link card button handler
        overlay.querySelectorAll('.link-card-btn').forEach(btn => btn.addEventListener('click', () => {
            if (!this.requireTransactionPinOrSetup('link a card')) return;
            this.openLinkCardForm(overlay);
        }));

        // Eye buttons for flip
        overlay.querySelectorAll('.eye-btn').forEach(btn => btn.addEventListener('click', (e) => {
            const cardEl = e.currentTarget.closest('.bank-card');
            cardEl.classList.toggle('flipped');
        }));
    }

    renderBankCardHTML(card, index) {
        const name = (this.currentUser.name || '').toUpperCase();
        const type = (card.cardType || 'Card').toUpperCase();
        const masked = (card.cardNumber || '').replace(/\s+/g,'').replace(/(\d{4})(?=\d)/g,'$1 ').trim();
        const exp = card.expiry || '';
        const cvv = card.cvv || '';
        return `
        <div class="bank-card" data-index="${index}">
          <div class="bank-card-inner">
            <div class="card-face card-front">
                <div class="card-row">
                    <div class="card-chip"></div>
                    <div class="card-brand">${type}</div>
                </div>
                <div class="card-row">
                    <div class="card-name">${name}</div>
                    <button class="eye-btn" title="Flip"><i class="fas fa-eye"></i></button>
                </div>
            </div>
            <div class="card-face card-back">
                <div class="card-row">
                    <div class="card-meta">Card Number</div>
                    <button class="eye-btn" title="Flip back"><i class="fas fa-eye-slash"></i></button>
                </div>
                <div class="card-row">
                    <div class="card-number">${masked}</div>
                </div>
                <div class="card-row">
                    <div class="card-meta">CVV</div>
                    <div class="card-meta">Expiry</div>
                </div>
                <div class="card-row">
                    <div class="card-meta">${cvv}</div>
                    <div class="card-meta">${exp}</div>
                </div>
            </div>
          </div>
        </div>`;
    }

    openLinkCardForm(parentOverlay) {
        // Replace body with form within the same modal
        const body = parentOverlay.querySelector('.cards-body');
        body.innerHTML = `
          <h4 style="margin-bottom:12px;">Link a Card</h4>
          <form class="card-form">
            <div>
              <label>Bank card name</label>
              <input type="text" id="cardName" placeholder="e.g., Everyday Checking Card" required>
            </div>
            <div>
              <label>Card type</label>
              <select id="cardType">
                <option value="Debit">Debit</option>
                <option value="Credit">Credit</option>
                <option value="Prepaid">Prepaid</option>
              </select>
            </div>
            <div>
              <label>Card number</label>
              <input type="text" id="cardNumber" inputmode="numeric" maxlength="19" placeholder="1234 5678 9012 3456" required>
            </div>
            <div class="row">
              <div>
                <label>Expiration date</label>
                <input type="text" id="expiry" placeholder="MM/YY" maxlength="5" required>
              </div>
              <div>
                <label>CVV</label>
                <input type="password" id="cvv" maxlength="4" placeholder="123" required>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-outline" id="cancelLink">Cancel</button>
              <button type="submit" class="btn-primary">Save</button>
            </div>
          </form>
        `;

        const numberInput = body.querySelector('#cardNumber');
        numberInput.addEventListener('input', () => {
            let v = numberInput.value.replace(/[^\d]/g, '');
            v = v.slice(0,16).replace(/(\d{4})(?=\d)/g,'$1 ').trim();
            numberInput.value = v;
        });
        const expiryInput = body.querySelector('#expiry');
        expiryInput.addEventListener('input', () => {
            let v = expiryInput.value.replace(/[^\d]/g, '');
            v = v.slice(0,4);
            if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
            expiryInput.value = v;
        });

        body.querySelector('#cancelLink').addEventListener('click', () => {
            this.showCardControls();
            parentOverlay.remove();
        });

        body.querySelector('.card-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const card = {
                name: body.querySelector('#cardName').value.trim(),
                cardType: body.querySelector('#cardType').value,
                cardNumber: numberInput.value.trim(),
                expiry: expiryInput.value.trim(),
                cvv: body.querySelector('#cvv').value.trim()
            };
            if (!card.name || !card.cardNumber || !card.expiry || !card.cvv) {
                this.showNotification('Please complete all fields', 'error');
                return;
            }
            // Basic validation
            if (!/^\d{2}\/\d{2}$/.test(card.expiry)) {
                this.showNotification('Invalid expiry format (MM/YY)', 'error');
                return;
            }
            const cards = this.loadUserCards();
            cards.push(card);
            this.saveUserCards(cards);
            this.showNotification('Card linked successfully', 'success');
            parentOverlay.remove();
            this.showCardControls();
        });
    }

    showTransferMoney() {
        this.showTransferWizard('Transfer Money', {}, 'standard');
    }

    showStatements() {
        // Switch to routing tab to show statements
        this.switchTab('routing', 
            document.querySelectorAll('.nav-tab'),
            document.querySelectorAll('.tab-content')
        );
        this.showNotification('Viewing account statements');
    }

    // Reusable 3-step Transfer Wizard
        showTransferWizard(title = 'Transfer', defaults = {}, methodKey = 'standard') {
        const overlay = document.createElement('div');
        overlay.className = 'deposit-wizard-overlay';
                const method = methodKey;
                const methodHelp = {
                        standard: 'Enter recipient bank and account details.',
                        zelle: 'Enter recipient Zelle email or mobile number and bank if known.',
                        wire: 'Enter recipient bank name and SWIFT/IBAN or routing + account.',
                        ach: 'Enter bank name and routing + account number for ACH transfer.',
                        check: 'Enter payee name and mailing details if required.'
                };
                overlay.innerHTML = `
            <div class="deposit-wizard" role="dialog" aria-modal="true">
                <div class="wizard-header">
                    <h3>${title}</h3>
                    <button class="close-wizard"><i class="fas fa-times"></i></button>
                </div>
                <div class="wizard-content">
                    <div class="wizard-step active" id="t-step-1">
                        <div class="step-header">
                            <h4>Step 1: Recipient Details</h4>
                                                        <p>${methodHelp[method] || 'Enter the recipient\'s information.'}</p>
                        </div>
                        <div class="form-grid">
                            <div>
                                <label>Recipient Name</label>
                                <input type="text" id="t-recipient-name" placeholder="Full name" value="${defaults.recipientName || ''}" required>
                            </div>
                                                        ${method === 'zelle' ? `
                                                            <div>
                                                                <label>Zelle Contact (Email or Phone)</label>
                                                                <input type="text" id="t-zelle-contact" placeholder="name@example.com or +1234567890" required>
                                                            </div>
                                                            <div>
                                                                <label>Recipient Bank (optional)</label>
                                                                <input type="text" id="t-recipient-bank" placeholder="Bank name">
                                                            </div>
                                                        ` : method === 'wire' ? `
                                                            <div>
                                                                <label>Recipient Bank</label>
                                                                <input type="text" id="t-recipient-bank" placeholder="Bank name" required>
                                                            </div>
                                                            <div>
                                                                <label>SWIFT/BIC or IBAN</label>
                                                                <input type="text" id="t-wire-code" placeholder="SWIFT/IBAN" required>
                                                            </div>
                                                            <div>
                                                                <label>Account Number</label>
                                                                <input type="text" id="t-recipient-acct" placeholder="1234567890" inputmode="numeric" required>
                                                            </div>
                                                        ` : method === 'ach' ? `
                                                            <div>
                                                                <label>Recipient Bank</label>
                                                                <input type="text" id="t-recipient-bank" placeholder="Bank name" required>
                                                            </div>
                                                            <div>
                                                                <label>Routing Number</label>
                                                                <input type="text" id="t-routing" placeholder="9-digit routing" inputmode="numeric" required>
                                                            </div>
                                                            <div>
                                                                <label>Account Number</label>
                                                                <input type="text" id="t-recipient-acct" placeholder="1234567890" inputmode="numeric" required>
                                                            </div>
                                                        ` : method === 'check' ? `
                                                            <div>
                                                                <label>Payee Mailing Address</label>
                                                                <input type="text" id="t-mailing" placeholder="Street, City, State, ZIP" required>
                                                            </div>
                                                            <div>
                                                                <label>Recipient Bank (optional)</label>
                                                                <input type="text" id="t-recipient-bank" placeholder="Bank name">
                                                            </div>
                                                        ` : `
                                                            <div>
                                                                <label>Recipient Bank</label>
                                                                <input type="text" id="t-recipient-bank" placeholder="Bank name" required>
                                                            </div>
                                                            <div>
                                                                <label>Account Number</label>
                                                                <input type="text" id="t-recipient-acct" placeholder="1234567890" inputmode="numeric" required>
                                                            </div>
                                                        `}
                        </div>
                    </div>
                    <div class="wizard-step" id="t-step-2">
                        <div class="step-header">
                            <h4>Step 2: Transfer Details</h4>
                            <p>Enter amount and reason for transfer.</p>
                        </div>
                        <div class="form-grid">
                            <div>
                                <label>Amount</label>
                                <div class="amount-input-section">
                                    <div class="currency-symbol">$</div>
                                    <input type="number" id="t-amount" placeholder="0.00" min="0.01" step="0.01">
                                </div>
                            </div>
                            <div>
                                <label>Reason for Transfer</label>
                                <input type="text" id="t-reason" placeholder="e.g., Rent, Gift, Services" maxlength="80">
                            </div>
                        </div>
                    </div>
                    <div class="wizard-step" id="t-step-3">
                        <div class="step-header">
                            <h4>Step 3: Review & Confirm</h4>
                            <p>Verify details and confirm with your transaction PIN.</p>
                        </div>
                        <div class="deposit-summary" id="t-summary"></div>
                        <div class="form-grid">
                            <div>
                                <label>Transaction PIN (4 digits)</label>
                                <input type="password" id="t-pin" placeholder="••••" maxlength="4" inputmode="numeric" autocomplete="off">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="wizard-actions">
                    <button class="wizard-btn secondary" id="t-back" style="display:none;">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <button class="wizard-btn primary" id="t-next">
                        Next <i class="fas fa-arrow-right"></i>
                    </button>
                    <button class="wizard-btn success" id="t-confirm" style="display:none;">
                        <i class="fas fa-check"></i> Confirm Transfer
                    </button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('.close-wizard').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        let step = 1;
        const get = (sel) => overlay.querySelector(sel);
        const showStep = (n) => {
            ['#t-step-1','#t-step-2','#t-step-3'].forEach((id,i)=>{
                const el = get(id);
                if (el) el.classList.toggle('active', i === (n-1));
            });
            get('#t-back').style.display = n>1 ? 'block' : 'none';
            get('#t-next').style.display = n<3 ? 'block' : 'none';
            get('#t-confirm').style.display = n===3 ? 'block' : 'none';
        };

        const validateStep1 = () => {
            const name = (get('#t-recipient-name').value||'').trim();
            if (!name) { this.showNotification('Enter recipient name', 'error'); return false; }
            if (method === 'zelle') {
                const contact = (get('#t-zelle-contact').value||'').trim();
                if (!contact) { this.showNotification('Enter Zelle email or phone', 'error'); return false; }
                return true;
            }
            if (method === 'wire') {
                const bank = (get('#t-recipient-bank').value||'').trim();
                const wire = (get('#t-wire-code').value||'').trim();
                const acct = (get('#t-recipient-acct').value||'').replace(/\D/g,'');
                if (!bank || !wire || acct.length < 6) { this.showNotification('Enter bank, SWIFT/IBAN and account number', 'error'); return false; }
                return true;
            }
            if (method === 'ach') {
                const bank = (get('#t-recipient-bank').value||'').trim();
                const routing = (get('#t-routing').value||'').replace(/\D/g,'');
                const acct = (get('#t-recipient-acct').value||'').replace(/\D/g,'');
                if (!bank || routing.length !== 9 || acct.length < 6) { this.showNotification('Enter bank, 9-digit routing and account', 'error'); return false; }
                return true;
            }
            if (method === 'check') {
                const mailing = (get('#t-mailing').value||'').trim();
                if (!mailing) { this.showNotification('Enter mailing address', 'error'); return false; }
                return true;
            }
            const bank = (get('#t-recipient-bank').value||'').trim();
            const acct = (get('#t-recipient-acct').value||'').replace(/\D/g,'');
            if (!bank || acct.length < 6) { this.showNotification('Enter bank and a valid account number', 'error'); return false; }
            return true;
        };
        const validateStep2 = () => {
            const amt = parseFloat(get('#t-amount').value||'0');
            if (!Number.isFinite(amt) || amt <= 0) { this.showNotification('Enter a valid amount', 'error'); return false; }
            return true;
        };
        const renderSummary = () => {
            const name = (get('#t-recipient-name').value||'').trim();
            const bank = (get('#t-recipient-bank')?.value||'').trim();
            const acct = (get('#t-recipient-acct')?.value||'').replace(/\s+/g,'');
            const amt = parseFloat(get('#t-amount').value||'0');
            const reason = (get('#t-reason').value||'').trim();
            const extra = method === 'zelle' ? `<div class="summary-row"><span>Zelle Contact:</span><span>${(get('#t-zelle-contact').value||'').trim()}</span></div>` :
                          method === 'wire' ? `<div class="summary-row"><span>SWIFT/IBAN:</span><span>${(get('#t-wire-code').value||'').trim()}</span></div>` :
                          method === 'ach' ? `<div class="summary-row"><span>Routing Number:</span><span>${(get('#t-routing').value||'').replace(/\D/g,'')}</span></div>` :
                          method === 'check' ? `<div class="summary-row"><span>Mailing Address:</span><span>${(get('#t-mailing').value||'').trim()}</span></div>` : '';
            get('#t-summary').innerHTML = `
                <div class="summary-row"><span>Recipient Name:</span><span>${name}</span></div>
                <div class="summary-row"><span>Recipient Bank:</span><span>${bank}</span></div>
                <div class="summary-row"><span>Account Number:</span><span>${acct}</span></div>
                <div class="summary-row"><span>Amount:</span><span>$${amt.toFixed(2)}</span></div>
                <div class="summary-row"><span>Reason:</span><span>${reason || '—'}</span></div>
                ${extra}`;
        };

        get('#t-back').addEventListener('click', ()=>{ if (step>1) { step--; showStep(step); } });
        get('#t-next').addEventListener('click', ()=>{
            if (step===1 && !validateStep1()) return;
            if (step===2 && !validateStep2()) return;
            step++;
            if (step===3) renderSummary();
            showStep(step);
        });

        get('#t-confirm').addEventListener('click', ()=>{
            // Validate transaction PIN
            const entered = (get('#t-pin').value||'').replace(/\D/g,'').slice(0,4);
            try {
                const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
                const u = users.find(x => x.email === this.currentUser.email || x.accountNumber === this.currentUser.accountNumber);
                if (!u || !u.pin) { this.showNotification('Please set your transaction PIN in Security Settings.', 'error'); this.showSecuritySettingsModal(); return; }
                if (entered !== String(u.pin)) { this.showNotification('Incorrect PIN', 'error'); return; }
            } catch { this.showNotification('Unable to verify PIN', 'error'); return; }

            // Build description and create pending transfer
            const name = (get('#t-recipient-name').value||'').trim();
            const bank = (get('#t-recipient-bank')?.value||'').trim();
            const acct = (get('#t-recipient-acct')?.value||'').replace(/\D/g,'');
            const amt = parseFloat(get('#t-amount').value||'0');
            const reason = (get('#t-reason').value||'').trim();
            // Enforce daily transfer limit pre-check
            try {
                const limits = this.loadUserLimits();
                const limit = Number(limits?.dailyTransferLimit || 0);
                const todayStr = new Date().toDateString();
                const userTransactionKey = this.getUserTransactionKey();
                const allTx = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
                const usedApproved = allTx
                    .filter(t => (t.type === 'transfer' || t.type === 'billpay') && t.status === 'approved' && new Date(t.timestamp).toDateString() === todayStr)
                    .reduce((s, t) => s + Number(t.amount || 0), 0);
                const pending = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
                const pendingToday = pending
                    .filter(t => t.accountNumber === this.currentUser.accountNumber && (t.type === 'transfer' || t.type === 'billpay') && new Date(t.timestamp).toDateString() === todayStr)
                    .reduce((s, t) => s + Number(t.amount || 0), 0);
                const projected = usedApproved + pendingToday + (Number(amt) || 0);
                if (projected > limit) {
                    const remaining = Math.max(0, limit - usedApproved - pendingToday);
                    this.showNotification(`Daily transfer limit exceeded. Remaining today: $${remaining.toFixed(2)}`, 'error');
                    return;
                }
            } catch {}
            // Insufficient funds check (available balance must cover amount)
            try {
                const available = Number(this.currentBalance) || 0;
                if (Number(amt) > available) {
                    this.showNotification(`Insufficient funds. Available: $${available.toFixed(2)}`, 'error');
                    return;
                }
            } catch {}
            let desc = `Transfer to ${name}`;
            if (bank) desc += ` (${bank}` + (acct?` ••••${acct.slice(-4)}`:'') + `)`;
            if (reason) desc += ` - ${reason}`;

            const details = { method, name, bank, acct, reason };
            if (method === 'zelle') details.zelleContact = (get('#t-zelle-contact').value||'').trim();
            if (method === 'wire') details.wireCode = (get('#t-wire-code').value||'').trim();
            if (method === 'ach') details.routing = (get('#t-routing').value||'').replace(/\D/g,'');
            if (method === 'check') details.mailing = (get('#t-mailing').value||'').trim();

            // Bypass separate PIN modal since PIN was just verified here
            this._pinBypass = true;
            const tx = this.createPendingTransaction('transfer', amt, desc, method, details);
            this._pinBypass = false;
            if (!tx) return; // createPendingTransaction handles PIN + frozen

            this.showNotification('Transfer submitted and pending admin approval.', 'success');
            close();
            this.updateTransactionHistory();
        });

        showStep(step);
    }

    showAlertsSettings() {
        const cfg = this.loadAlertsConfig();
        const overlay = document.createElement('div');
        overlay.className = 'deposit-wizard-overlay';
        overlay.innerHTML = `
            <div class="deposit-wizard" role="dialog" aria-modal="true">
                <div class="wizard-header">
                    <h3>Alerts & Notifications</h3>
                    <button class="close-wizard" aria-label="Close">&times;</button>
                </div>
                <div class="wizard-content" style="max-height:60vh;overflow:auto;">
                    <div class="wizard-step active" id="al-step">
                        <div class="step-header"><h4>Preferences</h4><p>Choose when and how we notify you.</p></div>
                        <div class="form-grid">
                            <div>
                                <label>Channels</label>
                                <div class="toggle-row"><label><input type="checkbox" id="ch-email"> Email</label></div>
                                <div class="toggle-row"><label><input type="checkbox" id="ch-sms"> SMS</label></div>
                                <div class="toggle-row"><label><input type="checkbox" id="ch-push"> In-app</label></div>
                            </div>
                            <div>
                                <label>Alert Types</label>
                                <div class="toggle-row"><label><input type="checkbox" id="ty-deposit"> Deposit posted</label></div>
                                <div class="toggle-row"><label><input type="checkbox" id="ty-approval"> Approval/Decline updates</label></div>
                                <div class="toggle-row"><label><input type="checkbox" id="ty-large"> Large transaction</label></div>
                                <div class="row">
                                    <div style="flex:1"><label>Large Tx Threshold</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="thr-large" min="0" step="1"></div></div>
                                </div>
                                <div class="toggle-row"><label><input type="checkbox" id="ty-lowbal"> Low balance</label></div>
                                <div class="row">
                                    <div style="flex:1"><label>Low Balance Threshold</label><div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="thr-lowbal" min="0" step="1"></div></div>
                                </div>
                                <div class="toggle-row"><label><input type="checkbox" id="ty-security"> Security/login alerts</label></div>
                            </div>
                            <div>
                                <label>Quiet Hours</label>
                                <div class="toggle-row"><label><input type="checkbox" id="qh-enabled"> Enable quiet hours</label></div>
                                <div class="row">
                                    <div><label>Start</label><input type="time" id="qh-start"></div>
                                    <div><label>End</label><input type="time" id="qh-end"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="wizard-actions">
                    <button class="wizard-btn secondary" id="al-test">Send Test Alert</button>
                    <button class="wizard-btn success" id="al-save"><i class="fas fa-check"></i> Save Preferences</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.close-wizard').addEventListener('click', close);

        // Populate
        overlay.querySelector('#ch-email').checked = !!cfg.channels.email;
        overlay.querySelector('#ch-sms').checked = !!cfg.channels.sms;
        overlay.querySelector('#ch-push').checked = !!cfg.channels.push;
        overlay.querySelector('#ty-deposit').checked = !!cfg.types.depositPosted;
        overlay.querySelector('#ty-approval').checked = !!cfg.types.approvalUpdates;
        overlay.querySelector('#ty-large').checked = !!cfg.types.largeTransaction;
        overlay.querySelector('#thr-large').value = cfg.types.largeTransactionThreshold;
        overlay.querySelector('#ty-lowbal').checked = !!cfg.types.lowBalance;
        overlay.querySelector('#thr-lowbal').value = cfg.types.lowBalanceThreshold;
        overlay.querySelector('#ty-security').checked = !!cfg.types.security;
        overlay.querySelector('#qh-enabled').checked = !!cfg.quietHours.enabled;
        overlay.querySelector('#qh-start').value = cfg.quietHours.start;
        overlay.querySelector('#qh-end').value = cfg.quietHours.end;

        // Save
        overlay.querySelector('#al-save').addEventListener('click', () => {
            const nextCfg = {
                channels: {
                    email: overlay.querySelector('#ch-email').checked,
                    sms: overlay.querySelector('#ch-sms').checked,
                    push: overlay.querySelector('#ch-push').checked
                },
                types: {
                    depositPosted: overlay.querySelector('#ty-deposit').checked,
                    approvalUpdates: overlay.querySelector('#ty-approval').checked,
                    largeTransaction: overlay.querySelector('#ty-large').checked,
                    largeTransactionThreshold: Math.max(0, Number(overlay.querySelector('#thr-large').value||0)),
                    lowBalance: overlay.querySelector('#ty-lowbal').checked,
                    lowBalanceThreshold: Math.max(0, Number(overlay.querySelector('#thr-lowbal').value||0)),
                    security: overlay.querySelector('#ty-security').checked
                },
                quietHours: {
                    enabled: overlay.querySelector('#qh-enabled').checked,
                    start: overlay.querySelector('#qh-start').value || '22:00',
                    end: overlay.querySelector('#qh-end').value || '07:00'
                }
            };
            this.saveAlertsConfig(nextCfg);
            this.showNotification('Alert preferences saved', 'success');
            close();
        });

        // Test alert
        overlay.querySelector('#al-test').addEventListener('click', () => {
            this.addNotification({ title: 'Test Alert', message: 'This is a test notification.', type: 'info' }, true);
            this.openNotificationsCenter();
        });
    }

    // Setting Handlers
    handleSettingToggle(setting) {
        switch(setting) {
            case 'personal-info':
                this.showPersonalInfoModal();
                break;
            case 'security':
                this.showSecuritySettingsModal();
                break;
            default:
                this.showNotification(`${setting} settings`);
        }
    }

    handleSwitchToggle(settingName, isEnabled) {
        const prefs = this.loadUserPrefs();
        prefs.switches = prefs.switches || {};
        prefs.switches[settingName] = !!isEnabled;
        this.saveUserPrefs(prefs);
        const settingLabel = settingName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const status = isEnabled ? 'enabled' : 'disabled';
        this.showNotification(`${settingLabel} ${status}`, isEnabled ? 'success' : 'info');
    }

    // Beneficiary Handlers
    handleBeneficiaryAction(action, beneficiaryName) {
        switch(action) {
            case 'edit-beneficiary':
                this.showNotification(`Edit beneficiary: ${beneficiaryName}`);
                break;
            case 'delete-beneficiary':
                this.confirmDeleteBeneficiary(beneficiaryName);
                break;
        }
    }

    confirmDeleteBeneficiary(beneficiaryName) {
        const confirmed = confirm(`Are you sure you want to delete beneficiary: ${beneficiaryName}?`);
        if (confirmed) {
            this.showNotification(`Beneficiary ${beneficiaryName} deleted`, 'success');
        }
    }

    showAddBeneficiaryForm() {
        this.showNotification('Add New Beneficiary form coming soon!');
    }

    // Limit Handlers
    handleLimitEdit(limitType) {
                const map = { atm: 'Daily ATM Withdrawal', transfer: 'Daily Transfer Limit' };
                const limits = this.loadUserLimits();
                const current = limitType === 'atm' ? limits.dailyAtmLimit : limits.dailyTransferLimit;
                const overlay = document.createElement('div');
                overlay.className = 'cards-overlay';
                overlay.innerHTML = `
                        <div class="cards-modal" role="dialog" aria-modal="true">
                            <div class="cards-header">
                                <h3>Edit ${map[limitType] || limitType}</h3>
                                <button class="cards-close" aria-label="Close">&times;</button>
                            </div>
                            <div class="cards-body">
                                <label>Limit Amount</label>
                                <div class="amount-input-section"><div class="currency-symbol">$</div><input type="number" id="limit-amount" min="0" step="10" value="${Number(current).toFixed(0)}"></div>
                                <div class="form-actions" style="justify-content:flex-end; margin-top:12px;">
                                    <button class="btn-outline" id="limit-cancel">Cancel</button>
                                    <button class="btn-primary" id="limit-save">Save</button>
                                </div>
                            </div>
                        </div>`;
                document.body.appendChild(overlay);
                const close = () => overlay.remove();
                overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
                overlay.querySelector('.cards-close').addEventListener('click', close);
                overlay.querySelector('#limit-cancel').addEventListener('click', close);
                overlay.querySelector('#limit-save').addEventListener('click', () => {
                        const val = Math.max(0, Number(overlay.querySelector('#limit-amount').value||0));
                        if (limitType === 'atm') limits.dailyAtmLimit = val; else if (limitType === 'transfer') limits.dailyTransferLimit = val;
                        this.saveUserLimits(limits);
                        this.renderAccountLimits();
                        this.showNotification('Limit updated', 'success');
                        close();
                });
    }

    // Routing Tab Handlers
    handleCopyToClipboard(copyType) {
        let textToCopy = '';
        if (copyType === 'account-number') {
            const toggleBtn = document.querySelector('#routing .account-summary-card [data-field="accountNumber"] button.toggle-visibility-btn');
            const revealed = toggleBtn && toggleBtn.getAttribute('aria-pressed') === 'true';
            textToCopy = revealed ? (this.currentUser.accountNumber || '') : this.maskAccountNumber(this.currentUser.accountNumber);
        } else if (copyType === 'routing-number') {
            textToCopy = this.currentUser.routingNumber || '021000021';
        } else {
            textToCopy = 'Information';
        }
        
        // In a real app, you would copy the actual full numbers
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.showNotification(`${copyType.replace('-', ' ')} copied to clipboard!`, 'success');
            }).catch(() => {
                this.showNotification('Failed to copy to clipboard');
            });
        } else {
            this.showNotification(`${copyType.replace('-', ' ')}: ${textToCopy}`, 'info');
        }
    }

    // Personal Info Modal
    showPersonalInfoModal() {
        const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
        const idx = users.findIndex(u => u.email === this.currentUser.email || u.accountNumber === this.currentUser.accountNumber);
        const user = users[idx] || {};
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header"><h3>Personal Information</h3><button class="cards-close" aria-label="Close">&times;</button></div>
                <div class="cards-body">
                    <div class="form-grid">
                        <div><label>Full Name</label><input type="text" id="pi-name" value="${this.escapeHtml(user.name||'')}"/></div>
                        <div><label>Email (login)</label><input type="email" id="pi-email" value="${this.escapeHtml(user.email||'')}" disabled/></div>
                        <div><label>Phone</label><input type="text" id="pi-phone" value="${this.escapeHtml(user.phone||'')}"/></div>
                        <div><label>Address</label><input type="text" id="pi-address" value="${this.escapeHtml((user.address && (user.address.street||''))||'')}" placeholder="Street"/></div>
                        <div class="row"><div><label>City</label><input type="text" id="pi-city" value="${this.escapeHtml((user.address && (user.address.city||''))||'')}"/></div><div><label>State</label><input type="text" id="pi-state" value="${this.escapeHtml((user.address && (user.address.state||''))||'')}"/></div><div><label>ZIP</label><input type="text" id="pi-zip" value="${this.escapeHtml((user.address && (user.address.zipCode||''))||'')}"/></div></div>
                    </div>
                </div>
                <div class="form-actions" style="justify-content:flex-end;padding:12px;">
                    <button class="btn-outline" id="pi-cancel">Cancel</button>
                    <button class="btn-primary" id="pi-save">Save</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#pi-cancel').addEventListener('click', close);
        overlay.querySelector('#pi-save').addEventListener('click', () => {
            const next = { ...user };
            next.name = overlay.querySelector('#pi-name').value.trim();
            next.phone = overlay.querySelector('#pi-phone').value.trim();
            next.address = {
                street: overlay.querySelector('#pi-address').value.trim(),
                city: overlay.querySelector('#pi-city').value.trim(),
                state: overlay.querySelector('#pi-state').value.trim(),
                zipCode: overlay.querySelector('#pi-zip').value.trim()
            };
            users[idx] = next;
            localStorage.setItem('bankingUsers', JSON.stringify(users));
            this.currentUser.name = next.name;
            this.currentUser.phoneNumber = next.phone;
            this.currentUser.address = next.address;
            this.renderMenuProfile();
            this.showNotification('Personal information updated', 'success');
            close();
        });
    }

    // User Preferences (switch toggles)
    getUserPrefsKey() { return `userPrefs_${this.currentUser.accountNumber || this.currentUser.id}`; }
    loadUserPrefs() { try { return JSON.parse(localStorage.getItem(this.getUserPrefsKey()) || '{}'); } catch { return {}; } }
    saveUserPrefs(p) { localStorage.setItem(this.getUserPrefsKey(), JSON.stringify(p||{})); }

    // Beneficiaries storage and UI
    getBeneficiariesKey() { return `userBeneficiaries_${this.currentUser.accountNumber || this.currentUser.id}`; }
    loadBeneficiaries() { try { return JSON.parse(localStorage.getItem(this.getBeneficiariesKey()) || '[]'); } catch { return []; } }
    saveBeneficiaries(list) { localStorage.setItem(this.getBeneficiariesKey(), JSON.stringify(list||[])); }
    renderBeneficiariesList() {
        const listEl = document.querySelector('.beneficiaries-list');
        if (!listEl) return;
        const items = this.loadBeneficiaries();
        if (!items.length) {
            listEl.innerHTML = `<div class="empty-transactions"><div class="empty-icon"><i class="fas fa-user"></i></div><h4>No beneficiaries saved</h4><p>Add payees to transfer faster.</p></div>`;
            return;
        }
        listEl.innerHTML = items.map((b, i) => `
            <div class="beneficiary-item" data-idx="${i}">
                <div class="beneficiary-avatar"><i class="fas fa-user"></i></div>
                <div class="beneficiary-info">
                    <h5>${this.escapeHtml(b.name)}</h5>
                    <p>${this.escapeHtml(b.bank || b.type || '')}</p>
                    <span class="beneficiary-account">${this.escapeHtml(b.mask || '')}</span>
                </div>
                <div class="beneficiary-actions">
                    <button class="beneficiary-btn edit" data-action="edit-beneficiary"><i class="fas fa-edit"></i></button>
                    <button class="beneficiary-btn delete" data-action="delete-beneficiary"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
        // Wire actions
        listEl.querySelectorAll('.beneficiary-btn.edit').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = Number(e.currentTarget.closest('.beneficiary-item').dataset.idx);
            this.openBeneficiaryEditor(idx);
        }));
        listEl.querySelectorAll('.beneficiary-btn.delete').forEach(btn => btn.addEventListener('click', (e) => {
            const idx = Number(e.currentTarget.closest('.beneficiary-item').dataset.idx);
            this.confirmDeleteBeneficiaryByIndex(idx);
        }));
    }
    showAddBeneficiaryForm() { this.openBeneficiaryEditor(null); }
    openBeneficiaryEditor(index) {
        const list = this.loadBeneficiaries();
        const existing = index!=null ? list[index] : { name: '', bank: '', account: '', mask: '' };
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header"><h3>${index!=null ? 'Edit' : 'Add'} Beneficiary</h3><button class="cards-close" aria-label="Close">&times;</button></div>
                <div class="cards-body">
                    <div class="form-grid">
                        <div><label>Name</label><input type="text" id="bf-name" value="${this.escapeHtml(existing.name)}"></div>
                        <div><label>Bank</label><input type="text" id="bf-bank" value="${this.escapeHtml(existing.bank||'')}"></div>
                        <div><label>Account Number</label><input type="text" id="bf-acct" value="${this.escapeHtml(existing.account||'')}"></div>
                    </div>
                </div>
                <div class="form-actions" style="justify-content:flex-end;padding:12px;">
                    <button class="btn-outline" id="bf-cancel">Cancel</button>
                    <button class="btn-primary" id="bf-save">Save</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#bf-cancel').addEventListener('click', close);
        overlay.querySelector('#bf-save').addEventListener('click', () => {
            const name = overlay.querySelector('#bf-name').value.trim();
            const bank = overlay.querySelector('#bf-bank').value.trim();
            const acct = overlay.querySelector('#bf-acct').value.replace(/\s+/g,'');
            if (!name || !bank || !acct) { this.showNotification('Please complete all fields', 'error'); return; }
            const mask = acct.length > 4 ? '****' + acct.slice(-4) : acct;
            const ben = { name, bank, account: acct, mask };
            if (index!=null) list[index] = ben; else list.push(ben);
            this.saveBeneficiaries(list);
            this.renderBeneficiariesList();
            this.showNotification('Beneficiary saved', 'success');
            close();
        });
    }
    confirmDeleteBeneficiary(name) {
        const confirmed = confirm(`Are you sure you want to delete beneficiary: ${name}?`);
        if (confirmed) {
            const list = this.loadBeneficiaries().filter(b => b.name !== name);
            this.saveBeneficiaries(list);
            this.renderBeneficiariesList();
            this.showNotification(`Beneficiary ${name} deleted`, 'success');
        }
    }
    confirmDeleteBeneficiaryByIndex(index) {
        const list = this.loadBeneficiaries();
        const name = list[index]?.name || 'beneficiary';
        const ok = confirm(`Delete ${name}?`);
        if (!ok) return;
        list.splice(index,1);
        this.saveBeneficiaries(list);
        this.renderBeneficiariesList();
        this.showNotification(`Beneficiary ${name} deleted`, 'success');
    }

    // Limits per user
    getUserLimitsKey() { return `userLimits_${this.currentUser.accountNumber || this.currentUser.id}`; }
    loadUserLimits() {
        try { return JSON.parse(localStorage.getItem(this.getUserLimitsKey()) || 'null') || { dailyAtmLimit: 500, dailyTransferLimit: 2500, usage: {} }; } catch { return { dailyAtmLimit: 500, dailyTransferLimit: 2500, usage: {} }; }
    }
    saveUserLimits(lim) { localStorage.setItem(this.getUserLimitsKey(), JSON.stringify(lim)); }
    getTodayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    updateAccountLimitsOnApproval(tx) {
        // Count transfers and bill pay toward daily transfer usage
        if (!tx) return;
        const lim = this.loadUserLimits();
        const day = this.getTodayKey();
        lim.usage[day] = lim.usage[day] || { atm: 0, transfer: 0 };
        if (tx.type === 'transfer' || tx.type === 'billpay') {
            lim.usage[day].transfer += Number(tx.amount) || 0;
        }
        this.saveUserLimits(lim);
        this.renderAccountLimits();
    }
    recalcTransferUsageFromTransactions() {
        const userTransactionKey = this.getUserTransactionKey();
        const list = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
        const lim = this.loadUserLimits();
        const day = this.getTodayKey();
        const used = list.filter(t => (t.type==='transfer' || t.type==='billpay') && t.status==='approved' && new Date(t.timestamp).toDateString() === new Date().toDateString()).reduce((s,t)=> s + Number(t.amount||0), 0);
        lim.usage[day] = lim.usage[day] || { atm: 0, transfer: 0 };
        lim.usage[day].transfer = used;
        this.saveUserLimits(lim);
    }
    renderAccountLimits() {
        // Ensure usage reflects history
        this.recalcTransferUsageFromTransactions();
        const lim = this.loadUserLimits();
        const day = this.getTodayKey();
        const used = (lim.usage[day]?.transfer) || 0;
        // ATM card elements
        const atmCard = document.querySelector('.limits-section .limit-card:nth-child(1)');
        const trnCard = document.querySelector('.limits-section .limit-card:nth-child(2)');
        if (atmCard) {
            const amtEl = atmCard.querySelector('.limit-amount');
            if (amtEl) amtEl.textContent = `$${Number(lim.dailyAtmLimit).toFixed(2)}`;
            const bar = atmCard.querySelector('.limit-progress');
            if (bar) bar.style.width = `${Math.min(100, (0 / Math.max(1, lim.dailyAtmLimit)) * 100)}%`;
            const usedEl = atmCard.querySelector('.limit-used span');
            if (usedEl) usedEl.textContent = `$0 used today`;
        }
        if (trnCard) {
            const amtEl = trnCard.querySelector('.limit-amount');
            if (amtEl) amtEl.textContent = `$${Number(lim.dailyTransferLimit).toFixed(2)}`;
            const bar = trnCard.querySelector('.limit-progress');
            const pct = (used / Math.max(1, lim.dailyTransferLimit)) * 100;
            if (bar) bar.style.width = `${Math.min(100, pct)}%`;
            const usedEl = trnCard.querySelector('.limit-used span');
            if (usedEl) usedEl.textContent = `$${Number(used).toFixed(2)} used today`;
        }
    }

    // Alerts & Notifications: storage and helpers
    getAlertsKey() {
        return `userAlerts_${this.currentUser.accountNumber || this.currentUser.id}`;
    }
    loadAlertsConfig() {
        try { return JSON.parse(localStorage.getItem(this.getAlertsKey()) || 'null') || {
            channels: { email: true, sms: false, push: true },
            types: {
                depositPosted: true,
                approvalUpdates: true,
                largeTransaction: true,
                largeTransactionThreshold: 1000,
                lowBalance: true,
                lowBalanceThreshold: 100,
                security: true
            },
            quietHours: { enabled: false, start: '22:00', end: '07:00' }
        }; } catch { return {
            channels: { email: true, sms: false, push: true },
            types: { depositPosted: true, approvalUpdates: true, largeTransaction: true, largeTransactionThreshold: 1000, lowBalance: true, lowBalanceThreshold: 100, security: true },
            quietHours: { enabled: false, start: '22:00', end: '07:00' }
        }; }
    }
    saveAlertsConfig(cfg) { localStorage.setItem(this.getAlertsKey(), JSON.stringify(cfg)); }

    getNotificationsKey() {
        return `userNotifications_${this.currentUser.accountNumber || this.currentUser.id}`;
    }
    loadNotifications() {
        try { return JSON.parse(localStorage.getItem(this.getNotificationsKey()) || '[]'); } catch { return []; }
    }
    saveNotifications(list) { localStorage.setItem(this.getNotificationsKey(), JSON.stringify(list)); }
    addNotification({ title, message, type = 'info' }, showToast = false) {
        const list = this.loadNotifications();
        const entry = { id: Date.now().toString(), title, message, type, timestamp: new Date().toISOString(), read: false };
        list.unshift(entry);
        this.saveNotifications(list);
        this.updateNotificationBadge();
        if (showToast && this.loadAlertsConfig().channels.push) this.showNotification(title + ': ' + message, type);
        return entry.id;
    }
    markAllNotificationsRead() {
        const list = this.loadNotifications().map(n => ({ ...n, read: true }));
        this.saveNotifications(list);
        this.updateNotificationBadge();
    }
    clearAllNotifications() {
        this.saveNotifications([]);
        this.updateNotificationBadge();
    }
    updateNotificationBadge() {
        const btn = document.querySelector('.notification-btn');
        if (!btn) return;
        let dot = btn.querySelector('.notif-dot');
        if (!dot) { dot = document.createElement('span'); dot.className = 'notif-dot'; btn.appendChild(dot); }
        const hasUnread = this.loadNotifications().some(n => !n.read);
        dot.classList.toggle('active', !!hasUnread);
    }
    openNotificationsCenter() {
        const list = this.loadNotifications();
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header">
                    <h3>Notifications</h3>
                    <button class="cards-close" aria-label="Close">&times;</button>
                </div>
                <div class="cards-body">
                    ${list.length ? '<div class="notif-list">' + list.map(n => `
                        <div class="notif-item ${n.read ? '' : 'unread'}">
                           <div class="notif-main">
                             <strong>${this.escapeHtml(n.title)}</strong>
                             <small>${new Date(n.timestamp).toLocaleString()}</small>
                           </div>
                           <div class="notif-msg">${this.escapeHtml(n.message)}</div>
                        </div>`).join('') + '</div>' : '<p>No notifications yet.</p>'}
                </div>
                <div class="form-actions" style="justify-content:space-between;padding:12px;">
                    <div>
                        <button class="btn-outline" id="nt-clear">Clear All</button>
                    </div>
                    <div>
                        <button class="btn-outline" id="nt-mark">Mark All Read</button>
                        <button class="btn-primary" id="nt-close">Close</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#nt-close').addEventListener('click', close);
        overlay.querySelector('#nt-mark').addEventListener('click', () => { this.markAllNotificationsRead(); close(); });
        overlay.querySelector('#nt-clear').addEventListener('click', () => { this.clearAllNotifications(); close(); });
    }

    handleStatementDownload(statement) {
        this.showNotification(`Downloading ${statement} statement...`, 'info');
        
        // Simulate download
        setTimeout(() => {
            this.showNotification('Statement downloaded successfully!', 'success');
        }, 1500);
    }

    handleDownloadAllStatements() {
        const list = this.getOrGenerateStatements();
        if (!list.length) { this.showNotification('No statements to download yet.', 'info'); return; }
        // Trigger individual downloads
        list.forEach(s => this.exportStatement(s));
        this.showNotification('Downloading statements...', 'success');
    }

    handleContactAction(contactType) {
        let supportEmail = 'customerservice0549@gmail.com';
        let supportPhone = '+18545537663752';
        try {
            const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            if (appSettings.supportEmail) supportEmail = appSettings.supportEmail;
            if (appSettings.supportPhone) supportPhone = appSettings.supportPhone;
        } catch {}
        switch(contactType) {
            case 'Customer Service':
                window.location.href = `mailto:${supportEmail}`;
                break;
            case 'Live Chat':
                window.location.href = `mailto:${supportEmail}`;
                break;
            case 'Email Support':
                window.location.href = `mailto:${supportEmail}`;
                break;
            case 'Find Branch':
                this.showNotification('Opening branch locator...', 'info');
                break;
            default:
                this.showNotification(`Contact ${contactType}`, 'info');
        }
    }

    // Documents & Statements
    getStatementsKey() { return `userStatements_${this.currentUser.accountNumber || this.currentUser.id}`; }
    loadStatements() { try { return JSON.parse(localStorage.getItem(this.getStatementsKey()) || '[]'); } catch { return []; } }
    saveStatements(list) { localStorage.setItem(this.getStatementsKey(), JSON.stringify(list||[])); }
    getOrGenerateStatements() {
        let list = this.loadStatements();
        if (list.length) return list;
        // Auto-generate current month statement if there is any activity
        const txKey = this.getUserTransactionKey();
        const all = JSON.parse(localStorage.getItem(txKey) || '[]');
        if (!all.length) return [];
        const now = new Date();
        const period = `${now.toLocaleString('default',{month:'long'})} ${now.getFullYear()}`;
        const s = this.buildStatementObject(period, all);
        list = [s];
        this.saveStatements(list);
        return list;
    }
    buildStatementObject(period, transactions) {
        const approved = transactions.filter(t=>t.status==='approved');
        const credits = approved.filter(t=>t.type==='deposit').reduce((s,t)=>s+Number(t.amount||0),0);
        const debits = approved.filter(t=>t.type==='transfer'||t.type==='billpay').reduce((s,t)=>s+Number(t.amount||0),0);
        const endBal = Number(localStorage.getItem(this.getUserBalanceKey())||'0');
        // Approximate start balance
        const startBal = Math.max(0, endBal - credits + debits);
        return { id: Date.now().toString(), period, startBal, endBal, credits, debits, generatedAt: new Date().toISOString() };
    }
    openDocumentsAndStatements() {
        const statements = this.getOrGenerateStatements();
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header">
                    <h3>Documents & Statements</h3>
                    <button class="cards-close" aria-label="Close">&times;</button>
                </div>
                <div class="cards-body" style="max-height:60vh;overflow:auto;">
                    ${statements.length ? statements.map(s=>`
                        <div class="statement-item">
                          <div class="statement-info">
                            <div class="statement-icon"><i class="fas fa-file-pdf"></i></div>
                            <div class="statement-details">
                              <h5>${this.escapeHtml(s.period)} Statement</h5>
                              <p>Start ${this.formatCurrency(s.startBal)} • End ${this.formatCurrency(s.endBal)}</p>
                              <div class="statement-meta">Generated ${new Date(s.generatedAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <button class="statement-download" data-id="${s.id}"><i class="fas fa-download"></i></button>
                        </div>
                    `).join('') : '<p>No statements yet. Make a transaction to generate one.</p>'}
                </div>
                <div class="form-actions" style="justify-content:space-between;padding:12px;">
                    <button class="btn-outline" id="gen-statement">Generate Latest</button>
                    <div>
                      <button class="btn-outline" id="doc-close">Close</button>
                      <button class="btn-primary" id="dl-all">Download All</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = ()=> overlay.remove();
        overlay.addEventListener('click',(e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#doc-close').addEventListener('click', close);
        overlay.querySelectorAll('.statement-download').forEach(btn=>btn.addEventListener('click',()=>{
            const id = btn.getAttribute('data-id');
            const list = this.loadStatements();
            const s = list.find(x=>x.id===id);
            if (s) this.exportStatement(s);
        }));
        overlay.querySelector('#dl-all').addEventListener('click', ()=> this.handleDownloadAllStatements());
        overlay.querySelector('#gen-statement').addEventListener('click', ()=>{
            const txKey = this.getUserTransactionKey();
            const all = JSON.parse(localStorage.getItem(txKey) || '[]');
            if (!all.length) { this.showNotification('No activity to include in statement.', 'info'); return; }
            const now = new Date();
            const period = `${now.toLocaleString('default',{month:'long'})} ${now.getFullYear()}`;
            const s = this.buildStatementObject(period, all);
            const list = this.loadStatements();
            list.unshift({ ...s, id: Date.now().toString() });
            this.saveStatements(list);
            this.showNotification('Statement generated', 'success');
            overlay.remove();
            this.openDocumentsAndStatements();
        });
    }
    exportStatement(s) {
        // Build a minimal receipt-like view to render as PNG via html2canvas
        const temp = document.createElement('div');
        temp.style.position='fixed'; temp.style.left='-9999px'; temp.style.top='0'; temp.style.width='420px';
        temp.innerHTML = `
          <div class="receipt-modal" style="box-shadow:none;border:1px solid #eee;">
            <div class="receipt-header"><h4 style="margin:0">${this.escapeHtml(s.period)} Statement</h4></div>
            <div class="receipt-body">
              <div class="receipt-row"><strong>Account:</strong><span>${this.maskAccountNumber(this.currentUser.accountNumber)}</span></div>
              <div class="receipt-row"><strong>Start Balance:</strong><span>${this.formatCurrency(s.startBal)}</span></div>
              <div class="receipt-row"><strong>End Balance:</strong><span>${this.formatCurrency(s.endBal)}</span></div>
              <div class="receipt-row"><strong>Total Credits:</strong><span>${this.formatCurrency(s.credits)}</span></div>
              <div class="receipt-row"><strong>Total Debits:</strong><span>${this.formatCurrency(s.debits)}</span></div>
              <div class="receipt-row"><strong>Generated:</strong><span>${new Date(s.generatedAt).toLocaleString()}</span></div>
            </div>
          </div>`;
        document.body.appendChild(temp);
        try {
            if (window.html2canvas) {
                window.html2canvas(temp).then(canvas => {
                    const url = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Statement_${s.period.replace(/\s+/g,'_')}.png`;
                    a.click();
                    temp.remove();
                }).catch(()=>{ temp.remove(); this.showNotification('Failed to export statement', 'error'); });
            } else {
                temp.remove();
                this.showNotification('Export unavailable (html2canvas missing)', 'error');
            }
        } catch { temp.remove(); this.showNotification('Export failed', 'error'); }
    }

    // Tax Documents (simple 1099-style summary)
    getTaxDocsKey() { return `userTaxDocs_${this.currentUser.accountNumber || this.currentUser.id}`; }
    loadTaxDocs() { try { return JSON.parse(localStorage.getItem(this.getTaxDocsKey()) || '[]'); } catch { return []; } }
    saveTaxDocs(list) { localStorage.setItem(this.getTaxDocsKey(), JSON.stringify(list||[])); }
    openTaxDocuments() {
        let docs = this.loadTaxDocs();
        if (!docs.length) {
            docs = this.generateCurrentYearTaxDoc();
            this.saveTaxDocs(docs);
        }
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header"><h3>Tax Documents</h3><button class="cards-close" aria-label="Close">&times;</button></div>
                <div class="cards-body" style="max-height:60vh;overflow:auto;">
                    ${docs.map(d=>`
                        <div class="statement-item">
                          <div class="statement-info">
                            <div class="statement-icon"><i class="fas fa-file-invoice"></i></div>
                            <div class="statement-details">
                              <h5>${this.escapeHtml(d.year)} 1099 Summary</h5>
                              <p>Interest: ${this.formatCurrency(d.interest)} • Other Income: ${this.formatCurrency(d.otherIncome)}</p>
                              <div class="statement-meta">Generated ${new Date(d.generatedAt).toLocaleString()}</div>
                            </div>
                          </div>
                          <button class="statement-download" data-id="${d.id}"><i class="fas fa-download"></i></button>
                        </div>`).join('')}
                </div>
                <div class="form-actions" style="justify-content:space-between;padding:12px;">
                    <button class="btn-outline" id="gen-tax">Generate Current Year</button>
                    <div>
                        <button class="btn-outline" id="tax-close">Close</button>
                        <button class="btn-primary" id="tax-dl-all">Download All</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = ()=> overlay.remove();
        overlay.addEventListener('click',(e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#tax-close').addEventListener('click', close);
        overlay.querySelectorAll('.statement-download').forEach(btn=>btn.addEventListener('click',()=>{
            const id = btn.getAttribute('data-id');
            const list = this.loadTaxDocs();
            const d = list.find(x=>x.id===id);
            if (d) this.exportTaxDoc(d);
        }));
        overlay.querySelector('#tax-dl-all').addEventListener('click', ()=>{
            this.loadTaxDocs().forEach(d=>this.exportTaxDoc(d));
            this.showNotification('Downloading tax documents...', 'success');
        });
        overlay.querySelector('#gen-tax').addEventListener('click', ()=>{
            const list = this.generateCurrentYearTaxDoc();
            this.saveTaxDocs(list);
            this.showNotification('Tax document generated', 'success');
            overlay.remove();
            this.openTaxDocuments();
        });
    }
    generateCurrentYearTaxDoc() {
        const year = new Date().getFullYear();
        const txKey = this.getUserTransactionKey();
        const approved = (JSON.parse(localStorage.getItem(txKey) || '[]')).filter(t=>t.status==='approved');
        // For demo: interest as 0.1% of end balance, otherIncome from deposits tagged 'interest' in description
        const endBal = Number(localStorage.getItem(this.getUserBalanceKey())||'0');
        const interest = +(endBal * 0.001).toFixed(2);
        const otherIncome = approved.filter(t=>t.type==='deposit' && /interest|dividend/i.test(t.description||''))
                                    .reduce((s,t)=>s+Number(t.amount||0),0);
        const doc = { id: String(year), year, interest, otherIncome, generatedAt: new Date().toISOString() };
        const list = this.loadTaxDocs().filter(d=>d.year!==year);
        list.unshift(doc);
        return list;
    }
    exportTaxDoc(d) {
        const temp = document.createElement('div');
        temp.style.position='fixed'; temp.style.left='-9999px'; temp.style.top='0'; temp.style.width='480px';
        temp.innerHTML = `
          <div class="receipt-modal" style="box-shadow:none;border:1px solid #eee;">
            <div class="receipt-header"><h4 style="margin:0">${this.escapeHtml(d.year)} 1099 Summary</h4></div>
            <div class="receipt-body">
              <div class="receipt-row"><strong>Account:</strong><span>${this.maskAccountNumber(this.currentUser.accountNumber)}</span></div>
              <div class="receipt-row"><strong>Interest Income:</strong><span>${this.formatCurrency(d.interest)}</span></div>
              <div class="receipt-row"><strong>Other Income:</strong><span>${this.formatCurrency(d.otherIncome)}</span></div>
              <div class="receipt-row"><strong>Generated:</strong><span>${new Date(d.generatedAt).toLocaleString()}</span></div>
            </div>
          </div>`;
        document.body.appendChild(temp);
        try {
            if (window.html2canvas) {
                window.html2canvas(temp).then(canvas => {
                    const url = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Tax_${d.year}.png`;
                    a.click();
                    temp.remove();
                }).catch(()=>{ temp.remove(); this.showNotification('Failed to export tax document', 'error'); });
            } else { temp.remove(); this.showNotification('Export unavailable', 'error'); }
        } catch { temp.remove(); this.showNotification('Export failed', 'error'); }
    }

    // Privacy Controls
    getPrivacyKey() { return `userPrivacy_${this.currentUser.accountNumber || this.currentUser.id}`; }
    loadPrivacy() {
        try { return JSON.parse(localStorage.getItem(this.getPrivacyKey()) || 'null') || {
            dataSharing: { marketing: false, affiliates: false, analytics: true },
            personalization: { offers: true, tips: true },
            communications: { email: true, sms: false }
        }; } catch { return { dataSharing: { marketing: false, affiliates: false, analytics: true }, personalization: { offers: true, tips: true }, communications: { email: true, sms: false } }; }
    }
    savePrivacy(cfg) { localStorage.setItem(this.getPrivacyKey(), JSON.stringify(cfg)); }
    openPrivacyControls() {
        const cfg = this.loadPrivacy();
        const overlay = document.createElement('div');
        overlay.className = 'deposit-wizard-overlay';
        overlay.innerHTML = `
            <div class="deposit-wizard" role="dialog" aria-modal="true">
                <div class="wizard-header"><h3>Privacy Controls</h3><button class="close-wizard" aria-label="Close">&times;</button></div>
                <div class="wizard-content" style="max-height:60vh;overflow:auto;">
                  <div class="wizard-step active">
                    <div class="step-header"><h4>Data Sharing</h4><p>Choose how your data is shared.</p></div>
                    <div class="form-grid">
                        <div><label><input type="checkbox" id="pv-marketing"> Share with marketing partners</label></div>
                        <div><label><input type="checkbox" id="pv-affiliates"> Share with affiliates</label></div>
                        <div><label><input type="checkbox" id="pv-analytics"> Allow analytics & diagnostics</label></div>
                    </div>
                    <div class="step-header" style="margin-top:16px;"><h4>Personalization</h4></div>
                    <div class="form-grid">
                        <div><label><input type="checkbox" id="pv-offers"> Personalized offers</label></div>
                        <div><label><input type="checkbox" id="pv-tips"> Financial tips</label></div>
                    </div>
                    <div class="step-header" style="margin-top:16px;"><h4>Communications</h4></div>
                    <div class="form-grid">
                        <div><label><input type="checkbox" id="pv-email"> Email updates</label></div>
                        <div><label><input type="checkbox" id="pv-sms"> SMS updates</label></div>
                    </div>
                  </div>
                </div>
                <div class="wizard-actions">
                    <button class="wizard-btn secondary" id="pv-cancel">Cancel</button>
                    <button class="wizard-btn success" id="pv-save"><i class="fas fa-check"></i> Save</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = ()=> overlay.remove();
        overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.close-wizard').addEventListener('click', close);
        overlay.querySelector('#pv-cancel').addEventListener('click', close);
        overlay.querySelector('#pv-marketing').checked = !!cfg.dataSharing.marketing;
        overlay.querySelector('#pv-affiliates').checked = !!cfg.dataSharing.affiliates;
        overlay.querySelector('#pv-analytics').checked = !!cfg.dataSharing.analytics;
        overlay.querySelector('#pv-offers').checked = !!cfg.personalization.offers;
        overlay.querySelector('#pv-tips').checked = !!cfg.personalization.tips;
        overlay.querySelector('#pv-email').checked = !!cfg.communications.email;
        overlay.querySelector('#pv-sms').checked = !!cfg.communications.sms;
        overlay.querySelector('#pv-save').addEventListener('click', ()=>{
            const next = {
                dataSharing: {
                    marketing: overlay.querySelector('#pv-marketing').checked,
                    affiliates: overlay.querySelector('#pv-affiliates').checked,
                    analytics: overlay.querySelector('#pv-analytics').checked
                },
                personalization: {
                    offers: overlay.querySelector('#pv-offers').checked,
                    tips: overlay.querySelector('#pv-tips').checked
                },
                communications: {
                    email: overlay.querySelector('#pv-email').checked,
                    sms: overlay.querySelector('#pv-sms').checked
                }
            };
            this.savePrivacy(next);
            this.showNotification('Privacy preferences saved', 'success');
            close();
        });
    }

    // Terms & Privacy Policy
    openTermsConditions() {
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header"><h3>Terms & Conditions</h3><button class="cards-close" aria-label="Close">&times;</button></div>
                <div class="cards-body" style="max-height:60vh;overflow:auto;line-height:1.6;">
                    <p>Welcome to our digital banking experience. By accessing or using this app, you agree to these Terms & Conditions.</p>
                    <p><strong>Account Use:</strong> You will protect your credentials and transaction PIN. You authorize us to process transactions submitted with your valid PIN.</p>
                    <p><strong>Transactions:</strong> Deposits and transfers may be subject to review and approval. Limits, holds, and verification may apply.</p>
                    <p><strong>Security:</strong> We provide tools like PIN protection and alerts, but you are responsible for promptly reporting unauthorized activity.</p>
                    <p><strong>Data:</strong> We handle your data per our Privacy Policy. You can manage sharing via Privacy Controls.</p>
                    <p><strong>Changes:</strong> Features and terms may change. Continued use constitutes acceptance of updates.</p>
                    <p><strong>Contact:</strong> For help, use Customer Service in the app.</p>
                </div>
                <div class="form-actions" style="justify-content:flex-end;padding:12px;">
                    <button class="btn-primary" id="t-close">Close</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = ()=> overlay.remove();
        overlay.addEventListener('click',(e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#t-close').addEventListener('click', close);
    }
    openPrivacyPolicy() {
        const overlay = document.createElement('div');
        overlay.className = 'cards-overlay';
        overlay.innerHTML = `
            <div class="cards-modal" role="dialog" aria-modal="true">
                <div class="cards-header"><h3>Privacy Policy</h3><button class="cards-close" aria-label="Close">&times;</button></div>
                <div class="cards-body" style="max-height:60vh;overflow:auto;line-height:1.6;">
                    <p><strong>Overview:</strong> We collect only what we need to provide banking services and keep your account secure.</p>
                    <p><strong>Data We Collect:</strong> Contact details, account identifiers, device information, and transaction history.</p>
                    <p><strong>How We Use Data:</strong> To operate your account, prevent fraud, personalize features, and comply with law.</p>
                    <p><strong>Sharing:</strong> We may share with service providers, affiliates, or as required by law. You can control marketing and analytics sharing in Privacy Controls.</p>
                    <p><strong>Your Choices:</strong> Manage alerts, PIN, and privacy preferences in the app. You can request data changes at any time.</p>
                    <p><strong>Security:</strong> We use industry-standard protections and in-app PIN confirmation for sensitive actions.</p>
                </div>
                <div class="form-actions" style="justify-content:flex-end;padding:12px;">
                    <button class="btn-primary" id="p-close">Close</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const close = ()=> overlay.remove();
        overlay.addEventListener('click',(e)=>{ if (e.target===overlay) close(); });
        overlay.querySelector('.cards-close').addEventListener('click', close);
        overlay.querySelector('#p-close').addEventListener('click', close);
    }

    // Search Functionality
    setupSearchFunctionality() {
        const searchInput = document.querySelector('.search-input');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                console.log('Searching for:', searchTerm);
                
                if (searchTerm.length > 2) {
                    this.performSearch(searchTerm);
                }
            });

            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const searchTerm = e.target.value.toLowerCase();
                    this.performSearch(searchTerm);
                }
            });
        }
    }

    performSearch(searchTerm) {
        console.log('Performing search for:', searchTerm);
        this.showNotification(`Searching for "${searchTerm}"...`);
    }

    // Transaction Search Toggle
    toggleTransactionSearch() {
        // This could expand to show a search overlay or filter
        this.showNotification('Transaction search activated');
    }

    // Filter Options
    showFilterOptions() {
        const filterOptions = [
            'All Transactions',
            'Deposits',
            'Withdrawals',
            'Transfers',
            'Recurring Payments'
        ];
        
        console.log('Filter options:', filterOptions);
        this.showNotification('Filter options available');
    }

    // Transaction Receipt Modal (clickable + downloadable)
    showTransactionReceipt(transactionElement) {
        const description = (transactionElement.querySelector('.transaction-main')?.textContent || transactionElement.querySelector('.transaction-description')?.textContent || '').trim();
        const amountText = (transactionElement.querySelector('.transaction-amount')?.textContent || '').trim();
        const date = (transactionElement.querySelector('.transaction-date')?.textContent || '').trim();
        const fallbackStatusClass = (transactionElement.className.match(/pending|approved|declined/)||['approved'])[0];
        const method = transactionElement.getAttribute('data-method') || (description.toLowerCase().includes('wire') ? 'wire' : description.toLowerCase().includes('zelle') ? 'zelle' : description.toLowerCase().includes('ach') ? 'ach' : description.toLowerCase().includes('check') ? 'check' : description.toLowerCase().includes('bill') ? 'billpay' : 'standard');
        // Try to retrieve full transaction details by id for richer fields and freshest status
        const txId = transactionElement.getAttribute('data-txid');
        let txDetails = null; let txStatus = fallbackStatusClass; let declineReason = '';
        try {
            const userTransactionKey = this.getUserTransactionKey();
            const userTransactions = JSON.parse(localStorage.getItem(userTransactionKey) || '[]');
            const tx = userTransactions.find(t => String(t.id) === String(txId));
            if (tx) {
                txDetails = tx.details || null;
                txStatus = tx.status || fallbackStatusClass;
                declineReason = tx.declineReason || '';
            }
        } catch {}

        // Determine amounts
        const raw = amountText.replace(/[^0-9.]/g, '');
        const numeric = parseFloat(raw || '0');
        const isNegative = amountText.trim().startsWith('-');
        const amountAbs = Math.abs(numeric);
        const fee = +(amountAbs * 0.01).toFixed(2); // 1% fee example
        const amountPaid = +(amountAbs + fee).toFixed(2);

        // Synthetic data
        const txNumber = 'TX-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        const sectionId = 'SEC-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const methodNames = { standard: 'Transfer', zelle: 'Zelle Transfer', wire: 'Wire Transfer', ach: 'ACH Transfer', check: 'Mailed Check', billpay: 'Bill Payment', deposit: 'Deposit' };
    const paymentMethod = isNegative ? (methodNames[method] || 'Transfer') : 'Deposit';
        const recipient = description.includes('Transfer to') ? description.replace('Transfer to', '').trim() : 'Bank Processing';
        const note = description;

        const overlay = document.createElement('div');
        overlay.className = 'receipt-overlay';
        const statusMap = {
            approved: { cls: 'status-success', text: 'Payment successful' },
            pending: { cls: 'status-processing', text: 'Pending approval' },
            declined: { cls: 'status-declined', text: 'Payment declined' }
        };
        const si = statusMap[txStatus] || statusMap.pending;
        overlay.innerHTML = `
            <div class="receipt-modal" role="dialog" aria-modal="true">
                <div class="receipt-header">
                    <h3>Payment Receipt</h3>
                    <button class="receipt-close" aria-label="Close">&times;</button>
                </div>
                <div class="receipt-body" id="receipt-capture">
                    <div class="receipt-status ${si.cls}"><span class="dot"></span> ${si.text}</div>

                    <div class="receipt-section">
                        <div class="receipt-row"><strong>Amount:</strong><span>$${amountAbs.toFixed(2)}</span></div>
                        <div class="receipt-row"><strong>Fee charged:</strong><span>$${fee.toFixed(2)}</span></div>
                        <div class="receipt-row"><strong>Amount paid:</strong><span>$${amountPaid.toFixed(2)}</span></div>
                    </div>

                    <div class="receipt-section">
                        <h5>Transaction details</h5>
                        <div class="receipt-row"><strong>Status:</strong><span>${si.text}</span></div>
                        <div class="receipt-row"><strong>Type:</strong><span>${paymentMethod}</span></div>
                        <div class="receipt-row"><strong>Recipient:</strong><span>${txDetails?.name || recipient}</span></div>
                        ${txDetails?.bank ? `<div class="receipt-row"><strong>Bank:</strong><span>${txDetails.bank}</span></div>` : ''}
                        ${method==='billpay' ? `<div class="receipt-row"><strong>Biller:</strong><span>${txDetails?.biller || ''}</span></div>` : ''}
                        ${method==='billpay' ? `<div class="receipt-row"><strong>Reference #:</strong><span>${txDetails?.reference || ''}</span></div>` : ''}
                        ${txDetails?.acct ? `<div class="receipt-row"><strong>Account:</strong><span>••••${String(txDetails.acct).slice(-4)}</span></div>` : ''}
                        ${txDetails?.zelleContact ? `<div class="receipt-row"><strong>Zelle contact:</strong><span>${txDetails.zelleContact}</span></div>` : ''}
                        ${txDetails?.wireCode ? `<div class="receipt-row"><strong>SWIFT/IBAN:</strong><span>${txDetails.wireCode}</span></div>` : ''}
                        ${txDetails?.routing ? `<div class="receipt-row"><strong>Routing:</strong><span>${txDetails.routing}</span></div>` : ''}
                        ${txDetails?.mailing ? `<div class="receipt-row"><strong>Mailing:</strong><span>${txDetails.mailing}</span></div>` : ''}
                        ${txStatus==='declined' && declineReason ? `<div class="receipt-row"><strong>Decline reason:</strong><span>${this.escapeHtml(declineReason)}</span></div>` : ''}
                        <div class="receipt-row"><strong>Note:</strong><span>${this.escapeHtml(txDetails?.reason || note)}</span></div>
                        <div class="receipt-row"><strong>Transaction number:</strong><span>${txNumber}</span></div>
                        <div class="receipt-row"><strong>Transaction date:</strong><span>${date || new Date().toLocaleString()}</span></div>
                        <div class="receipt-row"><strong>Section id:</strong><span>${sectionId}</span></div>
                    </div>
                </div>
                <div class="receipt-footer">
                    <button class="btn btn-secondary" id="report-issue-btn">Report issue</button>
                    <button class="btn btn-primary" id="share-receipt-btn">Share receipt</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('.receipt-close').addEventListener('click', close);

        // Report Issue -> email to support with prefilled subject/body
        overlay.querySelector('#report-issue-btn').addEventListener('click', () => {
            let supportEmail = 'customerservice0549@gmail.com';
            try {
                const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                if (appSettings.supportEmail) supportEmail = appSettings.supportEmail;
            } catch {}
            const subject = encodeURIComponent(`Issue with transaction ${txNumber}`);
            const body = encodeURIComponent(`Hello Support,%0D%0A%0D%0AI have an issue with the following transaction:%0D%0A- Transaction Number: ${txNumber}%0D%0A- Amount: $${amountAbs.toFixed(2)}%0D%0A- Date: ${date}%0D%0A- Section ID: ${sectionId}%0D%0A%0D%0ADescription/Note: ${note}%0D%0A%0D%0APlease assist.%0D%0A`);
            window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
        });

        // Share Receipt -> download image using html2canvas
        overlay.querySelector('#share-receipt-btn').addEventListener('click', async () => {
            const el = document.getElementById('receipt-capture');
            try {
                if (window.html2canvas) {
                    const canvas = await window.html2canvas(el, {backgroundColor: '#ffffff', scale: 2});
                    const dataUrl = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `${txNumber}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    this.showNotification('Receipt downloaded to your device.', 'success');
                } else {
                    this.showNotification('Sharing not available (html2canvas missing).', 'error');
                }
            } catch (err) {
                console.error(err);
                this.showNotification('Failed to export receipt.', 'error');
            }
        });
    }

    // Account Details
    showAccountDetails() {
        const accountDetails = {
            accountNumber: '****0630',
            routingNumber: '123456789',
            accountType: 'Checking'
        };
        
        console.log('Account Details:', accountDetails);
        this.showNotification('Account details: ****0630');
    }

    // Notification System
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#333',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: '1000',
            fontSize: '14px',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            transform: 'translateY(-100px)',
            transition: 'transform 0.3s ease'
        });
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateY(-100px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Logout functionality
    logout() {
        const confirmed = confirm('Are you sure you want to sign off?');
        if (confirmed) {
            // Clear session
            localStorage.removeItem('bankingAppSession');
            sessionStorage.removeItem('bankingAppSession');
            
            this.showNotification('Signing off...', 'success');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }

    // Check authentication
    checkAuth() {
        const sessionData = localStorage.getItem('bankingAppSession') || 
                           sessionStorage.getItem('bankingAppSession');

        if (!sessionData) {
            window.location.href = 'index.html';
            return;
        }

        try {
            const session = JSON.parse(sessionData);
            // Validate user still exists
            const users = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
            const exists = users.some(u => u.email === session.user.email);
            if (!exists) {
                // Invalidate and redirect
                localStorage.removeItem('bankingAppSession');
                sessionStorage.removeItem('bankingAppSession');
                window.location.href = 'index.html';
                return;
            }
            const loginTime = new Date(session.loginTime);
            const now = new Date();
            const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);

            // Auto-logout after 24 hours
            if (hoursSinceLogin >= 24) {
                this.logout();
                return;
            }

            // Update any user-specific information
            this.updateUserInfo(session.user);

        } catch (error) {
            console.error('Invalid session data:', error);
            window.location.href = 'index.html';
        }
    }

    updateUserInfo(user) {
        // Update any user-specific elements in the banking app
        console.log('Current user:', user.name);
        
        // You can update UI elements here based on user data
        // For example, update account holder name, account number, etc.
        try {
            this.renderRoutingInfo();
            this.renderMenuProfile();
        } catch {}
    }

    // Confirmation Dialog
    showConfirmDialog(message) {
        const confirmed = confirm(message);
        if (confirmed) {
            this.showNotification('Action confirmed');
        }
    }

    // Utility Methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        }).format(new Date(date));
    }
}

// Ensure security modal function exists (added above via handleMenuAction wiring)

// Additional Helper Functions

// Smooth scrolling for better UX
function smoothScrollTo(element) {
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Touch/swipe support for mobile
function addSwipeSupport() {
    let startX = 0;
    let startY = 0;

    document.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    document.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const diffX = startX - endX;
        const diffY = startY - endY;
        
        // Horizontal swipe detection
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                console.log('Swiped left');
            } else {
                console.log('Swiped right');
            }
        }
    });
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const isBankingAppPage = !!document.querySelector('.bottom-nav') || !!document.querySelector('.content-area');
    if (!isBankingAppPage) {
        return; // Do not initialize BankingApp on non-app pages (e.g., admin.html)
    }

    console.log('Banking App Initializing...');

    const app = new BankingApp();
    app.checkAuth();
    addSwipeSupport();
    initializeScrollNavigation();

    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        }
    });

    console.log('Banking App Initialized Successfully!');
});

// Scroll-based Navigation Hide/Show
function initializeScrollNavigation() {
    const bottomNav = document.querySelector('.bottom-nav');
    let lastScrollY = window.scrollY;
    let scrollTimeout;
    
    if (!bottomNav) return;
    
    function handleScroll() {
        const currentScrollY = window.scrollY;
        
        // Clear existing timeout
        clearTimeout(scrollTimeout);
        
        // Show navigation if at top of page
        if (currentScrollY <= 10) {
            bottomNav.classList.remove('hidden');
            return;
        }
        
        // Hide navigation while scrolling
        if (Math.abs(currentScrollY - lastScrollY) > 5) {
            bottomNav.classList.add('hidden');
        }
        
        // Show navigation when scrolling stops
        scrollTimeout = setTimeout(() => {
            bottomNav.classList.remove('hidden');
        }, 150);
        
        lastScrollY = currentScrollY;
    }
    
    // Add scroll event listener with throttling
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    });
}

// Handle window resize for responsive behavior
window.addEventListener('resize', () => {
    console.log('Window resized, adjusting layout...');
});

// Prevent zoom on double-tap for better mobile experience

// Global function to close all users modal
function closeAllUsersModal() {
    const modal = document.getElementById('all-users-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BankingApp;
}