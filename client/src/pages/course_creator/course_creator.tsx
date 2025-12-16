import {
  createSignal,
  For,
  onMount,
  createMemo,
  createEffect,
  Switch,
  Match,
} from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { type LocalCourse, CourseStore } from '~/lib/stores';
import GooglePlacesAutocomplete from './google_places_autocomplete';
import MapEditor from './map_editor';
import {
  MapMode,
  DrawTool,
  FeatureType,
  EnhancedHole,
  UnifiedHoleFeatures,
} from './types';
import { calculateTeeToGreenDistance } from './trajectory_utils';
import {
  createFeature,
  updateFeature,
  createEmptyFeatures,
  featuresToGeoJSON,
  parseFeatureId,
  getCollectionName,
} from './feature_utils';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

type BuilderStep = 'init' | 'builder';
// Use EnhancedHole for centralized feature management but with proper HoleDefinition interface
type Hole = Omit<EnhancedHole, 'features'> & {
  features?: UnifiedHoleFeatures;
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
  features: createEmptyFeatures(),
}));

const ensureHoles = (c: LocalCourse): LocalCourse => {
  const existing = c.holeDefinitions || [];
  if (existing.length >= 18) return c;

  const merged = DEFAULT_HOLES.map((def) => {
    const found = existing.find((h) => h.holeNumber === def.holeNumber);
    if (found) {
      // Ensure features exist
      const features = found.features || createEmptyFeatures();
      return { ...found, features };
    }
    return {
      ...def,
      courseId: c.id,
    };
  });
  return { ...c, holeDefinitions: merged };
};

export default function CourseBuilder() {
  const navigate = useNavigate();
  const params = useParams();

  const [step, setStep] = createSignal<BuilderStep>();
  const [loading, setLoading] = createSignal(false);
  const [course, setCourse] = createSignal<LocalCourse | null>(null);

  const [initForm, setInitForm] = createSignal<InitFormData>({
    name: '',
    city: 'Augusta',
    state: 'GA',
    lat: 33.5021,
    lng: -82.0226,
  });

  const [selectedHoleNum, setSelectedHoleNum] = createSignal(1);
  const [mapMode, setMapMode] = createSignal<MapMode>('view');
  const [drawTool, setDrawTool] = createSignal<DrawTool>('polygon');
  const [pickContext, setPickContext] = createSignal<PickContext>(null);

  onMount(async () => {
    if (params.id) {
      setLoading(true);
      try {
        const id = parseInt(params.id);
        const data = await CourseStore.getById(id);

        if (data) {
          setCourse(ensureHoles(data));
          setStep('builder');
          return;
        }

        const serverCourse = await CourseStore.fetchById(id);
        if (serverCourse) {
          setCourse(ensureHoles(serverCourse));
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

  const currentHole = createMemo((): Hole | undefined => {
    const hole = course()?.holeDefinitions.find(
      (h) => h.holeNumber === selectedHoleNum(),
    );
    if (!hole) return undefined;

    // Ensure we have features available
    const features =
      (hole as any).features || hole.features || createEmptyFeatures();
    return { ...hole, features } as Hole;
  });

  const pickCtx = createMemo(() => {
    const ctx = pickContext();
    if (!ctx) return null;
    return ctx;
  });

  const mapMarkers = createMemo(() => {
    const holeNumber = currentHole()?.holeNumber;

    if (!course() || !holeNumber) {
      return [];
    }

    const markers = [
      ...(currentHole()?.tee_boxes || []).map((t) => ({
        lat: t.lat,
        lng: t.lng,
        color: t.color,
      })),
    ];

    const holeDefinitions = course()!.holeDefinitions || [];

    if (mapMode() === 'view') {
      const holeFeatures = holeDefinitions[holeNumber - 1];

      if (holeFeatures.lat && holeFeatures.lng) {
        markers.push({
          lat: holeFeatures.lat,
          lng: holeFeatures.lng,
          color: '#ffffff',
        });
      }
      if (holeFeatures.front_lat && holeFeatures.front_lng) {
        markers.push({
          lat: holeFeatures.front_lat,
          lng: holeFeatures.front_lng,
          color: '#ef4444',
        });
      }
      if (holeFeatures.back_lat && holeFeatures.back_lng) {
        markers.push({
          lat: holeFeatures.back_lat,
          lng: holeFeatures.back_lng,
          color: '#3b82f6',
        });
      }
    }

    return markers;
  });

  // Convert unified features to GeoJSON for map rendering
  const mapEditorFeatures = createMemo((): GeoJSON.FeatureCollection => {
    const hole = currentHole();
    if (!hole?.features) {
      return { type: 'FeatureCollection', features: [] };
    }

    return featuresToGeoJSON(hole.features);
  });

  // Get current trajectory feature for map
  const currentTrajectory = createMemo(() => {
    const hole = currentHole();

    return hole?.features?.trajectory || null;
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
      setMapMode('pick_location');
    } else {
      const context = pickCtx();
      if (!context) return;

      const current = currentHole();
      if (!current) return;

      if (context.type === 'tee_box') {
        const currentTeeBoxes = current.tee_boxes || [];
        const idx = context.index;

        const updatedTeeBoxes = [...currentTeeBoxes];
        updatedTeeBoxes[idx] = { ...(updatedTeeBoxes[idx] || {}), lat, lng };

        updateHole(selectedHoleNum(), { tee_boxes: updatedTeeBoxes });
      } else if (context.type === 'pin') {
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

  const updateHole = (holeNum: number, data: Partial<Hole>) => {
    if (!course()) return;
    const holes = course()!.holeDefinitions.map((h) => {
      if (h.holeNumber === holeNum) {
        const updated = { ...h, ...data };
        // Keep features and features in sync
        if (data.features) {
          updated.features = data.features;
          updated.features = data.features;
        }
        return updated;
      }
      return h;
    });
    setCourse({ ...course()!, holeDefinitions: holes });

    if (course()!.id) {
      // Prepare data for persistence - include features if features changed
      const persistData = data.features
        ? { ...data, features: data.features }
        : data;

      CourseStore.updateHole(course()!.id!, holeNum, persistData as any).catch(
        (e) => console.warn('Failed to persist hole update:', e),
      );
    }
  };

  // UNIFIED FEATURE MANAGEMENT FUNCTIONS
  const createHoleFeature = (
    holeNum: number,
    type: FeatureType,
    geometry: GeoJSON.Geometry,
    properties: any = {},
  ) => {
    const hole = currentHole();
    if (!hole || !hole.features) return null;

    const feature = createFeature(type, geometry, properties);
    const updatedFeatures: UnifiedHoleFeatures = {
      greens: [...hole.features.greens],
      trajectory: hole.features.trajectory,
      teeBoxes: [...hole.features.teeBoxes],
      slopes: [...hole.features.slopes],
      hazards: [...hole.features.hazards],
    };

    if (type === 'trajectory') {
      updatedFeatures.trajectory = feature as any;
    } else {
      const collectionName = getCollectionName(
        type,
      ) as keyof UnifiedHoleFeatures;
      if (Array.isArray(updatedFeatures[collectionName])) {
        (updatedFeatures[collectionName] as any[]).push(feature);
      }
    }

    updateHole(holeNum, { features: updatedFeatures });
    return feature;
  };

  const updateHoleFeature = (
    holeNum: number,
    featureId: string,
    updates: { geometry?: GeoJSON.Geometry; properties?: any },
  ) => {
    const hole = currentHole();
    if (!hole || !hole.features) return;

    const { type } = parseFeatureId(featureId);
    const updatedFeatures: UnifiedHoleFeatures = {
      greens: [...hole.features.greens],
      trajectory: hole.features.trajectory,
      teeBoxes: [...hole.features.teeBoxes],
      slopes: [...hole.features.slopes],
      hazards: [...hole.features.hazards],
    };

    if (type === 'trajectory' && updatedFeatures.trajectory?.id === featureId) {
      updatedFeatures.trajectory = updateFeature(
        updatedFeatures.trajectory,
        updates,
      );
    } else {
      const collectionName = getCollectionName(
        type,
      ) as keyof UnifiedHoleFeatures;
      const collection = updatedFeatures[collectionName];
      if (Array.isArray(collection)) {
        const index = collection.findIndex((f) => f.id === featureId);
        if (index !== -1) {
          collection[index] = updateFeature(collection[index], updates);
        }
      }
    }

    updateHole(holeNum, { features: updatedFeatures });
  };

  const deleteHoleFeature = (holeNum: number, featureId: string) => {
    const hole = currentHole();
    if (!hole || !hole.features) return;

    const { type } = parseFeatureId(featureId);
    const updatedFeatures: UnifiedHoleFeatures = {
      greens: [...hole.features.greens],
      trajectory: hole.features.trajectory,
      teeBoxes: [...hole.features.teeBoxes],
      slopes: [...hole.features.slopes],
      hazards: [...hole.features.hazards],
    };

    if (type === 'trajectory') {
      updatedFeatures.trajectory = null;
    } else {
      const collectionName = getCollectionName(
        type,
      ) as keyof UnifiedHoleFeatures;
      const collection = updatedFeatures[collectionName];
      if (Array.isArray(collection)) {
        const filtered = collection.filter((f) => f.id !== featureId);
        (updatedFeatures[collectionName] as any) = filtered;
      }
    }

    updateHole(holeNum, { features: updatedFeatures });
  };

  // UNIFIED EVENT HANDLERS
  const handleFeatureCreate = async (
    type: FeatureType,
    geometry: GeoJSON.Geometry,
    properties: any = {},
  ) => {
    createHoleFeature(selectedHoleNum(), type, geometry, properties);
    setMapMode('view');
  };

  const handleFeatureUpdate = async (
    featureId: string,
    updates: { geometry?: GeoJSON.Geometry; properties?: any },
  ) => {
    console.log(featureId, updates)
    // updateHoleFeature(selectedHoleNum(), featureId, updates);
  };

  const handleFeatureDelete = (featureId: string) => {
    deleteHoleFeature(selectedHoleNum(), featureId);
  };

  // LEGACY HANDLERS (for backward compatibility with MapEditor)
  const handleLegacyFeatureCreate = async (feature: GeoJSON.Feature) => {
    const type = (feature.properties?.type as FeatureType) || 'green';
    await handleFeatureCreate(type, feature.geometry, feature.properties);
  };

  const handleLegacyFeatureUpdate = async (feature: GeoJSON.Feature) => {
    if (feature.id) {
      await handleFeatureUpdate(feature.id as string, {
        geometry: feature.geometry,
        properties: feature.properties,
      });
    }
  };

  // Effect to track hole changes for debugging
  createEffect(() => {
    const hole = currentHole();
    const features = mapEditorFeatures();
    // Track when holes change for feature redrawing
    if (hole) {
      console.log(`Switched to hole ${hole.holeNumber} with ${features.features.length} features`);
    }
  });

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
      <Switch>
        <Match when={loading()}>
          <div class="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
            Loading...
          </div>
        </Match>

        <Match when={step() === 'init'}>
          <div class="flex-1 relative">
            <div class="absolute inset-0 z-0">
              <MapEditor
                mode={mapMode}
                onLocationPick={() => null}
                center={[initForm().lng, initForm().lat]}
                features={{ type: 'FeatureCollection', features: [] }}
                trajectory={null}
                markers={() => [
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
        </Match>

        <Match when={step() === 'builder' && course()}>
          {(c) => (
            <>
              <header class="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20">
                <div class="flex items-center gap-4">
                  <div class="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded text-xs font-bold uppercase">
                    Draft
                  </div>
                  <h1 class="font-bold text-white">{c().name}</h1>
                </div>

                <button
                  onClick={handlePublish}
                  class="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                >
                  Finish & Publish
                </button>
              </header>

              <div class="flex-1 flex overflow-hidden">
                <div class="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
                  <div class="p-4 flex justify-between items-start">
                    <div>
                      <h2 class="text-2xl font-black text-white mb-1">
                        Hole {selectedHoleNum()}
                      </h2>
                      <span class="text-slate-500 text-sm">
                        Edit details and map features
                      </span>
                    </div>
                  </div>
                  <div class="p-4 grid grid-cols-6 gap-2">
                    <For each={c().holeDefinitions}>
                      {(hole) => (
                        <button
                          onClick={() => {
                            setSelectedHoleNum(
                              hole.holeNumber ?? hole.handicap ?? 1,
                            );
                            setMapMode('view');
                          }}
                          class={`aspect-square rounded-lg font-bold text-sm flex items-center justify-center transition-all ${
                            selectedHoleNum() === hole.holeNumber
                              ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 ring-offset-2 ring-offset-slate-900'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {hole.holeNumber}
                        </button>
                      )}
                    </For>
                  </div>
                </div>

                <div class="flex-1 relative bg-black">
                  <MapEditor
                    zoom={16}
                    mode={mapMode}
                    drawMode={drawTool}
                    center={
                      currentHole()?.lat && currentHole()?.lng
                        ? [currentHole()!.lng!, currentHole()!.lat!]
                        : [course()!.lng, course()!.lat]
                    }
                    trajectory={currentTrajectory()}
                    markers={mapMarkers}
                    features={mapEditorFeatures()}
                    onLocationPick={handleLocationPick}
                    onFeatureCreate={handleFeatureCreate}
                    onFeatureUpdate={handleFeatureUpdate}
                    onFeatureDelete={handleFeatureDelete}
                    onDrawCreate={handleLegacyFeatureCreate}
                    onDrawUpdate={handleLegacyFeatureUpdate}
                    onEditModeExit={() => {}}
                    onEditModeEnter={() => {}}
                  />
                </div>

                <div class="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-10 shadow-xl">
                  <div class="flex-1 p-6 space-y-6 overflow-y-auto">
                    <div class="space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="label text-xs">Par</label>
                          <input
                            type="number"
                            class="input-field w-full"
                            min={3}
                            max={5}
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
                            min={1}
                            max={18}
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
                                <div class="flex items-center gap-1">
                                  <input
                                    class="input-field w-20 text-sm py-1"
                                    placeholder="Yds"
                                    value={teeBox.yardage}
                                    onChange={(e) => {
                                      const boxes = [
                                        ...(currentHole()?.tee_boxes || []),
                                      ];

                                      if (!RegExp('^[0-9]+$').test) {
                                        return;
                                      }

                                      boxes[i()] = {
                                        ...(boxes[i()] || {}),
                                        yardage: parseInt(
                                          e.currentTarget.value,
                                        ),
                                      };
                                      updateHole(selectedHoleNum(), {
                                        tee_boxes: boxes,
                                      });
                                    }}
                                  />
                                  {(() => {
                                    const hole = currentHole();
                                    if (
                                      hole?.trajectory &&
                                      teeBox.lat &&
                                      teeBox.lng &&
                                      hole?.lat &&
                                      hole?.lng
                                    ) {
                                      return (
                                        <span class="text-xs text-blue-400">
                                          (
                                          {calculateTeeToGreenDistance(
                                            [teeBox.lng, teeBox.lat],
                                            [hole.lng, hole.lat],
                                            hole.trajectory,
                                          )}{' '}
                                          yds)
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
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
                                    : teeBox.lat && teeBox.lng
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

                      <div class="space-y-2">
                        <button
                          onClick={() => {
                            setMapMode('draw');
                            setDrawTool('polygon');
                          }}
                          class={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all ${mapMode() === 'draw' && drawTool() === 'polygon' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                        >
                          <span class="font-bold text-sm">
                            Draw Green Shape
                          </span>
                          <div
                            class={`w-3 h-3 rounded-full ${currentHole()?.features?.greens?.length ? 'bg-emerald-400' : 'bg-slate-600'}`}
                          />
                        </button>

                        <button
                          onClick={() => {
                            const trajectory =
                              currentHole()?.features?.trajectory;
                            if (trajectory && mapMode() !== 'draw') {
                              // If trajectory exists and not in draw mode, delete it
                              if (confirm('Delete the existing trajectory?')) {
                                deleteHoleFeature(
                                  selectedHoleNum(),
                                  trajectory.id,
                                );
                              }
                            } else {
                              // Otherwise, enter draw mode to create/edit trajectory
                              setMapMode('draw');
                              setDrawTool('trajectory');
                            }
                          }}
                          class={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all ${mapMode() === 'draw' && drawTool() === 'trajectory' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : currentHole()?.features?.trajectory ? 'bg-slate-800 hover:bg-red-900/50 text-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                        >
                          <span class="font-bold text-sm">
                            {currentHole()?.features?.trajectory &&
                            mapMode() !== 'draw'
                              ? 'Delete Trajectory'
                              : 'Draw Hole Trajectory'}
                          </span>
                          <div
                            class={`w-3 h-3 rounded-full ${currentHole()?.features?.trajectory ? 'bg-blue-400' : 'bg-slate-600'}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </Match>
      </Switch>
    </div>
  );
}
