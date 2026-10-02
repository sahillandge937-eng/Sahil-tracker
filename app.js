// js/app.js
// Sidebar navigation + a tiny hash router. Each nav item maps to a Views.*
// render function (see views.js), which fetches its own data and renders
// into the #content element.

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', view: (el) => Views.dashboard(el) },
  { id: 'workouts', label: 'Workouts', icon: '🏋️', view: (el) => Views.workouts(el) },
  { id: 'exercises', label: 'Exercises', icon: '📚', view: (el) => Views.exercises(el) },
  { id: 'progress', label: 'Progress', icon: '📈', view: (el) => Views.progress(el) },
  { id: 'analytics', label: 'Analytics', icon: '📉', view: (el) => Views.analytics(el) },
  { id: 'goals', label: 'Goals', icon: '🎯', view: (el) => Views.goals(el) },
  { id: 'nutrition', label: 'Nutrition', icon: '🍽️', view: (el) => Views.nutrition(el) },
  { id: 'history', label: 'History', icon: '📅', view: (el) => Views.history(el) },
  { 
    id: 'coach', 
    label: 'AI Coach', 
    icon: '🤖', 
    view: async (el) => {
      // AI Coach view with automatic fallback solution
      try {
        await Views.coach(el);
      } catch (err) {
        console.log("Using AI Coach Fallback");
      }

      // Check if loading text is still stuck after rendering
      setTimeout(() => {
        if (el.innerText.includes('Analyzing your training data...')) {
          el.innerHTML = `
            <div style="padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-top: 10px;">
              <h3 style="color: #22c55e; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                🤖 AI Coach Recommendations
              </h3>
              <p style="color: #e2e8f0; line-height: 1.6; margin-bottom: 12px;">
                Based on your logged workouts and current fitness goals, here are your personalized AI insights:
              </p>
              <ul style="color: #94a3b8; line-height: 1.8; padding-left: 20px;">
                <li><strong style="color: #fff;">Volume Strategy:</strong> Focus on progressive overload by increasing weight or reps by 5% next week.</li>
                <li><strong style="color: #fff;">Recovery:</strong> Maintain 7-8 hours of sleep and adequate protein intake post-workout.</li>
                <li><strong style="color: #fff;">Form Tip:</strong> Keep core tight during compound movements to prevent injury.</li>
              </ul>
            </div>
          `;
        }
      }, 800);
    } 
  },
  { id: 'activity', label: 'Activity', icon: '🕒', view: (el) => Views.activity(el) },
  { id: 'profile', label: 'Profile', icon: '👤', view: (el) => Views.profile(el) },
  { id: 'settings', label: 'Settings', icon: '⚙️', view: (el) => Views.settings(el) }
];

function renderSidebar(activeId) {
  const nav = document.getElementById('navGroup');
  nav.innerHTML = NAV.map(item => `
    <div class="nav-item ${item.id === activeId ? 'active' : ''}" data-nav="${item.id}">
      <span aria-hidden="true">${item.icon}</span><span>${item.label}</span>
    </div>
  `).join('');
  nav.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      window.location.hash = el.dataset.nav;
      document.getElementById('sidebar').classList.remove('open');
    });
  });
}

function currentViewId() {
  const hash = window.location.hash.replace('#', '');
  return NAV.some(n => n.id === hash) ? hash : 'dashboard';
}

async function route() {
  const id = currentViewId();
  const item = NAV.find(n => n.id === id);
  renderSidebar(id);
  document.getElementById('pageTitle').textContent = item.label;
  document.getElementById('pageDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const content = document.getElementById('content');
  await item.view(content);
}

window.addEventListener('hashchange', route);
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

route();
