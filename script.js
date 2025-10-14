async function loadPage(page) {
  const content = document.getElementById("content");
  try {
    const res = await fetch(`pages/${page}.html`);
    const html = await res.text();
    content.innerHTML = html;
    updateActiveLink(page);
  } catch (err) {
    content.innerHTML = "<p>Sorry, this page could not be loaded.</p>";
  }
}

function updateActiveLink(page) {
  document.querySelectorAll("nav a").forEach(link => {
    link.classList.toggle("active", link.getAttribute("href") === `#${page}`);
  });
}

window.addEventListener("hashchange", () => {
  const page = location.hash.replace("#", "") || "home";
  loadPage(page);
});

window.addEventListener("DOMContentLoaded", () => {
  const initialPage = location.hash.replace("#", "") || "home";
  loadPage(initialPage);
});
