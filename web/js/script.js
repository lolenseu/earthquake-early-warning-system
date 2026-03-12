const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mainContainer = document.getElementById("mainContainer");
const navItems = document.querySelectorAll(".nav-item");

// Make runningIntervals globally available
window.runningIntervals = [];

// Clear all running intervals from the previous page
function clearAllIntervals() {
    console.log('Clearing', window.runningIntervals.length, 'intervals');
    window.runningIntervals.forEach(id => clearInterval(id));
    window.runningIntervals.length = 0;
}

// Add interval tracking wrapper - use this instead of setInterval
function createInterval(callback, delay) {
    const intervalId = setInterval(callback, delay);
    window.runningIntervals.push(intervalId);
    return intervalId;
}

// Check if user is authenticated
function checkAuth() {
    const token = localStorage.getItem('eews_auth_token');
    const remember = localStorage.getItem('eews_remember');
    
    // If no token at all, redirect to login
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

// Show logout confirmation dialog
function showLogoutConfirmation() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(5px);
            z-index: 11000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 24px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
            animation: logoutFadeIn 0.3s ease;
        `;

        dialog.innerHTML = `
            <div style="text-align: center; margin-bottom: 20px;">
                <span class="material-icons" style="font-size: 64px; color: #e53e3e; background: #fff5f5; padding: 20px; border-radius: 50%; box-shadow: 0 10px 20px rgba(229, 62, 62, 0.2);">logout</span>
                <h3 style="color: #2d3748; margin: 20px 0 10px; font-size: 24px; font-weight: 600;">Confirm Logout</h3>
                <p style="color: #718096; font-size: 16px; margin: 0; line-height: 1.6;">Are you sure you want to log out?</p>
            </div>
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                <button id="logoutCancelBtn" style="
                    padding: 12px 24px;
                    border: 2px solid #e2e8f0;
                    background: white;
                    color: #718096;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    flex: 1;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                " onmouseover="this.style.background='#f7fafc'; this.style.borderColor='#cbd5e0'" onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0'">
                    <span class="material-icons" style="font-size: 18px;">cancel</span>
                    Cancel
                </button>
                <button id="logoutConfirmBtn" style="
                    padding: 12px 24px;
                    border: none;
                    background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
                    color: white;
                    border-radius: 12px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    flex: 1;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(229, 62, 62, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(229, 62, 62, 0.3)'">
                    <span class="material-icons" style="font-size: 18px;">logout</span>
                    Yes, Logout
                </button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Add animation style if not exists
        if (!document.getElementById('logoutAnimationStyle')) {
            const style = document.createElement('style');
            style.id = 'logoutAnimationStyle';
            style.textContent = `
                @keyframes logoutFadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        // Handle cancel
        document.getElementById('logoutCancelBtn').onclick = () => {
            document.body.removeChild(overlay);
            resolve(false);
        };

        // Handle confirm
        document.getElementById('logoutConfirmBtn').onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
        };

        // Handle click outside
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                resolve(false);
            }
        };

        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', handleEscape);
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

// Updated logout function with confirmation
async function logoutUser() {
    // Show confirmation dialog
    const confirmed = await showLogoutConfirmation();
    
    if (confirmed) {
        // Show loading state on logout button if needed
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            const originalHtml = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<span class="material-icons rotating">logout</span><span>Logging out...</span>';
            logoutBtn.style.opacity = '0.7';
            logoutBtn.style.pointerEvents = 'none';
        }

        // Clear authentication data
        localStorage.removeItem('eews_auth_token');
        localStorage.removeItem('eews_remember');
        localStorage.removeItem('currentPage');
        
        // Clear all intervals
        clearAllIntervals();
        
        // Small delay to show loading state
        setTimeout(() => {
            // Redirect to login page
            window.location.href = 'login.html';
        }, 500);
    }
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
        console.log('initDashboard exists:', typeof window.initDashboard);
        console.log('initDevices exists:', typeof initDevices);
        console.log('initAPIMonitor exists:', typeof initAPIMonitor);

        // Initialize page-specific scripts
        if (page.includes('dashboard.html') && typeof window.initDashboard === 'function') {
            console.log('Calling initDashboard...');
            await window.initDashboard();
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

// Logout button event listener
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Remove any existing listeners and add the new one
        logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
    }
});

// Settings button event listener (now li element)
const settingsBtn = document.getElementById('settingsBtn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        alert('Settings feature coming soon!');
        // Future implementation: navigate to settings page or open modal
    });
}