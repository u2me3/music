async function debug() {
    const encoded = encodeURIComponent("BIBI");

    console.log("=== TADB (BIBI) ===");
    try {
        const tadb = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encoded}`).then(r => r.json());
        if (tadb && tadb.artists) {
            console.log("strBiographyKO:", tadb.artists[0].strBiographyKO);
            console.log("strBiographyEN:", tadb.artists[0].strBiographyEN ? tadb.artists[0].strBiographyEN.substring(0, 100) : "null");
            console.log("strCountryCode:", tadb.artists[0].strCountryCode);
            console.log("strGenre:", tadb.artists[0].strGenre);
        } else {
            console.log("No TADB result");
        }
    } catch (e) { console.log(e.message); }
}

debug();
