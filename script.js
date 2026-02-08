const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const artistSection = document.getElementById('artist-section');
const resultsSection = document.getElementById('results-section');
const albumGrid = document.getElementById('album-grid');
const singleGrid = document.getElementById('single-grid');
const albumsTitle = document.getElementById('albums-title');
const singlesTitle = document.getElementById('singles-title');

// Artist UI Elements
const artistImage = document.getElementById('artist-image');
const artistName = document.getElementById('artist-name');
const artistGenre = document.getElementById('artist-genre');
const allmusicLink = document.getElementById('allmusic-link');

// Kodari Elements Removed


// Audio Player
let currentAudio = null;

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        alert("검색어를 입력해주십시오!");
        return;
    }

    // setKodariState('searching', `"${query}" 아티스트를 찾는 중입니다! 🫡`); // Removed


    // Reset UI
    artistSection.classList.add('hidden');
    albumsTitle.classList.add('hidden');
    singlesTitle.classList.add('hidden');

    // Hide Gimbab Section on Search
    const gimbabSection = document.getElementById('gimbab-section');
    const monthSection = document.getElementById('month-section'); // New
    if (gimbabSection) gimbabSection.classList.add('hidden');
    if (monthSection) monthSection.classList.add('hidden'); // Hide Month Section too

    albumGrid.innerHTML = ''; // Loading placeholder removed to keep it clean or use a spinner
    singleGrid.innerHTML = '';

    try {
        // 1. Fetch Artist
        const artist = await fetchArtist(query);

        if (!artist) {
            alert(`"${query}"... 찾을 수 없는 아티스트입니다.`);
            return; // Stop here
        }

        const artistData = artist; // { artistName, primaryGenreName, artistLinkUrl, artistId }

        // setKodariState('success', `"${artistData.artistName}" 찾았습니다! 작전 성공! 🎉`);
        displayArtist(artistData);
        fetchAndDisplayBio(artistData.artistName, artistData);

        // 3. Get Top Albums
        const collections = await fetchAlbums(artistData.artistId);
        displayCollections(collections, artistData.artistName);

        // 4. Display Gallery (Processed in fetchAndDisplayBio via Wiki now)
        // displayGallery(collections); <--- Removed

    } catch (error) {
        console.error("Search Error:", error);
        // setKodariState('error', ...); // Removed
        albumGrid.innerHTML = '<div class="placeholder-message">오류가 발생했습니다. 잠시 후 다시 시도해주세요.</div>';
    }
}

async function fetchArtist(name) {
    // iTunes API: Search for artist
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    return data.results[0];
}

async function fetchAlbums(artistId) {
    // iTunes API: Lookup artist's albums (mix of albums and singles)
    // Fetch more results to ensure we get enough of both
    const url = `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=50&sort=recent`;
    const response = await fetch(url);
    const data = await response.json();
    // Filter out the artist info itself (resultCount includes it)
    return data.results.filter(item => item.wrapperType === 'collection');
}

// Global variable to keep track of valid gallery images
let galleryImages = [];

// New: Accept 'artistData' object to use its English name for fallback search
async function fetchAndDisplayBio(artistNameStr, artistData = null) {
    const bioElement = document.getElementById('artist-bio');
    bioElement.textContent = "아티스트 정보를 불러오는 중...";

    let tadbFound = false;
    let tadbArtist = null;
    let wikiDataKO = null;
    let finalBio = null;
    let sourceLabel = "";

    // 1. KOREAN FIRST STRATEGY: Try Wiki Search immediately if query is Korean
    const isKoreanQuery = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(artistNameStr);

    if (isKoreanQuery) {
        console.log(`Korean Query detected: '${artistNameStr}'. Searching Wiki first...`);
        wikiDataKO = await fetchWikiData(artistNameStr, 'ko');

        if (wikiDataKO) {
            console.log("Wiki KO found:", wikiDataKO.title);
            // If we found a specific Korean page (e.g. "비비 (대한민국의 가수)"),
            // we treat this as the HIGH CONFIDENCE bio source.
            finalBio = wikiDataKO.extract;
            sourceLabel = " (출처: 위키백과)";
        }
    }

    // 2. Try TheAudioDB (for Images mainly, but also Bio if Wiki failed)
    async function searchTadb(query) {
        try {
            const tadbUrl = `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(query)}`;
            const tadbResp = await fetch(tadbUrl);
            const tadbData = await tadbResp.json();
            if (tadbData && tadbData.artists && tadbData.artists[0]) {
                return tadbData.artists[0];
            }
        } catch (e) {
            console.warn("TADB Search Error:", e);
        }
        return null;
    }

    // Search TADB (Try Original Query first)
    if (!tadbArtist) {
        tadbArtist = await searchTadb(artistNameStr);
    }

    // Retry with English Name from iTunes if different
    if (!tadbArtist && artistData && artistData.artistName && artistData.artistName !== artistNameStr) {
        console.log(`TADB: Retrying with English name '${artistData.artistName}'...`);
        tadbArtist = await searchTadb(artistData.artistName);
    }

    // VALIDATION: If iTunes says K-Pop, check if TADB result is actually Korean
    if (tadbArtist && artistData && artistData.primaryGenreName === 'K-Pop') {
        const isKorean = (tadbArtist.strCountryCode === 'KR') ||
            (tadbArtist.strCountry && tadbArtist.strCountry.toLowerCase().includes('korea')) ||
            (tadbArtist.strGenre && tadbArtist.strGenre.toLowerCase().includes('k-pop')) ||
            (tadbArtist.strBiographyEN && tadbArtist.strBiographyEN.toLowerCase().includes('south korean'));

        // Also check if BIO contains suspect words like "Philippines" if the country code is missing/wrong
        const isSuspect = (tadbArtist.strBiographyEN && tadbArtist.strBiographyEN.toLowerCase().includes('filipino'));

        if (!isKorean || isSuspect) {
            console.warn(`TADB Mismatch: iTunes is K-Pop but TADB result seems not to be Korean (${tadbArtist.strArtist}). Discarding TADB.`);
            tadbArtist = null; // Discard invalid result
        }
    }

    if (tadbArtist) {
        tadbFound = true;

        // Pick BIO from TADB only if we don't have a Wiki one yet
        // OR if TADB has a Korean bio (which is rare but preferred if exists)
        if (tadbArtist.strBiographyKO) {
            finalBio = tadbArtist.strBiographyKO;
            sourceLabel = "";
        } else if (!finalBio && tadbArtist.strBiographyEN) {
            // Only use English Bio if we didn't find Korean Wiki
            finalBio = tadbArtist.strBiographyEN;
            sourceLabel = " (Source: TheAudioDB)";
        }

        // Set Main Image
        if (tadbArtist.strArtistThumb) {
            document.getElementById('artist-image').src = tadbArtist.strArtistThumb;
        } else if (tadbArtist.strArtistFanart) {
            document.getElementById('artist-image').src = tadbArtist.strArtistFanart;
        }

        // Set Gallery
        displayTadbGallery(tadbArtist);
    }

    // 3. Fallbacks
    if (!finalBio) {
        // If we didn't search Wiki yet (non-Korean query) or failed earlier
        if (!wikiDataKO && isKoreanQuery) {
            // Already tried and failed
        } else if (!wikiDataKO) {
            wikiDataKO = await fetchWikiData(artistNameStr, 'ko');
            if (wikiDataKO) {
                finalBio = wikiDataKO.extract;
                sourceLabel = " (출처: 위키백과)";
            }
        }

        // English Wiki Fallback
        if (!finalBio) {
            let searchName = (artistData && artistData.artistName) ? artistData.artistName : artistNameStr;
            const wikiDataEN = await fetchWikiData(searchName, 'en');
            if (wikiDataEN) {
                finalBio = wikiDataEN.extract;
                sourceLabel = " (Source: Wikipedia)";

                // Wiki Image Fallback
                if (!tadbFound && wikiDataEN.thumbnail) document.getElementById('artist-image').src = wikiDataEN.thumbnail.source;
                if (!tadbFound) fetchGalleryFromWiki(wikiDataEN.title, 'en');
            }
        }
    }

    // Image Fallback for Korean Wiki result (if TADB failed)
    if (finalBio && wikiDataKO && !tadbFound) {
        if (wikiDataKO.thumbnail) document.getElementById('artist-image').src = wikiDataKO.thumbnail.source;
        fetchGalleryFromWiki(wikiDataKO.title, 'ko');
    }

    // If still no Korean Bio, Fallback to TADB English
    if (!finalBio && tadbFound && tadbArtist.strBiographyEN) {
        finalBio = tadbArtist.strBiographyEN;
        sourceLabel = " (Source: TheAudioDB)";
    }

    // If still nothing, Fallback to Wiki English
    if (!finalBio) {
        // Try searching Wiki English with English Name (preferred) or Query
        let searchName = (artistData && artistData.artistName) ? artistData.artistName : artistNameStr;
        const wikiDataEN = await fetchWikiData(searchName, 'en');

        if (wikiDataEN) {
            finalBio = wikiDataEN.extract;
            sourceLabel = " (Source: Wikipedia)";
            if (!tadbFound && wikiDataEN.thumbnail) {
                document.getElementById('artist-image').src = wikiDataEN.thumbnail.source;
            }
            if (!tadbFound) {
                fetchGalleryFromWiki(wikiDataEN.title, 'en');
            }
        }
    }

    // 3. Display Result
    if (finalBio) {
        bioElement.textContent = finalBio + sourceLabel;

        // Detect if text is English (simple check: > 50% ASCII)
        const isEnglish = (finalBio.match(/[a-zA-Z]/g) || []).length > (finalBio.length / 2);

        if (isEnglish) {
            // Create a container for translation
            const translationContainer = document.createElement('div');
            translationContainer.id = 'bio-translation';
            translationContainer.style.marginTop = '15px';
            translationContainer.style.padding = '15px';
            translationContainer.style.backgroundColor = '#2a2a2a'; // Slightly lighter background
            translationContainer.style.borderRadius = '10px';
            translationContainer.style.fontSize = '0.95rem';
            translationContainer.style.color = '#ddd';
            translationContainer.innerHTML = '🔄 한국어 번역을 가져오는 중...';

            bioElement.appendChild(translationContainer);

            // Attempt Auto-Translation
            try {
                const translatedText = await translateText(finalBio);
                if (translatedText) {
                    translationContainer.innerHTML = `<strong>[🇰🇷 자동 번역]</strong><br><br>${translatedText}`;
                } else {
                    throw new Error("Translation returned empty");
                }
            } catch (e) {
                console.warn("Auto-Translation Failed:", e);
                // Fallback to Link Button
                translationContainer.innerHTML = ''; // Clear loading text

                const translateBtn = document.createElement('a');
                translateBtn.href = `https://translate.google.com/?sl=auto&tl=ko&text=${encodeURIComponent(finalBio.substring(0, 1500))}...&op=translate`;
                translateBtn.target = "_blank";
                translateBtn.className = "translate-btn";
                translateBtn.innerHTML = "🇰🇷 구글 번역에서 보기 (클릭)";
                translateBtn.style.display = "inline-block";

                translationContainer.appendChild(translateBtn);
            }
        }
    } else {
        bioElement.textContent = "아티스트 상세 정보를 찾을 수 없습니다.";
        if (!tadbFound) {
            document.getElementById('gallery-grid').innerHTML = '<p style="color:#777;">이미지가 없습니다.</p>';
        }
    }
}

// Helper: Auto-Translate Function (Unofficial Google API)
// Helper: Auto-Translate Function (Unofficial Google API)
async function translateText(text) {
    if (!text) return null;

    try {
        const sentences = text.match(/[^.!?]+[.!?]+[\])'"]*|.+/g) || [text];
        let chunks = [];
        let currentChunk = '';

        // Group sentences into chunks of ~1000 chars
        for (let sentence of sentences) {
            if ((currentChunk + sentence).length < 1000) {
                currentChunk += sentence;
            } else {
                chunks.push(currentChunk);
                currentChunk = sentence;
            }
        }
        if (currentChunk) chunks.push(currentChunk);

        let fullTranslation = '';

        // Translate each chunk sequentially
        for (let chunk of chunks) {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(chunk)}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data[0]) {
                const chunkTranslation = data[0].map(item => item[0]).join('');
                fullTranslation += chunkTranslation + ' ';
            }
        }
        return fullTranslation.trim();
    } catch (e) {
        console.warn("Translation API Error", e);
    }
    return null;
}

// Helper: Fetch Wiki Data with Smart Disambiguation
async function fetchWikiData(query, lang) {
    try {
        const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`;
        const searchResp = await fetch(searchUrl);
        const searchData = await searchResp.json();

        if (searchData[1].length === 0) return null;

        // Smart Logic: Look for specific keywords in titles
        // Keywords: '가수', '그룹', '밴드', '음악가' (Korean) | 'Singer', 'Band', 'Musician', 'Group' (English)
        const titles = searchData[1];
        const keywords = ['가수', '그룹', '밴드', '음악가', '아이돌', 'Singer', 'Band', 'Musician', 'Group', 'Rapper'];

        // Find best match
        let bestTitle = titles[0]; // Default to first

        // 1. Check for exact match + keyword (e.g. "비비 (가수)")
        const keywordMatch = titles.find(t => keywords.some(k => t.includes(k) || t.includes(`(${k})`)));
        if (keywordMatch) {
            bestTitle = keywordMatch;
            console.log(`Smart Wiki: Switched from '${titles[0]}' to '${bestTitle}' based on keywords.`);
        }

        // Get Bio
        const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
        const summaryResp = await fetch(summaryUrl);

        if (summaryResp.ok) {
            const data = await summaryResp.json();

            // Filter out 'Disambiguation' type if possible (Wiki API typically returns 'standard')
            if (data.type === 'standard' && data.extract) {
                return data;
            }
        }
    } catch (e) {
        console.error(`Wiki ${lang} Fetch Error`, e);
    }
    return null;
}

// Helper: Original Wiki Logic extracted - DEPRECATED/REMOVED in favor of fetchWikiData above
// async function fetchBioFromWiki(artistNameStr, bioElement) {
//     async function tryWiki(lang) {
//         try {
//             // 1. Search for Title
//             const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(artistNameStr)}&limit=1&namespace=0&format=json&origin=*`;
//             const searchResp = await fetch(searchUrl);
//             const searchData = await searchResp.json();

//             if (searchData[1].length === 0) return null; // No results

//             const exactTitle = searchData[1][0];

//             // 2. Get Bio
//             const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(exactTitle)}`;
//             const summaryResp = await fetch(summaryUrl);

//             if (summaryResp.ok) {
//                 return await summaryResp.json();
//             }
//         } catch (e) {
//             console.error(`Wiki ${lang} Fetch Error`, e);
//         }
//         return null;
//     }

//     // Try Korean first
//     let data = await tryWiki('ko');
//     let usedLang = 'ko';

//     // If failed, try English
//     if (!data) {
//         bioElement.textContent = "한국어 위키에서 정보를 찾을 수 없어 영문 위키를 검색합니다...";
//         data = await tryWiki('en');
//         usedLang = 'en';
//     }

//     if (data) {
//         // Set Bio
//         if (data.type === 'standard' && data.extract) {
//             bioElement.textContent = data.extract + (usedLang === 'en' ? " (영문 위키백과)" : "");
//         } else {
//             bioElement.textContent = "상세한 소개가 없습니다.";
//         }

//         // Set Artist Image (if available)
//         if (data.thumbnail && data.thumbnail.source) {
//             document.getElementById('artist-image').src = data.thumbnail.source;
//         }

//         // Fetch Gallery (using the found title and language)
//         fetchGalleryFromWiki(data.title, usedLang);

//     } else {
//         bioElement.textContent = "관련 정보를 찾을 수 없습니다.";
//         document.getElementById('gallery-grid').innerHTML = '<p style="color:#777;">이미지가 없습니다.</p>';
//     }
// }

function displayTadbGallery(artist) {
    const galleryGrid = document.getElementById('gallery-grid');
    galleryGrid.innerHTML = '';
    const images = [artist.strArtistFanart, artist.strArtistFanart2, artist.strArtistFanart3, artist.strArtistThumb].filter(u => u);
    const uniqueImages = [...new Set(images)].slice(0, 5);
    if (uniqueImages.length === 0) { galleryGrid.innerHTML = '<p style="color:#777;">갤러리 이미지가 없습니다.</p>'; return; }
    uniqueImages.forEach(url => addGalleryItem(url));
}

function addGalleryItem(url) {
    const galleryGrid = document.getElementById('gallery-grid');
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `<img src="${url}" alt="Artist Photo" loading="lazy">`;
    item.onclick = () => { window.open(url, '_blank'); };
    galleryGrid.appendChild(item);
}

async function fetchGalleryFromWiki(title, lang) {
    const galleryGrid = document.getElementById('gallery-grid');
    galleryGrid.innerHTML = '<p style="color:#777;">사진을 불러오는 중...</p>';
    try {
        const url = `https://${lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            const items = data.items.filter(item => item.type === 'image');
            if (items.length > 0) {
                galleryGrid.innerHTML = '';
                let count = 0;
                items.forEach(item => {
                    if (count >= 5) return;
                    if (item.srcset && item.srcset.length > 0) {
                        const imgUrl = item.srcset[0].src;
                        addGalleryItem(imgUrl.startsWith('//') ? `https:${imgUrl}` : imgUrl);
                        count++;
                    }
                });
            } else { galleryGrid.innerHTML = '<p style="color:#777;">위키백과 이미지가 없습니다.</p>'; }
        }
    } catch (e) {
        console.error("Gallery Fetch Error", e);
        galleryGrid.innerHTML = '<p style="color:#777;">이미지 로딩 실패.</p>';
    }
}

function displayGallery(collections) { } // Deprecated

function displayArtist(artist) {
    artistName.textContent = artist.artistName;
    artistGenre.textContent = artist.primaryGenreName;

    // iTunes doesn't always give a high-res artist image in the artist search,
    // so we might use a generic one or try to pick one from their albums later.
    // For now, let's use a placeholder if empty, or try to get it from the API if available.
    // Actually iTunes search for artist doesn't provide an image.
    // Trick: We will update this image from the first album's artwork.
    artistImage.src = 'https://cdn-icons-png.flaticon.com/512/3659/3659784.png'; // Default Placeholder

    // Generate AllMusic Search Link
    allmusicLink.href = `https://www.allmusic.com/search/all/${encodeURIComponent(artist.artistName)}`;

    artistSection.classList.remove('hidden');
}

function displayCollections(collections, artistNameStr) {
    albumGrid.innerHTML = ''; // Clear placeholder
    singleGrid.innerHTML = '';

    if (collections.length === 0) {
        albumGrid.innerHTML = '<div class="placeholder-message">앨범 정보가 없습니다.</div>';
        return;
    }

    // Artist Image: We try to use Wikipedia thumbnail first (in fetchAndDisplayBio).
    // If that failed or hasn't run yet, we might fallback here.
    // But let's leave the Wikipedia one as primary. 
    // If the image is still empty/placeholder, we can update it.
    const currentSrc = document.getElementById('artist-image').src;
    if (collections.length > 0 && collections[0].artworkUrl100 && (currentSrc === "" || currentSrc.includes("flaticon"))) {
        // Only replace if we are still using the placeholder
        // artistImage.src = collections[0].artworkUrl100.replace('100x100', '600x600');
        // Actually, let's prefer the Wikipedia image if this runs later. 
        // Since fetchAndDisplayBio is async, we should check carefully.
        // For now, let's NOT override here if we want "Photos". iTunes art is usually album art.
    }

    // Split into Albums and Singles
    const albums = collections.filter(item => item.trackCount > 1 || item.collectionType === 'Album');
    const singles = collections.filter(item => item.trackCount === 1 || item.collectionType === 'Single');

    // Render Albums
    if (albums.length > 0) {
        albumsTitle.classList.remove('hidden');
        albums.forEach(album => {
            const card = createAlbumCard(album, artistNameStr);
            albumGrid.appendChild(card);
        });
    }

    // Render Singles
    if (singles.length > 0) {
        singlesTitle.classList.remove('hidden');
        singles.forEach(single => {
            const card = createAlbumCard(single, artistNameStr);
            singleGrid.appendChild(card);
        });
    }
}

function createAlbumCard(album, artistNameStr) {
    const card = document.createElement('div');
    card.className = 'album-card';

    // High resolution image trick
    const imageUrl = album.artworkUrl100.replace('100x100', '400x400');
    const year = album.releaseDate.substring(0, 4);

    // Generate Links
    const amzLink = `https://www.amazon.com/s?k=${encodeURIComponent(artistNameStr + ' ' + album.collectionName)}`;
    const dscLink = `https://www.discogs.com/search/?q=${encodeURIComponent(artistNameStr + ' ' + album.collectionName)}&type=release`;
    const allLink = `https://www.allmusic.com/search/albums/${encodeURIComponent(album.collectionName)}`;

    // YouTube Music Album Search Link
    const ytmAlbumLink = `https://music.youtube.com/search?q=${encodeURIComponent(artistNameStr + ' ' + album.collectionName)}`;

    card.innerHTML = `
        <div class="album-image-wrapper" title="Click to listen on YouTube Music 🎵" style="cursor: pointer;" onclick="window.open('${ytmAlbumLink}', '_blank')">
            <img src="${imageUrl}" alt="${album.collectionName}" loading="lazy">
            ${album.previewUrl ? `<button class="audio-preview-btn" data-url="${album.previewUrl}">▶</button>` : ''}
        </div>
        <div class="album-info">
            <div class="album-title" title="${album.collectionName}">${album.collectionName}</div>
            <div class="album-year">${year} • ${album.trackCount} Tracks</div>
            <div class="card-links">
                <a href="${amzLink}" target="_blank" class="mini-btn btn-amz" title="Buy on Amazon">Amazon</a>
                <a href="${dscLink}" target="_blank" class="mini-btn btn-dsc" title="View on Discogs">Discogs</a>
                <a href="${allLink}" target="_blank" class="mini-btn btn-all" title="View on AllMusic">AllMusic</a>
            </div>
            <button class="view-tracks-btn" style="width:100%; margin-top:10px; padding:8px; background:#333; color:white; border:none; border-radius:5px; cursor:pointer;">
                View Tracks & MVs 🎬
            </button>
        </div>
    `;

    // Audio Preview Logic
    const playBtn = card.querySelector('.audio-preview-btn');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAudio(playBtn.dataset.url, playBtn);
        });
    }

    // Modal Click Event
    card.querySelector('.view-tracks-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling if needed
        openTrackModal(album, artistNameStr);
    });

    return card;
}

// Modal Logic
const modal = document.getElementById('tracklist-modal');
const closeModal = document.getElementById('close-modal');
const trackList = document.getElementById('track-list');

closeModal.onclick = () => { modal.classList.add('hidden'); };
window.onclick = (e) => {
    if (e.target == modal) {
        modal.classList.add('hidden');
    }
};

async function openTrackModal(album, artistName) {
    modal.classList.remove('hidden');

    // Set Header Info
    document.getElementById('modal-album-art').src = album.artworkUrl100.replace('100x100', '200x200');
    document.getElementById('modal-album-title').textContent = album.collectionName;
    document.getElementById('modal-artist-name').textContent = artistName;

    trackList.innerHTML = '<p style="text-align:center; padding:20px;">트랙 정보를 불러오는 중...</p>';

    try {
        const tracks = await fetchTracks(album.collectionId);
        renderTracks(tracks, artistName);
    } catch (e) {
        console.error("Track Fetch Error", e);
        trackList.innerHTML = '<p style="text-align:center; padding:20px;">트랙 정보를 불러올 수 없습니다.</p>';
    }
}

async function fetchTracks(collectionId) {
    const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`;
    const response = await fetch(url);
    const data = await response.json();
    // First item is collection info, rest are tracks
    return data.results.filter(item => item.wrapperType === 'track');
}

function renderTracks(tracks, artistName) {
    trackList.innerHTML = '';

    if (tracks.length === 0) {
        trackList.innerHTML = '<p style="text-align:center; padding:20px;">트랙 정보가 없습니다.</p>';
        return;
    }

    tracks.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'track-item';

        // MV Search Link
        const mvQuery = `${artistName} ${track.trackName} Official Music Video`;
        const mvLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(mvQuery)}`;

        // YouTube Music Link (Re-applied)
        const ytmQuery = `${artistName} ${track.trackName}`;
        const ytmLink = `https://music.youtube.com/search?q=${encodeURIComponent(ytmQuery)}`;

        li.innerHTML = `
            <div class="track-info">
                <span class="track-number">${index + 1}</span>
                <span class="track-title">${track.trackName}</span>
            </div>
            <div class="track-actions">
                <a href="${mvLink}" target="_blank" class="mv-btn" title="Watch MV on YouTube">
                    <span>🎬 MV</span>
                </a>
                <a href="${ytmLink}" target="_blank" class="ytm-btn" title="Listen on YouTube Music">
                    <span>🎵 Music</span>
                </a>
            </div>
        `;
        trackList.appendChild(li);
    });
}

function toggleAudio(url, btn) {
    if (currentAudio && currentAudio.src === url) {
        // Toggle Pause
        if (currentAudio.paused) {
            currentAudio.play();
            btn.textContent = '⏸';
        } else {
            currentAudio.pause();
            btn.textContent = '▶';
        }
    } else {
        // Stop previous
        if (currentAudio) {
            currentAudio.pause();
            // Reset previous button icon
            document.querySelectorAll('.audio-preview-btn').forEach(b => b.textContent = '▶');
        }

        currentAudio = new Audio(url);
        currentAudio.volume = 0.5;
        currentAudio.play();
        btn.textContent = '⏳';

        currentAudio.onplaying = () => {
            btn.textContent = '⏸';
        };

        currentAudio.onended = () => {
            btn.textContent = '▶';
            currentAudio = null;
        };
    }
}

// Gimbab Records Recommendation Logic
async function initGimbabPicks() {
    const gimbabGrid = document.getElementById('gimbab-grid');
    if (!gimbabGrid) return;

    gimbabGrid.innerHTML = '<p style="color:#777; width:100%;">김밥레코즈 ESSENTIAL 추천 앨범을 불러오는 중... 🍙</p>';

    // Scraped List from Gimbab Records (Essentials - Pages 1 to 5)
    const allPicks = [
        // Page 1
        { query: "Nick Drake Pink Moon", desc: "Essential Pick" },
        { query: "Sonic Youth Daydream Nation", desc: "Essential Pick" },
        { query: "Sufjan Stevens Carrie & Lowell", desc: "Essential Pick" },
        { query: "Tame Impala Lonerism", desc: "Essential Pick" },
        { query: "Wilco Yankee Hotel Foxtrot", desc: "Essential Pick" },
        { query: "Freddie Gibbs Madlib Pinata", desc: "Essential Pick" },
        { query: "J Dilla Donuts", desc: "Essential Pick" },
        { query: "Jaylib Champion Sound", desc: "Essential Pick" },
        { query: "Billie Holiday Lady In Satin", desc: "Essential Pick" },
        { query: "John Coltrane Giant Steps", desc: "Essential Pick" },
        { query: "LCD Soundsystem LCD Soundsystem", desc: "Essential Pick" },
        { query: "Neutral Milk Hotel In The Aeroplane Over The Sea", desc: "Essential Pick" },
        // Page 2
        { query: "AC/DC Back In Black", desc: "Essential Pick" },
        { query: "Amy Winehouse Back To Black", desc: "Essential Pick" },
        { query: "Astrud Gilberto The Astrud Gilberto Album", desc: "Essential Pick" },
        { query: "Beach House Bloom", desc: "Essential Pick" },
        { query: "Bill Evans Trio Portrait In Jazz", desc: "Essential Pick" },
        { query: "The Cure Disintegration", desc: "Essential Pick" },
        { query: "Elliott Smith Either/Or", desc: "Essential Pick" },
        { query: "Fleet Foxes Fleet Foxes", desc: "Essential Pick" },
        { query: "Madvillain Madvillainy", desc: "Essential Pick" },
        // Page 3
        { query: "Otis Redding Otis Blue", desc: "Essential Pick" },
        { query: "The Prodigy The Fat Of The Land", desc: "Essential Pick" },
        { query: "Rolling Stones Sticky Fingers", desc: "Essential Pick" },
        { query: "The Stone Roses The Stone Roses", desc: "Essential Pick" },
        { query: "The Velvet Underground & Nico", desc: "Essential Pick" },
        { query: "The XX The XX", desc: "Essential Pick" },
        { query: "The Clash London Calling", desc: "Essential Pick" },
        { query: "D'Angelo Brown Sugar", desc: "Essential Pick" },
        { query: "Low Things We Lost In The Fire", desc: "Essential Pick" },
        { query: "Os Mutantes Everything is Possible", desc: "Essential Pick" },
        // Page 4
        { query: "The Kinks Arthur", desc: "Essential Pick" },
        { query: "Pat Metheny Group Travels", desc: "Essential Pick" },
        { query: "Rage Against The Machine Rage Against The Machine", desc: "Essential Pick" },
        { query: "Sigur Ros ( )", desc: "Essential Pick" },
        { query: "The Smiths Hatful Of Hollow", desc: "Essential Pick" },
        { query: "The Smiths The Queen Is Dead", desc: "Essential Pick" },
        { query: "Television Marquee Moon", desc: "Essential Pick" },
        { query: "D'Angelo Voodoo", desc: "Essential Pick" },
        { query: "Joao Donato Lugar Comum", desc: "Essential Pick" },
        { query: "John Lennon Imagine", desc: "Essential Pick" },
        { query: "Joy Division Unknown Pleasures", desc: "Essential Pick" },
        { query: "Joy Division Closer", desc: "Essential Pick" },
        // Page 5
        { query: "Miles Davis Kind Of Blue", desc: "Essential Pick" },
        { query: "Shuggie Otis Inspiration Information", desc: "Essential Pick" },
        { query: "Bob Marley & The Wailers Catch A Fire", desc: "Essential Pick" },
        { query: "Destroyer Kaputt", desc: "Essential Pick" },
        { query: "Ella Fitzgerald Ella In Berlin", desc: "Essential Pick" },
        { query: "Gang Of Four Entertainment", desc: "Essential Pick" },
        { query: "Lee Morgan The Sidewinder", desc: "Essential Pick" },
        { query: "The Beatles Rubber Soul", desc: "Essential Pick" },
        { query: "Blondie Parallel Lines", desc: "Essential Pick" },
        { query: "Eric Dolphy Out to Lunch", desc: "Essential Pick" },
        { query: "James Blake James Blake", desc: "Essential Pick" },
        { query: "John Coltrane A Love Supreme", desc: "Essential Pick" }
    ];

    // Randomly select 12 candidates to ensure we get 4 valid ones
    const shuffled = allPicks.sort(() => 0.5 - Math.random());
    const candidates = shuffled.slice(0, 12);

    gimbabGrid.innerHTML = ''; // Clear loading

    let validCount = 0;

    // Process in parallel for speed
    const promises = candidates.map(async (pick) => {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(pick.query)}&entity=album&limit=1`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.results.length > 0) {
                return data.results[0];
            }
        } catch (e) {
            console.warn("Gimbab Pick Fetch Error", e);
        }
        return null;
    });

    const results = await Promise.all(promises);

    // Filter valid results and take first 4
    const validAlbums = results.filter(album => album !== null);
    const finalSelection = validAlbums.slice(0, 4);

    for (const album of finalSelection) {
        const card = document.createElement('div');
        card.className = 'gimbab-card';

        const highResArt = album.artworkUrl100.replace('100x100', '400x400');

        card.innerHTML = `
            <img src="${highResArt}" alt="${album.collectionName}">
            <div class="gimbab-title" title="${album.collectionName}">${album.collectionName}</div>
            <div class="gimbab-artist">${album.artistName}</div>
        `;

        // On Click: Open YouTube Music Search
        card.onclick = () => {
            const ytmQuery = `${album.artistName} ${album.collectionName}`;
            const ytmLink = `https://music.youtube.com/search?q=${encodeURIComponent(ytmQuery)}`;
            window.open(ytmLink, '_blank');
        };

        gimbabGrid.appendChild(card);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initGimbabPicks();
    initAlbumOfTheMonth();

    // Check for Gimbab & Month visibility on load
    const gimbabSection = document.getElementById('gimbab-section');
    const monthSection = document.getElementById('month-section');

    // We want them visible on load
    if (gimbabSection) gimbabSection.classList.remove('hidden');
    if (monthSection) monthSection.classList.remove('hidden');

    // Logo Click to Reset/Home
    const logo = document.querySelector('.logo h1');
    if (logo) {
        logo.style.cursor = 'pointer';
        logo.onclick = () => {
            window.location.reload();
        };
    }

    // Initialize New Charts
    initMelonTop4();
    initBillboardTop4();

    // Check visibility for new sections
    const melonSection = document.getElementById('melon-section');
    const billboardSection = document.getElementById('billboard-section');
    if (melonSection) melonSection.classList.remove('hidden');
    if (billboardSection) billboardSection.classList.remove('hidden');
});

// Melon Top 4 Logic
async function initMelonTop4() {
    const melonGrid = document.getElementById('melon-grid');
    if (!melonGrid) return;

    melonGrid.innerHTML = '<p style="color:#777; width:100%;">Melon Top 100 불러오는 중... 🍈</p>';

    // Mock Data for Melon Top (Latest K-Pop Hits)
    // Mock Data for Melon Top (Pool of 20+ Hits) - Randomized
    const melonPicks = [
        { query: "Rosé APT.", desc: "Melon Hot" },
        { query: "aespa Whiplash", desc: "Melon Hot" },
        { query: "G-Dragon Power", desc: "Melon Hot" },
        { query: "Jennie Mantra", desc: "Melon Hot" },
        { query: "ILLIT Cherish (My Love)", desc: "Melon Hot" },
        { query: "QWER My Name is Malguem", desc: "Melon Hot" },
        { query: "DAY6 Melt Down", desc: "Melon Hot" },
        { query: "Lee Young Ji Small Girl", desc: "Melon Hot" },
        { query: "NewJeans How Sweet", desc: "Melon Hot" },
        { query: "IVE Accendio", desc: "Melon Hot" },
        { query: "TWS plot twist", desc: "Melon Hot" },
        { query: "Eclipse Sudden Shower", desc: "Melon Hot" },
        { query: "Zico Spot!", desc: "Melon Hot" },
        { query: "BIBI Bam Yang Gang", desc: "Melon Hot" },
        { query: "LE SSERAFIM Crazy", desc: "Melon Hot" },
        { query: "KISS OF LIFE Sticky", desc: "Melon Hot" },
        { query: "Crush Hmm-cheat", desc: "Melon Hot" },
        { query: "Taeyeon To. X", desc: "Melon Hot" },
        { query: "AKMU Hero", desc: "Melon Hot" },
        { query: "RIIZE Boom Boom Bass", desc: "Melon Hot" }
    ];

    // Randomize and select 4
    const shuffled = melonPicks.sort(() => 0.5 - Math.random());
    const candidates = shuffled.slice(0, 4);

    melonGrid.innerHTML = '';

    for (const pick of candidates) {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(pick.query)}&entity=song&limit=1`;
            const resp = await fetch(url);
            const data = await resp.json();

            if (data.results.length > 0) {
                const song = data.results[0];
                const card = document.createElement('div');
                card.className = 'gimbab-card';

                const highResArt = song.artworkUrl100.replace('100x100', '400x400');

                card.innerHTML = `
                    <div style="position:relative;">
                        <img src="${highResArt}" alt="${song.trackName}">
                        <div style="position:absolute; top:10px; left:10px; background:#00cd3c; color:white; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">Melon Hot</div>
                    </div>
                    <div class="gimbab-title" title="${song.trackName}">${song.trackName}</div>
                    <div class="gimbab-artist">${song.artistName}</div>
                `;

                card.onclick = () => {
                    const ytmQuery = `${song.artistName} ${song.trackName}`;
                    const ytmLink = `https://music.youtube.com/search?q=${encodeURIComponent(ytmQuery)}`;
                    window.open(ytmLink, '_blank');
                };

                melonGrid.appendChild(card);
            }
        } catch (e) {
            console.warn("Melon Fetch Error", e);
        }
    }
}

// Billboard Hot 100 Logic
async function initBillboardTop4() {
    const billboardGrid = document.getElementById('billboard-grid');
    if (!billboardGrid) return;

    billboardGrid.innerHTML = '<p style="color:#777; width:100%;">Billboard Hot 100 불러오는 중... 🇺🇸</p>';

    // Mock Data for Billboard Hot 100 (Latest Global Hits)
    // Mock Data for Billboard Hot 100 (Pool of 20+ Hits) - Randomized
    const billboardPicks = [
        { query: "Shaboozey A Bar Song (Tipsy)", desc: "Billboard Hot" },
        { query: "Lady Gaga Bruno Mars Die With A Smile", desc: "Billboard Hot" },
        { query: "Billie Eilish Birds of a Feather", desc: "Billboard Hot" },
        { query: "Sabrina Carpenter Espresso", desc: "Billboard Hot" },
        { query: "Post Malone I Had Some Help", desc: "Billboard Hot" },
        { query: "Kendrick Lamar Not Like Us", desc: "Billboard Hot" },
        { query: "Chappell Roan Good Luck, Babe!", desc: "Billboard Hot" },
        { query: "Tommy Richman Million Dollar Baby", desc: "Billboard Hot" },
        { query: "Hozier Too Sweet", desc: "Billboard Hot" },
        { query: "Benson Boone Beautiful Things", desc: "Billboard Hot" },
        { query: "Teddy Swims Lose Control", desc: "Billboard Hot" },
        { query: "Future Metro Boomin Like That", desc: "Billboard Hot" },
        { query: "SZA Saturn", desc: "Billboard Hot" },
        { query: "Ariana Grande We Can't Be Friends", desc: "Billboard Hot" },
        { query: "Jack Harlow Lovin On Me", desc: "Billboard Hot" },
        { query: "Tate McRae Greedy", desc: "Billboard Hot" },
        { query: "Taylor Swift Fortnight", desc: "Billboard Hot" },
        { query: "Doja Cat Paint The Town Red", desc: "Billboard Hot" },
        { query: "Miley Cyrus Flowers", desc: "Billboard Hot" },
        { query: "Morgan Wallen Last Night", desc: "Billboard Hot" }
    ];

    // Randomize and select 4
    const shuffled = billboardPicks.sort(() => 0.5 - Math.random());
    const candidates = shuffled.slice(0, 4);

    billboardGrid.innerHTML = '';

    for (const pick of candidates) {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(pick.query)}&entity=song&limit=1`;
            const resp = await fetch(url);
            const data = await resp.json();

            if (data.results.length > 0) {
                const song = data.results[0];
                const card = document.createElement('div');
                card.className = 'gimbab-card';

                const highResArt = song.artworkUrl100.replace('100x100', '400x400');

                card.innerHTML = `
                    <div style="position:relative;">
                        <img src="${highResArt}" alt="${song.trackName}">
                        <div style="position:absolute; top:10px; left:10px; background:#1db954; color:white; padding:2px 8px; border-radius:10px; font-size:0.7rem; font-weight:bold;">Billboard Hot</div>
                    </div>
                    <div class="gimbab-title" title="${song.trackName}">${song.trackName}</div>
                    <div class="gimbab-artist">${song.artistName}</div>
                `;

                card.onclick = () => {
                    const ytmQuery = `${song.artistName} ${song.trackName}`;
                    const ytmLink = `https://music.youtube.com/search?q=${encodeURIComponent(ytmQuery)}`;
                    window.open(ytmLink, '_blank');
                };

                billboardGrid.appendChild(card);
            }
        } catch (e) {
            console.warn("Billboard Fetch Error", e);
        }
    }
}

// Album of the Month Logic
async function initAlbumOfTheMonth() {
    const monthGrid = document.getElementById('month-grid');
    if (!monthGrid) return;

    monthGrid.innerHTML = '<p style="color:#777; width:100%;">이달의 앨범을 불러오는 중... 📅</p>';

    // Scraped List from Gimbab Records (Album of the Month - Pages 1 to 4)
    const monthPicks = [
        // Page 1
        { query: "PVA No More Like This", desc: "Month Pick" },
        { query: "Ana Frango Eletrico Little Electric Chicken Heart", desc: "Month Pick" },
        { query: "Ana Frango Eletrico Me Chama De Gato Que Eu Sou Sua", desc: "Month Pick" },
        { query: "Cecil McBee Mutima", desc: "Month Pick" },
        { query: "Sunset Rollercoaster Quit Quietly", desc: "Month Pick" },
        { query: "Autechre Untilted", desc: "Month Pick" },
        { query: "Kiyoshi Sugimoto L.A.Master", desc: "Month Pick" },
        { query: "Alex G Headlights", desc: "Month Pick" },
        { query: "Aya Hexed", desc: "Month Pick" },
        { query: "Satellite Lovers Sons of 1973", desc: "Month Pick" },
        { query: "Erik Hall Solo Three", desc: "Month Pick" },
        { query: "The Suicide Diary El Pino", desc: "Month Pick" },
        { query: "Annahstasia Tether", desc: "Month Pick" },
        { query: "Nas DJ Premier Light Years", desc: "Month Pick" },
        { query: "Oklou Choke Enough", desc: "Month Pick" },
        { query: "Rosalia Lux", desc: "Month Pick" },
        { query: "The Roots The Roots Come Alive Too", desc: "Month Pick" },
        { query: "Samia Bloodless", desc: "Month Pick" },
        // Page 2
        { query: "Wolf Alice The Clearing", desc: "Month Pick" },
        { query: "New Rotary Connection Hey Love", desc: "Month Pick" },
        { query: "David Byrne Who Is The Sky", desc: "Month Pick" },
        { query: "Various Artists With Love Volume 3", desc: "Month Pick" },
        { query: "Billy Woods Today I Wrote Nothing", desc: "Month Pick" },
        { query: "Lorde Virgin", desc: "Month Pick" },
        { query: "Marcos Valle Contrasts", desc: "Month Pick" },
        { query: "Agustin Pereyra Lucena Puertos De Alternativa", desc: "Month Pick" },
        { query: "Kirinji Omnibus", desc: "Month Pick" },
        { query: "Hiroshi Yoshimura Flora", desc: "Month Pick" },
        { query: "Aron! Cozy You", desc: "Month Pick" },
        { query: "Terri Lyne Carrington We Insist 2025", desc: "Month Pick" },
        { query: "Goro Ito Tree Forests", desc: "Month Pick" },
        { query: "Billy Woods Golliwog", desc: "Month Pick" },
        { query: "Headnodic Jazz Mafia", desc: "Month Pick" },
        // Page 3
        { query: "Charli XCX Brat", desc: "Month Pick" },
        { query: "The Altons Heartache In Room 14", desc: "Month Pick" },
        { query: "Saya Gray Saya", desc: "Month Pick" },
        { query: "Ryo Fukui Trio at the Slowboat 2004", desc: "Month Pick" },
        { query: "Park Jiha All Living Things", desc: "Month Pick" },
        { query: "The Delines Mr Luck Ms Doom", desc: "Month Pick" },
        { query: "Kashmere Stage Band Out Of Gas", desc: "Month Pick" },
        { query: "Various Artists American Baroque", desc: "Month Pick" },
        { query: "Kim Oki Spirit Advance Team", desc: "Month Pick" },
        { query: "Lonnie Smith Drives", desc: "Month Pick" },
        { query: "Keziah Jones Alive & Kicking", desc: "Month Pick" },
        { query: "Dexter Wansel Time Is Slipping Away", desc: "Month Pick" },
        { query: "Bobby Caldwell What You Won't Do For Love", desc: "Month Pick" },
        { query: "Edison Machado Boa Nova", desc: "Month Pick" },
        // Page 4
        { query: "Meshell Ndegeocello No More Water", desc: "Month Pick" },
        { query: "Hiatus Kaiyote Love Heart Cheat Code", desc: "Month Pick" },
        { query: "Sabrina Carpenter Short n Sweet", desc: "Month Pick" },
        { query: "The Round Robin Monopoly Alpha", desc: "Month Pick" },
        { query: "Skip James Today!", desc: "Month Pick" },
        { query: "Ozean Ozean EP", desc: "Month Pick" },
        { query: "Milton Nascimento Esperanza Spalding", desc: "Month Pick" },
        { query: "Various Artists Jazz On The Corner Two", desc: "Month Pick" },
        { query: "Horii Katsumi Project Hot Is Cool", desc: "Month Pick" },
        { query: "Fontaines D.C. Romance", desc: "Month Pick" },
        { query: "Rodrigo Leao Cinema", desc: "Month Pick" },
        { query: "Clairo Charm", desc: "Month Pick" },
        { query: "beabadoobee This Is How Tomorrow Moves", desc: "Month Pick" },
        { query: "Al Hirt Soul In The Horn", desc: "Month Pick" },
        { query: "Little Ann Deep Shadows", desc: "Month Pick" }
    ];

    // Randomly select 12 candidates to ensure we get 4 valid ones
    const shuffled = monthPicks.sort(() => 0.5 - Math.random());
    const candidates = shuffled.slice(0, 12);

    monthGrid.innerHTML = ''; // Clear loading

    let validCount = 0;

    // Process in parallel for speed
    const promises = candidates.map(async (pick) => {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(pick.query)}&entity=album&limit=1`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.results.length > 0) {
                return data.results[0];
            }
        } catch (e) {
            console.warn("Month Pick Fetch Error", e);
        }
        return null;
    });

    const results = await Promise.all(promises);

    // Filter valid results and take first 4
    const validAlbums = results.filter(album => album !== null);
    const finalSelection = validAlbums.slice(0, 4);

    for (const album of finalSelection) {
        const card = document.createElement('div');
        card.className = 'gimbab-card';

        const highResArt = album.artworkUrl100.replace('100x100', '400x400');

        card.innerHTML = `
            <img src="${highResArt}" alt="${album.collectionName}">
            <div class="gimbab-title" title="${album.collectionName}">${album.collectionName}</div>
            <div class="gimbab-artist">${album.artistName}</div>
        `;

        // On Click: Open YouTube Music Search
        card.onclick = () => {
            const ytmQuery = `${album.artistName} ${album.collectionName}`;
            const ytmLink = `https://music.youtube.com/search?q=${encodeURIComponent(ytmQuery)}`;
            window.open(ytmLink, '_blank');
        };

        monthGrid.appendChild(card);
    }
}
