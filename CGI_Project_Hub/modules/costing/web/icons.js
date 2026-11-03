'use strict';
// Small inline SVG icons: offline, consistent stroke and no font dependency.
const studioIconPaths={
 plus:'<path d="M12 5v14M5 12h14"/>',
 box:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v8l9 5 9-5V8M12 13v8M7.5 5.5l9 5"/>',
 truck:'<path d="M3 5h11v12H3zM14 9h4l3 4v4h-7M3 13h11"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
 pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
 users:'<circle cx="9" cy="7" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>',
 ruler:'<path d="m3 16 13-13 5 5L8 21 3 16ZM12 7l2 2M8 11l2 2M4 15l2 2"/>',
 panel:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h2M14 11h1M9 15h2M14 15h1M9 18h6"/>',
 check:'<path d="M9 4h6M9 3v3h6V3M8 4H5v17h14V4h-3M8 13l3 3 5-6"/>',
 gauge:'<path d="M4 18a9 9 0 1 1 16 0M12 14l4-5M7 8l1 1M12 5v2M17 8l-1 1M3 13h2M19 13h2M8 20h8"/><circle cx="12" cy="14" r="1"/>',
 sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 3v4M18 5h4"/>',
 folder:'<path d="M3 7V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
 wrench:'<path d="M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z"/>',
 bed:'<path d="M3 6v15M21 12v9M3 17h18M7 10h3v4H7zM13 10h5a3 3 0 0 1 3 3v4H3v-4"/>',
 route:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 5h8a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h8"/>',
 shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3ZM8 12l3 3 5-6"/>',
 clipboard:'<path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 11h8M8 15h5"/>',
 chart:'<path d="M3 3v18h18M7 15V9M12 15V6M17 15v-4"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
 document:'<path d="M5 3h10l4 4v14H5V3ZM14 3v5h5M8 12h8M8 16h6"/>',
 book:'<path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2ZM12 6v15"/>',
 cart:'<path d="M3 3h2l3 13h11l2-9H6"/><circle cx="10" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
 factory:'<path d="M3 21V9l6 4V8l6 4V3h4l2 18H3ZM7 17h2M12 17h2M17 17h2"/>',
 meal:'<path d="M5 3v5a3 3 0 0 0 6 0V3M8 3v18M18 3c-3 3-3 8 0 9h2V3h-2ZM20 12v9"/>'
};
function studioIcon(name,extra=''){return `<svg class="studio-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${studioIconPaths[name]||studioIconPaths.folder}</svg>`}
function categoryIcon(category){return {materials:'box',pg:'truck',labour:'users',options:'sparkle'}[category]||'folder'}
function groupIcon(group){const n=String(group.name||'').toLowerCase();if(/transport|freight|delivery/.test(n))return 'truck';if(/site.*commission/.test(n))return 'pin';if(/commission/.test(n))return 'gauge';if(/testing|\bfat\b|\bsat\b/.test(n))return 'check';if(/engineering|design|drawing/.test(n))return 'ruler';if(/\bpm\b|project.*manage/.test(n))return 'clipboard';if(/panel|\bmcc\b|switchgear/.test(n))return 'panel';if(/install/.test(n))return 'wrench';if(/travel|kilometr|mileage/.test(n))return 'route';if(/accommod|lodging|hotel|night/.test(n))return 'bed';if(/meal|food|\bloa\b/.test(n))return 'meal';if(/safety|ppe|insurance/.test(n))return 'shield';if(/manufact|fabricat/.test(n))return 'factory';if(/procure/.test(n))return 'cart';return categoryIcon(group.category)}
function groupDisplayName(name){let n=String(name||'Untitled subcategory');let base=n.split('(')[0].trim();if(base===base.toUpperCase())n=n.replace(base,base.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())).replace(/\b(mcc|pm|fat|sat|plc|scada|ec&i|p&gs)\b/gi,c=>c.toUpperCase());return n}
