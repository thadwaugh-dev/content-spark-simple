export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface Generation {
  id: string;
  topic: string;
  createdAt: string;
  captions: string[];
  threads: string[];
  hashtags: string[];
  videoHook: string;
}

export interface Usage {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface AppState {
  user: User | null;
  isPro: boolean;
  generations: Generation[];
  favorites: string[]; // ids of favorited generations
  usage: Usage;
}
