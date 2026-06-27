import { User, Generation, Usage, AppState } from './types';

const KEYS = {
  USER: 'contentspark_user',
  PRO: 'contentspark_pro',
  GENERATIONS: 'contentspark_generations',
  FAVORITES: 'contentspark_favorites',
  USAGE: 'contentspark_usage',
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function loadUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEYS.USER);
  return raw ? JSON.parse(raw) : null;
}

export function saveUser(user: User) {
  localStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export function loadIsPro(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEYS.PRO) === 'true';
}

export function saveIsPro(isPro: boolean) {
  localStorage.setItem(KEYS.PRO, isPro.toString());
}

export function loadGenerations(): Generation[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(KEYS.GENERATIONS);
  return raw ? JSON.parse(raw) : [];
}

export function saveGenerations(generations: Generation[]) {
  localStorage.setItem(KEYS.GENERATIONS, JSON.stringify(generations));
}

export function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(KEYS.FAVORITES);
  return raw ? JSON.parse(raw) : [];
}

export function saveFavorites(favIds: string[]) {
  localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favIds));
}

export function loadUsage(): Usage {
  if (typeof window === 'undefined') {
    return { date: getToday(), count: 0 };
  }
  const raw = localStorage.getItem(KEYS.USAGE);
  const today = getToday();
  
  if (!raw) {
    const fresh = { date: today, count: 0 };
    localStorage.setItem(KEYS.USAGE, JSON.stringify(fresh));
    return fresh;
  }
  
  const parsed: Usage = JSON.parse(raw);
  
  // Reset if new day
  if (parsed.date !== today) {
    const reset = { date: today, count: 0 };
    localStorage.setItem(KEYS.USAGE, JSON.stringify(reset));
    return reset;
  }
  
  return parsed;
}

export function saveUsage(usage: Usage) {
  localStorage.setItem(KEYS.USAGE, JSON.stringify(usage));
}

export function canGenerate(isPro: boolean, usage: Usage): boolean {
  if (isPro) return true;
  return usage.count < 5;
}

export function incrementUsage(): Usage {
  const current = loadUsage();
  const newUsage = { ...current, count: current.count + 1 };
  saveUsage(newUsage);
  return newUsage;
}

export function createDemoUser(): User {
  return {
    id: 'demo-' + Date.now(),
    email: 'demo@contentspark.com',
    name: 'Demo User',
    createdAt: new Date().toISOString(),
  };
}

export function createUserFromEmail(email: string, name?: string): User {
  return {
    id: 'user-' + Date.now(),
    email: email.toLowerCase().trim(),
    name: name || email.split('@')[0],
    createdAt: new Date().toISOString(),
  };
}

// Helper to get full app state
export function loadFullState(): AppState {
  return {
    user: loadUser(),
    isPro: loadIsPro(),
    generations: loadGenerations(),
    favorites: loadFavorites(),
    usage: loadUsage(),
  };
}
