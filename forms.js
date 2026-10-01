// js/forms.js
// Builds the modal forms used across views: log workout, add exercise,
// update weight, create/edit goal, log nutrition.

const Forms = {};

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const GOAL_TYPES = [
  {
    value: 'workouts_per_week',
    label: 'Workouts per week',
    unit: 'workouts'
  },
  {
    value: 'distance_per_week',
    label: 'Distance per week',
    unit: 'km'
  },
  {
    value: 'calories_per_week',
    label: 'Calories burned per week',
    unit: 'kcal'
  },
  {
    value: 'target_weight',
    label: 'Reach a target weight',
    unit: 'kg'
  },
  {
    value: 'streak',
    label: 'Maintain a day streak',
    unit: 'days'
  }
];

// ---------------- Workout ----------------
Forms.workout = async (onDone, existing) => {
  const exerciseLibrary = await Api.exercises.list().catch(() => []);

  const existingExercises = existing
    ? existing.exercises.map(e => ({
        exercise_id: e.exercise_id,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight_kg,
        rest: e.rest_seconds
      }))
    : [];

  const rowHtml = (row = {}, i) => `
    <div
      class="field-row"
      data-ex-row="${i}"
      style="grid-template-columns: 2fr 1fr 1fr 1fr auto; align-items:end; margin-bottom:8px"
    >
      <div class="field" style="margin-bottom:0">
        <label>Exercise</label>
        <select data-f="exercise_id">
          <option value="">—</option>
          ${exerciseLibrary.map(ex => `
            <option
              value="${ex.id}"
              ${row.exercise_id === ex.id ? 'selected' : ''}
            >
              ${escapeHtml(ex.name)}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="field" style="margin-bottom:0">
        <label>Sets</label>
        <input
          data-f="sets"
          type="number"
          value="${row.sets ?? ''}"
        >
      </div>

      <div class="field" style="margin-bottom:0">
        <label>Reps</label>
        <input
          data-f="reps"
          type="number"
          value="${row.reps ?? ''}"
        >
      </div>

      <div class="field" style="margin-bottom:0">
        <label>Weight (kg)</label>
        <input
          data-f="weight"
          type="number"
          step="0.5"
          value="${row.weight ?? ''}"
        >
      </div>

      <button
        type="button"
        class="icon-btn danger"
        data-remove-row
      >
        ✕
      </button>
    </div>
  `;

  const body = `
    <div class="field-row">

      <div class="field">
        <label>Type</label>

        <select id="fType">
          ${WORKOUT_TYPES.map(t => `
            <option
              ${existing && existing.type === t ? 'selected' : ''}
            >
              ${t}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="field">
        <label>Date</label>

        <input
          id="fDate"
          type="date"
          value="${new Date(
            existing ? existing.date : Date.now()
          ).toISOString().slice(0, 10)}"
        >
      </div>

    </div>

    <div class="field-row">

      <div class="field">
        <label>Duration (min)</label>

        <input
          id="fDuration"
          type="number"
          min="1"
          max="600"
          value="${existing ? existing.duration_min : 30}"
        >
      </div>

      <div class="field">
        <label>Distance (km, optional)</label>

        <input
          id="fDistance"
          type="number"
          step="0.1"
          value="${
            existing && existing.distance_km
              ? existing.distance_km
              : ''
          }"
        >
      </div>

    </div>

    <div class="field-row">

      <div class="field">
        <label>Effort (1-5)</label>

        <input
          id="fDifficulty"
          type="range"
          min="1"
          max="5"
          value="${existing ? existing.difficulty : 3}"
        >
      </div>

      <div class="field">
        <label>Calories (leave blank to auto-estimate)</label>

        <input
          id="fCalories"
          type="number"
          value="${existing ? existing.calories : ''}"
        >
      </div>

    </div>

    <div class="field">
      <label>Notes</label>

      <textarea id="fNotes">${escapeHtml(
        existing ? existing.notes : ''
      )}</textarea>
    </div>

    <label>Exercises</label>

    <div id="exRows">
      ${
        (existingExercises.length
          ? existingExercises
          : [{}]
        ).map(rowHtml).join('')
      }
    </div>

    <button
      type="button"
      class="btn btn-sm"
      id="addRow"
      style="margin-bottom:16px"
    >
      + Add exercise row
    </button>

    <button
      class="btn btn-primary"
      id="fSubmit"
      style="width:100%"
    >
      ${existing ? 'Save changes' : 'Log workout'}
    </button>
  `;

  Modal.open(
    existing ? 'Edit workout' : 'Log a workout',
    body,
    {
      onMount: (root) => {

        let rowCount =
          (
            existingExercises.length
              ? existingExercises
              : [{}]
          ).length;

        root
          .querySelector('#addRow')
          .addEventListener('click', () => {

            root
              .querySelector('#exRows')
              .insertAdjacentHTML(
                'beforeend',
                rowHtml({}, rowCount++)
              );

            bindRemove(root);
          });

        bindRemove(root);

        function bindRemove(scope) {

          scope
            .querySelectorAll('[data-remove-row]')
            .forEach(btn => {

              btn.onclick = () => {
                btn
                  .closest('[data-ex-row]')
                  .remove();
              };

            });
        }

        root
          .querySelector('#fSubmit')
          .addEventListener('click', async () => {

            const exercises = [
              ...root.querySelectorAll('[data-ex-row]')
            ]
              .map(row => ({
                exercise_id:
                  Number(
                    row.querySelector(
                      '[data-f="exercise_id"]'
                    ).value
                  ) || null,

                sets:
                  Number(
                    row.querySelector(
                      '[data-f="sets"]'
                    ).value
                  ) || null,

                reps:
                  Number(
                    row.querySelector(
                      '[data-f="reps"]'
                    ).value
                  ) || null,

                weight:
                  Number(
                    row.querySelector(
                      '[data-f="weight"]'
                    ).value
                  ) || null
              }))
              .filter(e => e.exercise_id);

            // ------------------------------------------------
            // FIX:
            // Build the selected date using LOCAL date values.
            // This prevents October 1 from being saved as
            // September 30 because of UTC conversion.
            // ------------------------------------------------

            const selectedDate =
              root.querySelector('#fDate').value;

            const [year, month, day] =
              selectedDate
                .split('-')
                .map(Number);

            const workoutTimestamp =
              new Date(
                year,
                month - 1,
                day
              ).getTime();

            const payload = {

              type:
                root.querySelector('#fType').value,

              date:
                workoutTimestamp,

              duration:
                root.querySelector('#fDuration').value,

              distance:
                root.querySelector('#fDistance').value || null,

              difficulty:
                root.querySelector('#fDifficulty').value,

              calories:
                root.querySelector('#fCalories').value || null,

              notes:
                root.querySelector('#fNotes').value,

              exercises
            };

            if (existing) {

              await Api.workouts
                .update(existing.id, payload)
                .catch(() => {});

            } else {

              await Api.workouts
                .create(payload)
                .catch(() => {});

            }

            Modal.close();

            onDone();
          });
      }
    }
  );
};

// ---------------- Exercise ----------------
Forms.exercise = (onDone) => {

  const body = `
    <div class="field">
      <label>Name</label>

      <input
        id="xName"
        placeholder="e.g. Incline Dumbbell Press"
      >
    </div>

    <div class="field-row">

      <div class="field">
        <label>Muscle group</label>

        <input
          id="xMuscle"
          placeholder="e.g. Chest"
        >
      </div>

      <div class="field">
        <label>Category</label>

        <select id="xCategory">
          <option>Strength</option>
          <option>Bodyweight</option>
          <option>Cardio</option>
        </select>
      </div>

    </div>

    <div class="field">

      <label>Difficulty</label>

      <select id="xDifficulty">
        <option>Beginner</option>
        <option>Intermediate</option>
        <option>Advanced</option>
      </select>

    </div>

    <div class="field">

      <label>Description</label>

      <textarea
        id="xDesc"
        placeholder="Brief description"
      ></textarea>

    </div>

    <button
      class="btn btn-primary"
      id="xSubmit"
      style="width:100%"
    >
      Add exercise
    </button>
  `;

  Modal.open('Add exercise', body, {

    onMount: (root) => {

      root
        .querySelector('#xSubmit')
        .addEventListener('click', async () => {

          const name =
            root
              .querySelector('#xName')
              .value
              .trim();

          if (!name) return;

          await Api.exercises
            .create({
              name,

              muscle_group:
                root.querySelector('#xMuscle').value ||
                'General',

              category:
                root.querySelector('#xCategory').value,

              difficulty:
                root.querySelector('#xDifficulty').value,

              description:
                root.querySelector('#xDesc').value
            })
            .catch(() => {});

          Modal.close();

          onDone();
        });

    }
  });
};

// ---------------- Weight ----------------
Forms.weight = (onDone) => {

  const body = `
    <div class="field">

      <label>Weight (kg)</label>

      <input
        id="yWeight"
        type="number"
        step="0.1"
        placeholder="e.g. 69.5"
      >

    </div>

    <div class="field">

      <label>Date</label>

      <input
        id="yDate"
        type="date"
        value="${new Date()
          .toISOString()
          .slice(0, 10)}"
      >

    </div>

    <button
      class="btn btn-primary"
      id="ySubmit"
      style="width:100%"
    >
      Save weight
    </button>
  `;

  Modal.open('Update weight', body, {

    onMount: (root) => {

      root
        .querySelector('#ySubmit')
        .addEventListener('click', async () => {

          const weight =
            Number(
              root.querySelector('#yWeight').value
            );

          if (!weight) return;

          await Api.progress
            .logWeight({
              weight,

              date:
                new Date(
                  root.querySelector('#yDate').value
                ).getTime()
            })
            .catch(() => {});

          Modal.close();

          onDone();
        });

    }
  });
};

// ---------------- Goal ----------------
Forms.goal = (onDone, existing) => {

  const body = `
    <div class="field">

      <label>Title</label>

      <input
        id="gTitle"
        value="${escapeHtml(
          existing ? existing.title : ''
        )}"
        placeholder="e.g. Workout 4 times per week"
      >

    </div>

    <div class="field">

      <label>Goal type</label>

      <select
        id="gType"
        ${existing ? 'disabled' : ''}
      >

        ${GOAL_TYPES.map(g => `
          <option
            value="${g.value}"
            ${
              existing &&
              existing.type === g.value
                ? 'selected'
                : ''
            }
          >
            ${g.label}
          </option>
        `).join('')}

      </select>

    </div>

    <div class="field">

      <label>Target value</label>

      <input
        id="gTarget"
        type="number"
        step="0.1"
        value="${
          existing
            ? existing.target_value
            : ''
        }"
      >

    </div>

    <button
      class="btn btn-primary"
      id="gSubmit"
      style="width:100%"
    >
      ${existing ? 'Save changes' : 'Create goal'}
    </button>
  `;

  Modal.open(
    existing ? 'Edit goal' : 'Create a goal',
    body,
    {

      onMount: (root) => {

        root
          .querySelector('#gSubmit')
          .addEventListener('click', async () => {

            const type =
              root.querySelector('#gType').value;

            const unit =
              (
                GOAL_TYPES.find(
                  g => g.value === type
                ) || {}
              ).unit || '';

            const payload = {

              title:
                root.querySelector('#gTitle').value,

              type,

              target_value:
                root.querySelector('#gTarget').value,

              unit
            };

            if (existing) {

              await Api.goals
                .update(existing.id, payload)
                .catch(() => {});

            } else {

              await Api.goals
                .create(payload)
                .catch(() => {});

            }

            Modal.close();

            onDone();
          });

      }
    }
  );
};

// ---------------- Nutrition ----------------
Forms.nutrition = (onDone) => {

  const body = `
    <div class="field">

      <label>Food name</label>

      <input
        id="nName"
        placeholder="e.g. Grilled chicken & rice"
      >

    </div>

    <div class="field">

      <label>Meal</label>

      <select id="nMeal">
        ${MEAL_TYPES.map(m => `
          <option>${m}</option>
        `).join('')}
      </select>

    </div>

    <div class="field-row">

      <div class="field">

        <label>Calories</label>

        <input
          id="nCal"
          type="number"
        >

      </div>

      <div class="field">

        <label>Protein (g)</label>

        <input
          id="nProtein"
          type="number"
        >

      </div>

    </div>

    <div class="field-row">

      <div class="field">

        <label>Carbs (g)</label>

        <input
          id="nCarbs"
          type="number"
        >

      </div>

      <div class="field">

        <label>Fat (g)</label>

        <input
          id="nFat"
          type="number"
        >

      </div>

    </div>

    <button
      class="btn btn-primary"
      id="nSubmit"
      style="width:100%"
    >
      Log food
    </button>
  `;

  Modal.open('Log food', body, {

    onMount: (root) => {

      root
        .querySelector('#nSubmit')
        .addEventListener('click', async () => {

          const food_name =
            root
              .querySelector('#nName')
              .value
              .trim();

          const calories =
            Number(
              root.querySelector('#nCal').value
            );

          if (
            !food_name ||
            !Number.isFinite(calories)
          ) {
            return;
          }

          await Api.nutrition
            .create({

              food_name,

              calories,

              protein:
                root.querySelector('#nProtein').value,

              carbs:
                root.querySelector('#nCarbs').value,

              fat:
                root.querySelector('#nFat').value,

              meal_type:
                root.querySelector('#nMeal').value

            })
            .catch(() => {});

          Modal.close();

          onDone();
        });

    }
  });
};
