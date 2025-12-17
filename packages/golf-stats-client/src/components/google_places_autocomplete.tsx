import { onMount, createSignal } from 'solid-js';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

interface PlaceResult {
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

interface Props {
  apiKey: string;
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  class?: string;
}

export default function GooglePlacesAutocomplete(props: Props) {
  let containerRef: HTMLDivElement | undefined;
  const [error, setError] = createSignal('');

  onMount(async () => {
    if (!props.apiKey) {
      setError('Google Maps API Key is missing');
      return;
    }

    try {
      setOptions({
        key: props.apiKey,
        v: 'weekly',
      });

      // Import the library - Note: PlaceAutocompleteElement is in 'places' library
      const { PlaceAutocompleteElement } = await importLibrary('places') as any;

      if (!containerRef || !PlaceAutocompleteElement) return;

      // Create the element
      const autocomplete = new PlaceAutocompleteElement();
      
      // Attempt to style it to match the app theme somewhat
      // Using direct style properties since it's a web component
      autocomplete.style.width = '100%';
      autocomplete.style.backgroundColor = '#1e293b'; // slate-800
      autocomplete.style.borderRadius = '0.5rem';
      
      // Append to container
      containerRef.innerHTML = ''; // Clear loading/input
      containerRef.appendChild(autocomplete);

      // Event Listener
      autocomplete.addEventListener('gmp-select', async ({ placePrediction }: any) => {
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ['displayName', 'location', 'addressComponents'] });

        if (!place.location) return;

        let city = '';
        let state = '';

        place.addressComponents?.forEach((component: any) => {
          if (component.types.includes('locality')) {
            city = component.longText || component.shortText;
          }
          if (component.types.includes('administrative_area_level_1')) {
            state = component.shortText;
          }
        });

        props.onPlaceSelect({
          name: place.displayName || '',
          city,
          state,
          lat: place.location.lat(),
          lng: place.location.lng(),
        });
      });

    } catch (err) {
      console.error('Google Maps Load Error:', err);
      setError('Failed to load Google Maps');
    }
  });

  return (
    <div class="w-full relative">
      <div ref={containerRef} class={props.class}>
        {/* Placeholder while loading */}
        <input 
            type="text" 
            class="w-full bg-transparent border-none outline-none text-white placeholder-slate-400"
            placeholder={props.placeholder || 'Loading maps...'}
            disabled
        />
      </div>
      {error() && (
        <div class="text-red-400 text-xs mt-1 absolute">{error()}</div>
      )}
    </div>
  );
}
