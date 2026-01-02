"use client";

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Area, Point } from 'react-easy-crop';

interface ImageEditorProps {
    isOpen: boolean;
    imageSrc: string;
    onSave: (editedImageUrl: string) => void;
    onCancel: () => void;
}

// Helper function to create a cropped image
const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new window.Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.crossOrigin = 'anonymous';
        image.src = url;
    });

const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation: number = 0
): Promise<{ blob: Blob; mimeType: string; extension: string } | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    const rotRad = (rotation * Math.PI) / 180;

    // Calculate bounding box of the rotated image
    const sin = Math.abs(Math.sin(rotRad));
    const cos = Math.abs(Math.cos(rotRad));
    const bBoxWidth = image.width * cos + image.height * sin;
    const bBoxHeight = image.width * sin + image.height * cos;

    // Set canvas size to match the bounding box
    canvas.width = bBoxWidth;
    canvas.height = bBoxHeight;

    // Translate and rotate
    ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);

    // Draw rotated image
    ctx.drawImage(image, 0, 0);

    // Extract the cropped area
    const data = ctx.getImageData(
        pixelCrop.x + (bBoxWidth - image.width) / 2,
        pixelCrop.y + (bBoxHeight - image.height) / 2,
        pixelCrop.width,
        pixelCrop.height
    );

    // Check if image has transparency (any alpha value < 255)
    let hasTransparency = false;
    for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] < 255) {
            hasTransparency = true;
            break;
        }
    }

    // Set canvas to final cropped size
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // For non-transparent images, fill with white background first
    if (!hasTransparency) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Put cropped image data
    ctx.putImageData(data, 0, 0);

    // Output as PNG if has transparency, otherwise JPEG for smaller file size
    const mimeType = hasTransparency ? 'image/png' : 'image/jpeg';
    const extension = hasTransparency ? 'png' : 'jpg';

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve({ blob, mimeType, extension });
            } else {
                resolve(null);
            }
        }, mimeType, mimeType === 'image/jpeg' ? 0.9 : undefined);
    });
};

export default function ImageEditor({ isOpen, imageSrc, onSave, onCancel }: ImageEditorProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        if (!croppedAreaPixels) return;

        setIsSaving(true);

        try {
            const result = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
            if (!result) {
                alert('Failed to process image');
                return;
            }

            const { blob, extension } = result;

            // Upload the cropped image with correct extension
            const formData = new FormData();
            formData.append('file', blob, `edited-image.${extension}`);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const uploadResult = await response.json();

            if (uploadResult.success && uploadResult.file?.path) {
                onSave(uploadResult.file.path);
            } else {
                alert(uploadResult.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Image editing error:', error);
            alert('Failed to save edited image');
        } finally {
            setIsSaving(false);
        }
    };

    const rotateLeft = () => setRotation((prev) => prev - 90);
    const rotateRight = () => setRotation((prev) => prev + 90);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--color-bg-base, #f5f5f5)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100001
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text-main)'
            }}>
                <h3 style={{ margin: 0, fontWeight: 600 }}>Edit Image</h3>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-main)',
                        fontSize: '1.5rem',
                        cursor: 'pointer'
                    }}
                >
                    ×
                </button>
            </div>

            {/* Cropper Area - with checkered background for transparency indication */}
            <div style={{
                flex: 1,
                position: 'relative',
                background: `
                    linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                    linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                    linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
                `,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                backgroundColor: '#f5f5f5'
            }}>
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={undefined}
                    minZoom={0.5}
                    maxZoom={3}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    style={{
                        containerStyle: {
                            backgroundColor: 'transparent'
                        },
                        mediaStyle: {
                            backgroundColor: 'white'
                        }
                    }}
                />
            </div>

            {/* Controls */}
            <div style={{
                padding: '1rem 1.5rem',
                backgroundColor: 'var(--color-bg-surface)',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                color: 'var(--color-text-main)'
            }}>
                {/* Zoom Control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ minWidth: '60px' }}>Zoom:</span>
                    <input
                        type="range"
                        min={0.5}
                        max={3}
                        step={0.1}
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        style={{ flex: 1 }}
                    />
                    <span style={{ minWidth: '50px', textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
                </div>

                {/* Rotation Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ minWidth: '60px' }}>Rotate:</span>
                    <button
                        type="button"
                        onClick={rotateLeft}
                        className="btn btn-outline"
                        style={{
                            padding: '0.5rem 1rem'
                        }}
                    >
                        ↺ -90°
                    </button>
                    <button
                        type="button"
                        onClick={rotateRight}
                        className="btn btn-outline"
                        style={{
                            padding: '0.5rem 1rem'
                        }}
                    >
                        ↻ +90°
                    </button>
                    <span style={{ marginLeft: 'auto' }}>{rotation}°</span>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSaving}
                        className="btn btn-outline"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="btn btn-primary"
                    >
                        {isSaving ? 'Saving...' : 'Save & Insert'}
                    </button>
                </div>
            </div>

            {/* Custom styles for react-easy-crop to use light background */}
            <style jsx global>{`
                .reactEasyCrop_Container {
                    background-color: transparent !important;
                }
                .reactEasyCrop_CropArea {
                    border: 2px solid var(--color-primary, #3b82f6) !important;
                    box-shadow: 0 0 0 9999px rgba(255, 255, 255, 0.5) !important;
                }
            `}</style>
        </div>
    );
}
