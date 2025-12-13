const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mainContainer = document.getElementById("mainContainer");
const navItems = document.querySelectorAll(".nav-item");

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

// Load the saved page or default page
loadPageWithActiveState(savedPage || defaultPage);

// Check mobile on load and resize
checkMobile();
window.addEventListener('resize', checkMobile);
