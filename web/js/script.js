const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mainContainer = document.getElementById("mainContainer");
const navItems = document.querySelectorAll(".nav-item");

// Track running intervals to clear them when changing pages
const runningIntervals = [];

// Clear all running intervals from the previous page
function clearAllIntervals() {
    console.log('Clearing', runningIntervals.length, 'intervals');
    runningIntervals.forEach(id => clearInterval(id));
    runningIntervals.length = 0;
}

// Add interval tracking wrapper - use this instead of setInterval
function createInterval(callback, delay) {
    const intervalId = setInterval(callback, delay);
    runningIntervals.push(intervalId);
    return intervalId;
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
                ">Yes, Logout</button>
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

// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('eews_auth_token');
    const remember = localStorage.getItem('eews_remember');
    
    // If no token at all, redirect to login
    // (remember is NOT a security mechanism)
    if (!token) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
        return false;
    }
    
    return true;
}

// Verify token with server
async function verifyToken() {
    const token = localStorage.getItem('eews_auth_token');
    if (!token) return false;
    
    try {
        const res = await fetch("https://lolenseu.pythonanywhere.com/pipeline/eews/verify", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        
        return res.ok;
    } catch (error) {
        return false;
    }
}

// Redirect to login
function redirectToLogin() {
    localStorage.removeItem('eews_auth_token');
    localStorage.removeItem('eews_remember');
    if (!window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
}

// Logout function with confirmation
async function logoutUser() {
    // Show confirmation dialog
    const confirmed = await showConfirmation(
        'Are you sure you want to logout? You will need to login again to access the system.',
        'danger'
    );
    
    if (!confirmed) {
        return; // User cancelled logout
    }
    
    // Clear authentication data
    localStorage.removeItem('eews_auth_token');
    localStorage.removeItem('eews_remember');
    localStorage.removeItem('eews_user_data');
    localStorage.removeItem('eews_key_history');
    
    // Show logout notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #48bb78;
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 3001;
        animation: slideIn 0.3s ease;
    `;
    notification.innerHTML = `
        <span class="material-icons">check_circle</span>
        <span>Logged out successfully!</span>
    `;
    document.body.appendChild(notification);
    
    // Redirect after a short delay
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}

// Reload the page
function refreshPage() {
    location.reload();
}

// Check if mobile and handle sidebar state
function checkMobile() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // On mobile, start with collapsed sidebar (icons hidden)
        sidebar.classList.add("collapsed");
    } else {
        // On desktop, ensure sidebar is expanded
        sidebar.classList.remove("collapsed");
    }
}

// Toggle sidebar
sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
});

// Show loading spinner in main container
function showLoadingSpinner() {
    mainContainer.style.position = 'relative';
    mainContainer.style.minHeight = '200px';
    
    // Create spinner element
    const spinner = document.createElement('div');
    spinner.id = 'loadingSpinner';
    spinner.style.position = 'absolute';
    spinner.style.top = '50%';
    spinner.style.left = '50%';
    spinner.style.transform = 'translate(-50%, -50%)';
    spinner.style.zIndex = '1000';
    spinner.style.display = 'flex';
    spinner.style.flexDirection = 'column';
    spinner.style.alignItems = 'center';
    spinner.style.gap = '15px';
    
    // Spinner HTML
    spinner.innerHTML = `
        <div style="
            width: 80px;
            height: 80px;
            border: 10px solid rgba(255, 255, 255, 0.3);
            border-top: 10px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        "></div>
        <div style="
            color: #667eea;
            font-weight: 500;
            font-size: 18px;
        ">Loading...</div>
    `;
    
    // Add keyframe animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    mainContainer.appendChild(spinner);
}

// Hide loading spinner
function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.remove();
    }
}

// Load content dynamically
async function loadPage(page) {
    // Check authentication first
    if (!checkAuth()) return;

    // Clear all intervals from previous page BEFORE loading new content
    clearAllIntervals();

    // Show loading spinner
    showLoadingSpinner();

    try {
        const res = await fetch(page);
        const html = await res.text();
        
        // Debug: Check if HTML was loaded
        console.log('Loaded HTML for', page, ':', html.substring(0, 200) + '...');
        
        mainContainer.innerHTML = html;

        // Save current page to localStorage
        localStorage.setItem('currentPage', page);

        // Wait for the next animation frame to ensure DOM is painted
        await new Promise(requestAnimationFrame);
        
        // Wait a bit more to ensure all elements are properly attached to DOM
        await new Promise(resolve => setTimeout(resolve, 100));

        // Debug: Check if containers exist
        console.log('Checking containers after load...');
        console.log('iotmapid exists:', !!document.getElementById('iotmapid'));
        console.log('reportmapid exists:', !!document.getElementById('reportmapid'));
        console.log('quakeList exists:', !!document.getElementById('quakeList'));
        console.log('lastUpdated exists:', !!document.getElementById('lastUpdated'));

        // Debug: Check if functions are available
        console.log('Function availability:');
        console.log('initIoTMap exists:', typeof initIoTMap);
        console.log('initReportMap exists:', typeof initReportMap);
        console.log('initDashboard exists:', typeof initDashboard);
        console.log('initDevices exists:', typeof initDevices);
        console.log('initAPIMonitor exists:', typeof initAPIMonitor);

        // Initialize page-specific scripts
        if (page.includes('dashboard.html') && typeof initDashboard === 'function') {
            console.log('Calling initDashboard...');
            await initDashboard(); // if initDashboard is async, otherwise just call it
        } else if (page.includes('map.html') && typeof initIoTMap === 'function') {
            console.log('Initializing IoT Map...');
            await initIoTMap();
        } else if (page.includes('devices.html') && typeof initDevices === 'function') {
            console.log('Calling initDevices...');
            await initDevices();
        } else if (page.includes('reports.html') && typeof initReportMap === 'function') {
            console.log('Initializing Report Map...');
            await initReportMap();
        } else if (page.includes('api.html') && typeof initAPIMonitor === 'function') {
            console.log('Initializing API Monitor...');
            await initAPIMonitor();
        }

    } catch (err) {
        mainContainer.innerHTML = `<p style="color:red;">Failed to load ${page}</p>`;
        console.error(err);
    } finally {
        // Always hide spinner after everything is loaded and initialized
        hideLoadingSpinner();
    }
}

// Nav click handler
navItems.forEach(item => {
    item.addEventListener("click", () => {
        // Check authentication before navigating
        if (!checkAuth()) {
            return;
        }
        
        navItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        loadPage(item.dataset.page);
    });
});

// Load page and set active state
function loadPageWithActiveState(page) {
    // Remove active class from all nav items
    navItems.forEach(i => i.classList.remove("active"));
    
    // Find and activate the matching nav item
    navItems.forEach(item => {
        if (item.dataset.page === page) {
            item.classList.add("active");
        }
    });
    
    // Load the page content
    loadPage(page);
}

// Initialize - check if there's a saved page, otherwise load default
const savedPage = localStorage.getItem('currentPage');
const defaultPage = "pages/dashboard.html";

// Authentication check on page load
if (window.location.pathname.includes('login.html')) {
    // If already logged in and trying to access login page, redirect to dashboard
    if (checkAuth()) {
        verifyToken().then(valid => {
            if (valid) {
                window.location.href = savedPage || defaultPage;
            }
        });
    }
} else {
    // Check authentication for protected pages
    if (!checkAuth()) {
        window.location.href = 'login.html';
    } else {
        // Verify token if exists
        const token = localStorage.getItem('eews_auth_token');
        if (token) {
            verifyToken().then(isValid => {
                if (!isValid) {
                    redirectToLogin();
                } else {
                    // Load the saved page or default page
                    loadPageWithActiveState(savedPage || defaultPage);
                }
            });
        } else {
            // Load the saved page or default page
            loadPageWithActiveState(savedPage || defaultPage);
        }
    }
}

// Check mobile on load and resize
checkMobile();
window.addEventListener('resize', checkMobile);

// Logout button event listener (now li element)
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutUser);
}

// Settings button event listener (now li element)
const settingsBtn = document.getElementById('settingsBtn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        alert('Settings feature coming soon!');
        // Future implementation: navigate to settings page or open modal
    });
}