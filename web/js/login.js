// Password toggle functionality
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const passwordIcon = document.getElementById('password-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        passwordIcon.textContent = 'visibility';
    } else {
        passwordInput.type = 'password';
        passwordIcon.textContent = 'visibility_off';
    }
}

// Auto-hide message after 5 seconds
function autoHideMessage() {
    setTimeout(() => {
        const msg = document.getElementById('msg');
        if (msg.classList.contains('success') || msg.classList.contains('error')) {
            msg.style.display = 'none';
            msg.className = 'message';
        }
    }, 5000);
}

// Show message function with aria-live for accessibility
function showMessage(message, type) {
    const msg = document.getElementById("msg");
    msg.textContent = message;
    msg.className = `message ${type}`;
    msg.style.display = 'block';
    msg.setAttribute('aria-live', 'polite');
    autoHideMessage();
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

// Reset login button to default state
function resetLoginButton(button, originalText) {
    button.disabled = false;
    button.innerHTML = originalText;
    button.style.borderColor = '';
    button.style.backgroundColor = '';
    button.style.color = '';
    button.style.animation = '';
}

// Enhanced login function
async function login(event) {
    event.preventDefault(); // Prevent form submission
    
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember").checked;
    
    const loginBtn = document.getElementById("loginBtn");
    const originalText = loginBtn.innerHTML;
    
    // Validation
    if (!username || !password) {
        showMessage('Please enter both username and password.', 'error');
        return;
    }
    
    // Create ripple effect
    createRipple({ currentTarget: loginBtn });
    
    // Disable button and show loading state
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
            showMessage('Login successful! Redirecting...', 'success');
            
            // Save username and remember flag
            if (remember) {
                localStorage.setItem('eews_remember', 'true');
                localStorage.setItem('eews_username', username);
            } else {
                localStorage.setItem('eews_remember', 'false');
                localStorage.removeItem('eews_username');
            }
            
            // Save auth token
            if (data.token) {
                localStorage.setItem('eews_auth_token', data.token);
            }
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = "layout.html";
            }, 1500);
        } else {
            showMessage(data.message || 'Invalid credentials. Please try again.', 'error');
            
            // Clear password for security
            document.getElementById("password").value = '';
            
            // Add shake animation and style for error
            loginBtn.style.animation = 'shake 0.5s ease-in-out';
            loginBtn.style.borderColor = '#e53e3e';
            loginBtn.style.backgroundColor = '#ffebee';
            loginBtn.style.color = '#e53e3e';
            
            // Reset button after animation
            setTimeout(() => resetLoginButton(loginBtn, originalText), 2000);
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please check your connection and try again.', 'error');
        resetLoginButton(loginBtn, originalText);
    }
}

// Auto-fill username if remembered
window.addEventListener('load', () => {
    const remembered = localStorage.getItem('eews_remember');
    if (remembered === 'true') {
        const savedUsername = localStorage.getItem('eews_username');
        if (savedUsername) {
            document.getElementById('username').value = savedUsername;
            document.getElementById('remember').checked = true;
        }
    }
});

// Add ripple effect on login button click
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', login);
    }
});
