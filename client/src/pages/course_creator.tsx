// CourseBuilder.tsx
import {
  createSignal,
  Show,
  For,
  onMount,
  createEffect,
  createMemo,
} from 'solid-js';
import { createShortcut } from '@solid-primitives/keyboard';
import { useNavigate, useParams } from '@solidjs/router';
import MapEditor from '~/components/map_editor';
import { type LocalCourse, CourseStore } from '~/lib/stores';
import GooglePlacesAutocomplete from '~/components/google_places_autocomplete';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

type BuilderStep = 'init' | 'builder';
type TeeBox = {
  id?: number;
  name: string;
  color: string;
  yardage: number;
  lat?: number;
  lng?: number;
};
type Hole = {
  holeNumber: number;
  par: number;
  handicap: number;
  lat?: number;
  lng?: number;
  geo_features?: any;
  tee_boxes?: TeeBox[];
};

type InitFormData = {
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

type PickContext =
  | { type: 'tee_box'; index: number }
  | { type: 'pin'; position: 'front' | 'middle' | 'back' }
  | null;

const DEFAULT_HOLES: Hole[] = Array.from({ length: 18 }, (_, i) => ({
  holeNumber: i + 1,
  par: 4,
  handicap: i + 1,
  lat: 0,
  lng: 0,
  geo_features: null,
  tee_boxes: [],
}));

const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) => {
  const earthRadiusMeters = 6371e3;
  const lat1Radians = (lat1 * Math.PI) / 180;
  const lat2Radians = (lat2 * Math.PI) / 180;
  const deltaLatRadians = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLngRadians = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRadians / 2) * Math.sin(deltaLatRadians / 2) +
    Math.cos(lat1Radians) *
      Math.cos(lat2Radians) *
      Math.sin(deltaLngRadians / 2) *
      Math.sin(deltaLngRadians / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = earthRadiusMeters * c;
  return Math.round(meters * 1.09361); // yards
};

export default function CourseBuilder() {
  const navigate = useNavigate();
  const params = useParams();

  // -- Global State --
  const [step, setStep] = createSignal<BuilderStep>('init');
  const [loading, setLoading] = createSignal(false);
  const [course, setCourse] = createSignal<LocalCourse | null>(null);

  // -- Init State --
  const [initForm, setInitForm] = createSignal<InitFormData>({
    name: '',
    city: 'Augusta',
    state: 'GA',
    lat: 33.5021,
    lng: -82.0226,
  });
  const [isPickingLocation, setIsPickingLocation] = createSignal(false);

  // -- Builder State --
  const [selectedHoleNum, setSelectedHoleNum] = createSignal(1);
  const [mapMode, setMapMode] = createSignal<'view' | 'pick_location' | 'draw'>(
    'view',
  );
  const [pickContext, setPickContext] = createSignal<PickContext>(null);
  const [isEditingGreen, setIsEditingGreen] = createSignal(false);

  onMount(async () => {
    if (params.id) {
      setLoading(true);
      try {
        const id = parseInt(params.id);
        const data = await CourseStore.getById(id);
        console.log(data)
        if (data) {
          setCourse(data);
          setStep('builder');
          return;
        }

        const serverCourse = await CourseStore.fetchById(id);
        if (serverCourse) {
          setCourse(serverCourse);
          setStep('builder');
          return;
        }

        setStep('init');
      } catch (e) {
        console.error('Failed to load course', e);
        navigate('/courses/new');
      } finally {
        setLoading(false);
      }
    } else {
      setStep('init');
    }
  });

  createEffect(() => {
    const _course = course();
    if (_course) {
      CourseStore.localUpdateCourse(_course);
    }
  });

  createShortcut(
    ['Escape'],
    () => {
      setMapMode('view');
      setPickContext(null);
      setIsEditingGreen(false);
      (document.activeElement as HTMLElement)?.blur();
    },
    {
      preventDefault: false,
      requireReset: true,
    },
  );

  const pickCtx = createMemo(() => {
    const ctx = pickContext();
    if (!ctx) return null;
    return ctx;
  });

  const handlePlaceSelect = (place: {
    name: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
  }) => {
    setInitForm((p) => ({
      ...p,
      name: place.name,
      city: place.city,
      state: place.state,
      lat: place.lat,
      lng: place.lng,
    }));
  };

  const handleInitSubmit = async () => {
    try {
      setLoading(true);
      const newCourse = await CourseStore.create({
        name: initForm().name,
        city: initForm().city,
        state: initForm().state,
        lat: initForm().lat,
        lng: initForm().lng,
        holeDefinitions: DEFAULT_HOLES.map((h) => ({
          courseId: 0,
          holeNumber: h.holeNumber,
          par: h.par,
          handicap: h.handicap,
          lat: h.lat,
          lng: h.lng,
          geo_features: h.geo_features,
          tee_boxes: h.tee_boxes,
        })),
        status: 'draft',
      });

      navigate(`/courses/${newCourse.id}/edit`, { replace: true });
    } catch (e) {
      console.error('Failed to create draft', e);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationPick = (lat: number, lng: number) => {
    if (step() === 'init') {
      setInitForm((prev) => ({ ...prev, lat, lng }));
      setIsPickingLocation(false);
    } else {
      const context = pickCtx();
      if (!context) return;

      const current = currentHole();
      if (!current) return;

      if (context.type === 'tee_box') {
        const idx = context.index;
        const currentTeeBoxes = current.tee_boxes || [];
        const updatedTeeBoxes = [...currentTeeBoxes];
        updatedTeeBoxes[idx] = { ...(updatedTeeBoxes[idx] || {}), lat, lng };
        updateHole(selectedHoleNum(), { tee_boxes: updatedTeeBoxes });
      } else if (context.type === 'pin') {
        // position front/middle/back -> we use the same updateHole entry
        if (context.position === 'middle') {
          updateHole(selectedHoleNum(), { lat, lng });
        } else if (context.position === 'front') {
          updateHole(selectedHoleNum(), { front_lat: lat, front_lng: lng });
        } else if (context.position === 'back') {
          updateHole(selectedHoleNum(), { back_lat: lat, back_lng: lng });
        }
      }

      setPickContext(null);
      setMapMode('view');
    }
  };

  const currentHole = () => {
    if (!course()) return null;
    return course()!.holeDefinitions.find(
      (h) => h.holeNumber === selectedHoleNum(),
    );
  };

  // updateHole updates local course state only; persist via CourseStore.updateHole
  const updateHole = (holeNum: number, data: Partial<Hole>) => {
    if (!course()) return;
    const holes = course()!.holeDefinitions.map((h) =>
      h.holeNumber === holeNum ? { ...h, ...data } : h,
    );
    setCourse({ ...course()!, holeDefinitions: holes });
    // persist small change to store (course id must exist)
    if (course()!.id) {
      CourseStore.updateHole(course()!.id, holeNum, data as any).catch((e) =>
        console.warn('Failed to persist hole update:', e),
      );
    }
  };

  // --- New green handlers for MapEditor callbacks ---

  // Called when user finishes drawing a green (onDrawCreate)
  const handleGreenCreate = async (feature: GeoJSON.Feature) => {
    // Append feature to the current hole's geo_features and persist
    const hole = currentHole();
    if (!hole) return;

    const currentGeo = hole.geo_features || {
      type: 'FeatureCollection',
      features: [],
    };
    const newFeature = {
      ...feature,
      properties: {
        ...(feature.properties || {}),
        type: 'green',
        hole: hole.holeNumber,
      },
    };

    const newGeo = {
      ...currentGeo,
      features: [...(currentGeo.features || []), newFeature],
    };
    await updateHole(selectedHoleNum(), { geo_features: newGeo });
  };

  // Called when a green is edited (vertices moved/inserted/deleted)
  const handleGreenUpdate = async (feature: GeoJSON.Feature) => {
    const hole = currentHole();
    if (!hole) return;
    const currentGeo = hole.geo_features || {
      type: 'FeatureCollection',
      features: [],
    };

    // Find the matching feature by id (properties.id)
    const incomingId = (feature.properties as any)?.id;
    if (!incomingId) {
      // If no id, nothing we can match reliably — append fallback
      const newGeo = {
        ...currentGeo,
        features: [...(currentGeo.features || []), feature],
      };
      await updateHole(selectedHoleNum(), { geo_features: newGeo });
      return;
    }

    const updatedFeatures = (currentGeo.features || []).map((f: any) =>
      (f.properties as any)?.id === incomingId ? feature : f,
    );

    const newGeo = { ...currentGeo, features: updatedFeatures };
    await updateHole(selectedHoleNum(), { geo_features: newGeo });
  };

  // Called when user wants to edit a green via a UI toggle
  const toggleEditGreen = (enable: boolean) => {
    setIsEditingGreen(enable);
    setMapMode(enable ? 'draw' : 'view');
  };

  const handleGreenEditMode = (enable: boolean) => {
    setIsEditingGreen(enable);
    setMapMode(enable ? 'view' : 'view'); // editing handled inside MapEditor via clicks
  };

  const handlePublish = async () => {
    if (!confirm('Finish and publish this course? This cannot be undone.')) {
      return;
    }
    const _course = course();
    if (!_course?.id) return;
    try {
      setLoading(true);
      await CourseStore.publish(_course.id);
      navigate('/');
    } catch (e) {
      console.error(e);
      alert('Failed to publish course. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="h-screen w-screen bg-golf-dark text-white flex flex-col overflow-hidden">
      <Show when={loading()}>
        <div class="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
          Loading...
        </div>
      </Show>

      <Show when={step() === 'init'}>
        <div class="flex-1 relative">
          <div class="absolute inset-0 z-0">
            <MapEditor
              mode={isPickingLocation() ? 'pick_location' : 'view'}
              onLocationPick={handleLocationPick}
              center={
                initForm().lng && initForm().lat
                  ? [initForm().lng, initForm().lat]
                  : undefined
              }
              markers={[
                { lat: initForm().lat, lng: initForm().lng, label: 'C' },
              ]}
            />
          </div>

          <div class="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300">
            <div class="bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700 space-y-6">
              <div class="text-center">
                <h1 class="text-3xl font-black text-emerald-500">
                  Course Builder
                </h1>
                <p class="text-slate-400">
                  Search for a course to get started.
                </p>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Search Course
                  </label>
                  <GooglePlacesAutocomplete
                    apiKey={GOOGLE_MAPS_KEY}
                    onPlaceSelect={handlePlaceSelect}
                    class="input-field w-full bg-slate-800 border-emerald-500/50 focus:border-emerald-500"
                    placeholder="e.g. Pebble Beach Golf Links"
                  />
                </div>

                <div class="relative py-2">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-slate-700"></div>
                  </div>
                  <div class="relative flex justify-center text-xs uppercase">
                    <span class="bg-slate-900 px-2 text-slate-500 font-bold">
                      Or Enter Details
                    </span>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold uppercase text-slate-500 mb-1">
                    Course Name
                  </label>
                  <input
                    class="input-field w-full"
                    placeholder="e.g. Augusta National"
                    value={initForm().name}
                    onInput={(e) =>
                      setInitForm((p) => ({
                        ...p,
                        name: e.currentTarget.value,
                      }))
                    }
                  />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">
                      City
                    </label>
                    <input
                      class="input-field w-full"
                      placeholder="Augusta"
                      value={initForm().city}
                      onInput={(e) =>
                        setInitForm((p) => ({
                          ...p,
                          city: e.currentTarget.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-bold uppercase text-slate-500 mb-1">
                      State
                    </label>
                    <input
                      class="input-field w-full"
                      placeholder="GA"
                      value={initForm().state}
                      onInput={(e) =>
                        setInitForm((p) => ({
                          ...p,
                          state: e.currentTarget.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div class="p-4 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between">
                  <div>
                    <span class="block text-xs font-bold text-slate-400">
                      Location Center
                    </span>
                    <span class="font-mono text-xs text-emerald-400">
                      {initForm().lat?.toFixed(4)}, {initForm().lng?.toFixed(4)}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsPickingLocation(true)}
                    class="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded transition-colors border border-slate-600"
                  >
                    Adjust Pin
                  </button>
                </div>
              </div>

              <button
                onClick={handleInitSubmit}
                disabled={loading() || !initForm().name}
                class="w-full btn-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading() ? 'Creating...' : 'Start Building'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={step() === 'builder' && course()}>
        {(c) => (
          <>
            <header class="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20">
              <div class="flex items-center gap-4">
                <div class="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded text-xs font-bold uppercase">
                  Draft
                </div>
                <h1 class="font-bold text-white">{c().name}</h1>
              </div>

              <div class="flex gap-2 items-center">
                <button
                  onClick={() => toggleEditGreen(!isEditingGreen())}
                  class="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-sm"
                >
                  Toggle Green Edit
                </button>
                <button
                  onClick={handlePublish}
                  class="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  Finish & Publish
                </button>
              </div>
            </header>

            <div class="flex-1 flex overflow-hidden">
              <div class="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
                <div class="p-4 grid grid-cols-6 gap-2">
                  <For each={c().holeDefinitions}>
                    {(hole) => (
                      <button
                        onClick={() => {
                          setSelectedHoleNum(hole.handicap);
                          setMapMode('view');
                        }}
                        class={`aspect-square rounded-lg font-bold text-sm flex items-center justify-center transition-all ${
                          selectedHoleNum() === hole.handicap
                            ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-900'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {hole.handicap}
                      </button>
                    )}
                  </For>
                </div>

                <div class="flex-1 p-6 space-y-6 overflow-y-auto border-t border-slate-800">
                  <div class="flex justify-between items-start">
                    <div>
                      <h2 class="text-2xl font-black text-white mb-1">
                        Hole {selectedHoleNum()}
                      </h2>
                      <span class="text-slate-500 text-sm">
                        Edit details and map features
                      </span>
                    </div>
                  </div>

                  <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="label text-xs">Par</label>
                        <input
                          type="number"
                          class="input-field w-full"
                          value={currentHole()?.par}
                          onInput={(e) =>
                            updateHole(selectedHoleNum(), {
                              par: parseInt(e.currentTarget.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label class="label text-xs">Handicap</label>
                        <input
                          type="number"
                          class="input-field w-full"
                          value={currentHole()?.handicap}
                          onInput={(e) =>
                            updateHole(selectedHoleNum(), {
                              handicap: parseInt(e.currentTarget.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div class="space-y-3 pt-4 border-t border-slate-800">
                    <div class="flex items-center justify-between">
                      <h3 class="font-bold text-slate-400 text-xs uppercase tracking-wider">
                        Green Positions
                      </h3>
                    </div>

                    <div class="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          setPickContext({ type: 'pin', position: 'front' });
                          setMapMode('pick_location');
                        }}
                        class={`p-2 rounded-lg border text-center transition-all ${currentHole()?.front_lat ? 'bg-slate-800 border-red-500/50 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'} ${pickCtx()?.type === 'pin' && (pickCtx() as any).position === 'front' ? 'ring-2 ring-red-500' : ''}`}
                      >
                        <div class="text-[10px] uppercase font-bold mb-1">
                          Front
                        </div>
                        <div
                          class={`w-3 h-3 rounded-full bg-red-500 mx-auto mb-1 ${currentHole()?.front_lat ? '' : 'opacity-20'}`}
                        />
                        <span class="text-[10px]">
                          {currentHole()?.front_lat ? 'Set' : 'Empty'}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setPickContext({ type: 'pin', position: 'middle' });
                          setMapMode('pick_location');
                        }}
                        class={`p-2 rounded-lg border text-center transition-all ${currentHole()?.lat ? 'bg-slate-800 border-white/50 text-white' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'} ${pickCtx()?.type === 'pin' && (pickCtx() as any).position === 'middle' ? 'ring-2 ring-white' : ''}`}
                      >
                        <div class="text-[10px] uppercase font-bold mb-1">
                          Middle (Pin)
                        </div>
                        <div
                          class={`w-3 h-3 rounded-full bg-white mx-auto mb-1 ${currentHole()?.lat ? '' : 'opacity-20'}`}
                        />
                        <span class="text-[10px]">
                          {currentHole()?.lat ? 'Set' : 'Empty'}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setPickContext({ type: 'pin', position: 'back' });
                          setMapMode('pick_location');
                        }}
                        class={`p-2 rounded-lg border text-center transition-all ${currentHole()?.back_lat ? 'bg-slate-800 border-blue-500/50 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'} ${pickCtx()?.type === 'pin' && (pickCtx() as any).position === 'back' ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <div class="text-[10px] uppercase font-bold mb-1">
                          Back
                        </div>
                        <div
                          class={`w-3 h-3 rounded-full bg-blue-500 mx-auto mb-1 ${currentHole()?.back_lat ? '' : 'opacity-20'}`}
                        />
                        <span class="text-[10px]">
                          {currentHole()?.back_lat ? 'Set' : 'Empty'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div class="space-y-3 pt-4 border-t border-slate-800">
                    <div class="flex items-center justify-between">
                      <h3 class="font-bold text-slate-400 text-xs uppercase tracking-wider">
                        Tee Boxes
                      </h3>
                      <button
                        onClick={() =>
                          updateHole(selectedHoleNum(), {
                            tee_boxes: [
                              ...(currentHole()?.tee_boxes || []),
                              {
                                name: '',
                                color: '#ffffff',
                                yardage: 0,
                                lat: 0,
                                lng: 0,
                              },
                            ],
                          })
                        }
                        class="text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-2 py-1 rounded font-bold transition-colors"
                      >
                        + Add
                      </button>
                    </div>

                    <div class="space-y-2">
                      <For each={currentHole()?.tee_boxes || []}>
                        {(teeBox, i) => (
                          <div class="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-2">
                            <div class="flex gap-2">
                              <input
                                type="color"
                                class="w-8 h-8 rounded cursor-pointer bg-transparent"
                                value={teeBox.color}
                                onChange={(e) => {
                                  const boxes = [
                                    ...(currentHole()?.tee_boxes || []),
                                  ];
                                  boxes[i()] = {
                                    ...(boxes[i()] || {}),
                                    color: e.currentTarget.value,
                                  };
                                  updateHole(selectedHoleNum(), {
                                    tee_boxes: boxes,
                                  });
                                }}
                              />
                              <input
                                class="input-field flex-1 text-sm py-1"
                                placeholder="Name (e.g. Blue)"
                                value={teeBox.name}
                                onChange={(e) => {
                                  const boxes = [
                                    ...(currentHole()?.tee_boxes || []),
                                  ];
                                  boxes[i()] = {
                                    ...(boxes[i()] || {}),
                                    name: e.currentTarget.value,
                                  };
                                  updateHole(selectedHoleNum(), {
                                    tee_boxes: boxes,
                                  });
                                }}
                              />
                              <button
                                onClick={() => {
                                  const boxes = [
                                    ...(currentHole()?.tee_boxes || []),
                                  ];
                                  boxes.splice(i(), 1);
                                  updateHole(selectedHoleNum(), {
                                    tee_boxes: boxes,
                                  });
                                }}
                                class="text-slate-500 hover:text-red-400 p-1"
                              >
                                ✕
                              </button>
                            </div>

                            <div class="flex items-center gap-2">
                              <input
                                type="number"
                                class="input-field w-20 text-sm py-1"
                                placeholder="Yds"
                                value={teeBox.yardage}
                                onChange={(e) => {
                                  const boxes = [
                                    ...(currentHole()?.tee_boxes || []),
                                  ];
                                  boxes[i()] = {
                                    ...(boxes[i()] || {}),
                                    yardage: parseInt(e.currentTarget.value),
                                  };
                                  updateHole(selectedHoleNum(), {
                                    tee_boxes: boxes,
                                  });
                                }}
                              />
                              <button
                                onClick={() => {
                                  setPickContext({
                                    type: 'tee_box',
                                    index: i(),
                                  });
                                  setMapMode('pick_location');
                                }}
                                class={`flex-1 text-xs font-bold py-1.5 rounded transition-colors ${pickCtx()?.type === 'tee_box' && (pickCtx() as any).index === i() ? 'bg-blue-500 text-white animate-pulse' : teeBox.lat ? 'bg-slate-700 text-emerald-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                              >
                                {pickCtx()?.type === 'tee_box' &&
                                (pickCtx() as any).index === i()
                                  ? 'Click Map...'
                                  : teeBox.lat
                                    ? 'Reposition'
                                    : 'Place on Map'}
                              </button>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  <div class="space-y-3 pt-4 border-t border-slate-800">
                    <h3 class="font-bold text-slate-400 text-xs uppercase tracking-wider">
                      Map Actions
                    </h3>

                    <button
                      onClick={() =>
                        setMapMode((m) => (m === 'draw' ? 'view' : 'draw'))
                      }
                      class={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all ${mapMode() === 'draw' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                    >
                      <span class="font-bold text-sm">Draw Green Shape</span>
                      <div
                        class={`w-3 h-3 rounded-full ${currentHole()?.geo_features?.features?.length ? 'bg-emerald-400' : 'bg-slate-600'}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex-1 relative bg-black">
                <MapEditor
                  zoom={15}
                  mode={isEditingGreen() ? 'edit' : mapMode()}
                  drawMode="polygon"
                  center={
                    currentHole()?.lat && currentHole()?.lng
                      ? [currentHole()!.lng!, currentHole()!.lat!]
                      : [course()!.lng, course()!.lat]
                  }
                  onLocationPick={handleLocationPick}
                  onDrawCreate={(feat) => {
                    // when finished drawing a new green in MapEditor
                    handleGreenCreate(feat);
                    // set mode back to view
                    setMapMode('view');
                  }}
                  onDrawUpdate={(feat) => {
                    // when editing vertices in MapEditor
                    handleGreenUpdate(feat);
                  }}
                  markers={[
                    ...course()!.holeDefinitions.flatMap((h) => {
                      const marks: any[] = [];
                      if (h.lat && h.lng)
                        marks.push({
                          lat: h.lat,
                          lng: h.lng,
                          color: '#ffffff',
                          label: h.handicap?.toString(),
                        });
                      if (h.front_lat && h.front_lng)
                        marks.push({
                          lat: h.front_lat,
                          lng: h.front_lng,
                          color: '#ef4444',
                        });
                      if (h.back_lat && h.back_lng)
                        marks.push({
                          lat: h.back_lat,
                          lng: h.back_lng,
                          color: '#3b82f6',
                        });
                      return marks;
                    }),
                    ...(currentHole()?.tee_boxes || []).map((t) => ({
                      lat: t.lat,
                      lng: t.lng,
                      color: t.color,
                    })),
                  ]}
                  initialGeoJSON={{
                    type: 'FeatureCollection',
                    features: (course()!.holeDefinitions || [])
                      .flatMap((h) => h.geo_features?.features || [])
                      .map((f: any) => {
                        // ensure features have id property for editing
                        if (!f.properties) f.properties = {};
                        if (!f.properties.id)
                          f.properties.id =
                            f.properties.id ??
                            `green-${Math.random().toString(36).slice(2, 9)}`;
                        return f;
                      }),
                  }}
                />
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
