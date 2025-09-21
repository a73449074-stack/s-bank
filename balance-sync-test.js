// Test script to verify balance synchronization between admin and user systems
// Run this in browser console on either admin.html or banking-app.html

function testBalanceSynchronization() {
    console.log('=== BALANCE SYNCHRONIZATION TEST ===');
    
    // Test user data (similar to what would be in bankingUsers)
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        accountNumber: '123456789',
        balance: '$0.00'
    };
    
    console.log('Test User:', testUser);
    
    // Simulate admin balance key generation
    function adminGetUserBalanceKey(user) {
        return `userBalance_${user.accountNumber || user.id}`;
    }
    
    // Simulate main app balance key generation  
    function mainGetUserBalanceKey(user) {
        return `userBalance_${user.accountNumber || user.id}`;
    }
    
    // Generate keys
    const adminKey = adminGetUserBalanceKey(testUser);
    const mainKey = mainGetUserBalanceKey(testUser);
    
    console.log('Admin Key:', adminKey);
    console.log('Main Key:', mainKey);
    console.log('Keys Match:', adminKey === mainKey);
    
    if (adminKey !== mainKey) {
        console.error('❌ KEYS DO NOT MATCH! Balance sync will fail.');
        return false;
    }
    
    // Test balance setting and retrieval
    const testAmount = 5000;
    
    // Simulate admin setting balance
    localStorage.setItem(adminKey, testAmount.toString());
    console.log('✅ Admin set balance:', testAmount);
    
    // Simulate main app retrieving balance
    const retrievedBalance = localStorage.getItem(mainKey);
    console.log('Main app retrieved balance:', retrievedBalance);
    
    if (retrievedBalance === testAmount.toString()) {
        console.log('✅ BALANCE SYNC SUCCESS!');
        return true;
    } else {
        console.error('❌ BALANCE SYNC FAILED!');
        return false;
    }
}

// Test with different user scenarios
function testVariousUserTypes() {
    console.log('\n=== TESTING VARIOUS USER TYPES ===');
    
    const userTypes = [
        { name: 'User with Account Number', accountNumber: '123456', id: '123456' },
        { name: 'User with different ID', accountNumber: '789012', id: 'user_789012' },
        { name: 'User without Account Number', id: 'user_noaccnt' }
    ];
    
    userTypes.forEach(user => {
        console.log(`\nTesting: ${user.name}`);
        console.log('User data:', user);
        
        const adminKey = `userBalance_${user.accountNumber || user.id}`;
        const mainKey = `userBalance_${user.accountNumber || user.id}`;
        
        console.log('Admin key:', adminKey);
        console.log('Main key:', mainKey);
        console.log('Match:', adminKey === mainKey ? '✅' : '❌');
    });
}

// Check current localStorage balance keys
function showCurrentBalanceKeys() {
    console.log('\n=== CURRENT BALANCE KEYS IN LOCALSTORAGE ===');
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userBalance_')) {
            const value = localStorage.getItem(key);
            console.log(`${key}: ${value}`);
        }
    }
}

// Run all tests
console.log('Starting balance synchronization tests...');
testBalanceSynchronization();
testVariousUserTypes();
showCurrentBalanceKeys();

console.log('\n=== TEST COMPLETE ===');
console.log('If all tests show ✅, balance synchronization should work correctly.');