export type Destination = { kind: "choice" | "ending" | "unknown"; id: string };
export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { choiceId: string; optionId: string }
  | { endingId: string }
  | { flag: string; equals: boolean }
  | { counter: string; atLeast: number };
export interface Pack {
  schemaVersion: string;
  id: string;
  revision: number;
  synthetic: boolean;
  status: string;
  notes?: string[];
  game: { id: string; title: string; aliases: string[] };
  release: { id: string; label: string; locale: string };
  sources: {
    id: string;
    kind: string;
    reference: string;
    permission: string;
  }[];
  routes: {
    id: string;
    safeLabel: string;
    entryChoiceId: string;
    requiredEndingIds: string[];
  }[];
  choices: {
    id: string;
    kind?: "choice" | "instruction";
    orderKnown?: boolean;
    optionsComplete?: boolean;
    locator: string;
    prompt: string;
    skipTo?: Destination;
    options: { id: string; text: string; next: Destination }[];
    rules: {
      routeId: string;
      when: Condition;
      recommendedOptionIds: string[];
      sourceId: string;
      sourceLocator: string;
    }[];
  }[];
  endings: {
    id: string;
    safeLabel: string;
    hiddenTitle: string;
    spoilerLevel: number;
  }[];
  reviews: {
    reviewer: string;
    date: string;
    routeIds: string[];
    evidence: string;
    method?: string;
  }[];
}
export interface Session {
  id: string;
  packId: string;
  revision: number;
  releaseId: string;
  routeId: string;
  initialEndingIds: string[];
  events: { choiceId: string; optionId: string; at: string }[];
  completed: boolean;
  startedAt: string;
  updatedAt: string;
}
export interface Library {
  format: string;
  version: number;
  packs: Pack[];
  sessions: Session[];
  completed: { packKey: string; endingId: string; at: string }[];
  favorites?: SavedRoute[];
  visits?: SavedRoute[];
  bookmarks?: (SavedRoute & { choiceId: string })[];
}
export interface SavedRoute {
  packKey: string;
  routeId: string;
  at: string;
}
export interface Draft {
  gameId: string;
  title: string;
  release: string;
  route: string;
  source: string;
  permission: string;
  ending: string;
  steps: {
    id: string;
    locator: string;
    prompt: string;
    options: string[];
    recommended: number;
  }[];
}
