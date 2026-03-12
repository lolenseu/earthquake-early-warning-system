// Profile data
let currentUser = {
    username: 'admin',
    email: 'admin@eews.com',
    role: 'admin',
    recoveryKey: 'eews_admin',
    createdAt: '2024-01-01',
    lastReset: null
};

// Toggle password visibility in modal
function toggleModalPassword(inputId, iconId) {
    const passwordInput = document.getElementById(inputId);
    const passwordIcon = document.getElementById(iconId);
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        passwordIcon.textContent = 'visibility';
    } else {
        passwordInput.type = 'password';
        passwordIcon.textContent = 'visibility_off';
    }
}

// Check password strength
function checkPasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    return strength;
}

// Update password strength meter
function updateModalPasswordStrength(password) {
    const strengthFill = document.getElementById('modalStrengthFill');
    const strengthText = document.getElementById('modalStrengthText');
    
    if (!password) {
        strengthFill.className = 'strength-fill';
        strengthText.textContent = 'Enter new password';
        return;
    }
    
    const strength = checkPasswordStrength(password);
    
    strengthFill.className = 'strength-fill';
    
    if (strength <= 1) {
        strengthFill.classList.add('weak');
        strengthText.textContent = 'Weak password';
    } else if (strength <= 2) {
        strengthFill.classList.add('medium');
        strengthText.textContent = 'Medium password';
    } else {
        strengthFill.classList.add('strong');
        strengthText.textContent = 'Strong password';
    }
}

// Check if passwords match
function checkPasswordMatch() {
    const newPass = document.getElementById('modalNewPassword').value;
    const confirmPass = document.getElementById('modalConfirmPassword').value;
    const indicator = document.getElementById('passwordMatchIndicator');
    const matchIcon = document.getElementById('matchIcon');
    const matchText = document.getElementById('matchText');
    const updateBtn = document.getElementById('updatePasswordBtn');
    
    if (!newPass && !confirmPass) {
        indicator.className = 'password-match-indicator';
        matchIcon.textContent = 'info';
        matchText.textContent = 'Enter new password';
        updateBtn.disabled = false;
        return;
    }
    
    if (newPass === confirmPass) {
        indicator.className = 'password-match-indicator match';
        matchIcon.textContent = 'check_circle';
        matchText.textContent = 'Passwords match';
        updateBtn.disabled = false;
    } else {
        indicator.className = 'password-match-indicator no-match';
        matchIcon.textContent = 'error';
        matchText.textContent = 'Passwords do not match';
        updateBtn.disabled = true;
    }
}

// Show custom confirmation dialog
function showConfirmation(message, type = 'warning') {
    return new Promise((resolve) => {
        // Create confirmation overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirmation-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            z-index: 3000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease;
        `;

        // Create confirmation dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirmation-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 20px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            animation: slideUp 0.3s ease;
        `;

        // Set icon and colors based on type
        let icon = 'warning';
        let color = '#fbbf24';
        let title = 'Confirm Action';
        
        if (type === 'danger') {
            icon = 'error';
            color = '#e53e3e';
            title = 'Warning!';
        } else if (type === 'info') {
            icon = 'info';
            color = '#667eea';
            title = 'Information';
        }

        dialog.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <span class="material-icons" style="font-size: 48px; color: ${color};">${icon}</span>
                <h3 style="color: #2d3748; margin: 10px 0 5px; font-size: 20px;">${title}</h3>
                <p style="color: #718096; font-size: 16px;">${message}</p>
            </div>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button class="confirm-btn cancel" style="
                    padding: 12px 24px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #718096;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    flex: 1;
                ">Cancel</button>
                <button class="confirm-btn ok" style="
                    padding: 12px 24px;
                    border: none;
                    background: ${color};
                    color: white;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    flex: 1;
                ">Yes, Proceed</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            .confirm-btn:hover {
                transform: translateY(-2px);
            }
            .confirm-btn.cancel:hover {
                background: #edf2f7;
            }
            .confirm-btn.ok:hover {
                filter: brightness(110%);
                box-shadow: 0 4px 12px ${color}40;
            }
        `;
        document.head.appendChild(style);

        // Handle button clicks
        const cancelBtn = dialog.querySelector('.cancel');
        const okBtn = dialog.querySelector('.ok');

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });

        okBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        });
    });
}

// Format date nicely
function formatDate(dateString) {
    if (!dateString) return 'Never';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        // Format: Jan 15, 2024, 14:30:25
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// Open profile modal
function openProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Load user data from token or localStorage
    loadUserProfile();
    
    // Reset password fields
    document.getElementById('modalNewPassword').value = '';
    document.getElementById('modalConfirmPassword').value = '';
    updateModalPasswordStrength('');
    checkPasswordMatch();
}

// Close profile modal
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Fetch user data from server
async function fetchUserDataFromServer() {
    const token = localStorage.getItem('eews_auth_token');
    if (!token) {
        console.log('No token found');
        return null;
    }
    
    try {
        const response = await fetch("https://lolenseu.pythonanywhere.com/pipeline/eews/user_profile", {
            method: "GET",
            headers: { 
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('User data fetched:', data.user);
            return data.user;
        } else {
            console.log('Failed to fetch user data:', data.message);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    }
    return null;
}

// Load user profile data
async function loadUserProfile() {
    console.log('Loading user profile...');
    
    // First try to get data from server
    const serverData = await fetchUserDataFromServer();
    
    if (serverData) {
        console.log('Using server data:', serverData);
        currentUser.username = serverData.username || currentUser.username;
        currentUser.email = serverData.email || currentUser.email;
        currentUser.role = serverData.role || currentUser.role;
        currentUser.recoveryKey = serverData.recovery_key || `eews_${currentUser.role}`;
        currentUser.createdAt = serverData.created_at || currentUser.createdAt;
        currentUser.lastReset = serverData.last_password_reset || null;
    } else {
        console.log('No server data, using token or defaults');
        // Fallback to token decoding
        const token = localStorage.getItem('eews_auth_token');
        if (token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(window.atob(base64));
                
                currentUser.username = payload.username || 'admin';
                currentUser.role = payload.role || 'admin';
                currentUser.recoveryKey = `eews_${currentUser.role}`;
                
                // Try to get from localStorage as fallback
                const savedUser = localStorage.getItem('eews_user_data');
                if (savedUser) {
                    try {
                        const userData = JSON.parse(savedUser);
                        currentUser.email = userData.email || currentUser.email;
                        currentUser.createdAt = userData.created_at || currentUser.createdAt;
                        currentUser.lastReset = userData.last_password_reset || null;
                    } catch (e) {}
                }
            } catch (e) {
                console.log('Error decoding token:', e);
            }
        }
    }
    
    // Format dates for display
    const createdDisplay = formatDate(currentUser.createdAt);
    const lastResetDisplay = formatDate(currentUser.lastReset);
    
    console.log('Updating display with:', {
        username: currentUser.username,
        email: currentUser.email,
        role: currentUser.role,
        created: createdDisplay,
        lastReset: lastResetDisplay
    });
    
    // Update profile display
    document.getElementById('profileUsername').textContent = currentUser.username;
    document.getElementById('profileEmail').textContent = currentUser.email;
    document.getElementById('profileRole').textContent = currentUser.role;
    document.getElementById('profileRoleBadge').textContent = 
        currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    document.getElementById('profileCreatedAt').textContent = createdDisplay;
    document.getElementById('profileLastReset').textContent = lastResetDisplay;
    document.getElementById('recoveryKeyInput').value = currentUser.recoveryKey;
    
    // Update sidebar
    document.getElementById('userName').textContent = 
        currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1);
    document.getElementById('userRole').textContent = 
        currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
    
    // Save to localStorage as backup
    try {
        localStorage.setItem('eews_user_data', JSON.stringify({
            email: currentUser.email,
            created_at: currentUser.createdAt,
            last_password_reset: currentUser.lastReset
        }));
    } catch (e) {}
}

// Save recovery key with confirmation
async function saveRecoveryKey() {
    const newRecoveryKey = document.getElementById('recoveryKeyInput').value.trim();
    const saveBtn = document.getElementById('saveKeyBtn');
    
    if (!newRecoveryKey) {
        showNotification('Please enter a recovery key', 'error');
        return;
    }
    
    // Show confirmation dialog
    const confirmed = await showConfirmation(
        `Are you sure you want to change your recovery key to "${newRecoveryKey}"?`,
        'warning'
    );
    
    if (!confirmed) {
        showNotification('Action cancelled', 'info');
        return;
    }
    
    // Validate format (optional)
    if (!newRecoveryKey.startsWith('eews_')) {
        const proceed = await showConfirmation(
            'Recovery key should start with "eews_". Do you want to continue anyway?',
            'warning'
        );
        if (!proceed) {
            showNotification('Action cancelled', 'info');
            return;
        }
    }
    
    // Disable button and show loading
    saveBtn.disabled = true;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="material-icons rotating">refresh</span> Saving...';
    
    try {
        const token = localStorage.getItem('eews_auth_token');
        const response = await fetch("https://lolenseu.pythonanywhere.com/pipeline/eews/update_recovery_key", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
                username: currentUser.username,
                recovery_key: newRecoveryKey
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showNotification('Recovery key updated successfully!', 'success');
            currentUser.recoveryKey = newRecoveryKey;
        } else {
            showNotification(data.message || 'Failed to save recovery key', 'error');
        }
    } catch (error) {
        console.error('Error saving key:', error);
        showNotification('Network error saving key', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// Update password with confirmation
async function updatePassword() {
    const newPassword = document.getElementById('modalNewPassword').value;
    const confirmPassword = document.getElementById('modalConfirmPassword').value;
    const updateBtn = document.getElementById('updatePasswordBtn');
    
    // Validation
    if (!newPassword || !confirmPassword) {
        showNotification('Please enter and confirm new password', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    // Show confirmation dialog
    const confirmed = await showConfirmation(
        'Are you sure you want to change your password? You will need to use the new password for future logins.',
        'danger'
    );
    
    if (!confirmed) {
        showNotification('Password change cancelled', 'info');
        return;
    }
    
    // Disable button and show loading
    updateBtn.disabled = true;
    const originalText = updateBtn.innerHTML;
    updateBtn.innerHTML = '<span class="material-icons rotating">refresh</span> Updating...';
    
    try {
        // Call API to update password
        const token = localStorage.getItem('eews_auth_token');
        const response = await fetch("https://lolenseu.pythonanywhere.com/pipeline/eews/change_password", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
                username: currentUser.username,
                new_password: newPassword
            })
        });

        const data = await response.json();
        
        if (data.success) {
            showNotification('Password updated successfully!', 'success');
            
            // Update last reset date by fetching fresh data
            await loadUserProfile();
            
            // Clear password fields
            document.getElementById('modalNewPassword').value = '';
            document.getElementById('modalConfirmPassword').value = '';
            updateModalPasswordStrength('');
            checkPasswordMatch();
        } else {
            showNotification(data.message || 'Failed to update password', 'error');
        }
    } catch (error) {
        console.error('Error updating password:', error);
        showNotification('Network error updating password', 'error');
    } finally {
        updateBtn.disabled = false;
        updateBtn.innerHTML = originalText;
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy', 'error');
    });
}

// Show notification
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="material-icons">${type === 'success' ? 'check_circle' : type === 'warning' ? 'warning' : type === 'info' ? 'info' : 'error'}</span>
        <span>${message}</span>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#48bb78' : type === 'warning' ? '#fbbf24' : type === 'info' ? '#667eea' : '#e53e3e'};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Profile button click
    const profileBtn = document.getElementById('userProfileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', openProfileModal);
    }
    
    // Close modal buttons
    const closeBtn = document.getElementById('closeProfileModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeProfileModal);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('profileModal');
        if (event.target === modal) {
            closeProfileModal();
        }
    });
    
    // Password strength and match checking
    const newPassword = document.getElementById('modalNewPassword');
    const confirmPassword = document.getElementById('modalConfirmPassword');
    
    if (newPassword) {
        newPassword.addEventListener('input', (e) => {
            updateModalPasswordStrength(e.target.value);
            checkPasswordMatch();
        });
    }
    
    if (confirmPassword) {
        confirmPassword.addEventListener('input', checkPasswordMatch);
    }
    
    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes rotating {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .rotating {
            animation: rotating 1s linear infinite;
        }
    `;
    document.head.appendChild(style);
});