'use client';

import { createContext, useContext } from 'react';

/** Nama user yang sedang login, dicetak pada stempel foto kamera. Diisi AppShell. */
const Ctx = createContext('');
export const NamaPengunggahProvider = Ctx.Provider;
export const useNamaPengunggah = () => useContext(Ctx);
