// Password toggle functionality with specific IDs
function togglePassword(inputId, iconId) {
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

// Auto-hide message after 5 seconds
function autoHideMessage(elementId) {
    setTimeout(() => {
        const msg = document.getElementById(elementId);
        if (msg && (msg.classList.contains('success') || msg.classList.contains('error'))) {
            msg.style.display = 'none';
            msg.className = 'message';
        }
    }, 5000);
}

// Show message function
function showMessage(elementId, message, type) {
    const msg = document.getElementById(elementId);
    if (msg) {
        msg.textContent = message;
        msg.className = `message ${type}`;
        msg.style.display = 'block';
        msg.setAttribute('aria-live', 'polite');
        autoHideMessage(elementId);
    }
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    return strength;
}

// Update password strength meter
function updatePasswordStrength(password) {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!password) {
        strengthFill.className = 'strength-fill';
        strengthText.textContent = 'Enter password';
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

// Modal functions
function openForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Reset form
    document.getElementById('resetPasswordForm').reset();
    document.getElementById('resetMsg').style.display = 'none';
    updatePasswordStrength('');
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// Reset password function
async function resetPassword(event) {
    event.preventDefault();
    
    const resetKey = document.getElementById('resetKey').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const resetBtn = document.getElementById('resetBtn');
    
    // Validation
    if (!resetKey) {
        showMessage('resetMsg', 'Please enter the recovery key', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('resetMsg', 'Password must be at least 6 characters long', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('resetMsg', 'Passwords do not match', 'error');
        return;
    }
    
    // Disable button and show loading
    resetBtn.disabled = true;
    resetBtn.innerHTML = `
        <span class="material-icons rotating">refresh</span>
        Resetting...
    `;
    
    try {
        // Call the API to reset password
        const response = await fetch("https://lolenseu.pythonanywhere.com/pipeline/eews/reset_password", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                key: resetKey,
                new_password: newPassword
            })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('resetMsg', 'Password reset successful! You can now login with your new password.', 'success');
            
            // Reset form and close modal after 2 seconds
            setTimeout(() => {
                closeForgotPasswordModal();
                // Clear password field in login form
                document.getElementById('password').value = '';
                // Show success message in login form
                showMessage('msg', 'Password reset successful! Please login with your new password.', 'success');
            }, 2000);
        } else {
            showMessage('resetMsg', data.message || 'Invalid recovery key', 'error');
            resetBtn.disabled = false;
            resetBtn.innerHTML = `
                <span class="material-icons">refresh</span>
                Reset Password
            `;
        }
    } catch (error) {
        console.error('Reset error:', error);
        showMessage('resetMsg', 'Network error. Please try again.', 'error');
        resetBtn.disabled = false;
        resetBtn.innerHTML = `
            <span class="material-icons">refresh</span>
            Reset Password
        `;
    }
}

// Enhanced login function
async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember").checked;
    
    const loginBtn = document.getElementById("loginBtn");
    const originalText = loginBtn.innerHTML;
    
    // Validation
    if (!username || !password) {
        showMessage('msg', 'Please enter both username and password.', 'error');
        return;
    }
    
    // Create ripple effect
    createRipple({ currentTarget: loginBtn });
    
    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.innerHTML = `
        Logging in...
    `;
    
    try {
        const res = await fetch("https://lolenseu.pythonanywhere.com/pipeline/eews/login", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ 
                username, 
                password,
                remember
            })
        });

        const data = await res.json();

        if (data.success) {
            showMessage('msg', 'Login successful! Redirecting...', 'success');
            
            if (remember) {
                localStorage.setItem('eews_remember', 'true');
                localStorage.setItem('eews_username', username);
            } else {
                localStorage.setItem('eews_remember', 'false');
                localStorage.removeItem('eews_username');
            }
            
            if (data.token) {
                localStorage.setItem('eews_auth_token', data.token);
            }
            
            setTimeout(() => {
                window.location.href = "layout.html";
            }, 1500);
        } else {
            showMessage('msg', data.message || 'Invalid credentials. Please try again.', 'error');
            document.getElementById("password").value = '';
            
            loginBtn.style.animation = 'shake 0.5s ease-in-out';
            loginBtn.style.borderColor = '#e53e3e';
            loginBtn.style.backgroundColor = '#ffebee';
            loginBtn.style.color = '#e53e3e';
            
            setTimeout(() => resetLoginButton(loginBtn, originalText), 2000);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('msg', 'Network error. Please check your connection and try again.', 'error');
        resetLoginButton(loginBtn, originalText);
    }
}

// Create ripple effect
function createRipple(event) {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const ripple = document.createElement('span');
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(255, 255, 255, 0.6)';
    ripple.style.transform = 'scale(0)';
    ripple.style.animation = 'ripple-animation 0.6s linear';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    ripple.style.pointerEvents = 'none';
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// Reset login button
function resetLoginButton(button, originalText) {
    button.disabled = false;
    button.innerHTML = originalText;
    button.style.borderColor = '';
    button.style.backgroundColor = '';
    button.style.color = '';
    button.style.animation = '';
}

// Add CSS animation for rotating icon
const style = document.createElement('style');
style.textContent = `
    @keyframes rotating {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .rotating {
        animation: rotating 1s linear infinite;
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', login);
    }
    
    // Forgot password button
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', openForgotPasswordModal);
    }
    
    // Close modal buttons
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelResetBtn');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeForgotPasswordModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeForgotPasswordModal);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('forgotPasswordModal');
        if (event.target === modal) {
            closeForgotPasswordModal();
        }
    });
    
    // Password strength checker
    const newPassword = document.getElementById('newPassword');
    if (newPassword) {
        newPassword.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value);
        });
    }
    
    // Auto-fill username if remembered
    const remembered = localStorage.getItem('eews_remember');
    if (remembered === 'true') {
        const savedUsername = localStorage.getItem('eews_username');
        if (savedUsername) {
            document.getElementById('username').value = savedUsername;
            document.getElementById('remember').checked = true;
        }
    }
});