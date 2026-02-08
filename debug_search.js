async function debug() {
    const query = "비비";
    const encoded = encodeURIComponent(query);

    console.log("=== iTunes ===");
    try {
        const itunes = await fetch(`https://itunes.apple.com/search?term=${encoded}&entity=musicArtist&limit=1`).then(r => r.json());
        console.log(JSON.stringify(itunes, null, 2));
    } catch (e) { console.log(e.message); }

    console.log("\n=== TADB ===");
    try {
        const tadb = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encoded}`).then(r => r.json());
        console.log(JSON.stringify(tadb, null, 2));
    } catch (e) { console.log(e.message); }

    console.log("\n=== Wiki OpenSearch ===");
    try {
        const wiki = await fetch(`https://ko.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=5&format=json`).then(r => r.json());
        console.log(JSON.stringify(wiki, null, 2));
    } catch (e) { console.log(e.message); }
}

debug();
