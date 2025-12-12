const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mainContainer = document.getElementById("mainContainer");
const navItems = document.querySelectorAll(".nav-item");
const logoutBtn = document.getElementById("logoutBtn");

// Toggle sidebar
sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
});

// Load content dynamically
function loadPage(page) {
    mainContainer.style.opacity = 0;
    fetch(page)
        .then(res => res.text())
        .then(html => {
            mainContainer.innerHTML = html;
            mainContainer.style.opacity = 1;
        })
        .catch(err => {
            mainContainer.innerHTML = `<p style="color:red;">Failed to load ${page}</p>`;
            mainContainer.style.opacity = 1;
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

// Logout handler
logoutBtn.addEventListener("click", () => {
    // Clear any stored authentication
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirect to login or home page
    window.location.href = "/";
});

// Load default page
loadPage("pages/dashboard.html");
