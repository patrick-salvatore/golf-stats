import { createSignal } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { CourseStore } from '~/lib/stores';
import GooglePlacesAutocomplete from './google_places_autocomplete';
import MapEditor from './map_editor';
import { MapMode } from './types';

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

type InitFormData = {
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
};

const DEFAULT_HOLES = Array.from({ length: 18 }, (_, i) => ({
  holeNumber: i + 1,
  par: 4,
  handicap: i + 1,
  lat: 0,
  lng: 0,
}));

export default function CreateCourseForm() {
  const navigate = useNavigate();
  
  const [loading, setLoading] = createSignal(false);
  const [mapMode] = createSignal<MapMode>('view');
  
  const [initForm, setInitForm] = createSignal<InitFormData>({
    name: '',
    city: 'Augusta',
    state: 'GA',
    lat: 33.5021,
    lng: -82.0226,
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



  const handleSubmit = async () => {
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
          geo_features: undefined,
          tee_boxes: undefined,
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

  return (
    <div class="h-screen w-screen bg-golf-dark text-white flex flex-col overflow-hidden">
      <div class="flex-1 relative">
        <div class="absolute inset-0 z-0">
          <MapEditor
            mode={mapMode}
            onLocationPick={() => null}
            center={[initForm().lng, initForm().lat]}
            features={() => ({ type: 'FeatureCollection', features: [] })}
            trajectory={() => null}
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
              onClick={handleSubmit}
              disabled={loading() || !initForm().name}
              class="w-full btn-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading() ? 'Creating...' : 'Start Building'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}