// js/app.js - Clean App Router
document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');
  
  // Navigation handling
  async function navigate(route) {
    const viewName = route || 'dashboard';
    if (window.Views && typeof window.Views[viewName] === 'function') {
      try {
        await window.Views[viewName](content);
      } catch (err) {
        console.error('Error rendering view:', err);
        if (content) content.innerHTML = '<div class="empty">Error loading page content.</div>';
      }
    } else {
      if (content) content.innerHTML = '<div class="empty">Page not found.</div>';
    }
  }

  // Handle Hash Changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    navigate(hash);
  });

  // Initial Load
  const initialRoute = window.location.hash.replace('#', '') || 'dashboard';
  await navigate(initialRoute);
});
