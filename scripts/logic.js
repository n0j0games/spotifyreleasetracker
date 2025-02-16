/**
 * Main Logic. Handles the algorithm
 * @class
 **/

import SpotifyAPI from "./api.js";
import keys from "../apikey.js";
import User from "./user.js";
import logger from "./logger.js";
import targetProxy from "./main.js";

const location_ = window.location.href.split("?")[0];
const api = new SpotifyAPI(keys.id, location_);
let user = null;
let artists = [];
let current_playlist = null;
let filters = {
    album: false,
    single: false,
    feature: false
}

/*
    AUTH/LOGIN/LOGOUT
*/

// Called from main, requests spotify authorization
const requiredversion = 130;

function auth() {
    localStorage.setItem("releasr_auth_version", requiredversion);
    api.requestAuthorization().then(url => window.location.href = url);
}

// Handles redirect from spotify login page
function handleRedirect() {
    api.handleRedirect(function () {
        window.history.pushState("", "", keys.uri);
    });
}

function getAccessToken() {
    return api.access_token;
}

function getTimespan() {
    return user.timespan;
}

function getActivePlaylist() {
    return user.active_playlist;
}

// Logs user out, removes access/refresh token from localstorage
function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    location.reload();
}

//let temp_data = null;

/* Login Step 1: Request user Info */
function login(onLogin) {
    const version = localStorage.getItem("releasr_auth_version");
    if (version === null || version < requiredversion) {
        localStorage.setItem("releasr_auth_version", requiredversion);
        logout();
        return;
    }

    api.call("GET", "user_profile", null, onLogin, logger.error, "Could not load user profile") //Calls Step 2

    /*api.call("GET", "user_profile", null, function(response) {
        temp_data = JSON.parse(response);
        pantry.call("GET", temp_data.id, onLogin, logger.error, "Could not load user profile");
    }, logger.error, "Could not load user profile") */
}

/* Login Step 2: Called after successful login procedure from main */
function onLogin(response) {
    /*let pantry_data = null;
    if (response != null) {
        pantry_data = JSON.parse(response);    
    }*/
    user = new User(JSON.parse(response), null);

    api.call("GET", "playlists", null, playlistCallback, logger.error, "Could not load your profile") //Calls Step 3

    return user.getProfile();
}

/* Login Step 3: Callback from playlists, loads user info */
function playlistCallback(response) {
    let list = []
    const data = JSON.parse(response).items;
    for (let x in data) {
        if (data[x].owner.id === user.id)
            list.push({name: data[x].name, id: data[x].id});
    }
    user.playlists = list;
    setCurrentPlaylist();
    loadReleasePlaylists();
    loadArtists(); //Calls Step 4
    targetProxy.settings = {
        timespan: user.timespan,
        market: user.market,
        active_playlist: user.active_playlist,
        advanced_filter: user.advanced_filter,
        sort_by: user.sort_by,
        not_save_doubles: user.not_save_doubles,
        playlists: user.playlists
    };
}

/*
    ARTIST SECTION
*/

/* Login Step 4: Loading Artists, after Playlist is set */
function loadArtists() {
    artists = user.artists;
    if (artists !== null) {
        if (artists.length === 0) {
            getSongsFromPlaylists();
        } else {
            artists = sortArtists(artists);
            targetProxy.artists = artists;
            refreshAlbums();
        }
    } else {
        artists = [];
        api.call("GET", "followed_artists", null, artistCallback,
            logger.error, "Could not load artists");
    }
}

/* Login Step 4: Loading List of Release-Playlists */
function loadReleasePlaylists() {
    const playlists = user.release_playlists;
    if (playlists !== null) {
        targetProxy.playlists = sortArtists(playlists);
    } else {
        targetProxy.playlists = [];
    }
}

/* Artist getter loop: Fetch artists from Spotify in batches of 50x */
let total = 0;

function artistCallback(response) {
    const data = JSON.parse(response);
    const items = data.artists.items;
    const limit = data.artists.limit;
    if (items.length !== 0) {
        if (total === 0) {
            total = data.artists.total;
            if (total < items.length) {
                console.warn("Total item count smaller than actual item count (Spotify Api Bug). Ignore this");
                total = items.length;
            }
            if (limit < total) {
                api.call("GET",
                    "followed_artists",
                    "&after=" + items[items.length - 1].id,
                    artistCallback,
                    logger.error,
                    "Could not load artists");
            }
        }

        // Update IDs of artists and add them to list
        for (let x in items) {
            const current = {
                id: items[x]["id"],
                name: items[x]["name"],
                image: items[x]["images"][0]["url"],
                active: true,
                following: true,
                added: true
            };
            let inList = false;
            for (let y in artists) {
                if (artists[y].id === current.id) {
                    if (!artists[y].following) {
                        artists[y].following = true;
                    }
                    inList = true;
                    break;
                }
            }
            if (!inList) {
                artists.push(current);
            }
        }
    }
    saveArtists();
}

// Called from frontend, adds artist
function addArtist(id) {
    api.call("GET", "artist_profile", id, onArtistFound, logger.error, "Artist not added")
}

// Callback if artist found by ID
function onArtistFound(response) {
    const data = JSON.parse(response);
    let image = null;
    if (data["images"].length !== 0) {
        image = data["images"][0]["url"];
    }
    const current = {id: data["id"], name: data["name"], image: image, active: true, following: false, added: true};
    insertArtist(current);
}

// Searching for artists via search query
function searchArtist(searchq) {
    searchq = searchq.trim();
    if (searchq.length === 0) {
        targetProxy.artists = artists;
        return;
    }
    if (searchq.toLowerCase().startsWith("http://") || searchq.toLowerCase().startsWith("https://")) {
        searchq = searchq.split("artist/")[1].split("?")[0];
        api.call("GET", "artist_profile", searchq, searchSingleArtist, logger.error, "Unknown link");
    } else {
        api.call("GET", "search_artist", searchq, searchArtistCallback, searchSingleArtistError, null);
    }
}

// Callback if single artist is loaded from url
function searchSingleArtist(response) {
    const data = JSON.parse(response);
    let image = null;
    if (data["images"].length !== 0) {
        image = data["images"][0]["url"];
    }
    const current = {id: data["id"], name: data["name"], image: image, active: true, following: false, added: false};
    let found = false;
    for (let x in artists) {
        if (artists[x].id === current.id) {
            found = true;
        }
    }
    let results = [...artists];
    if (!found) {
        results.push(current);
    }
    targetProxy.artists = results;
}

// Error callback if single artist is loaded from url
function searchSingleArtistError() {
    console.warn("Could not find artist via link");
    targetProxy.artists = artists;
}

// Callback of artist search NOT from url
function searchArtistCallback(response) {
    const data = JSON.parse(response);
    const item = data.artists.items;
    let search = [];
    for (let i = 0; i < Math.min(10, item.length); i++) {
        if (item[i].followers.total < 100) {
            continue;
        }
        if (item[i]["images"].length === 0) {
            search.push({
                id: item[i]["id"],
                name: item[i]["name"],
                image: null,
                active: false,
                following: false,
                added: false
            });
        } else {
            search.push({
                id: item[i]["id"],
                name: item[i]["name"],
                image: item[i]["images"][0]["url"],
                active: false,
                following: false,
                added: false
            });
        }
    }
    let results = [...artists];
    for (let i in search) {
        let found = false;
        for (let x in artists) {
            if (artists[x].id === search[i].id) {
                found = true;
            }
        }
        if (!found) {
            results.push(search[i]);
        }
    }
    targetProxy.artists = results;
}

// Insert artist
function insertArtist(current) {
    for (let x in artists) {
        if (artists[x].id === current.id) {
            return;
        }
    }
    artists.unshift(current);
    saveArtists();
}

// Save to localstorage, call proxy
function saveArtists() {
    user.artists = artists;
    targetProxy.artists = sortArtists(artists);
    refreshAlbums();
}

// Hide artist, called from frontend
function hideArtist(nr) {
    artists[nr].active = !artists[nr].active;
    saveArtists();

}

// Remove artist, called from frontend
function removeArtist(nr) {
    for (let k in artists) {
        if (artists[nr].name === artists[k].name)
            artists.splice(nr, 1);
    }
    saveArtists();
}

// Sync artists with spotify, called from frontend
function syncArtists() {
    let temp = [];
    for (let k in artists) {
        if (!artists[k].following)
            temp.push(artists[k]);
    }
    artists = temp;
    total = 0;
    api.call("GET", "followed_artists", null, artistCallback,
        logger.error, "Could not load artists");
}

// Returns a list of active artists
function getActiveArtists() {
    let c = 0
    for (let x in artists) {
        if (artists[x].active) {
            c++;
        }
    }
    return c;
}

// Returns the amount of release-playlists
function getReleasePlaylistCount() {
    return user.release_playlists.length;
}

// Sorts artists, also used for release-playlists
function sortArtists(temp) {
    temp.sort((a, b) => a.name.localeCompare(b.name));
    return temp;
}

/*
    RELEASE-PLAYLISTS SECTION
*/

// Search for playlists via search query
function searchPlaylist(searchq) {
    searchq = searchq.trim();
    if (searchq.length === 0) {
        targetProxy.playlists = user.release_playlists;
        return;
    }
    api.call("GET", "search_playlist", searchq, searchPlaylistCallback, logger.error, "Error while loading playlists");
}

// Callback after search for playlists
function searchPlaylistCallback(response) {
    const release_playlists = user.release_playlists;
    const data = JSON.parse(response);
    const item = data.playlists.items;
    let search = [];
    for (let i = 0; i < Math.min(10, item.length); i++) {
        if (item[i]["images"].length === 0) {
            search.push({
                id: item[i]["id"],
                name: item[i]["name"],
                image: null,
                owner: item[i]["owner"]["display_name"],
                added: false
            });
        } else {
            search.push({
                id: item[i]["id"],
                name: item[i]["name"],
                image: item[i]["images"][0]["url"],
                owner: item[i]["owner"]["display_name"],
                added: false
            });
        }

    }
    let results = [...release_playlists];
    for (let i in search) {
        let found = false;
        for (let x in release_playlists) {
            if (release_playlists[x].id === search[i].id) {
                found = true;
            }
        }
        if (!found) {
            results.push(search[i]);
        }
    }
    targetProxy.playlists = results;
}

// Adds certein playlist to list of release playlists
function addPlaylist(id) {
    api.call("GET", "playlist", id, onPlaylistFound, logger.error, "Playlist not added")
}

// Callback if playlist found by ID
function onPlaylistFound(response) {
    const data = JSON.parse(response);
    let image = null;
    if (data["images"].length !== 0) {
        image = data["images"][0]["url"];
    }
    const current = {
        id: data["id"],
        name: data["name"],
        image: image,
        owner: data["owner"]["display_name"],
        added: true
    };
    insertPlaylist(current);
}

// Insert playlist
function insertPlaylist(current) {
    const playlists = user.release_playlists;
    for (let x in playlists) {
        if (playlists[x].id === current.id) {
            return;
        }
    }
    playlists.unshift(current);
    saveReleasePlaylists(playlists);
}

// Save to localstorage, call proxy
function saveReleasePlaylists(playlists) {
    user.release_playlists = playlists;
    targetProxy.playlists = playlists;
    refreshAlbums();
}

function removePlaylist(nr) {
    const playlists = user.release_playlists;
    for (let k in playlists) {
        if (playlists[nr].name === playlists[k].name)
            playlists.splice(nr, 1);
    }
    saveReleasePlaylists(playlists);
}

/*
    ALBUM SECTION
*/

let results = [];
let total_ = 0;
let song_total_ = 0;

// Refresh Albums, called after artists window closed and after first artist load
function refreshAlbums() {
    results = [];
    if (artists.size === 0) {
        getSongsFromPlaylists();
        return
    }

    total_ = 0
    song_total_ = 0;

    let active_artists = [];
    for (let x in artists) {
        if (artists[x].active) {
            total_++;
            active_artists.push(artists[x]);
        }
    }
    if (total_ === 0) {
        getSongsFromPlaylists();
        return;
    }

    // !: Hotfix to supress content-caching, adds unused date tag to url
    const date = new Date().getDate();

    for (let x in active_artists) {
        const param = `${active_artists[x].id}/albums?limit=50&include_groups=album,single&date=${date}`;
        api.call("GET", "artist", param, albumCallback, logger.error, "Could not load albums for artist")
    }
}

function albumCallback(response) {
    //const searched_artist = JSON.parse(response).href.split("/")[5];
    const items = JSON.parse(response).items;
    for (let x in items) {
        const item = items[x];
        let album = getAlbum(item, "");
        if (album !== null) {
            song_total_++;
            api.call("GET", "album_tracks", `${album.id}/tracks?offset=0&limit=50`, function (response_) {
                getSongsCallback(response_, album);
            }, logger.error, "Could not save songs");
        }
    }
    total_--;
    if (total_ === 0) {
        //results = sortResults(results);
        //filterAlbums();
        getSongsFromPlaylists();
    }
}

// Gets album from album item
function getAlbum(item, playlist) {
    let album = {
        id: item.external_urls.spotify.split("/")[4],
        title: item.name,
        artist: item.artists[0].name,
        type: item.album_type,
        href: item.external_urls.spotify,
        image: item.images[0].url,
        artists_list: [],
        real_date: item.release_date,
        release_date: item.release_date,
        tracks: item.total_tracks,
        markets: item.available_markets,
        isfeature: true,
        show: true,
        shown_in: playlist,
        songs: [],
        explicit: false,
        dummy: 0
    }
    for (const y in item.artists) {
        album.artists_list.push(item.artists[y].name);
    }
    let fromVariousArtists = false;
    for (const z in album.artists_list) {
        if (album.artists_list[z]["id"] === "0LyfQWJT6nXafLPZqxe9Of")
            fromVariousArtists = true;
    }
    for (const y in artists) {
        const temp = artists[y].name;
        if (album.artist.toLowerCase() === temp.toLowerCase()) {
            album.isfeature = false;
            break;
        }
    }
    const dateArray = album.release_date.split('-');
    album.release_date = new Date(dateArray[0], dateArray[1] - 1, dateArray[2]);
    const intimespan = inTimeSpan(album.release_date);
    const passFilter = matchesFilter(album.title);
    if (intimespan && passFilter && !fromVariousArtists) {
        return album;
    }
    return null;
}

// Add songs from release-playlists
function getSongsFromPlaylists() {
    const playlists = user.release_playlists;

    if (playlists.length === 0) {
        filterAlbums();
        return;
    }

    for (let x in playlists) {
        api.call("GET", "playlist", `${playlists[x].id}/tracks?limit=50`, function (response) {
            getPlaylistSongsCallback(response, playlists[x].name);
        }, logger.error, "Could not load songs from playlist");
    }
}

// Callback after loading songs from release-playlists
function getPlaylistSongsCallback(response, name) {
    let items = JSON.parse(response);
    let found = false;
    for (let x in items.items) {
        if (items.items[x].track === null) {
            continue;
        }
        let item = items.items[x].track.album;
        let album = getAlbum(item, name);
        if (album !== null) {
            found = true;
            song_total_++;
            api.call("GET", "album_tracks", `${album.id}/tracks?offset=0&limit=50`, function (response) {
                getSongsCallback(response, album);
            }, logger.error, "Could not save songs");
        }
    }
    if (found === false) {
        filterAlbums();
    }
}

// Callback after loading songs from album, adds songs to results
function getSongsCallback(response, album) {
    const data = JSON.parse(response);
    const items = data.items;
    let songs = [];
    let explicit = false;
    for (let x in items) {
        if (items[x].explicit) {
            explicit = true;
        }
        let artists = [];
        for (let y in items[x].artists) {
            artists.push(items[x].artists[y].name);
        }
        if (matchesFilter(items[x].name)) {
            songs.push({"name": items[x].name, "artists": artists, "id": items[x].id});
        }
    }
    album.songs = songs;
    album.tracks = songs.length;
    album.explicit = explicit;

    if (album.tracks === 1) {
        let artists_ = album.songs[0].artists;
        for (let x in artists_) {
            let found = false;
            for (let y in album.artists_list) {
                if (album.artists_list[y] === artists_[x]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                album.artists_list.push(artists_[x]);
            }
        }
    }

    let duplicate = false;
    let duplicate_explicit = false;
    for (const y in results) {
        const title_ = results[y].album.title;
        const artist_ = results[y].album.artist;
        if (album.title === title_ && album.artist === artist_) {
            duplicate = true;
            duplicate_explicit = results[y].album.explicit;
            if (!duplicate_explicit && album.explicit) {
                results.splice(y, 1);
            }
            break;
        }
    }
    if (!duplicate || (duplicate && !duplicate_explicit && album.explicit)) {
        results.push({album});
        results = sortResults(results);
    }
    song_total_--;
    filterAlbums();
}

/* sort by date & main artist */
function sortResults(temp) {
    const sort_by = user.sort_by;
    if (sort_by === "release_date") {
        temp.sort((a, b) => a.album.shown_in.localeCompare(b.album.shown_in));
        temp.sort((a, b) => a.album.artist.localeCompare(b.album.artist));
        temp.sort((a, b) => b.album.release_date.getTime() - a.album.release_date.getTime());
    } else if (sort_by === "alphabetical") {
        temp.sort((a, b) => a.album.shown_in.localeCompare(b.album.shown_in));
        temp.sort((a, b) => b.album.release_date.getTime() - a.album.release_date.getTime());
        temp.sort((a, b) => a.album.artist.localeCompare(b.album.artist));
    } else if (sort_by === "playlist") {
        temp.sort((a, b) => a.album.artist.localeCompare(b.album.artist));
        temp.sort((a, b) => b.album.release_date.getTime() - a.album.release_date.getTime());
        temp.sort((a, b) => a.album.shown_in.localeCompare(b.album.shown_in));
    } else {
        logger.error("Could not sort albums", "Unknown sort_by value");
    }

    return temp;
}

// Check if release is in timespan
function inTimeSpan(date) {
    if (user.timespan === -1) {
        return true;
    }
    const now = new Date().getTime();
    let diff = Math.abs(now - date.getTime());
    diff = diff / (1000 * 60 * 60 * 24);
    return (diff <= user.timespan)
}

// Check if string matches filter
function matchesFilter(string) {
    if (!user.advanced_filter) {
        return true;
    }
    string = string.toLowerCase();
    return !(string.includes("acapella")
        || string.includes("a capella")
        || string.includes("a cappella")
        || string.includes("acappella")
        || string.includes("instrumental")
        || string.includes("slowed")
        || string.includes("night core")
        || string.includes("nightcore")
        || string.includes("sped up"));
}

/* toggles the specific filters, call via main */
function toggleFilters(album, single, feature) {

    if (feature) {
        filters.feature = !filters.feature;
    }
    if (album) {
        if (filters.album) {
            filters.album = false;
        } else {
            filters.album = true;
            filters.single = false;
        }
    }
    if (single) {
        if (filters.single) {
            filters.single = false;
        } else {
            filters.single = true;
            filters.album = false;
        }
    }

    targetProxy.filters = filters;
    filterAlbums();
}

/* filters each album and sends them back to main, also removes duplicates */
function filterAlbums() {
    if (song_total_ !== 0) {
        return;
    }
    removeDuplicates(results);

    for (let x in results) {
        if (filters.feature && results[x].album.isfeature) {
            results[x].album.show = false;
        } else if (filters.single && !(results[x].album.type === "single")) {
            results[x].album.show = false;
        } else results[x].album.show = !(filters.album && !(results[x].album.type === "album"));
    }
    targetProxy.albums = results;
}

// Removes duplicates from results
function removeDuplicates(temp) {
    for (let i = 0; i < temp.length; i++) {
        for (let j = i + 1; j < temp.length; j++) {
            if (temp[i].album.id === temp[j].album.id) {
                temp.splice(i, 1);
                i--;
            }
        }
    }
}

/*
    SETTINGS SECTION
*/

/* Change which current playlist is selected, called at start and if changed in settings */
function setCurrentPlaylist() {
    const saved_playlists = user.saved_playlists;
    if (user.saved_playlists === undefined) {
        user.saved_playlists = [];
    }
    for (let i in saved_playlists) {
        if (saved_playlists[i].name === user.active_playlist) {
            current_playlist = saved_playlists[i];
            break;
        }
    }
    if (current_playlist === null && user.active_playlist !== "none") {
        current_playlist = {"name": user.active_playlist, "items": []};
        let temp_ = user.saved_playlists;
        temp_.push(current_playlist);
        user.saved_playlists = temp_;
    }
}

/* called if settings change */
function saveSettings(time, market, active_playlist, advanced_filter, not_save_doubles, sort_by) {
    if (active_playlist != null) {
        user.active_playlist = active_playlist;
        setCurrentPlaylist();
    }
    if (time !== null) {
        if (isNaN(time) || time < 0 || time > 90) {
            logger.error("Could not save settings", "Input is not a number")
        } else {
            user.timespan = time;
        }
    }
    if (market !== null) {
        user.market = market;
    }
    if (advanced_filter !== null) {
        user.advanced_filter = advanced_filter;
    }
    if (not_save_doubles !== null) {
        user.not_save_doubles = not_save_doubles;
    }
    if (sort_by !== null) {
        user.sort_by = sort_by;
    }
    location.reload()
}

// Import data, called from frontend
function importData(value) {
    try {
        const data = JSON.parse(value);
        user.importUser(data);
        location.reload();
    } catch (e) {
        logger.error("Could not load user", "The entered data is not in JSON format")
    }
}

// Export data, called from frontend
async function exportData() {
    try {
        await navigator.clipboard.writeText(JSON.stringify((user.exportUser())));
        logger.log('Copied to clipbard', "You can now save the clipboard into a file and paste it back in the settings to restore your data later")
    } catch (err) {
        logger.error('Failed to copy data', err)
    }
}

// Reset artists, called from frontend
function deleteData() {
    localStorage.removeItem("user_" + user.id);
    logout();
    //pantry.call("DELETE", user.id, logout, logger.error, "Could not delete user from pantry");
}

/*
    SAVE ALBUM/SONGS SECTION
*/

function albumIsSaved(album) {
    if (current_playlist === null || current_playlist.name === "none") {
        return false;
    }
    return current_playlist.items.includes(album);
}

let temp_album = null;

function saveAlbum(album, isSingle) {
    temp_album = album;
    if (current_playlist === null || current_playlist.name === "none") {
        logger.log("Could not save song", "You have selected 'None' as your playlist, therefore the song could not be saved. Please select a playlist in the settings");
        return;
    }
    const items = current_playlist.items;
    if (items.includes(album)) {
        console.warn("Wanted to save album even though its already saved");
        return;
    }
    current_playlist.items.push(album);
    if (current_playlist.items.length > 100) {
        console.warn("Only storing up to 100 Albums in playlist, removing oldest");
        current_playlist.items.shift();
    }
    user.replaceSavedPlaylist(current_playlist);
    let limit = 50;
    if (user.not_save_doubles && isSingle) {
        limit = 1;
    }
    api.call("GET", "album_tracks", `${album}/tracks?offset=0&limit=${limit}`, saveSongsFromAlbum, logger.error, "Could not save songs");
}

function saveSongsFromAlbum(response) {
    let songs = [];
    const data = JSON.parse(response);
    if (data.items.length === 0) {
        console.error("Empty album");
        return;
    }
    if (current_playlist.name === "your_library") {
        for (let i in data.items) {
            if (matchesFilter(data.items[i].name)) {
                songs.push(data.items[i].id);
            }
        }
        api.call("PUT", "save_to_library", "?ids=" + songs.join(','), saveToLibraryCallBack, logger.error, "Could not save song");
    } else {
        for (let i in data.items) {
            if (matchesFilter(data.items[i].name)) {
                songs.push("spotify:track:" + data.items[i].id);
            }
        }
        const body = {"uris": songs};
        api.call("POST", "add_to_playlist", current_playlist.name + "/tracks", saveToLibraryCallBack, logger.error, "Could not save song", body)
    }
}

function saveToLibraryCallBack(_) {
    if (temp_album === null) {
        console.error("Album is null in savetolibrarycallback");
        return;
    }
    logger.log("Saved songs", "Successfully saved songs to your library/playlist");
    targetProxy.saved = temp_album;
    temp_album = null;
}


export default {
    getActiveArtists,
    getTimespan,
    refreshAlbums,
    exportData,
    saveSettings,
    removeArtist,
    hideArtist,
    syncArtists,
    deleteData,
    importData,
    addArtist,
    auth,
    onLogin,
    handleRedirect,
    login,
    logout,
    getAccessToken,
    saveAlbum,
    getActivePlaylist,
    albumIsSaved,
    toggleFilters,
    searchArtist,
    searchPlaylist,
    addPlaylist,
    removePlaylist,
    getReleasePlaylistCount,
}