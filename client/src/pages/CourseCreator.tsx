import { createSignal, For } from "solid-js";
import { useNavigate } from "@solidjs/router";

export default function CourseCreator() {
  const navigate = useNavigate();
  const [name, setName] = createSignal("");
  const [city, setCity] = createSignal("");
  const [state, setState] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  // Simple 18 hole setup
  const [holes, setHoles] = createSignal(
    Array.from({ length: 18 }, (_, i) => ({
      hole_number: i + 1,
      par: 4,
      yardage: 400,
      handicap: i + 1,
      lat: 0,
      lng: 0
    }))
  );

  const updateHole = (index: number, field: string, value: any) => {
    const newHoles = [...holes()];
    (newHoles[index] as any)[field] = parseInt(value) || 0;
    setHoles(newHoles);
  };

  const saveCourse = async () => {
    if (!name()) return;
    setLoading(true);
    try {
      // Mock coords for course center (could use a map picker later)
      const payload = {
        name: name(),
        city: city(),
        state: state(),
        lat: 0,
        lng: 0,
        hole_definitions: holes()
      };

      await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: payload })
      });

      navigate('/tracker');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-golf-dark text-white p-4 pb-20">
      <div class="max-w-2xl mx-auto space-y-6">
        <h1 class="text-2xl font-bold text-emerald-500">Add New Course</h1>
        
        <div class="space-y-4 bg-slate-800 p-4 rounded-xl">
          <input
            class="input-field w-full"
            placeholder="Course Name"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <div class="flex gap-4">
            <input
              class="input-field w-1/2"
              placeholder="City"
              value={city()}
              onInput={(e) => setCity(e.currentTarget.value)}
            />
            <input
              class="input-field w-1/2"
              placeholder="State"
              value={state()}
              onInput={(e) => setState(e.currentTarget.value)}
            />
          </div>
        </div>

        <div class="space-y-2">
          <h2 class="font-bold text-slate-400 uppercase text-xs tracking-wider">Scorecard Data</h2>
          <div class="grid grid-cols-12 gap-2 text-center text-xs font-bold text-slate-500 mb-2">
            <div class="col-span-1">#</div>
            <div class="col-span-3">Par</div>
            <div class="col-span-4">Yards</div>
            <div class="col-span-4">HCP</div>
          </div>
          
          <For each={holes()}>
            {(hole, i) => (
              <div class="grid grid-cols-12 gap-2 items-center">
                <div class="col-span-1 font-mono text-slate-400 text-center">{hole.hole_number}</div>
                <div class="col-span-3">
                  <input
                    type="number"
                    class="input-field w-full text-center p-2"
                    value={hole.par}
                    onInput={(e) => updateHole(i(), 'par', e.currentTarget.value)}
                  />
                </div>
                <div class="col-span-4">
                  <input
                    type="number"
                    class="input-field w-full text-center p-2"
                    value={hole.yardage}
                    onInput={(e) => updateHole(i(), 'yardage', e.currentTarget.value)}
                  />
                </div>
                <div class="col-span-4">
                  <input
                    type="number"
                    class="input-field w-full text-center p-2"
                    value={hole.handicap}
                    onInput={(e) => updateHole(i(), 'handicap', e.currentTarget.value)}
                  />
                </div>
              </div>
            )}
          </For>
        </div>

        <button
          onClick={saveCourse}
          disabled={loading() || !name()}
          class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold shadow-xl transition-all"
        >
          {loading() ? "Saving..." : "Create Course"}
        </button>
      </div>
    </div>
  );
}
