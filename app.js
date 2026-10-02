document.addEventListener("DOMContentLoaded", () => {
  fetchWorkouts();

  const form = document.getElementById("workoutForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("wName").value;
      const duration = document.getElementById("wDuration").value;
      const calories = document.getElementById("wCalories").value;

      await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, duration, calories })
      });

      form.reset();
      fetchWorkouts();
    });
  }
});

async function fetchWorkouts() {
  try {
    const res = await fetch("/api/workouts");
    const data = await res.json();
    const list = document.getElementById("workoutList");
    
    if (list) {
      list.innerHTML = data.map(w => `
        <div class="item-row">
          <div class="item-details">
            <span class="item-name">${w.name}</span>
            <span class="item-sub">${w.duration} mins</span>
          </div>
          <div class="item-meta">
            <span class="meta-val">+${w.calories} kcal</span>
          </div>
        </div>
      `).join("");
    }
  } catch (err) {
    console.error("Error fetching workouts:", err);
  }
}
