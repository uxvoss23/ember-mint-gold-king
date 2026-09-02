import { useEffect } from "react";
import { create } from "zustand";
import type { Court, CourtAmenity, CourtSurface } from "@/lib/courts/types";
import { isAdminEmail } from "@/lib/auth/admin";

export interface CourtPhotoState {
  /** Dedicated first image on cards / carousel */
  preview?: string;
  /** Additional gallery images (not including preview) */
  gallery: string[];
}

export interface CourtFieldOverride {
  name?: string;
  address?: string;
  neighborhood?: string;
  notes?: string;
  surface?: CourtSurface;
  hoops?: number;
  amenities?: CourtAmenity[];
  lightsHours?: string;
  hours?: string;
}

export interface CourtAdminOverride extends CourtFieldOverride {
  photos?: CourtPhotoState;
  updatedAt?: string;
}

interface CourtAdminState {
  overrides: Record<string, CourtAdminOverride>;
  setFields: (courtId: string, fields: CourtFieldOverride) => Promise<void>;
  setPreview: (courtId: string, dataUrl: string | undefined) => Promise<void>;
  addGalleryPhoto: (courtId: string, dataUrl: string) => Promise<void>;
  addGalleryPhotos: (courtId: string, dataUrls: string[]) => Promise<void>;
  replaceGalleryPhoto: (courtId: string, index: number, dataUrl: string) => Promise<void>;
  removeGalleryPhoto: (courtId: string, index: number) => Promise<void>;
  setGallery: (courtId: string, gallery: string[]) => Promise<void>;
  clearOverride: (courtId: string) => Promise<void>;
}

function applyOverrides(overrides: Record<string, CourtAdminOverride>) {
  useCourtAdmin.setState({ overrides });
}

export async function refreshCourtAdmin() {
  const { listCourtOverridesFn } = await import("@/lib/courts/court-admin-fns");
  applyOverrides(await listCourtOverridesFn());
}

export const useCourtAdmin = create<CourtAdminState>()((set, get) => ({
  overrides: {},
  setFields: async (courtId, fields) => {
    const { upsertCourtFieldsFn } = await import("@/lib/courts/court-admin-fns");
    applyOverrides(await upsertCourtFieldsFn({ data: { courtId, fields } }));
  },
  setPreview: async (courtId, dataUrl) => {
    const { setCourtPreviewFn } = await import("@/lib/courts/court-admin-fns");
    applyOverrides(
      await setCourtPreviewFn({ data: { courtId, photoUrl: dataUrl ?? null } }),
    );
  },
  addGalleryPhoto: async (courtId, dataUrl) => {
    await get().addGalleryPhotos(courtId, [dataUrl]);
  },
  addGalleryPhotos: async (courtId, dataUrls) => {
    if (!dataUrls.length) return;
    const { addCourtGalleryPhotosFn } = await import("@/lib/courts/court-admin-fns");
    applyOverrides(
      await addCourtGalleryPhotosFn({ data: { courtId, photos: dataUrls } }),
    );
  },
  replaceGalleryPhoto: async (courtId, index, dataUrl) => {
    const { replaceCourtGalleryPhotoFn } = await import("@/lib/courts/court-admin-fns");
    applyOverrides(
      await replaceCourtGalleryPhotoFn({
        data: { courtId, index, photoUrl: dataUrl },
      }),
    );
  },
  removeGalleryPhoto: async (courtId, index) => {
    const { removeCourtGalleryPhotoFn } = await import("@/lib/courts/court-admin-fns");
    applyOverrides(await removeCourtGalleryPhotoFn({ data: { courtId, index } }));
  },
  setGallery: async () => {
    /* unused — gallery is edited per photo */
  },
  clearOverride: async () => {
    /* unused */
  },
}));

export function useHydrateCourtAdmin() {
  useEffect(() => {
    void refreshCourtAdmin().catch(() => {
      /* empty until first admin save */
    });
  }, []);
}

export function mergeCourtWithOverride(
  court: Court,
  ov?: CourtAdminOverride,
): Court {
  if (!ov) return court;
  return {
    ...court,
    name: ov.name ?? court.name,
    address: ov.address ?? court.address,
    neighborhood: ov.neighborhood ?? court.neighborhood,
    notes: ov.notes ?? court.notes,
    surface: ov.surface ?? court.surface,
    hoops: ov.hoops ?? court.hoops,
    amenities: ov.amenities ?? court.amenities,
    lightsHours: ov.lightsHours ?? court.lightsHours,
    hours: ov.hours ?? court.hours,
  };
}

export { isAdminEmail };
