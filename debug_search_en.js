async function debug() {
    const query = "BIBI"; // English name from iTunes
    const encoded = encodeURIComponent(query);

    console.log("\n=== TADB (BIBI) ===");
    try {
        const tadb = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encoded}`).then(r => r.json());
        console.log(JSON.stringify(tadb, null, 2));
    } catch (e) { console.log(e.message); }
}

debug();
