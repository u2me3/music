async function debug() {
    // Example: BIBI - Lowlife Princess: Noir (iTunes URL)
    // We need a real iTunes URL. Let's fetch one first or use a known one.
    // Known ID for "Lowlife Princess: Noir": 1655706917
    const itunesUrl = "https://music.apple.com/us/album/lowlife-princess-noir/1655706917";

    console.log(`=== Odesli API Test: ${itunesUrl} ===`);
    try {
        const url = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(itunesUrl)}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data && data.linksByPlatform && data.linksByPlatform.youtubeMusic) {
            console.log("YouTube Music Link:", data.linksByPlatform.youtubeMusic.url);
            console.log("Entity UniqueID:", data.linksByPlatform.youtubeMusic.entityUniqueId);
        } else {
            console.log("No YouTube Music link found");
            console.log("Keys:", Object.keys(data.linksByPlatform || {}));
        }
    } catch (e) { console.log(e.message); }
}

debug();
