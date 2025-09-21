// Debug Balance Synchronization
// Paste this into browser console on either admin.html or banking-app.html

function debugBalanceSync() {
    console.log('=== BALANCE SYNC DEBUG TOOL ===');
    
    // Show all balance keys in localStorage
    console.log('\n--- ALL BALANCE KEYS IN LOCALSTORAGE ---');
    const balanceKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userBalance_')) {
            const value = localStorage.getItem(key);
            balanceKeys.push({ key, value });
            console.log(`${key}: ${value}`);
        }
    }
    
    if (balanceKeys.length === 0) {
        console.log('No balance keys found!');
    }
    
    // Show all users in bankingUsers
    console.log('\n--- ALL USERS IN BANKINGUSERS ---');
    const bankingUsers = JSON.parse(localStorage.getItem('bankingUsers') || '[]');
    bankingUsers.forEach((user, index) => {
        console.log(`User ${index}:`, {
            name: user.name,
            email: user.email,
            accountNumber: user.accountNumber,
            id: user.id,
            balance: user.balance
        });
        
        // Generate what the balance key should be
        const expectedKey = `userBalance_${user.accountNumber || user.id}`;
        const actualBalance = localStorage.getItem(expectedKey);
        console.log(`  Expected key: ${expectedKey}`);
        console.log(`  Actual value in localStorage: ${actualBalance}`);
        console.log(`  User balance property: ${user.balance}`);
        console.log('  ---');
    });
    
    // Show current session user if available
    console.log('\n--- CURRENT SESSION USER ---');
    const sessionData = localStorage.getItem('userSession');
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            console.log('Session user:', session.user);
            
            if (typeof app !== 'undefined' && app.currentUser) {
                console.log('App currentUser:', app.currentUser);
                console.log('App would generate key:', `userBalance_${app.currentUser.accountNumber || app.currentUser.id}`);
            }
        } catch (e) {
            console.log('Error parsing session:', e);
        }
    } else {
        console.log('No active session found');
    }
    
    console.log('\n=== END DEBUG ===');
    
    return {
        balanceKeys,
        bankingUsers,
        sessionData
    };
}

// Auto-run the debug
debugBalanceSync();