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
function loadPage(page) {
    // Check authentication first
    if (!checkAuth()) {
        return;
    }
    
    // Show loading spinner
    showLoadingSpinner();
    
    fetch(page)
        .then(res => res.text())
        .then(html => {
            mainContainer.innerHTML = html;
            // Hide loading spinner
            hideLoadingSpinner();
            
            // Save current page to localStorage
            localStorage.setItem('currentPage', page);
            
            // Initialize dashboard if dashboard page is loaded
            if (page.includes('dashboard.html')) {
                console.log('Dashboard page loaded, initializing...');
                // Wait for DOM to be ready and init dashboard
                setTimeout(() => {
                    if (typeof initDashboard === 'function') {
                        initDashboard();
                    } else {
                        console.error('initDashboard function not found');
                    }
                }, 200);
            }

            // Initialize map if map page is loaded
            if (page.includes('map.html')) {
                console.log('Map page loaded, initializing...');
                // Wait for DOM to be ready and init map
                setTimeout(() => {
                    if (typeof initMap === 'function') {
                        initMap();
                    } else {
                        console.error('initMap function not found');
                    }
                }, 200);
            }

            // Initialize devices if devices page is loaded
            if (page.includes('devices.html')) {
                console.log('Devices page loaded, initializing...');
                // Wait for DOM to be ready and init devices
                setTimeout(() => {
                    if (typeof initDevices === 'function') {
                        initDevices();
                    } else {
                        console.error('initDevices function not found');
                    }
                }, 200);
            }
        })
        .catch(err => {
            mainContainer.innerHTML = `<p style="color:red;">Failed to load ${page}</p>`;
            // Hide loading spinner
            hideLoadingSpinner();
        });
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
