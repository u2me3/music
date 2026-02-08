async function debug() {
    const encodedKO = encodeURIComponent("비비");
    const encodedEN = encodeURIComponent("BIBI");

    console.log("=== Wiki KO '비비' ===");
    try {
        const search = await fetch(`https://ko.wikipedia.org/w/api.php?action=opensearch&search=${encodedKO}&limit=5&namespace=0&format=json&origin=*`).then(r => r.json());
        console.log("Titles:", search[1]);

        // Fetch summary of first result
        const sumUrl = `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(search[1][0])}`;
        const sum = await fetch(sumUrl).then(r => r.json());
        console.log("First Result Type:", sum.type);
        console.log("First Result Extract:", sum.extract);

        // Fetch summary of '비비 (대한민국의 가수)' if exists
        if (search[1][1]) {
            const sumUrl2 = `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(search[1][1])}`;
            const sum2 = await fetch(sumUrl2).then(r => r.json());
            console.log("Second Result Type:", sum2.type);
            console.log("Second Result Extract:", sum2.extract);
        }

    } catch (e) { console.log(e); }

    console.log("\n=== Wiki EN 'BIBI' ===");
    try {
        const search = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodedEN}&limit=5&namespace=0&format=json&origin=*`).then(r => r.json());
        console.log("Titles:", search[1]);
        // Fetch summary of first result
        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(search[1][0])}`;
        const sum = await fetch(sumUrl).then(r => r.json());
        console.log("First Result Type:", sum.type);
        console.log("First Result Extract:", sum.extract);
    } catch (e) { console.log(e); }
}

debug();
