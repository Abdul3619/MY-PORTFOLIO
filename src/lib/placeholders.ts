// Inline placeholder used when a project has no image (replaces the discontinued via.placeholder.com service)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#1a1a1a"/><text x="50%" y="50%" fill="#555" font-family="system-ui, sans-serif" font-size="48" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>`;

export const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
