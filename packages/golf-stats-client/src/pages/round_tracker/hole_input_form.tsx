import { Show } from 'solid-js';
import { ApproachInput } from '~/components/approach_input';
import { ClubSelector } from '~/components/club_selector';
import { FairwayInput } from '~/components/fairway_input';
import { HoleMap } from '~/components/hole_map';
import { PuttInput } from '~/components/putt_input';
import { RecoveryInput } from '~/components/recovery_input';
import { ScoreInput } from '~/components/score_input';

export const HoleInputForm = (props: any) => {
  return (
    <div class="flex-1 flex flex-col pb-8">
      {/* Header */}
      <div class="bg-slate-900/80 backdrop-blur-md p-4 sticky top-0 z-10 border-b border-white/5">
        <div class="max-w-md mx-auto flex justify-between items-center">
          <div class="flex items-center gap-3">
            <button
              onClick={props.onEndRound}
              class="w-8 h-8 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
              title="End Round"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <div>
              <h2 class="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                {props.tracker.step === 'edit' ? 'Editing ' : ''}Hole{' '}
                {props.round.currentHoleNum}
              </h2>
              <span class="text-white font-semibold truncate max-w-[200px] block">
                {props.round.courseName}
              </span>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-400 block">Total</span>
            <span class="font-mono font-bold text-white text-lg">
              {props.round.holes.reduce((acc: number, h: any) => acc + h.score, 0) +
                (props.holeInput.score - props.holeInput.par)}
            </span>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div class="flex justify-center my-4 gap-2">
        <button
          onClick={() => props.setTracker('inputViewMode', 'score')}
          class={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            props.tracker.inputViewMode === 'score'
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Score
        </button>
        <button
          onClick={() => props.setTracker('inputViewMode', 'map')}
          class={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            props.tracker.inputViewMode === 'map'
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          Map
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-6">
        <Show when={props.tracker.inputViewMode === 'map'}>
          <HoleMap
            holeDef={
              props.round.holeDefinitions.find(
                (h: any) => h.holeNumber === props.round.currentHoleNum,
              ) || null
            }
            userLat={props.tracker.userLat}
            userLng={props.tracker.userLng}
          />
        </Show>

        <Show when={props.tracker.inputViewMode === 'score'}>
          <div class="card p-0 overflow-hidden bg-transparent border-none shadow-none">
            <div class="flex justify-between items-baseline mb-2 px-1">
              <label class="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Club Sequence
              </label>
              <span class="text-[10px] text-slate-500 font-mono">
                {props.holeInput.selectedClubs.map((c: any) => c.name).join(' → ')}
              </span>
            </div>
            <ClubSelector
              clubs={props.clubs}
              selectedClubs={props.holeInput.selectedClubs}
              onClubSelect={props.addClubToHole}
            />
          </div>

          <ScoreInput
            par={() => props.holeInput.par}
            setPar={(v) =>
              props.setHoleInput(
                'par',
                typeof v === 'function' ? v(props.holeInput.par) : v,
              )
            }
            score={() => props.holeInput.score}
            setScore={(v) =>
              props.setHoleInput(
                'score',
                typeof v === 'function' ? v(props.holeInput.score) : v,
              )
            }
          />

          <Show when={props.holeInput.par > 3}>
            <FairwayInput
              status={() => props.holeInput.fairwayStatus}
              setStatus={(v) =>
                props.setHoleInput(
                  'fairwayStatus',
                  typeof v === 'function'
                    ? v(props.holeInput.fairwayStatus)
                    : v,
                )
              }
            />
          </Show>

          <ApproachInput
            girStatus={() => props.holeInput.girStatus}
            setGirStatus={(v) =>
              props.setHoleInput(
                'girStatus',
                typeof v === 'function' ? v(props.holeInput.girStatus) : v,
              )
            }
            proximity={() => props.holeInput.proximity}
            setProximity={(v) =>
              props.setHoleInput(
                'proximity',
                typeof v === 'function' ? v(props.holeInput.proximity) : v,
              )
            }
          />

          <RecoveryInput
            fairwayBunker={() => props.holeInput.fairwayBunker}
            setFairwayBunker={(v) =>
              props.setHoleInput(
                'fairwayBunker',
                typeof v === 'function' ? v(props.holeInput.fairwayBunker) : v,
              )
            }
            greensideBunker={() => props.holeInput.greensideBunker}
            setGreensideBunker={(v) =>
              props.setHoleInput(
                'greensideBunker',
                typeof v === 'function'
                  ? v(props.holeInput.greensideBunker)
                  : v,
              )
            }
          />

          <PuttInput
            putts={() => props.holeInput.putts}
            setPutts={(v) =>
              props.setHoleInput(
                'putts',
                typeof v === 'function' ? v(props.holeInput.putts) : v,
              )
            }
          />
        </Show>
      </div>

      {/* Footer */}
      <Show when={props.tracker.step === 'playing'}>
        <div class="p-4 bg-gradient-to-t from-golf-dark to-transparent sticky bottom-0 z-20 flex gap-3">
          <Show when={props.round.currentHoleNum > 1}>
            <button
              onClick={props.prevHole}
              class="w-1/3 bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-bold text-lg shadow-xl active:scale-[0.98] transition-all flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414-1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </Show>
          <button
            onClick={props.saveHole}
            class="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>Next Hole</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      </Show>

      <Show when={props.tracker.step === 'edit'}>
        <div class="p-4 bg-gradient-to-t from-golf-dark to-transparent sticky bottom-0 z-20 flex gap-3">
          <button
            onClick={props.handleCancelEdit}
            class="w-1/3 bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl font-bold text-lg shadow-xl active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={props.saveEditedHole}
            class="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white p-4 rounded-xl font-bold text-lg shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all"
          >
            Save Changes
          </button>
        </div>
      </Show>
    </div>
  );
};
