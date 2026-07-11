import React, { createContext, useCallback, useContext, useState } from 'react';

/**
 * SearchContext — global open/close state for the CommandPalette.
 *
 * Kept intentionally minimal: just `open`, `openPalette`, `closePalette`,
 * `togglePalette`. Any component (Navbar's search icon, keyboard binding
 * at the app root) can drive the palette without prop drilling.
 *
 * The palette itself lives high in the component tree (App.jsx) so a
 * single instance handles every open request.
 */
const SearchContext = createContext(null);

export const SearchProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((v) => !v), []);

  return (
    <SearchContext.Provider value={{ open, openPalette, closePalette, togglePalette }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
};
