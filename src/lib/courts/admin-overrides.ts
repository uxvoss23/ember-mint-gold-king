import { create } from "zustand";
import { persist } from "zustand/middleware";
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
  setFields: (courtId: string, fields: CourtFieldOverride) => void;
  setPreview: (courtId: string, dataUrl: string | undefined) => void;
  addGalleryPhoto: (courtId: string, dataUrl: string) => void;
  addGalleryPhotos: (courtId: string, dataUrls: string[]) => void;
  replaceGalleryPhoto: (courtId: string, index: number, dataUrl: string) => void;
  removeGalleryPhoto: (courtId: string, index: number) => void;
  setGallery: (courtId: string, gallery: string[]) => void;
  clearOverride: (courtId: string) => void;
}

function patch(
  overrides: Record<string, CourtAdminOverride>,
  courtId: string,
  next: Partial<CourtAdminOverride>,
): Record<string, CourtAdminOverride> {
  const prev = overrides[courtId] ?? {};
  return {
    ...overrides,
    [courtId]: {
      ...prev,
      ...next,
      photos: next.photos ?? prev.photos,
      updatedAt: new Date().toISOString(),
    },
  };
}

export const useCourtAdmin = create<CourtAdminState>()(
  persist(
    (set, get) => ({
      overrides: {},
      setFields: (courtId, fields) =>
        set((s) => ({
          overrides: patch(s.overrides, courtId, fields),
        })),
      setPreview: (courtId, dataUrl) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { ...prev, preview: dataUrl, gallery: prev.gallery ?? [] },
          }),
        }));
      },
      addGalleryPhoto: (courtId, dataUrl) => {
        get().addGalleryPhotos(courtId, [dataUrl]);
      },
      addGalleryPhotos: (courtId, dataUrls) => {
        if (!dataUrls.length) return;
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: {
              preview: prev.preview,
              gallery: [...(prev.gallery ?? []), ...dataUrls],
            },
          }),
        }));
      },
      replaceGalleryPhoto: (courtId, index, dataUrl) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        const gallery = [...(prev.gallery ?? [])];
        if (index < 0 || index >= gallery.length) return;
        gallery[index] = dataUrl;
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { preview: prev.preview, gallery },
          }),
        }));
      },
      removeGalleryPhoto: (courtId, index) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        const gallery = (prev.gallery ?? []).filter((_, i) => i !== index);
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { preview: prev.preview, gallery },
          }),
        }));
      },
      setGallery: (courtId, gallery) => {
        const prev = get().overrides[courtId]?.photos ?? { gallery: [] };
        set((s) => ({
          overrides: patch(s.overrides, courtId, {
            photos: { preview: prev.preview, gallery },
          }),
        }));
      },
      clearOverride: (courtId) =>
        set((s) => {
          const { [courtId]: _, ...rest } = s.overrides;
          return { overrides: rest };
        }),
    }),
    {
      name: "upset-court-admin-v1",
      // Drop huge blobs if storage balloons — keep last-write overrides
      partialize: (s) => ({ overrides: s.overrides }),
    },
  ),
);

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
