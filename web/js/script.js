const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mainContainer = document.getElementById("mainContainer");
const navItems = document.querySelectorAll(".nav-item");

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

// Logout function
function logoutUser() {
    // Clear authentication data
    localStorage.removeItem('eews_auth_token');
    localStorage.removeItem('eews_remember');
    
    // Redirect to login page
    window.location.href = 'login.html';
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
