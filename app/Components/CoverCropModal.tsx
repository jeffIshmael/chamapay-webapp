"use client";

import { useCallback, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { FiCheck, FiX } from "react-icons/fi";
import "react-easy-crop/react-easy-crop.css";

/** Matches goal cover hero (~full-width × 168px) — close to X/Twitter banner. */
export const GOAL_COVER_ASPECT = 3 / 1;

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (e) => reject(e));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName = "cover.jpg"
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const maxW = 1500;
  const scale = Math.min(1, maxW / pixelCrop.width);
  canvas.width = Math.round(pixelCrop.width * scale);
  canvas.height = Math.round(pixelCrop.height * scale);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.9
    );
  });

  return new File([blob], fileName, { type: "image/jpeg" });
}

export default function CoverCropModal({
  open,
  imageSrc,
  aspect = GOAL_COVER_ASPECT,
  title = "Crop cover photo",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  imageSrc: string | null;
  aspect?: number;
  title?: string;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  if (!open || !imageSrc) return null;

  const handleConfirm = async () => {
    if (!croppedAreaPixels || busy) return;
    setBusy(true);
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels);
      await onConfirm(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-modal-layer z-[80]">
      <div className="app-modal-backdrop" onClick={() => !busy && onCancel()} />
      <div className="app-modal-sheet bg-gray-950 max-h-[94%] flex flex-col overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="relative flex items-center justify-center px-4 py-3 min-h-[44px]">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="absolute left-3 h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white"
            aria-label="Cancel"
          >
            <FiX size={18} />
          </button>
          <h2 className="text-[15px] font-semibold text-white">{title}</h2>
          <button
            type="button"
            disabled={busy || !croppedAreaPixels}
            onClick={() => void handleConfirm()}
            className="absolute right-3 h-9 px-3 rounded-full bg-downy-500 text-white text-[13px] font-bold flex items-center gap-1 disabled:opacity-50"
          >
            {busy ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                <FiCheck size={16} />
                Done
              </>
            )}
          </button>
        </div>

        <div className="relative w-full h-[min(52vh,360px)] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={false}
            objectFit="horizontal-cover"
          />
        </div>

        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] text-white/50 text-center mb-3">
            Drag to reposition · pinch or slide to zoom
          </p>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-downy-500"
            aria-label="Zoom"
          />
        </div>
      </div>
    </div>
  );
}
