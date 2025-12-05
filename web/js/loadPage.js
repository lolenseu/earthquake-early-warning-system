function loadPage(page) {
    fetch(page + '?v=' + Date.now())
        .then(r => r.text())
        .then(html => {
        document.getElementById("main-content").innerHTML = html;
    });
}