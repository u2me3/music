async function debug() {
    // Test with BIBI's "Lowlife Princess: Noir" or similar
    const artist = encodeURIComponent("BIBI");
    const album = encodeURIComponent("Lowlife Princess: Noir");

    console.log(`=== TADB Album Search: ${artist} - ${album} ===`);
    try {
        const url = `https://www.theaudiodb.com/api/v1/json/2/searchalbum.php?s=${artist}&a=${album}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data && data.album) {
            const alb = data.album[0];
            console.log("Album ID:", alb.idAlbum);
            console.log("strImdbID:", alb.strImdbID); // Sometimes re-used?
            console.log("strAllMusicID:", alb.strAllMusicID);
            console.log("strMusicBrainzID:", alb.strMusicBrainzID);
            console.log("strDiscogsID:", alb.strDiscogsID);
            console.log("strWikidataID:", alb.strWikidataID);
            console.log("strWikipediaID:", alb.strWikipediaID);
            console.log("strGeniusID:", alb.strGeniusID);
            console.log("strLyricWikiID:", alb.strLyricWikiID);
            console.log("strMusicMozID:", alb.strMusicMozID);
            console.log("strRateYourMusicID:", alb.strRateYourMusicID);
            console.log("strDescriptionEN:", alb.strDescriptionEN ? alb.strDescriptionEN.substring(0, 50) : "null");
            // Check for loose fields
            console.log("Full Object Keys:", Object.keys(alb));
        } else {
            console.log("No album found");
        }
    } catch (e) { console.log(e.message); }
}

debug();
