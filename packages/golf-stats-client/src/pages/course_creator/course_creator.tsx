import {
  For,
  onMount,
  createMemo,
  createEffect,
  Switch,
  Match,
  Show,
} from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { CourseStore } from '~/lib/stores';
import MapEditor, { MapEditorRef } from './map_editor';
import { FeatureType, UnifiedHoleFeatures } from './types';
import { HoleMetadata } from './map_drawing_manager';
import { calculateTeeToGreenDistance } from './trajectory_utils';
import {
  createFeature,
  updateFeature,
  createEmptyFeatures,
  featuresToGeoJSON,
  parseFeatureId,
  getCollectionName,
} from './feature_utils';
import {
  courseCreatorState,
  courseCreatorActions,
  type Hole,
} from './course_creator_store';
import { type LocalCourse } from '~/lib/stores';

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
    const found = existing.find((h: any) => h.holeNumber === def.holeNumber);
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

export default function CourseCreator() {
  const navigate = useNavigate();
  const params = useParams();
  
  // Ref for MapEditor to trigger undo state saves
  let mapEditorRef: MapEditorRef | null = null;

  onMount(async () => {
    if (params.id) {
      courseCreatorActions.setLoading(true);
      try {
        const id = parseInt(params.id);
        const data = await CourseStore.getById(id);

        if (data) {
          courseCreatorActions.setCourse(ensureHoles(data));
          return;
        }

        try {
          const serverCourse = await CourseStore.fetchById(id);
          if (serverCourse) {
            courseCreatorActions.setCourse(ensureHoles(serverCourse));
          }
        } catch (e) {
          console.error('Failed to fetch course', e);

          if (!data) {
            navigate('/courses/new');
          }
        }
      } catch (e) {
        console.error('Failed to load course', e);
        navigate('/courses/new');
      } finally {
        courseCreatorActions.setLoading(false);
      }
    } else {
      navigate('/courses/new');
    }
  });

  const currentHole = createMemo((): Hole | undefined => {
    const hole = courseCreatorState.course?.holeDefinitions.find(
      (h) => h.holeNumber === courseCreatorState.selectedHoleNum,
    );
    if (!hole) return undefined;

    // Ensure we have features available
    const features =
      (hole as any).features || hole.features || createEmptyFeatures();
    return { ...hole, features } as Hole;
  });

  const pickCtx = createMemo(() => {
    const ctx = courseCreatorState.pickContext;
    if (!ctx) return null;
    return ctx;
  });

  const mapMarkers = createMemo(() => {
    const holeNumber = currentHole()?.holeNumber;

    if (!courseCreatorState.course || !holeNumber) {
      return [];
    }

    const markers = [
      ...(currentHole()?.tee_boxes || []).map((t) => ({
        lat: t.lat,
        lng: t.lng,
        color: t.color,
      })),
    ];

    const holeDefinitions = courseCreatorState.course.holeDefinitions || [];

    if (courseCreatorState.mapMode === 'view') {
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

  const handleLocationPick = (lat: number, lng: number) => {
    const context = pickCtx();
    if (!context) return;

    const current = currentHole();
    if (!current) return;

    if (context.type === 'tee_box') {
      const currentTeeBoxes = current.tee_boxes || [];
      const idx = context.index;

      const updatedTeeBoxes = [...currentTeeBoxes];
      updatedTeeBoxes[idx] = { ...(updatedTeeBoxes[idx] || {}), lat, lng };

      updateHoleWithUndoSave(courseCreatorState.selectedHoleNum, {
        tee_boxes: updatedTeeBoxes,
      });
    } else if (context.type === 'pin') {
      if (context.position === 'middle') {
        updateHoleWithUndoSave(courseCreatorState.selectedHoleNum, {
          lat,
          lng,
        });
      } else if (context.position === 'front') {
        updateHoleWithUndoSave(courseCreatorState.selectedHoleNum, {
          front_lat: lat,
          front_lng: lng,
        });
      } else if (context.position === 'back') {
        updateHoleWithUndoSave(courseCreatorState.selectedHoleNum, {
          back_lat: lat,
          back_lng: lng,
        });
      }
    }

    courseCreatorActions.setPickContext(null);
    courseCreatorActions.setMapMode('view');
  };

  // Auto-dismiss error after 30 seconds
  createEffect(() => {
    const error = courseCreatorState.updateError;
    if (error) {
      const timeout = setTimeout(() => {
        if (courseCreatorState.updateError?.timestamp === error.timestamp) {
          courseCreatorActions.clearUpdateError();
        }
      }, 30000);

      return () => clearTimeout(timeout);
    }
  });

  // Get current hole metadata for undo/redo
  const getCurrentHoleMetadata = (): HoleMetadata => {
    const hole = currentHole();
    if (!hole) return {};

    return {
      lat: hole.lat,
      lng: hole.lng,
      front_lat: hole.front_lat,
      front_lng: hole.front_lng,
      back_lat: hole.back_lat,
      back_lng: hole.back_lng,
      tee_boxes: hole.tee_boxes,
      par: hole.par,
      handicap: hole.handicap,
    };
  };

  // Restore hole state from undo/redo
  const handleHoleStateRestore = async (_features: GeoJSON.FeatureCollection, metadata: HoleMetadata) => {
    // Update hole with restored metadata (features are restored by drawing manager)
    await courseCreatorActions.updateHole(courseCreatorState.selectedHoleNum, metadata);
  };

  // Enhanced updateHole that saves undo state for metadata changes
  const updateHoleWithUndoSave = async (holeNum: number, data: Partial<Hole>) => {
    // Save current state before making changes (for non-feature changes)
    const hasNonFeatureChanges = Object.keys(data).some(key => key !== 'features');
    if (hasNonFeatureChanges && mapEditorRef) {
      await mapEditorRef.saveCurrentState();
    }

    // Update the hole
    await courseCreatorActions.updateHole(holeNum, data);
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

    courseCreatorActions.updateHole(holeNum, { features: updatedFeatures });
    return feature;
  };

  const deleteHoleFeature = (holeNum: number, featureId: string) => {
    const hole = currentHole();
    if (!hole || !hole.features) return;

    const { type } = parseFeatureId(featureId);
    const updatedFeatures: UnifiedHoleFeatures = {
      trajectory: hole.features.trajectory,
      greens: [...hole.features.greens],
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

    courseCreatorActions.updateHole(holeNum, { features: updatedFeatures });
  };

  // UNIFIED EVENT HANDLERS
  const handleFeatureCreate = async (
    type: FeatureType,
    geometry: GeoJSON.Geometry,
    properties: any = {},
  ) => {
    createHoleFeature(
      courseCreatorState.selectedHoleNum,
      type,
      geometry,
      properties,
    );
    courseCreatorActions.setMapMode('view');
  };

  const handleFeatureUpdate = async (
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

    courseCreatorActions.updateHole(courseCreatorState.selectedHoleNum, {
      features: updatedFeatures,
    });
  };

  const handleFeatureDelete = (featureId: string) => {
    deleteHoleFeature(courseCreatorState.selectedHoleNum, featureId);
  };

  // // LEGACY HANDLERS (for backward compatibility with MapEditor)
  // const handleLegacyFeatureCreate = async (feature: GeoJSON.Feature) => {
  //   const type = (feature.properties?.type as FeatureType) || 'green';
  //   await handleFeatureCreate(type, feature.geometry, feature.properties);
  // };

  // const handleLegacyFeatureUpdate = async (feature: GeoJSON.Feature) => {
  //   if (feature.id) {
  //     await handleFeatureUpdate(feature.id as string, {
  //       geometry: feature.geometry,
  //       properties: feature.properties,
  //     });
  //   }
  // };

  // Effect to track hole changes for debugging
  createEffect(() => {
    const hole = currentHole();
    const features = mapEditorFeatures();
    // Track when holes change for feature redrawing
    if (hole) {
      console.log(
        `Switched to hole ${hole.holeNumber} with ${features.features.length + mapMarkers().length} features`,
      );
    }
  });

  const handlePublish = async () => {
    if (!confirm('Finish and publish this course? This cannot be undone.')) {
      return;
    }
    const _course = courseCreatorState.course;
    if (!_course?.id) return;
    try {
      courseCreatorActions.setLoading(true);
      await CourseStore.publish(_course.id);
      navigate('/');
    } catch (e) {
      console.error(e);
      alert('Failed to publish course. Please try again.');
    } finally {
      courseCreatorActions.setLoading(false);
    }
  };

  return (
    <div class="h-screen w-screen bg-golf-dark text-white flex flex-col overflow-hidden">
      <Switch>
        <Match when={courseCreatorState.loading}>
          <div class="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
            Loading...
          </div>
        </Match>

        <Match when={!courseCreatorState.loading && courseCreatorState.course}>
          <header class="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20">
            <div class="flex items-center gap-4">
              <div class="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded text-xs font-bold uppercase">
                Draft
              </div>
              <h1 class="font-bold text-white">
                {courseCreatorState.course!.name}
              </h1>
            </div>

            <button
              onClick={handlePublish}
              class="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
            >
              Finish & Publish
            </button>
          </header>

          {/* Error Banner */}
          <Show when={courseCreatorState.updateError}>
            {(error) => (
              <div class="bg-red-500/10 border-b border-red-500/20 p-4 flex items-center justify-between">
                <div class="flex items-start gap-3">
                  <div class="text-red-400 mt-0.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-red-400 font-bold text-sm">
                      Failed to Update Hole {error().holeNum}
                    </h3>
                    <p class="text-red-300 text-sm mt-1">{error().error}</p>
                    <div class="text-xs text-red-400 mt-2 space-y-1">
                      <div class="font-bold">Attempted Updates:</div>
                      {Object.entries(error().data).map(([key, value]) => (
                        <div class="pl-2">
                          <span class="font-mono text-red-300">{key}:</span>{' '}
                          {JSON.stringify(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    onClick={courseCreatorActions.retryHoleUpdate}
                    class="bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={courseCreatorActions.clearUpdateError}
                    class="text-red-400 hover:text-red-300 p-1 rounded transition-colors"
                    title="Dismiss error"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </Show>

          <div class="flex-1 flex overflow-hidden">
            <div class="w-80 bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
              <div class="p-4 flex justify-between items-start">
                <div>
                  <h2 class="text-2xl font-black text-white mb-1">
                    Hole {courseCreatorState.selectedHoleNum}
                  </h2>
                  <span class="text-slate-500 text-sm">
                    Edit details and map features
                  </span>
                </div>
              </div>
              <div class="p-4 grid grid-cols-6 gap-2">
                <For each={courseCreatorState.course!.holeDefinitions}>
                  {(hole) => (
                    <button
                      onClick={() => {
                        courseCreatorActions.setSelectedHoleNum(
                          hole.holeNumber ?? hole.handicap ?? 1,
                        );
                        courseCreatorActions.setMapMode('view');
                      }}
                      class={`aspect-square rounded-lg font-bold text-sm flex items-center justify-center transition-all ${
                        courseCreatorState.selectedHoleNum === hole.holeNumber
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
                mode={() => courseCreatorState.mapMode}
                drawMode={() => courseCreatorState.drawTool}
                center={
                  currentHole()?.lat && currentHole()?.lng
                    ? [currentHole()!.lng!, currentHole()!.lat!]
                    : [
                        courseCreatorState.course!.lng,
                        courseCreatorState.course!.lat,
                      ]
                }
                trajectory={currentTrajectory}
                markers={mapMarkers}
                features={mapEditorFeatures}
                courseId={courseCreatorState.course!.id}
                holeNumber={courseCreatorState.selectedHoleNum}
                getCurrentHoleMetadata={getCurrentHoleMetadata}
                onHoleStateRestore={handleHoleStateRestore}
                ref={(ref) => { mapEditorRef = ref; }}
                onLocationPick={handleLocationPick}
                onFeatureCreate={handleFeatureCreate}
                onFeatureUpdate={handleFeatureUpdate}
                onFeatureDelete={handleFeatureDelete}
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
                            onInput={async (e) =>
                              await updateHoleWithUndoSave(
                                courseCreatorState.selectedHoleNum,
                                {
                                  par: parseInt(e.currentTarget.value),
                                },
                              )
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
                            onInput={async (e) =>
                              await updateHoleWithUndoSave(
                                courseCreatorState.selectedHoleNum,
                                {
                                  handicap: parseInt(e.currentTarget.value),
                                },
                              )
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
                        courseCreatorActions.setPickContext({
                          type: 'pin',
                          position: 'front',
                        });
                        courseCreatorActions.setMapMode('pick_location');
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
                        courseCreatorActions.setPickContext({
                          type: 'pin',
                          position: 'middle',
                        });
                        courseCreatorActions.setMapMode('pick_location');
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
                        courseCreatorActions.setPickContext({
                          type: 'pin',
                          position: 'back',
                        });
                        courseCreatorActions.setMapMode('pick_location');
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
                          onClick={async () =>
                            await updateHoleWithUndoSave(
                              courseCreatorState.selectedHoleNum,
                              {
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
                              },
                            )
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
                              onChange={async (e) => {
                                const boxes = [
                                  ...(currentHole()?.tee_boxes || []),
                                ];
                                boxes[i()] = {
                                  ...(boxes[i()] || {}),
                                  color: e.currentTarget.value,
                                };
                                     await updateHoleWithUndoSave(
                                       courseCreatorState.selectedHoleNum,
                                       {
                                         tee_boxes: boxes,
                                       },
                                     );
                              }}
                            />
                            <input
                              class="input-field flex-1 text-sm py-1"
                              placeholder="Name (e.g. Blue)"
                              value={teeBox.name}
                              onChange={async (e) => {
                                const boxes = [
                                  ...(currentHole()?.tee_boxes || []),
                                ];
                                boxes[i()] = {
                                  ...(boxes[i()] || {}),
                                  name: e.currentTarget.value,
                                };
                                     await updateHoleWithUndoSave(
                                       courseCreatorState.selectedHoleNum,
                                       {
                                         tee_boxes: boxes,
                                       },
                                     );
                              }}
                            />
                            <button
                              onClick={async () => {
                                const boxes = [
                                  ...(currentHole()?.tee_boxes || []),
                                ];
                                boxes.splice(i(), 1);
                                     await updateHoleWithUndoSave(
                                       courseCreatorState.selectedHoleNum,
                                       {
                                         tee_boxes: boxes,
                                       },
                                     );
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
                                onChange={async (e) => {
                                  const boxes = [
                                    ...(currentHole()?.tee_boxes || []),
                                  ];

                                  if (!RegExp('^[0-9]+$').test) {
                                    return;
                                  }

                                  boxes[i()] = {
                                    ...(boxes[i()] || {}),
                                    yardage: parseInt(e.currentTarget.value),
                                  };
                                  await courseCreatorActions.updateHole(
                                    courseCreatorState.selectedHoleNum,
                                    {
                                      tee_boxes: boxes,
                                    },
                                  );
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
                                courseCreatorActions.setPickContext({
                                  type: 'tee_box',
                                  index: i(),
                                });
                                courseCreatorActions.setMapMode(
                                  'pick_location',
                                );
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
                        courseCreatorActions.setMapMode('draw');
                        courseCreatorActions.setDrawTool('polygon');
                      }}
                      class={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all ${courseCreatorState.mapMode === 'draw' && courseCreatorState.drawTool === 'polygon' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                    >
                      <span class="font-bold text-sm">Draw Green Shape</span>
                      <div
                        class={`w-3 h-3 rounded-full ${currentHole()?.features?.greens?.length ? 'bg-emerald-400' : 'bg-slate-600'}`}
                      />
                    </button>

                    <button
                      onClick={() => {
                        const trajectory = currentHole()?.features?.trajectory;
                        if (
                          trajectory &&
                          courseCreatorState.mapMode !== 'draw'
                        ) {
                          // If trajectory exists and not in draw mode, delete it
                          if (confirm('Delete the existing trajectory?')) {
                            deleteHoleFeature(
                              courseCreatorState.selectedHoleNum,
                              trajectory.id,
                            );
                          }
                        } else {
                          // Otherwise, enter draw mode to create/edit trajectory
                          courseCreatorActions.setMapMode('draw');
                          courseCreatorActions.setDrawTool('trajectory');
                        }
                      }}
                      class={`w-full py-3 px-4 rounded-xl flex items-center justify-between transition-all ${courseCreatorState.mapMode === 'draw' && courseCreatorState.drawTool === 'trajectory' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : currentHole()?.features?.trajectory ? 'bg-slate-800 hover:bg-red-900/50 text-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                    >
                      <span class="font-bold text-sm">
                        {currentHole()?.features?.trajectory &&
                        courseCreatorState.mapMode !== 'draw'
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
        </Match>
      </Switch>
    </div>
  );
}
