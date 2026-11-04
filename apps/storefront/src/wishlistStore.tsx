import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { recordEvent } from './api';
import {
  loadWishlist,
  removeFromWishlist,
  saveWishlist,
  toggleWishlist,
  WISHLIST_KEY,
  parseWishlist,
  type WishlistEntry,
  type WishlistStorage,
} from './wishlist';

/** Result of one save / unsave tap. */
export type ToggleResult = {
  /** Saved after the tap. */
  on: boolean;
  /** False when the change could not be written to the device (it still applies now). */
  persisted: boolean;
  /** The list is full, nothing was saved. */
  full: boolean;
};

type Wishlist = {
  entries: WishlistEntry[];
  count: number;
  has: (id: string) => boolean;
  toggle: (product: { id: string; name?: string }) => ToggleResult;
  remove: (id: string) => boolean;
  /**
   * Set for a few seconds after a tap that could not be completed as asked: the write to
   * the device failed (`saveFailed`) or the list is full (`full`). An i18n key under
   * `wishlist.`; `id` changes on every notice so the same one can show again.
   */
  notice: { id: number; key: 'saveFailed' | 'full' } | null;
};

const WishlistContext = createContext<Wishlist | null>(null);

function storage(): WishlistStorage | null {
  try {
    return (globalThis as any)?.localStorage ?? null;
  } catch {
    return null; // access itself can throw when site data is blocked
  }
}

/**
 * The one wishlist store (YAN-111). The Discover Save button, product card hearts, the
 * product page, the header count and the Wishlist screen all read it, so a change in one
 * place shows everywhere in the same render.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<WishlistEntry[]>(() => loadWishlist(storage()));
  const [notice, setNotice] = useState<Wishlist['notice']>(null);
  const say = useCallback((key: 'saveFailed' | 'full') => setNotice({ id: Date.now(), key }), []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);
  // Taps read and write this ref, so rapid repeated taps never work from a stale render.
  const ref = useRef(entries);

  const commit = useCallback(
    (next: WishlistEntry[]): boolean => {
      ref.current = next;
      setEntries(next);
      const ok = saveWishlist(storage(), next);
      if (!ok) say('saveFailed');
      return ok;
    },
    [say],
  );

  const toggle = useCallback(
    (product: { id: string; name?: string }): ToggleResult => {
      const { next, on, full } = toggleWishlist(ref.current, product, Date.now());
      if (full) {
        say('full');
        return { on: false, persisted: true, full };
      }
      const persisted = commit(next);
      recordEvent(product.id, on ? 'save' : 'unsave');
      return { on, persisted, full };
    },
    [commit, say],
  );

  const remove = useCallback(
    (id: string): boolean => {
      if (!ref.current.some((e) => e.id === id)) return true;
      const persisted = commit(removeFromWishlist(ref.current, id));
      recordEvent(id, 'unsave');
      return persisted;
    },
    [commit],
  );

  // Another tab changed the wishlist: follow it (web only).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== WISHLIST_KEY && e.key !== null) return;
      const next = parseWishlist(e.key === null ? null : e.newValue);
      ref.current = next;
      setEntries(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<Wishlist>(() => {
    const ids = new Set(entries.map((e) => e.id));
    return {
      entries,
      count: entries.length,
      has: (id) => ids.has(id),
      toggle,
      remove,
      notice,
    };
  }, [entries, toggle, remove, notice]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): Wishlist {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>');
  return ctx;
}
