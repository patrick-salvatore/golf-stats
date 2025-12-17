import { createSignal, createEffect, Show, For } from 'solid-js';
import { A, useNavigate } from '@solidjs/router';
import * as courseApi from '~/api/courses';
import { db } from '~/lib/db';

type Course = {
  id: number;
  name: string;
  city: string;
  state: string;
  status: 'draft' | 'published';
};

export default function CourseManager() {
  const navigate = useNavigate();
  const [courses, setCourses] = createSignal<Course[]>([]);
  const [loading, setLoading] = createSignal(true);

  createEffect(async () => {
    try {
      const data = await courseApi.getMyCourses();
      setCourses(data as Course[]);
    } catch (e) {
      console.error('Failed to load courses', e);
    } finally {
      setLoading(false);
    }
  });

  const drafts = () => courses().filter(c => c.status === 'draft');
  const published = () => courses().filter(c => c.status === 'published');

  const handleDeleteCourse = async (course: Course, event: Event) => {
    event.stopPropagation(); // Prevent navigation when clicking delete
    
    if (!confirm(`Are you sure you want to delete "${course.name}"?`)) {
      return;
    }

    try {
      if (course.status === 'draft') {
        // Draft courses: delete from IndexedDB only
        await db.courses.where('id').equals(course.id).delete();
        // Also delete related hole definitions
        await db.hole_definitions.where('courseId').equals(course.id).delete();
      } else {
        // Published courses: delete from both DB and IndexedDB
        await courseApi.deleteCourse(course.id);
        await db.courses.where('serverId').equals(course.id).delete();
        // Also delete related hole definitions
        await db.hole_definitions.where('courseId').equals(course.id).delete();
      }

      // Update the local state to remove the deleted course
      setCourses(courses().filter(c => c.id !== course.id));
    } catch (error) {
      console.error('Failed to delete course:', error);
      alert('Failed to delete course. Please try again.');
    }
  };

  return (
    <div class="min-h-screen bg-golf-dark text-white p-6 pb-20">
      <header class="mb-8">
        <div class="flex items-center justify-between mb-2">
            <h1 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
            Course Manager
            </h1>
            <A href="/" class="text-sm font-bold text-slate-400 hover:text-white">Back</A>
        </div>
        <p class="text-slate-400 font-medium">Create and manage your courses.</p>
      </header>

      <div class="mb-8">
        <A
          href="/courses/new"
          class="w-full bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-900/40 flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create New Course
        </A>
      </div>

      <Show when={!loading()} fallback={<div class="text-center text-slate-500 animate-pulse">Loading...</div>}>
        <div class="space-y-8">
          <section>
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              Drafts
            </h2>
            <div class="space-y-3">
              <Show when={drafts().length > 0} fallback={<p class="text-slate-500 text-sm italic">No drafts in progress.</p>}>
                <For each={drafts()}>
                  {(course) => (
                    <div 
                        class="bg-slate-800 p-4 rounded-xl border border-slate-700 cursor-pointer hover:border-emerald-500/50 transition-colors"
                        onClick={() => navigate(`/courses/${course.id}/edit`)}
                    >
                      <div class="flex justify-between items-center">
                        <div>
                          <h3 class="font-bold text-white text-lg">{course.name || 'Untitled Course'}</h3>
                          <p class="text-slate-400 text-sm">{course.city}, {course.state}</p>
                        </div>
                        <div class="flex items-center gap-3">
                          <div class="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full text-xs font-bold uppercase">
                            Continue
                          </div>
                          <button
                            class="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-red-500/10 transition-colors"
                            onClick={(e) => handleDeleteCourse(course, e)}
                            title="Delete course"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <section>
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              Published
            </h2>
            <div class="space-y-3">
              <Show when={published().length > 0} fallback={<p class="text-slate-500 text-sm italic">No published courses yet.</p>}>
                <For each={published()}>
                  {(course) => (
                    <div 
                        class="bg-slate-800 p-4 rounded-xl border border-slate-700 cursor-pointer hover:border-emerald-500/50 transition-colors"
                        onClick={() => navigate(`/courses/${course.id}/edit`)}
                    >
                      <div class="flex justify-between items-center">
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-bold text-white text-lg">{course.name}</h3>
                                <span class="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">Live</span>
                            </div>
                          <p class="text-slate-400 text-sm">{course.city}, {course.state}</p>
                        </div>
                        <div class="flex items-center gap-3">
                          <div class="text-slate-500">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                          </div>
                          <button
                            class="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-red-500/10 transition-colors"
                            onClick={(e) => handleDeleteCourse(course, e)}
                            title="Delete course"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>
        </div>
      </Show>
    </div>
  );
}
