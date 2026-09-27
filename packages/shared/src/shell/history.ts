export interface HistoryState {
  entries: string[];
  cursor: number | null;
  draft: string;
}

export const HISTORY_LIMIT = 100;

export function empty(): HistoryState {
  return { entries: [], cursor: null, draft: '' };
}

export function push(state: HistoryState, line: string): HistoryState {
  if (!line.trim() || state.entries.at(-1) === line) return state;
  return { entries: [...state.entries, line].slice(-HISTORY_LIMIT), cursor: null, draft: '' };
}

export function up(state: HistoryState, current: string): HistoryState {
  if (!state.entries.length) return state;
  if (state.cursor === null) return { ...state, cursor: state.entries.length - 1, draft: current };
  return { ...state, cursor: Math.max(0, state.cursor - 1) };
}

export function down(state: HistoryState): HistoryState {
  if (state.cursor === null) return state;
  if (state.cursor === state.entries.length - 1) return { ...state, cursor: null };
  return { ...state, cursor: state.cursor + 1 };
}

export const history = { empty, push, up, down, HISTORY_LIMIT };
