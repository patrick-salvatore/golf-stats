import { createStore } from 'solid-js/store';
import { type LocalCourse, CourseStore } from '~/lib/stores';
import {
  MapMode,
  DrawTool,
  EnhancedHole,
  UnifiedHoleFeatures,
} from './types';

export type BuilderStep = 'init' | 'builder';

// Use EnhancedHole for centralized feature management but with proper HoleDefinition interface
export type Hole = Omit<EnhancedHole, 'features'> & {
  features?: UnifiedHoleFeatures;
};

export type PickContext =
  | { type: 'tee_box'; index: number }
  | { type: 'pin'; position: 'front' | 'middle' | 'back' }
  | null;

export type UpdateError = {
  holeNum: number;
  data: Partial<Hole>;
  error: string;
  timestamp: number;
} | null;

export interface CourseCreatorState {
  loading: boolean;
  course: LocalCourse | null;
  selectedHoleNum: number;
  mapMode: MapMode;
  drawTool: DrawTool;
  pickContext: PickContext;
  updateError: UpdateError;
}

const initialState: CourseCreatorState = {
  loading: false,
  course: null,
  selectedHoleNum: 1,
  mapMode: 'view',
  drawTool: 'polygon',
  pickContext: null,
  updateError: null,
};

export const [courseCreatorState, setCourseCreatorState] = createStore<CourseCreatorState>(initialState);

// Store actions
export const courseCreatorActions = {

  setLoading: (loading: boolean) => {
    setCourseCreatorState('loading', loading);
  },

  setCourse: (course: LocalCourse | null) => {
    setCourseCreatorState('course', course);
  },

  setSelectedHoleNum: (holeNum: number) => {
    setCourseCreatorState('selectedHoleNum', holeNum);
  },

  setMapMode: (mode: MapMode) => {
    setCourseCreatorState('mapMode', mode);
  },

  setDrawTool: (tool: DrawTool) => {
    setCourseCreatorState('drawTool', tool);
  },

  setPickContext: (context: PickContext) => {
    setCourseCreatorState('pickContext', context);
  },

  setUpdateError: (error: UpdateError) => {
    setCourseCreatorState('updateError', error);
  },

  clearUpdateError: () => {
    setCourseCreatorState('updateError', null);
  },

  // Complex update operations
  updateHoleInCourse: (holeNum: number, data: Partial<Hole>) => {
    const course = courseCreatorState.course;
    if (!course) return;

    const holes = course.holeDefinitions.map((h) => {
      if (h.holeNumber === holeNum) {
        const updated = { ...h, ...data };
        // Keep features in sync
        if (data.features) {
          updated.features = data.features;
        }
        return updated;
      }
      return h;
    });

    setCourseCreatorState('course', { ...course, holeDefinitions: holes });
  },

  // Async update with error handling
  updateHole: async (holeNum: number, data: Partial<Hole>) => {
    const course = courseCreatorState.course;
    if (!course) return;

    // Clear any previous errors for this hole
    if (courseCreatorState.updateError?.holeNum === holeNum) {
      setCourseCreatorState('updateError', null);
    }

    // Update local state immediately
    courseCreatorActions.updateHoleInCourse(holeNum, data);

    // Persist to storage
    if (course.id) {
      const persistData = data.features
        ? { ...data, features: data.features }
        : data;

      try {
        await CourseStore.upsertHole(course.id, holeNum, persistData as any);
      } catch (error) {
        console.error('Failed to update hole:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setCourseCreatorState('updateError', {
          holeNum,
          data,
          error: errorMessage,
          timestamp: Date.now()
        });
      }
    }
  },

  retryHoleUpdate: async () => {
    const error = courseCreatorState.updateError;
    if (!error) return;

    setCourseCreatorState('updateError', null);
    await courseCreatorActions.updateHole(error.holeNum, error.data);
  },

  // Reset the entire state
  reset: () => {
    setCourseCreatorState(initialState);
  },
};